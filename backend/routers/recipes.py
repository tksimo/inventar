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
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, Recipe, RecipeIngredient
from schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeListItem,
    RecipeIngredientIn,
    RecipeIngredientResponse,
    RecipeImportUrlBody,
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
