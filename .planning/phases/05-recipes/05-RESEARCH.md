# Phase 5: Recipes — Research

**Researched:** 2026-04-19
**Domain:** Recipe management — CRUD, URL import via JSON-LD, inventory matching, shopping list integration, cook-and-deduct
**Confidence:** HIGH (codebase fully verified; all decisions locked in CONTEXT.md)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Ingredients stored as structured records: `name` (string) + `quantity` (float, nullable) + `unit` (string, nullable) + `item_id` (FK to items table, nullable).

**D-02:** Auto-suggest inventory item matches at creation/import time (name substring match, case-insensitive). User can accept, change, or skip.

**D-03:** Unlinked ingredients (`item_id = null`) stay unlinked permanently until user explicitly links them. No forced linking.

**D-04:** URL import uses **JSON-LD / Schema.org structured data** (`@type: Recipe`) parsed server-side.

**D-05:** Backend fetches URL, extracts JSON-LD, maps `name`, `recipeIngredient[]`, `recipeInstructions[]` to internal schema.

**D-06:** On parse failure: show toast error + fall back to manual entry, pre-filling recipe name from page `<title>` if extractable.

**D-07:** Inventory check uses name substring match for unlinked ingredients; FK lookup for linked ones.

**D-08:** Ingredient status icons: ✅ Have enough / ⚠️ Low or not enough / ❌ Missing.

**D-09:** Unit-mismatch items show ⚠️ with a note (wording at Claude's discretion).

**D-10:** "Add all missing to shopping list" adds all ❌ and ⚠️ ingredients. Unlinked = text entries; linked = item_id.

**D-11:** Marking as cooked shows a **confirmation sheet** listing every matched ingredient with pre-filled deduction amount.

**D-12:** Pre-fill: matching units → pre-fill recipe quantity; mismatched units → pre-fill 1.

**D-13:** Unlinked/unmatched ingredients appear as greyed-out rows "not in inventory — skipped". Not deducted.

**D-14:** On confirm: backend deducts entered quantities; appends transaction row (`action = "cook"`, recipe_id reference); status-mode: `have` → `low` → `out` on deduct.

### Claude's Discretion

- Drag order of ingredients in recipe form (append-to-bottom is fine)
- Exact placement of "Check ingredients" vs "Cook" buttons on recipe detail screen
- Empty state for recipe list page
- Toast library/component for import errors (reuse existing Toast component)
- Exact wording for unit-mismatch notes in check screen

### Deferred Ideas (OUT OF SCOPE)

- Recipe suggestions / meal planning
- AI/OCR photo import (RECP-06 — v2)
- Dietary tags / filtering (RECP-07 — v2)
- Recipe sharing / export
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECP-01 | User can create a recipe manually with name, ingredient list, optional instructions | New `recipes` + `recipe_ingredients` tables via Alembic migration; RecipeForm component; POST /api/recipes/ endpoint |
| RECP-02 | User can import recipe by URL; app parses and extracts ingredients | POST /api/recipes/import-url endpoint using httpx (already in requirements.txt) + json library for JSON-LD extraction |
| RECP-03 | User can check recipe against inventory to see missing/low ingredients | GET /api/recipes/{id}/check-ingredients endpoint; RecipeCheckSheet component following QuickUpdateSheet pattern |
| RECP-04 | User can add all missing ingredients to shopping list with one tap | POST /api/recipes/{id}/add-missing-to-shopping-list; reuses existing POST /api/shopping-list/ contract |
| RECP-05 | User can mark recipe as cooked; app deducts ingredient quantities | POST /api/recipes/{id}/cook; CookConfirmSheet bottom sheet; Transaction rows with action="cook" |
</phase_requirements>

---

## Summary

Phase 5 builds on top of fully-implemented Phase 2 (inventory CRUD), Phase 3 (barcode), and Phase 4 (shopping list). The recipes domain requires two new database tables (`recipes` and `recipe_ingredients`), a new backend router, a new frontend page replacing the existing StubPage, and several new components following established patterns.

The most technically nuanced pieces are: (1) the JSON-LD extraction for URL import — `httpx` is already in requirements.txt and the barcode router demonstrates the async-httpx pattern; (2) the ingredient quantity parsing ("250g Mehl" → name=Mehl, quantity=250, unit=g) which requires a lightweight regex parser; (3) the cook-and-deduct logic which must handle status-mode items correctly (step-down: `have`→`low`→`out`) and write to the append-only transactions table.

The `/recipes` route currently renders a `StubPage` from Phase 1. The full implementation replaces that stub. All patterns (bottom sheets, CSS Modules, apiFetch, Alembic migrations, TDD red-green) are established by prior phases and must be followed exactly.

**Primary recommendation:** Follow the ShoppingList page as the structural template. Use the QuickUpdateSheet as the structural template for both RecipeCheckSheet and CookConfirmSheet. Add a single Alembic migration (0005) for the two new tables.

---

## Standard Stack

### Core (all already in project — no new installs required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.135.3 | Backend router for recipes | Established project backend [VERIFIED: requirements.txt] |
| SQLAlchemy | 2.0.49 | ORM for Recipe + RecipeIngredient models | Established ORM [VERIFIED: requirements.txt] |
| Alembic | 1.18.4 | Schema migration (migration 0005) | Established migration tool [VERIFIED: requirements.txt] |
| Pydantic v2 | 2.11.9 | Request/response schemas | Established validation layer [VERIFIED: requirements.txt] |
| httpx | 0.28.1 | Server-side URL fetch for JSON-LD import | Already in requirements.txt; used by barcode router [VERIFIED: requirements.txt + barcode.py] |
| React 19 | 19.2.5 | Frontend components | Established frontend [VERIFIED: package.json] |
| lucide-react | 0.511.0 | Icons (ChefHat, UtensilsCrossed, etc.) | Established icon library [VERIFIED: package.json] |
| Vitest | 3.2.4 | Frontend tests | Established test runner [VERIFIED: vitest.config.js] |
| pytest | 8.4.2 | Backend tests | Established test runner [VERIFIED: pytest.ini] |

**No new packages required.** All needed libraries are already installed.

**Installation:** None needed.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:

```
backend/
├── routers/
│   └── recipes.py              # New: all recipe endpoints
├── schemas/
│   └── recipe.py               # New: RecipeCreate, RecipeIngredientIn, RecipeResponse, etc.
├── alembic/versions/
│   └── 0005_add_recipes.py     # New: recipes + recipe_ingredients tables
├── models/__init__.py          # Extend: add Recipe + RecipeIngredient ORM classes
├── tests/
│   └── test_recipes.py         # New: RED-GREEN backend tests
frontend/src/
├── pages/
│   └── Recipes.jsx             # New: replaces StubPage at /recipes
│   └── Recipes.module.css      # New: page styles
│   └── Recipes.test.jsx        # New: page tests
├── hooks/
│   └── useRecipes.js           # New: data hook (CRUD + import + check + cook)
│   └── useRecipes.test.js      # New: hook tests
├── components/
│   ├── RecipeCard/             # New: list item card
│   ├── RecipeForm/             # New: create/edit form (name + instructions + ingredient rows)
│   ├── RecipeDetail/           # New: detail view with Check + Cook buttons
│   ├── RecipeIngredientRow/    # New: single ingredient row in form/detail
│   ├── RecipeCheckSheet/       # New: bottom sheet, follows QuickUpdateSheet pattern
│   └── CookConfirmSheet/       # New: bottom sheet, follows QuickUpdateSheet pattern
```

### Pattern 1: New Alembic Migration (0005)

**What:** Add `recipes` and `recipe_ingredients` tables to SQLite.
**When to use:** Any new persistent entity needs a migration.

```python
# Source: backend/alembic/versions/0004_add_sort_order_to_shopping_list.py (pattern)
revision = '0005'
down_revision = '0004'

def upgrade() -> None:
    op.create_table('recipes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_table('recipe_ingredients',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('recipe_id', sa.Integer(), sa.ForeignKey('recipes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(), nullable=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True),
    )
```

**CRITICAL:** The `item_id` FK must use `ondelete='SET NULL'` so deleting an inventory item does not cascade-delete recipe ingredients. The `recipe_id` FK uses `ondelete='CASCADE'` so deleting a recipe removes all its ingredients.

### Pattern 2: ORM Model Addition

**What:** Add `Recipe` and `RecipeIngredient` to `backend/models/__init__.py`.
**Pattern matches:** Existing `Item`, `ShoppingListEntry` models.

```python
# Source: backend/models/__init__.py (established pattern)
class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    ingredients = relationship("RecipeIngredient", back_populates="recipe",
                               cascade="all, delete-orphan", order_by="RecipeIngredient.sort_order")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    sort_order = Column(Integer, nullable=True)
    recipe = relationship("Recipe", back_populates="ingredients")
    item = relationship("Item")
```

Update `__all__` to include `"Recipe"` and `"RecipeIngredient"`.

### Pattern 3: Backend Router Structure

**What:** New router at `backend/routers/recipes.py`, registered in `main.py`.
**Endpoints required:**

| Method | Path | Purpose | Requirement |
|--------|------|---------|-------------|
| GET | /api/recipes/ | List all recipes (name + id + ingredient count) | RECP-01 |
| POST | /api/recipes/ | Create recipe manually | RECP-01 |
| GET | /api/recipes/{id} | Get single recipe with full ingredients | RECP-01 |
| PATCH | /api/recipes/{id} | Update recipe name/instructions/ingredients | RECP-01 |
| DELETE | /api/recipes/{id} | Delete recipe | RECP-01 |
| POST | /api/recipes/import-url | Import recipe from URL | RECP-02 |
| GET | /api/recipes/{id}/check | Check ingredients against inventory | RECP-03 |
| POST | /api/recipes/{id}/add-missing | Add missing to shopping list | RECP-04 |
| POST | /api/recipes/{id}/cook | Deduct ingredients from inventory | RECP-05 |

**Registration in main.py** (mirrors existing pattern):
```python
# Source: backend/main.py (established pattern)
from routers import health, items, categories, locations, access_info, barcode, shopping_list, recipes
app.include_router(recipes.router)
```

### Pattern 4: URL Import with JSON-LD Extraction

**What:** Server-side fetch of recipe URL, JSON-LD extraction, ingredient string parsing.
**Pattern source:** barcode.py demonstrates `httpx.AsyncClient` usage. [VERIFIED: barcode.py]

```python
# Source: inspired by backend/routers/barcode.py httpx pattern
import httpx
import json
import re
from bs4 import BeautifulSoup  # NOT available — use stdlib html.parser instead

async def _fetch_recipe_json_ld(url: str) -> dict | None:
    """Fetch URL and extract Schema.org Recipe JSON-LD block."""
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as http:
        resp = await http.get(url, headers={"User-Agent": "Inventar/0.1 (home-assistant-addon)"})
    if resp.status_code != 200:
        return None
    # Parse with stdlib html.parser (no BeautifulSoup needed)
    from html.parser import HTMLParser
    # Extract all <script type="application/ld+json"> blocks and scan for @type:Recipe
    ...
```

**CRITICAL — No BeautifulSoup:** `beautifulsoup4` is NOT in requirements.txt. [VERIFIED: requirements.txt] Use Python's stdlib `html.parser` or a regex scan of raw HTML for `<script type="application/ld+json">` blocks. The JSON-LD data is in `<script>` tags, so simple regex extraction is reliable enough:

```python
import re, json

def _extract_json_ld_recipe(html: str) -> dict | None:
    """Find all JSON-LD blocks and return the first one with @type Recipe."""
    pattern = re.compile(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE
    )
    for m in pattern.finditer(html):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        # Handle @graph wrapping
        if isinstance(data, dict) and data.get("@graph"):
            data = next((n for n in data["@graph"] if "Recipe" in str(n.get("@type", ""))), None)
            if not data:
                continue
        if isinstance(data, list):
            data = next((n for n in data if "Recipe" in str(n.get("@type", ""))), None)
            if not data:
                continue
        if data and "Recipe" in str(data.get("@type", "")):
            return data
    return None
```

**Page title extraction for fallback (D-06):**
```python
title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.DOTALL | re.IGNORECASE)
page_title = title_match.group(1).strip() if title_match else None
```

### Pattern 5: Ingredient String Parsing

**What:** Parse `recipeIngredient[]` strings like `"250g Mehl"`, `"2 Eier"`, `"1 TL Salz"` into `{name, quantity, unit}`.
**Approach:** Regex-based, no external library needed.

```python
import re

_AMOUNT_RE = re.compile(
    r'^(?P<qty>\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?)\s*(?P<unit>[a-zA-ZäöüÄÖÜ]+(?:\.|))?\s*(?P<name>.+)$',
    re.UNICODE
)

def parse_ingredient(raw: str) -> dict:
    """Parse '250g Mehl' → {name: 'Mehl', quantity: 250.0, unit: 'g'}."""
    raw = raw.strip()
    m = _AMOUNT_RE.match(raw)
    if not m:
        return {"name": raw, "quantity": None, "unit": None}
    qty_str = m.group("qty").replace(",", ".").replace(" ", "")
    try:
        quantity = float(qty_str)
    except ValueError:
        return {"name": raw, "quantity": None, "unit": None}
    unit = m.group("unit") or None
    name = m.group("name").strip()
    # If no unit but name starts with known unit-less count words, leave unit None
    return {"name": name, "quantity": quantity, "unit": unit}
```

**Note:** This parser handles the common cases. Edge cases (fractions "1/2", ranges "2-3") are handled by the regex `\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?`. Imperfect parses are fine — user reviews at import time (D-02).

### Pattern 6: Cook-and-Deduct Logic

**What:** POST /api/recipes/{id}/cook — deducts entered quantities from inventory; writes transaction rows.
**Status-mode step-down (D-14):** `have`→`low`→`out` on deduct.

```python
# Source: backend/routers/shopping_list.py check-off pattern
from models import Item, QuantityMode, StockStatus, Transaction

def _step_down_status(current: StockStatus) -> StockStatus:
    """have -> low -> out."""
    if current == StockStatus.HAVE:
        return StockStatus.LOW
    return StockStatus.OUT  # low -> out; out stays out

def _deduct_item(item: Item, amount: float, recipe_id: int, user, db: Session) -> None:
    if item.quantity_mode == QuantityMode.EXACT:
        item.quantity = max(0, (item.quantity or 0) - amount)
    else:
        # STATUS mode: step down once per cook action (D-14)
        item.status = _step_down_status(item.status or StockStatus.HAVE)
    txn = Transaction(
        item_id=item.id,
        action="cook",
        delta=-amount,
        ha_user_id=user.id if user else None,
        ha_user_name=user.name if user else None,
    )
    db.add(txn)
```

**CRITICAL:** Transaction table is append-only. Never UPDATE or DELETE transaction rows. [VERIFIED: models/__init__.py docstring + STATE.md]

The Transaction model currently has no `recipe_id` column. [VERIFIED: models/__init__.py] The `action="cook"` string in the transaction is sufficient for audit purposes per D-14. The recipe reference lives implicitly in the action string — no schema change to the transactions table is needed.

### Pattern 7: Add Missing to Shopping List (RECP-04 / D-10)

**What:** POST /api/recipes/{id}/add-missing — adds all ❌ and ⚠️ ingredients to shopping list.
**Reuse existing endpoint:** The existing `POST /api/shopping-list/` endpoint takes `{item_id: int}`. For linked ingredients, call it with item_id. For unlinked text ingredients, the current shopping list schema requires an item_id — this is a gap.

**Gap analysis:** The `ShoppingListEntry` model has `item_id` as a non-nullable FK. [VERIFIED: models/__init__.py] Unlinked recipe ingredients (D-10: "adds them as text entries") cannot use the current schema directly. Two options:
1. Create a stub inventory item for the unlinked ingredient and add that item_id (complex)
2. Add a `free_text` nullable column to `shopping_list` for unlinked entries (schema change required)

**Recommendation:** Option 2 — add `free_text` nullable column in migration 0005 alongside the recipe tables. A shopping list entry has EITHER `item_id` OR `free_text`, never both. This keeps the model clean. The frontend already handles this by checking `item_id` vs display name. This requires updating the `ShoppingListEntry` model and `ShoppingListEntryResponse` schema.

**Alternative (simpler):** Only add linked ingredients (those with item_id set or name-matched) to the shopping list for RECP-04. Unlinked ingredients show a note "Link ingredient to inventory to add to shopping list." This avoids any schema change. Choose based on scope preference — CONTEXT.md says "adds them as text entries" for unlinked, so the schema change approach is the locked decision.

**IMPORTANT:** The planner must decide between these two interpretations. D-10 says "For unlinked ingredients, adds them as text entries" — this requires `free_text` in shopping_list. This is an implicit schema dependency not explicitly addressed in CONTEXT.md.

### Pattern 8: Frontend Page and Hook Pattern

**What:** Recipes page replaces `StubPage` at `/recipes`. Hook follows `useShoppingList.js` pattern.
**Route registration in App.jsx:**

```jsx
// Source: frontend/src/App.jsx (established pattern)
import Recipes from './pages/Recipes.jsx'
// Inside AppInner's Routes:
<Route path="/recipes" element={<Recipes itemsApi={itemsApi} />} />
```

**Nav item in AppLayout.jsx:**
```jsx
// Source: frontend/src/layout/AppLayout.jsx (established pattern)
import { House, ShoppingCart, UtensilsCrossed, Settings as SettingsIcon } from 'lucide-react'
<NavItem to="/recipes" icon={UtensilsCrossed} label="Recipes" />
```

**Hook signature (useRecipes.js):**
```js
export function useRecipes() {
  // state: recipes, loading, error
  // mutations: create, update, remove, importUrl, checkIngredients, addMissing, cook
  return { recipes, loading, error, refetch, create, update, remove,
           importUrl, checkIngredients, addMissing, cook }
}
```

### Anti-Patterns to Avoid

- **Using `fetch()` directly:** All API calls MUST go through `apiFetch(path)` — never `fetch('/path')`. [VERIFIED: api.js + STATE.md]
- **Absolute paths in apiFetch:** Must be relative (no leading `/`). `apiFetch('api/recipes/')` not `apiFetch('/api/recipes/')`.
- **Adding `beautifulsoup4` as a dependency:** Not in requirements.txt; use stdlib html.parser/regex. [VERIFIED: requirements.txt]
- **Touching the transactions table with UPDATE/DELETE:** It is append-only. [VERIFIED: models/__init__.py]
- **Writing new Alembic migrations without a `down_revision`:** Each migration chains from the previous. Migration 0005 must set `down_revision = '0004'`. [VERIFIED: existing migrations]
- **Using raw SQL:** All DB access via SQLAlchemy ORM. [VERIFIED: shopping_list.py pattern]
- **Missing `extra='forbid'` in Pydantic schemas:** All request schemas use `extra='forbid'` for ASVS V5. [VERIFIED: item.py, shopping_list.py]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for URL fetch | Custom urllib code | `httpx.AsyncClient` (already installed) | Timeout, redirect, header handling built-in |
| JSON-LD detection | Custom parser | `json.loads()` + regex for script tags | JSON-LD is valid JSON; stdlib is sufficient |
| Ingredient string parsing | NLP library | Regex-based parser (see Pattern 5) | Recipe strings follow predictable formats; no NLP dependency needed |
| Bottom sheet UI | Custom modal | Adapt `QuickUpdateSheet` pattern | z-index hierarchy established; keyboard/Escape already handled |
| Empty state UI | Custom component | `EmptyState` component | Already built with correct ARIA |
| Toast notification | Custom toast | `Toast` component | Already built; props: message, duration, onDismiss |
| Status-mode step-down | Custom logic | `_step_down_status` helper (simple) | 3-state machine, trivial but must be correct |

**Key insight:** This phase adds features on top of a mature foundation. The right approach is adaptation of existing patterns, not fresh building.

---

## Common Pitfalls

### Pitfall 1: JSON-LD @graph Wrapping
**What goes wrong:** Many sites (e.g. Chefkoch) wrap JSON-LD in `{"@graph": [...]}` rather than emitting a bare Recipe object. A naive "find @type:Recipe" check fails.
**Why it happens:** Schema.org allows both formats.
**How to avoid:** After parsing JSON, check for `@graph` key and flatten (see Pattern 4).
**Warning signs:** Import works on Allrecipes but not Chefkoch.

### Pitfall 2: recipeIngredient as Nested Object vs String
**What goes wrong:** Most sites emit `recipeIngredient` as `["250g Mehl", "2 Eier"]`. Some sites emit it as `[{"@type": "HowToSupply", "name": "Mehl", "requiredQuantity": "250g"}]`.
**Why it happens:** Schema.org allows both formats.
**How to avoid:** Check if each element is a string or dict. For dicts, extract `.name` and `.requiredQuantity`.
**Warning signs:** Ingredient list is empty after import despite JSON-LD being present.

### Pitfall 3: Missing CASCADE on recipe_ingredients FK
**What goes wrong:** Deleting a recipe leaves orphaned `recipe_ingredients` rows. SQLAlchemy relationship `cascade="all, delete-orphan"` handles ORM-level deletion, but the DB-level FK must also have `ondelete='CASCADE'` for raw deletes and test cleanup.
**How to avoid:** Set both `cascade="all, delete-orphan"` on the relationship AND `ondelete='CASCADE'` on the FK in the migration.

### Pitfall 4: item_id FK to items.id with ondelete='SET NULL'
**What goes wrong:** If ondelete is not set, deleting an inventory item that is referenced by recipe ingredients raises a FK violation.
**How to avoid:** `sa.ForeignKey('items.id', ondelete='SET NULL')` + column is nullable. [ASSUMED based on standard SQLite FK behavior — SQLite FK enforcement requires `PRAGMA foreign_keys=ON`; SQLAlchemy does not enable this by default for SQLite]
**Warning signs:** Deleting an item that appears in a recipe crashes with IntegrityError.

### Pitfall 5: Transaction action="cook" Not in items.py Whitelist
**What goes wrong:** If the items router or audit trail checks `action` against a whitelist, `"cook"` needs to be included.
**Why it happens:** The `action` column is a plain String with no DB-level enum. No whitelist exists currently. [VERIFIED: models/__init__.py]
**How to avoid:** No action needed — the column accepts any string. But document valid values in the router comment.

### Pitfall 6: apiFetch Relative Path on Deeply Nested Routes
**What goes wrong:** `apiFetch('api/recipes/5/check')` works; `apiFetch('/api/recipes/5/check')` throws TypeError.
**How to avoid:** All paths in useRecipes.js must be relative (no leading `/`). This is enforced by the apiFetch guard. [VERIFIED: api.js]

### Pitfall 7: Unit Comparison for Inventory Check (D-08/D-09)
**What goes wrong:** Recipe says "250g flour", inventory item tracks count=3. Treating these as comparable leads to wrong ✅/⚠️/❌ status.
**How to avoid:** Normalize units before comparison. If units are present on both sides and they differ: show ⚠️ with unit-mismatch note (D-09). If recipe has a unit and inventory has `quantity_mode='status'`: always treat as ⚠️.

### Pitfall 8: httpx SSRF Risk on URL Import
**What goes wrong:** Malicious recipe URL targeting internal network (`http://192.168.1.1/`, `file:///etc/passwd`).
**How to avoid:** Validate the URL scheme is `https://` or `http://` and reject non-routable private IP ranges before fetching. At minimum, reject `file://` and `ftp://` schemes. [ASSUMED — no SSRF mitigation pattern in existing barcode.py to copy, but this is a new user-controlled URL]

---

## Code Examples

### Verified patterns from existing codebase

**apiFetch hook call pattern (from useShoppingList.js):**
```js
// Source: frontend/src/hooks/useShoppingList.js
async function json(path, init) {
  const res = await apiFetch(path, init)
  if (!res.ok) {
    const err = new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status}`)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}
```

**Pydantic v2 schema pattern (from schemas/shopping_list.py):**
```python
# Source: backend/schemas/shopping_list.py
class RecipeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=1)
    instructions: Optional[str] = None
    ingredients: List[RecipeIngredientIn] = Field(default_factory=list)
```

**Transaction INSERT pattern (from shopping_list.py):**
```python
# Source: backend/routers/shopping_list.py _record_txn
txn = Transaction(
    item_id=item.id,
    action="cook",      # new action value — valid per String column
    delta=-amount,
    ha_user_id=user.id if user else None,
    ha_user_name=user.name if user else None,
)
db.add(txn)
```

**httpx async fetch pattern (from barcode.py):**
```python
# Source: backend/routers/barcode.py
async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as http:
    resp = await http.get(url, headers={"User-Agent": "Inventar/0.1 (home-assistant-addon)"})
if resp.status_code != 200:
    raise HTTPException(status_code=404, detail="Recipe not found at URL")
```

**Bottom sheet pattern (from QuickUpdateSheet.jsx):**
```jsx
// Source: frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx
// CookConfirmSheet follows this structure exactly:
// 1. Backdrop div with onClick=onClose, aria-hidden="true"
// 2. div role="dialog" aria-modal="true" aria-labelledby={headingId}
// 3. Handle bar (aria-hidden)
// 4. Content
// 5. Footer with primary + secondary actions
// z-index: 65 per UI-SPEC (above ItemDrawer at 60, below CameraOverlay at 70)
```

---

## Runtime State Inventory

This is a greenfield phase (new feature, no rename/refactor). Skip runtime state inventory.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| httpx | URL import (RECP-02) | Yes | 0.28.1 | — |
| Python stdlib `json`, `re`, `html.parser` | JSON-LD extraction | Yes | stdlib | — |
| SQLite | Data persistence | Yes | via SQLAlchemy | — |
| Node/npm | Frontend build | Yes | in project | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

All required libraries are already installed. No new packages needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.4.2 |
| Framework (frontend) | vitest 3.2.4 + @testing-library/react 16.3.0 |
| Config file (backend) | `backend/pytest.ini` |
| Config file (frontend) | `frontend/vitest.config.js` |
| Quick run (backend) | `cd backend && python -m pytest tests/test_recipes.py -q` |
| Quick run (frontend) | `cd frontend && npm test -- --run src/hooks/useRecipes.test.js` |
| Full suite (backend) | `cd backend && python -m pytest -q` |
| Full suite (frontend) | `cd frontend && npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECP-01 | POST /api/recipes/ creates recipe + ingredients | unit | `pytest tests/test_recipes.py::test_create_recipe -xq` | Wave 0 |
| RECP-01 | GET /api/recipes/ returns list | unit | `pytest tests/test_recipes.py::test_list_recipes -xq` | Wave 0 |
| RECP-01 | GET /api/recipes/{id} returns detail with ingredients | unit | `pytest tests/test_recipes.py::test_get_recipe_detail -xq` | Wave 0 |
| RECP-01 | PATCH /api/recipes/{id} updates recipe | unit | `pytest tests/test_recipes.py::test_update_recipe -xq` | Wave 0 |
| RECP-01 | DELETE /api/recipes/{id} removes recipe + ingredients | unit | `pytest tests/test_recipes.py::test_delete_recipe_cascades -xq` | Wave 0 |
| RECP-02 | POST /api/recipes/import-url extracts JSON-LD | unit (mocked httpx) | `pytest tests/test_recipes.py::test_import_url_json_ld -xq` | Wave 0 |
| RECP-02 | POST /api/recipes/import-url falls back on parse failure | unit (mocked httpx) | `pytest tests/test_recipes.py::test_import_url_fallback -xq` | Wave 0 |
| RECP-03 | GET /api/recipes/{id}/check returns per-ingredient status | unit | `pytest tests/test_recipes.py::test_check_ingredients -xq` | Wave 0 |
| RECP-03 | Check screen shows correct ✅/⚠️/❌ | integration (frontend) | `npm test -- --run src/pages/Recipes.test.jsx` | Wave 0 |
| RECP-04 | POST /api/recipes/{id}/add-missing adds items to shopping list | unit | `pytest tests/test_recipes.py::test_add_missing_to_shopping_list -xq` | Wave 0 |
| RECP-05 | POST /api/recipes/{id}/cook deducts exact-mode quantities | unit | `pytest tests/test_recipes.py::test_cook_deducts_exact -xq` | Wave 0 |
| RECP-05 | POST /api/recipes/{id}/cook steps down status-mode items | unit | `pytest tests/test_recipes.py::test_cook_steps_down_status -xq` | Wave 0 |
| RECP-05 | POST /api/recipes/{id}/cook writes transaction rows | unit | `pytest tests/test_recipes.py::test_cook_writes_transactions -xq` | Wave 0 |
| RECP-05 | Unlinked ingredients are skipped (D-13) | unit | `pytest tests/test_recipes.py::test_cook_skips_unlinked -xq` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/test_recipes.py -q`
- **Per wave merge:** `cd backend && python -m pytest -q && cd ../frontend && npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_recipes.py` — covers all RECP-01 through RECP-05 backend tests
- [ ] `frontend/src/hooks/useRecipes.test.js` — covers hook API contract
- [ ] `frontend/src/pages/Recipes.test.jsx` — covers page rendering + check screen display
- [ ] `backend/alembic/versions/0005_add_recipes.py` — migration must exist before any test can import models

*(Existing test infrastructure — conftest.py, vitest.config.js, setup.js — fully covers all phase requirements. Only new test files and the migration are needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | HA ingress handles auth (established) |
| V3 Session Management | No | Stateless API (established) |
| V4 Access Control | No | Single-household, no role separation |
| V5 Input Validation | Yes | Pydantic `extra='forbid'` on all request schemas; URL validation before fetch |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via recipe name/ingredients | Tampering | SQLAlchemy ORM only; no raw SQL |
| SSRF via import-url endpoint | Spoofing/Elevation | Validate URL scheme; reject private IPs before fetch |
| Overly large URL response DoS | DoS | `httpx` timeout (10s); response body size limit |
| Path injection in recipe_id | Tampering | FastAPI Path with `int` type validates automatically |
| Unknown fields in POST body | Tampering | `extra='forbid'` in all Pydantic schemas |

**SSRF mitigation for /api/recipes/import-url (RECP-02):**
```python
from urllib.parse import urlparse
import ipaddress

def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=422, detail="URL must be http or https")
    # Optionally: reject private IP ranges
    # (lightweight check — full SSRF mitigation would require DNS resolution check too)
```

---

## Open Questions

1. **Shopping list text entries for unlinked ingredients (D-10)**
   - What we know: D-10 says "For unlinked ingredients, adds them as text entries"
   - What's unclear: The current `ShoppingListEntry` model has non-nullable `item_id`. Adding text-only entries requires either a schema change (add `free_text` nullable column + make `item_id` nullable) or creating stub inventory items.
   - Recommendation: Add `free_text` nullable column to `shopping_list` in migration 0005 and make `item_id` nullable. Update `ShoppingListEntry` ORM model and `ShoppingListEntryResponse` schema. The planner should include this as an explicit task.

2. **Transaction recipe_id reference (D-14)**
   - What we know: D-14 says "appends a transaction row (action = 'cook', referencing recipe)"
   - What's unclear: The current `Transaction` model has no `recipe_id` column. [VERIFIED: models/__init__.py]
   - Recommendation: Add `recipe_id` nullable FK column to `transactions` table in migration 0005. Or: accept that `action="cook"` is sufficient reference without a recipe_id FK. Simpler approach (no schema change to transactions) is likely preferred.

3. **Ingredient sort order in recipe form**
   - What we know: CONTEXT.md says "append to bottom is fine" (Claude's discretion)
   - What's unclear: Whether drag-to-reorder is expected in v1
   - Recommendation: No drag-to-reorder in recipe form. Append-only. Saves significant complexity.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SQLite FK `ondelete='SET NULL'` behavior requires `PRAGMA foreign_keys=ON` for enforcement | Pitfall 4 | item deletion may leave stale item_id references in recipe_ingredients without crash — low risk, data integrity issue |
| A2 | SSRF: `httpx` follows redirects; malicious redirects to internal IPs are possible if not blocked | Security Domain | Internal network exposure from recipe URL import |
| A3 | Ingredient string format `"250g Mehl"` is representative; German recipe sites may use different patterns | Pattern 5 | Ingredient parsing fails silently for non-standard strings — user reviews at import time, so acceptable |
| A4 | No `recipe_id` column needed in `transactions` table for Phase 5 — `action="cook"` is sufficient for audit | Pattern 6 | Audit trail cannot trace which recipe triggered a deduction — acceptable for v1 |

---

## Sources

### Primary (HIGH confidence — verified in codebase)
- `backend/models/__init__.py` — ORM schema, Transaction model, append-only constraint
- `backend/routers/barcode.py` — httpx async pattern, timeout, user-agent
- `backend/routers/shopping_list.py` — router structure, transaction pattern, endpoint conventions
- `backend/schemas/shopping_list.py` — Pydantic v2 schema patterns
- `backend/schemas/item.py` — extra='forbid', use_enum_values patterns
- `backend/tests/conftest.py` — test fixture pattern (session-scoped schema, per-test client)
- `backend/alembic/versions/` — migration chaining pattern
- `frontend/src/lib/api.js` — apiFetch contract
- `frontend/src/hooks/useShoppingList.js` — hook pattern
- `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx` — bottom sheet pattern
- `frontend/src/components/Toast/Toast.jsx` — toast component API
- `frontend/src/components/EmptyState/EmptyState.jsx` — empty state component API
- `frontend/src/App.jsx` — route registration pattern
- `frontend/src/layout/AppLayout.jsx` — nav item registration pattern
- `frontend/package.json` — installed library versions
- `backend/requirements.txt` — installed Python packages
- `.planning/phases/05-recipes/05-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence — cross-referenced with codebase)
- Schema.org Recipe JSON-LD specification — `@type: Recipe`, `recipeIngredient[]`, `recipeInstructions[]` fields, `@graph` wrapping patterns [ASSUMED based on training knowledge — standard is stable]

### Tertiary (LOW confidence — training knowledge only)
- Ingredient string parsing regex patterns [ASSUMED — common format for German recipe sites, not verified against specific sites]
- SSRF mitigation patterns for httpx [ASSUMED — standard security practice]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in requirements.txt and package.json
- Architecture patterns: HIGH — all patterns extracted from existing codebase
- Pitfalls: MEDIUM — pitfall 1/2 (JSON-LD) based on training knowledge of Schema.org; pitfalls 3-8 verified from codebase patterns
- Security: MEDIUM — SSRF concern is standard knowledge, not yet verified against specific attack scenarios

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable dependencies; no fast-moving ecosystem concerns)
