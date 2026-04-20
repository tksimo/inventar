"""Recipe CRUD router (Phase 5, Plan 02).

Endpoints in this plan:
  - GET    /api/recipes/         list[RecipeListItem]
  - POST   /api/recipes/         create manual recipe (RECP-01)
  - GET    /api/recipes/{id}     detail
  - PATCH  /api/recipes/{id}     update
  - DELETE /api/recipes/{id}     delete (cascades ingredients)
  - POST   /api/recipes/import-url  JSON-LD fetch + parse (RECP-02, Task 2)

Plan 03 appends:
  - GET  /api/recipes/{id}/check        ingredient-vs-inventory status
  - POST /api/recipes/{id}/add-missing  append missing items to shopping list
  - POST /api/recipes/{id}/cook         deduct and write Transaction

Auto-suggest (D-02, D-07):
  When creating or importing a recipe, any ingredient with item_id=None is
  tested against the inventory by case-insensitive substring match. If EXACTLY
  ONE non-archived item matches, its id is stored on the ingredient. Zero or
  multiple matches leaves item_id=None -- the frontend shows a pill the user
  can tap to accept/change (Plan 05 UI).

Threat mitigations:
  - T-05-01 / T-05-06 (Tampering): Pydantic `extra='forbid'` + Field bounds on
    all request bodies; enforced at schema parse.
  - T-05-03 (Tampering): ingredient item_id existence NOT enforced -- the ORM
    accepts any int and SET NULL is applied if the target is later deleted.
    Acceptable household-scale constraint; documented here.
  - SQLi: ORM access only; the ilike filter uses a parameterized like() with
    wildcards escaped via a helper. No `text()` interpolation.
"""
from __future__ import annotations

import ipaddress
import json
import re
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, Recipe, RecipeIngredient, ShoppingListEntry, QuantityMode, StockStatus, Transaction
from schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeListItem,
    RecipeIngredientIn,
    RecipeIngredientResponse,
    RecipeImportUrlBody,
    IngredientCheckItem,
    IngredientCheckResponse,
    RecipeCookIngredient,
    RecipeCookBody,
)

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _escape_like(raw: str) -> str:
    """Escape SQL LIKE wildcards. Use with .like(..., escape='\\\\')."""
    return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def auto_suggest_item_id(
    db: Session,
    ingredient_name: str,
    existing_item_id: Optional[int],
) -> Optional[int]:
    """D-02 / D-07: case-insensitive substring match; return item_id or None.

    If the user explicitly passed item_id, honor it (do NOT override).
    """
    if existing_item_id is not None:
        return existing_item_id
    name = (ingredient_name or "").strip()
    if not name:
        return None
    pattern = f"%{_escape_like(name).lower()}%"
    rows = (
        db.query(Item)
        .filter(Item.archived == False)  # noqa: E712
        .filter(func.lower(Item.name).like(pattern, escape="\\"))
        .limit(2)
        .all()
    )
    # Only auto-link when exactly one candidate exists -- avoid ambiguous picks.
    if len(rows) == 1:
        return rows[0].id
    return None


def _apply_ingredients(db: Session, recipe: Recipe, ingredients: List[RecipeIngredientIn]) -> None:
    """Replace recipe.ingredients with the supplied list, applying auto-suggest."""
    # Delete existing via ORM (relationship cascade removes them on flush).
    for existing in list(recipe.ingredients):
        db.delete(existing)
    db.flush()

    for idx, ing in enumerate(ingredients):
        resolved_item_id = auto_suggest_item_id(db, ing.name, ing.item_id)
        row = RecipeIngredient(
            recipe_id=recipe.id,
            name=ing.name,
            quantity=ing.quantity,
            unit=ing.unit,
            item_id=resolved_item_id,
            sort_order=idx,
        )
        db.add(row)


def _list_item(recipe: Recipe) -> RecipeListItem:
    return RecipeListItem(
        id=recipe.id,
        name=recipe.name,
        source_url=recipe.source_url,
        ingredient_count=len(recipe.ingredients),
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[RecipeListItem])
def list_recipes(db: Session = Depends(get_db)) -> List[RecipeListItem]:
    """RECP-01: list all recipes with ingredient count."""
    recipes = db.query(Recipe).order_by(Recipe.name).all()
    return [_list_item(r) for r in recipes]


@router.post("/", response_model=RecipeResponse, status_code=201)
def create_recipe(
    body: RecipeCreate,
    db: Session = Depends(get_db),
) -> RecipeResponse:
    """RECP-01: create a new recipe with optional ingredients (auto-suggest item_id per D-02)."""
    recipe = Recipe(
        name=body.name,
        instructions=body.instructions,
        source_url=body.source_url,
    )
    db.add(recipe)
    db.flush()  # get recipe.id

    for idx, ing in enumerate(body.ingredients):
        resolved_item_id = auto_suggest_item_id(db, ing.name, ing.item_id)
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                name=ing.name,
                quantity=ing.quantity,
                unit=ing.unit,
                item_id=resolved_item_id,
                sort_order=idx,
            )
        )

    db.commit()
    db.refresh(recipe)
    return RecipeResponse.model_validate(recipe)


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)) -> RecipeResponse:
    """RECP-01: get full recipe detail with ingredients."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeResponse.model_validate(recipe)


@router.patch("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    db: Session = Depends(get_db),
) -> RecipeResponse:
    """RECP-01: update a recipe. `ingredients` (if set) REPLACES the full list."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        recipe.name = data["name"]
    if "instructions" in data:
        recipe.instructions = data["instructions"]
    if "source_url" in data:
        recipe.source_url = data["source_url"]

    if "ingredients" in data and data["ingredients"] is not None:
        _apply_ingredients(db, recipe, body.ingredients or [])

    db.commit()
    db.refresh(recipe)
    return RecipeResponse.model_validate(recipe)


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)) -> dict:
    """RECP-01: delete a recipe. Cascade removes ingredients (ON DELETE CASCADE)."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# URL import (RECP-02 -- D-04, D-05, D-06)
# ---------------------------------------------------------------------------


IMPORT_TIMEOUT_SECONDS = 10.0
IMPORT_USER_AGENT = "Inventar/0.1 (home-assistant-addon)"

_JSON_LD_BLOCK_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)
_TITLE_RE = re.compile(r'<title[^>]*>(.*?)</title>', re.DOTALL | re.IGNORECASE)

# Parse "250g Mehl", "2 Eier", "1 TL Salz", "1/2 tsp sugar"
_AMOUNT_RE = re.compile(
    r'^\s*(?P<qty>\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?)\s*(?P<unit>[A-Za-zÄÖÜäöüß]{1,5}\.?)?\s+(?P<name>.+?)\s*$',
    re.UNICODE,
)


def _validate_url(url: str) -> None:
    """T-05-05: reject non-http schemes and literal private IPs."""
    if not url or not url.strip():
        raise HTTPException(status_code=422, detail="URL is required")
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=422, detail="URL must be http or https")
    if not parsed.hostname:
        raise HTTPException(status_code=422, detail="URL is missing a host")
    # Literal-IP SSRF guard. DNS-based SSRF is documented as accepted risk.
    try:
        ip = ipaddress.ip_address(parsed.hostname)
    except ValueError:
        ip = None
    if ip is not None and (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved):
        raise HTTPException(status_code=422, detail="Private hosts are not allowed")


def _extract_recipe_json_ld(html: str) -> Optional[dict]:
    """Find the first JSON-LD block that is (or contains) a Schema.org Recipe.

    Handles three shapes (RESEARCH.md Pitfall 1):
      1. Top-level object with @type == "Recipe"
      2. Top-level list -- scan for an object with @type == "Recipe"
      3. @graph-wrapped -- scan graph list for Recipe
    """
    for match in _JSON_LD_BLOCK_RE.finditer(html):
        raw = match.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue

        candidates: list = []
        if isinstance(data, list):
            candidates = data
        elif isinstance(data, dict):
            if isinstance(data.get("@graph"), list):
                candidates = data["@graph"]
            else:
                candidates = [data]

        for node in candidates:
            if not isinstance(node, dict):
                continue
            node_type = node.get("@type")
            type_str = (
                " ".join(node_type)
                if isinstance(node_type, list)
                else str(node_type or "")
            )
            if "Recipe" in type_str:
                return node
    return None


def _extract_page_title(html: str) -> Optional[str]:
    m = _TITLE_RE.search(html)
    if not m:
        return None
    title = m.group(1).strip()
    return title or None


def _parse_ingredient_string(raw: str) -> dict:
    """Parse "250g Mehl" -> {name: "Mehl", quantity: 250.0, unit: "g"}."""
    if not raw:
        return {"name": "", "quantity": None, "unit": None}
    raw_stripped = raw.strip()
    m = _AMOUNT_RE.match(raw_stripped)
    if not m:
        return {"name": raw_stripped, "quantity": None, "unit": None}
    qty_str = m.group("qty").replace(",", ".").replace(" ", "")
    # Handle fractions like "1/2"
    if "/" in qty_str:
        num_str, _, den_str = qty_str.partition("/")
        try:
            num = float(num_str)
            den = float(den_str)
            quantity = num / den if den != 0 else None
        except ValueError:
            quantity = None
    else:
        try:
            quantity = float(qty_str)
        except ValueError:
            quantity = None
    if quantity is None:
        return {"name": raw_stripped, "quantity": None, "unit": None}

    unit = m.group("unit")
    if unit:
        unit = unit.strip().rstrip(".")
        if any(ch.isdigit() for ch in unit) or len(unit) > 5:
            unit = None
    name = m.group("name").strip()
    if not name:
        return {"name": raw_stripped, "quantity": None, "unit": None}
    return {"name": name, "quantity": quantity, "unit": unit or None}


def _parse_ingredient_node(node) -> dict:
    """recipeIngredient[] may be a string OR a HowToSupply-like dict."""
    if isinstance(node, str):
        return _parse_ingredient_string(node)
    if isinstance(node, dict):
        name = (node.get("name") or node.get("ingredient") or "").strip()
        qty_raw = node.get("requiredQuantity") or node.get("amount") or node.get("quantity")
        if isinstance(qty_raw, str):
            parsed = _parse_ingredient_string(f"{qty_raw} {name}")
            if parsed["name"]:
                return parsed
        return {"name": name or str(node), "quantity": None, "unit": None}
    return {"name": str(node), "quantity": None, "unit": None}


def _join_instructions(node) -> Optional[str]:
    """recipeInstructions may be a string, list[str], or list[dict{text}]."""
    if node is None:
        return None
    if isinstance(node, str):
        return node.strip() or None
    if isinstance(node, list):
        parts: list[str] = []
        for step in node:
            if isinstance(step, str):
                parts.append(step.strip())
            elif isinstance(step, dict):
                text = step.get("text") or step.get("name")
                if isinstance(text, str):
                    parts.append(text.strip())
        joined = "\n".join(p for p in parts if p)
        return joined or None
    return None


def _fallback_response(page_title: Optional[str], url: str) -> RecipeResponse:
    now = datetime.utcnow()
    return RecipeResponse(
        id=0,
        name=(page_title.strip() if page_title else "Imported recipe"),
        instructions=None,
        source_url=url,
        created_at=now,
        updated_at=now,
        ingredients=[],
    )


@router.post("/import-url", response_model=RecipeResponse)
async def import_recipe_from_url(body: RecipeImportUrlBody) -> RecipeResponse:
    """RECP-02: fetch a URL, extract JSON-LD Recipe, return a RecipeResponse-shaped preview.

    This endpoint does NOT persist the recipe. The frontend receives the parsed
    data, opens RecipeForm pre-filled, and the user hits Save which triggers
    POST /api/recipes/ (which persists + runs auto-suggest).
    """
    _validate_url(body.url)

    html: Optional[str] = None
    try:
        async with httpx.AsyncClient(
            timeout=IMPORT_TIMEOUT_SECONDS,
            follow_redirects=True,
        ) as http:
            resp = await http.get(body.url, headers={"User-Agent": IMPORT_USER_AGENT})
        if resp.status_code == 200:
            html = resp.text
    except Exception:
        # Network/timeout/TLS error -- fall back to manual entry (D-06).
        html = None

    if html is None:
        return _fallback_response(None, body.url)

    recipe_node = _extract_recipe_json_ld(html)
    if recipe_node is None:
        page_title = _extract_page_title(html)
        return _fallback_response(page_title, body.url)

    name = (recipe_node.get("name") or _extract_page_title(html) or "Imported recipe").strip()
    instructions = _join_instructions(recipe_node.get("recipeInstructions"))

    ingredients_raw = recipe_node.get("recipeIngredient") or []
    if not isinstance(ingredients_raw, list):
        ingredients_raw = [ingredients_raw]

    parsed_ingredients: list[RecipeIngredientResponse] = []
    for idx, node in enumerate(ingredients_raw):
        parsed = _parse_ingredient_node(node)
        if not parsed["name"]:
            continue
        parsed_ingredients.append(
            RecipeIngredientResponse(
                id=0,  # sentinel -- not yet persisted
                name=parsed["name"],
                quantity=parsed["quantity"],
                unit=parsed["unit"],
                item_id=None,
                sort_order=idx,
            )
        )

    now = datetime.utcnow()
    return RecipeResponse(
        id=0,  # sentinel -- this is a preview; POST /api/recipes/ persists it
        name=name,
        instructions=instructions,
        source_url=body.url,
        created_at=now,
        updated_at=now,
        ingredients=parsed_ingredients,
    )


# ---------------------------------------------------------------------------
# Ingredient check + add-missing-to-shopping-list (RECP-03, RECP-04)
# ---------------------------------------------------------------------------


def _find_matched_item(db: Session, item_id: Optional[int], name: str) -> Optional[Item]:
    """Resolve ingredient -> Item. Prefer explicit item_id; fall back to name match."""
    if item_id is not None:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is not None and not item.archived:
            return item
        # Archived or gone -- no match.
        return None
    if not name:
        return None
    pattern = f"%{_escape_like(name).lower()}%"
    row = (
        db.query(Item)
        .filter(Item.archived == False)  # noqa: E712
        .filter(func.lower(Item.name).like(pattern, escape="\\"))
        .order_by(Item.name)
        .first()
    )
    return row


def _classify_ingredient(db: Session, ingredient: RecipeIngredient) -> IngredientCheckItem:
    """Return an IngredientCheckItem for a single recipe ingredient (D-08, D-09)."""
    matched = _find_matched_item(db, ingredient.item_id, ingredient.name)

    if matched is None:
        return IngredientCheckItem(
            ingredient_id=ingredient.id,
            name=ingredient.name,
            quantity=ingredient.quantity,
            unit=ingredient.unit,
            item_id=None,
            matched_item_name=None,
            status="missing",
            unit_mismatch=False,
        )

    unit_mismatch = False
    if matched.quantity_mode == QuantityMode.STATUS:
        if matched.status == StockStatus.HAVE:
            status = "have"
        elif matched.status == StockStatus.LOW:
            status = "low"
        else:  # OUT or None
            status = "missing"
        if ingredient.unit:
            unit_mismatch = True
    else:
        # EXACT mode
        available = matched.quantity or 0
        if ingredient.quantity is None:
            status = "have" if available > 0 else "missing"
        else:
            status = "have" if available >= ingredient.quantity else "low"

        if ingredient.unit:
            # Inventory has no unit field; any recipe-side unit is a mismatch.
            unit_mismatch = True
            if status == "have":
                status = "low"  # Pitfall 7 -- downgrade so user verifies manually.

    return IngredientCheckItem(
        ingredient_id=ingredient.id,
        name=ingredient.name,
        quantity=ingredient.quantity,
        unit=ingredient.unit,
        item_id=matched.id,
        matched_item_name=matched.name,
        status=status,
        unit_mismatch=unit_mismatch,
    )


@router.get("/{recipe_id}/check", response_model=IngredientCheckResponse)
def check_ingredients(
    recipe_id: int,
    db: Session = Depends(get_db),
) -> IngredientCheckResponse:
    """RECP-03: per-ingredient availability check (D-07, D-08, D-09)."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    items = [_classify_ingredient(db, ing) for ing in recipe.ingredients]
    missing_count = sum(1 for i in items if i.status in ("missing", "low"))
    return IngredientCheckResponse(
        recipe_id=recipe.id,
        ingredients=items,
        missing_count=missing_count,
    )


def _next_sort_order(db: Session) -> int:
    max_sort = db.query(func.max(ShoppingListEntry.sort_order)).scalar()
    return (max_sort or 0) + 1


@router.post("/{recipe_id}/add-missing")
def add_missing_to_shopping_list(
    recipe_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """RECP-04: add every 'missing'/'low' ingredient to shopping_list (D-10).

    Linked (item_id) -> new ShoppingListEntry(item_id=..., free_text=None).
    Unlinked        -> new ShoppingListEntry(item_id=None, free_text=ingredient.name).
    Duplicates skipped (same item_id OR same free_text already on list).
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    added = 0
    skipped = 0

    for ingredient in recipe.ingredients:
        classified = _classify_ingredient(db, ingredient)
        if classified.status not in ("missing", "low"):
            continue  # 'have' -- nothing to buy

        if classified.item_id is not None:
            # Linked ingredient -- dedupe against existing item_id
            existing = (
                db.query(ShoppingListEntry)
                .filter(ShoppingListEntry.item_id == classified.item_id)
                .first()
            )
            if existing is not None:
                skipped += 1
                continue
            entry = ShoppingListEntry(
                item_id=classified.item_id,
                added_manually=True,
                sort_order=_next_sort_order(db),
                free_text=None,
            )
            db.add(entry)
            db.flush()  # so _next_sort_order on the next iteration sees this row
            added += 1
        else:
            # Unlinked ingredient -- dedupe against existing free_text (case-insensitive)
            name = (ingredient.name or "").strip()
            if not name:
                skipped += 1
                continue
            existing = (
                db.query(ShoppingListEntry)
                .filter(func.lower(ShoppingListEntry.free_text) == name.lower())
                .first()
            )
            if existing is not None:
                skipped += 1
                continue
            entry = ShoppingListEntry(
                item_id=None,
                added_manually=True,
                sort_order=_next_sort_order(db),
                free_text=name,
            )
            db.add(entry)
            db.flush()
            added += 1

    db.commit()
    return {"added": added, "skipped": skipped}


# ---------------------------------------------------------------------------
# Cook-and-deduct (RECP-05, D-11/D-12/D-13/D-14)
# ---------------------------------------------------------------------------


def _step_down_status(current: Optional[StockStatus]) -> StockStatus:
    """D-14: HAVE -> LOW, LOW -> OUT, OUT -> OUT (clamp). None treated as OUT."""
    if current == StockStatus.HAVE:
        return StockStatus.LOW
    return StockStatus.OUT  # LOW, OUT, or None


def _cook_record_txn(
    db: Session,
    item_id: int,
    amount: float,
    user,
) -> None:
    """Write an append-only Transaction for a cook deduction (D-14)."""
    txn = Transaction(
        item_id=item_id,
        action="cook",
        delta=-float(amount),
        ha_user_id=user.id if user else None,
        ha_user_name=user.name if user else None,
    )
    db.add(txn)


@router.post("/{recipe_id}/cook")
def cook_recipe(
    recipe_id: int,
    body: RecipeCookBody,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """RECP-05: deduct ingredient quantities from inventory (D-14).

    Client is expected to OMIT unlinked ingredients from the deductions list
    (D-13). The backend validates that every submitted deduction references
    a real ingredient of this recipe and a real (non-archived) inventory item.
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    user = getattr(request.state, "user", None)

    # Build lookup of this recipe's ingredients for fast ingredient_id validation
    ingredient_ids = {ing.id for ing in recipe.ingredients}

    for deduction in body.deductions:
        if deduction.ingredient_id not in ingredient_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Ingredient {deduction.ingredient_id} does not belong to recipe {recipe_id}",
            )

        item = db.query(Item).filter(Item.id == deduction.item_id).first()
        if item is None or item.archived:
            raise HTTPException(
                status_code=404,
                detail=f"Item {deduction.item_id} not found",
            )

        if item.quantity_mode == QuantityMode.EXACT:
            current = item.quantity or 0
            item.quantity = max(0, current - int(deduction.amount))
        else:
            # STATUS mode: one step-down per cook action, regardless of amount.
            item.status = _step_down_status(item.status)

        _cook_record_txn(db, item.id, deduction.amount, user)

    db.commit()
    return {"ok": True, "deducted": len(body.deductions), "recipe_id": recipe.id}
