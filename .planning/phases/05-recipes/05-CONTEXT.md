# Phase 5: Recipes — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can store recipes (manually created or imported from a URL), check whether they have the ingredients on hand against current inventory, add missing ingredients to the shopping list in one tap, and mark a recipe as cooked to automatically deduct ingredient quantities from inventory.

No recipe suggestions, meal planning, nutrition tracking, or AI-generated recipes — those belong to later milestones.

</domain>

<decisions>
## Implementation Decisions

### Ingredient Data Model

- **D-01:** Ingredients are stored as **structured records**: `name` (string) + `quantity` (float, nullable) + `unit` (string, nullable) + `item_id` (FK to items table, nullable). The `item_id` link is optional — recipes can be created without all ingredients being linked.
- **D-02:** When creating or importing a recipe, the app **auto-suggests inventory item matches** for each ingredient at creation time (name substring match, case-insensitive). User can accept, change, or skip the suggestion. Links are stored on accept.
- **D-03:** Ingredients without a match remain unlinked (`item_id = null`) and can be linked later or left unlinked permanently.

### URL Import (RECP-02)

- **D-04:** Backend parses recipe URLs using **JSON-LD / Schema.org structured data** (`@type: Recipe`). This is the most reliable approach — major recipe sites (Chefkoch, BBC Good Food, Allrecipes, etc.) embed it.
- **D-05:** Parsing is server-side: backend fetches the URL, extracts JSON-LD, maps `name`, `recipeIngredient[]`, and `recipeInstructions[]` to the internal recipe schema.
- **D-06:** **On parse failure** (no JSON-LD found, network error, site blocked): show a toast error + **fall back to manual entry**, pre-filling the recipe name from the page `<title>` if extractable. User completes the ingredient list manually.

### Inventory Matching (RECP-03)

- **D-07:** Checking a recipe against inventory uses **name substring match** for unlinked ingredients: if ingredient `name` appears anywhere in an inventory item's `name` (case-insensitive), it's treated as a match. Already-linked ingredients (`item_id` set) use the direct FK.
- **D-08:** The recipe check screen shows **an ingredient list with per-ingredient status icons**:
  - ✅ Have enough (quantity ≥ recipe quantity, where units match; or status = "have")
  - ⚠️ Low / not enough (quantity < recipe quantity, or status = "low")
  - ❌ Missing (no inventory match at all)
- **D-09:** Items with mismatched units (e.g. recipe says "250g", inventory tracks count) show ⚠️ with a note — Claude's discretion on exact wording.
- **D-10:** "Add all missing to shopping list" button (RECP-04) adds all ❌ and ⚠️ ingredients to the shopping list. For unlinked ingredients, adds them as text entries; for linked ones, uses the item_id.

### Cook & Deduct (RECP-05)

- **D-11:** Marking a recipe as cooked shows a **confirmation sheet listing every matched ingredient** with a pre-filled deduction amount. User reviews and can adjust any quantity before confirming.
- **D-12:** Pre-fill logic: if units match between recipe and inventory (e.g. both count), pre-fill with the recipe quantity. If units mismatch (e.g. "250g" vs count), pre-fill with 1. User always sees the value and can change it.
- **D-13:** Unlinked / unmatched ingredients (no `item_id`, no name match) appear in the confirmation sheet as **greyed-out rows** with a "not in inventory — skipped" note. They are not deducted.
- **D-14:** On confirm, the backend deducts the entered quantities from each matched inventory item and appends a `transaction` row (`action = "cook"`, referencing recipe). Status-mode items: deduct 1 → step down (`have` → `low` → `out`).

### Claude's Discretion

- Drag order of ingredients in the recipe form (append to bottom is fine)
- Exact placement of "Check ingredients" vs "Cook" buttons on the recipe detail screen
- Empty state for the recipe list page
- Toast library/component for import errors (reuse existing Toast component)
- Exact wording for unit-mismatch notes in the check screen

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions to carry forward
- `.planning/phases/02-core-inventory/02-CONTEXT.md` — ItemDrawer pattern, apiFetch contract, CSS Modules, TDD pattern
- `.planning/phases/03-barcode-scanning/03-CONTEXT.md` — QuickUpdateSheet bottom sheet, z-index 65 for overlays
- `.planning/phases/04-shopping-restock/04-CONTEXT.md` — Shopping list integration points (D-10 adds to shopping list)

### Requirements
- `.planning/REQUIREMENTS.md` — RECP-01 through RECP-05

### Existing components to reuse/extend
- `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx` — bottom sheet pattern; cook confirmation sheet follows same pattern
- `frontend/src/components/EmptyState/` — reuse for empty recipe list
- `frontend/src/components/Toast/` — reuse for import error notifications
- `frontend/src/lib/api.js` — `apiFetch` is the ONLY way to make API calls (HA ingress token)
- `backend/models/__init__.py` — existing ORM; recipes + recipe_ingredients need new tables via Alembic migration
- `frontend/src/App.jsx` — add `/recipes` route alongside existing `/`, `/shopping`, `/settings`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuickUpdateSheet`: bottom sheet with action controls — adapt for cook confirmation sheet (D-11)
- `EmptyState`: existing empty state component — use for empty recipe list
- `Toast`: toast notification component — use for import error (D-06)
- `apiFetch`: sole API call contract — all recipe API calls must use this
- `ShoppingList` router (`backend/routers/shopping_list.py`) — reference for adding items to shopping list (D-10)

### Established Patterns
- CSS Modules for all component styling
- TDD red-green: write failing tests first
- Alembic migrations for schema changes (new migration needed for `recipes` + `recipe_ingredients` tables)
- `apiFetch(path)` — never `fetch('/path')` directly
- Transactions table is append-only — cook deductions get a transaction row

### Integration Points
- `frontend/src/App.jsx` — add `<Route path="/recipes" element={<Recipes />} />` and nav entry
- `backend/main.py` — register new recipes router
- `backend/models/__init__.py` — add `Recipe` and `RecipeIngredient` ORM models
- Shopping list router — reuse `POST /shopping-list` endpoint when adding missing ingredients (D-10)

</code_context>

<specifics>
## Specific Ideas

- Auto-suggest inventory matches at ingredient creation time (D-02) — substring match, case-insensitive, same logic as RECP-03
- Cook confirmation sheet shows greyed-out unmatched ingredients (D-13) — full transparency about what's being skipped
- JSON-LD parsing handles `recipeIngredient` as an array of strings — needs parsing into `name + quantity + unit` (e.g. "250g Mehl" → name=Mehl, quantity=250, unit=g)
- The `/recipes` page is currently a StubPage from Phase 1 — replace the stub with the real implementation

</specifics>

<deferred>
## Deferred Ideas

- Recipe suggestions / meal planning — explicitly out of scope per PROJECT.md
- AI/OCR photo import (RECP-06) — v2 requirement, not v1
- Dietary tags / filtering (RECP-07) — v2 requirement
- Recipe sharing / export — not requested for v1

</deferred>

---

*Phase: 05-recipes*
*Context gathered: 2026-04-19*
