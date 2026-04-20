---
phase: 05-recipes
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - backend/alembic/versions/0005_add_recipes.py
  - backend/main.py
  - backend/models/__init__.py
  - backend/routers/recipes.py
  - backend/schemas/__init__.py
  - backend/schemas/recipe.py
  - backend/schemas/shopping_list.py
  - backend/tests/test_recipes.py
  - frontend/src/App.jsx
  - frontend/src/components/CookConfirmSheet/CookConfirmSheet.jsx
  - frontend/src/components/CookConfirmSheet/CookConfirmSheet.module.css
  - frontend/src/components/RecipeCard/RecipeCard.jsx
  - frontend/src/components/RecipeCard/RecipeCard.module.css
  - frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.jsx
  - frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.module.css
  - frontend/src/components/RecipeDetail/RecipeDetail.jsx
  - frontend/src/components/RecipeDetail/RecipeDetail.module.css
  - frontend/src/components/RecipeForm/RecipeForm.jsx
  - frontend/src/components/RecipeForm/RecipeForm.module.css
  - frontend/src/hooks/useRecipes.js
  - frontend/src/hooks/useRecipes.test.js
  - frontend/src/layout/AppLayout.jsx
  - frontend/src/layout/AppLayout.test.jsx
  - frontend/src/pages/Recipes.jsx
  - frontend/src/pages/Recipes.module.css
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 5 adds recipe CRUD, URL import, ingredient-vs-inventory checking, and cook-and-deduct. The overall architecture is sound: ORM-only database access, Pydantic `extra='forbid'` on all request schemas, explicit SSRF guards on URL import, and a clean hook/page/component split in the frontend. Test coverage is thorough for both the backend (pytest) and frontend (vitest + RTL).

Four warnings and three info items were found. No critical security vulnerabilities were identified. The most important issues are: a silent float-to-int truncation in the cook deduction handler, an unsafe migration downgrade path, a React rendering bug from index-based keys, and a frontend "Cook & deduct" button that can fire as a no-op when all amounts have been decremented to zero.

---

## Warnings

### WR-01: Cook deduction silently truncates float amounts to int (EXACT mode)

**File:** `backend/routers/recipes.py:702`
**Issue:** `int(deduction.amount)` hard-truncates the deduction before subtracting from inventory. The schema defines `amount: float = Field(..., gt=0, le=100000)`, so a client sending `2.7` will deduct only `2` from inventory with no error or warning. This causes silent under-deduction and inventory drift. In STATUS mode (line 704) the amount is ignored for the step-down but still passed as-is to `_cook_record_txn`, so the Transaction audit row records the correct float — only the EXACT inventory quantity is wrong.

**Fix:** Remove the coercion and use `round()` if integer semantics are required, or keep the float and change `item.quantity` to `Float`:
```python
# Option A: round instead of truncate
item.quantity = max(0, current - round(deduction.amount))

# Option B: keep float math (requires Item.quantity to be Float in the model)
item.quantity = max(0.0, current - deduction.amount)
```
If integer-only inventory quantities are by design (the model currently has `Integer`), document that the schema's `float` type is misleading and validate `amount` as an integer in `RecipeCookIngredient`.

---

### WR-02: Unsafe migration downgrade when free-text shopping list rows exist

**File:** `backend/alembic/versions/0005_add_recipes.py:72-81`
**Issue:** The `downgrade()` path drops `free_text` and then reverts `item_id` to `nullable=False`. If any `ShoppingListEntry` rows were added by RECP-04 with `item_id=NULL` (the normal case for unlinked ingredients), the `alter_column` to `NOT NULL` will raise a database constraint error and leave the schema in a half-migrated state. SQLite's batch mode does not enforce this atomically across the two operations.

**Fix:** Add a `DELETE` or `UPDATE` step before restoring the `NOT NULL` constraint:
```python
def downgrade() -> None:
    # Remove free-text rows that would violate the restored NOT NULL constraint
    op.execute("DELETE FROM shopping_list WHERE item_id IS NULL")
    with op.batch_alter_table("shopping_list", schema=None) as batch_op:
        batch_op.drop_column("free_text")
        batch_op.alter_column(
            "item_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
    op.drop_table("recipe_ingredients")
    op.drop_table("recipes")
```
Add a comment warning that downgrading is destructive (deletes free-text entries).

---

### WR-03: "Cook & deduct" button stays enabled when all amounts are zero

**File:** `frontend/src/components/CookConfirmSheet/CookConfirmSheet.jsx:62-73`
**Issue:** `canCook` is `!saving && matched.length > 0`. The user can decrement every stepper to 0 (the `Minus` button disables at `amt <= 0` but only after reaching 0, not before). With all amounts at 0, `handleConfirm` builds `deductions` and filters by `d.amount > 0`, resulting in an empty array. A POST to `/api/recipes/{id}/cook` with `{"deductions": []}` succeeds (returns `{"ok": true, "deducted": 0}`), shows the toast "cooked. Inventory updated.", and does nothing to inventory. The user receives false positive feedback.

**Fix:** Include the zero-amount check in `canCook`:
```jsx
const hasAnyPositiveAmount = matched.some(
  (ing) => (amounts[ing.ingredient_id] ?? 0) > 0
)
const canCook = !saving && matched.length > 0 && hasAnyPositiveAmount
```

---

### WR-04: Ingredient list uses array index as React key

**File:** `frontend/src/components/RecipeForm/RecipeForm.jsx:175`
**Issue:** `key={idx}` on ingredient `<li>` elements causes React to reuse DOM nodes incorrectly when items are removed from the middle of the list. Removing ingredient at index 1 from a 3-item list causes React to update items 1 and 2 in place rather than removing item 1, which can leave stale input values in the form fields — particularly visible when controlled inputs are involved.

**Fix:** Assign a stable `_key` to each ingredient on creation and use that as the React key:
```js
// emptyIngredient()
function emptyIngredient() {
  return { _key: crypto.randomUUID(), id: null, name: '', quantity: '', unit: '', item_id: null }
}

// toInitialState()
ingredients: (recipe.ingredients ?? []).map((ing) => ({
  _key: ing.id != null ? `persisted-${ing.id}` : crypto.randomUUID(),
  ...
})),

// JSX
{form.ingredients.map((ing, idx) => (
  <li key={ing._key} className={styles.ingredientRow}>
```

---

## Info

### IN-01: `addMissing` sends spurious `Content-Type: application/json` with no body

**File:** `frontend/src/hooks/useRecipes.js:121-124`
**Issue:** The `addMissing` call sends `Content-Type: application/json` but includes no `body`. Some reverse proxies and strict servers reject this combination. The backend endpoint does not expect a body.

**Fix:** Remove the `headers` entry:
```js
const data = await json(`api/recipes/${id}/add-missing`, {
  method: 'POST',
})
```

---

### IN-02: `Number()` coercion in RecipeForm can produce NaN sent to the API

**File:** `frontend/src/components/RecipeForm/RecipeForm.jsx:91`
**Issue:** `i.quantity === '' ? null : Number(i.quantity)` — if `i.quantity` is a non-numeric string (possible via programmatic state manipulation or pasted import data), `Number(...)` returns `NaN`. The backend schema validates `ge=0, le=100000` and will reject it with a 422, but the error message shown to the user ("Couldn't save. Try again.") gives no useful diagnostic.

**Fix:** Add a guard or parse with `parseFloat`:
```js
const qty = i.quantity === '' ? null : parseFloat(i.quantity)
// Include NaN check
quantity: (qty === null || isNaN(qty)) ? null : qty,
```

---

### IN-03: Bare `except Exception` in URL import silently discards all network error detail

**File:** `backend/routers/recipes.py:416-418`
**Issue:** The broad `except Exception:` catch on the httpx fetch discards potentially useful diagnostic information (e.g., TLS certificate errors, DNS failures, timeout specifics). This is consistent with the D-06 design decision (fallback to manual entry), but makes server-side debugging harder.

**Fix:** Log the exception before continuing. Add a logger at the module level:
```python
import logging
_log = logging.getLogger(__name__)

# Inside the except block:
except Exception as exc:
    _log.warning("import-url fetch failed for %s: %s", body.url, exc)
    html = None
```

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
