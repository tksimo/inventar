---
phase: 05-recipes
plan: 05
subsystem: frontend
tags: [recipes, frontend, react, bottom-sheet, check-ingredients, cook, ui, a11y]
one_liner: "RecipeCheckSheet + CookConfirmSheet bottom sheets wired into Recipes page; Check/Cook/AddMissing flows fully functional; 218 frontend tests + 152 backend tests green"
dependency_graph:
  requires:
    - frontend/src/hooks/useRecipes.js (checkIngredients, addMissing, cook — Plan 04)
    - frontend/src/pages/Recipes.jsx (Plan 04 base — selected state, RecipeDetail stub handlers)
    - frontend/src/components/RecipeDetail/RecipeDetail.jsx (onCheck/onCook props — Plan 04)
    - frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx (structural reference)
    - backend/routers/recipes.py (Plans 02-03 — check + cook + add-missing endpoints)
  provides:
    - frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.jsx (RECP-03 + RECP-04 entry)
    - frontend/src/components/CookConfirmSheet/CookConfirmSheet.jsx (RECP-05 deduction confirmation)
    - frontend/src/pages/Recipes.jsx (wired Check + Cook flows with toast notifications)
  affects:
    - frontend/src/pages/Recipes.test.jsx (3 new integration tests added)
tech_stack:
  added: []
  patterns:
    - RecipeCheckSheet follows QuickUpdateSheet shell (backdrop aria-hidden, role=dialog, Escape handler, drag handle, z-index 65/64)
    - CookConfirmSheet follows same shell + internal useState for stepper amounts
    - D-12 pre-fill: unit_mismatch or quantity=null -> 1; otherwise recipe.quantity
    - Matched vs skipped partition in useMemo for CookConfirmSheet
    - Parent page owns all API calls; sheets are pure presentation components
    - Toast shown on success; sheet stays open on addMissing success (D-10)
    - Cook success closes sheet + refreshes RecipeDetail with new quantities
key_files:
  created:
    - frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.jsx
    - frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.module.css
    - frontend/src/components/CookConfirmSheet/CookConfirmSheet.jsx
    - frontend/src/components/CookConfirmSheet/CookConfirmSheet.module.css
  modified:
    - frontend/src/pages/Recipes.jsx (added 13 state vars + 6 handlers + 2 sheet renders)
    - frontend/src/pages/Recipes.test.jsx (added 3 new integration tests; import waitFor)
decisions:
  - "findByText('Flour') replaced with findByRole('dialog') in test — 'Flour' appears in both RecipeDetail and RecipeCheckSheet; using role=dialog is the unambiguous selector"
  - "CookConfirmSheet matches on item_id != null AND matched_item_name (both required) — consistent with check response contract"
  - "handleOpenCook re-fetches checkIngredients only if checkData is null or stale (recipe_id mismatch) — avoids redundant network calls"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-20"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
requirements: [RECP-03, RECP-04, RECP-05]
---

# Phase 5 Plan 05: RecipeCheckSheet + CookConfirmSheet — Check & Cook Flows Summary

**One-liner:** RecipeCheckSheet + CookConfirmSheet bottom sheets wired into Recipes page; Check/Cook/AddMissing flows fully functional; 218 frontend tests + 152 backend tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RecipeCheckSheet component (RECP-03 + RECP-04 entry) | 0747232 | frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.jsx, RecipeCheckSheet.module.css |
| 2 | CookConfirmSheet component (RECP-05 deduction confirmation) | fafd512 | frontend/src/components/CookConfirmSheet/CookConfirmSheet.jsx, CookConfirmSheet.module.css |
| 3 | Wire Check + Cook flows into Recipes page; extend tests | 7bb4a18 | frontend/src/pages/Recipes.jsx, frontend/src/pages/Recipes.test.jsx |

## Decisions Made

1. **Test selector for RecipeCheckSheet** — `findByText('Flour')` in the "opens RecipeCheckSheet" test failed because 'Flour' appears in both RecipeDetail and RecipeCheckSheet simultaneously (two matching DOM nodes). Fixed by using `findByRole('dialog')` as the primary assertion (sheet is open), then checking status icon aria-labels which are unique to the sheet.

2. **Matched ingredient partition condition** — `CookConfirmSheet` classifies an ingredient as "matched" only when both `item_id != null` AND `matched_item_name` is truthy. This matches the check response contract: an ingredient can have `item_id` but null `matched_item_name` in edge cases; the plan spec uses this dual check.

3. **handleOpenCook stale-data guard** — The Cook handler re-fetches `checkIngredients` only when `checkData` is null or its `recipe_id` differs from the selected recipe. This avoids a redundant network call when the user has already run "Check ingredients" for the same recipe in the same session.

## Verification Results

- `frontend/src/pages/Recipes.test.jsx` — 8 tests pass (5 existing + 3 new)
- Full frontend suite — 218 tests across 26 files, 0 failures
- Backend suite — 152 tests, 0 failures
- `npm run build` — succeeds, 494KB JS bundle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test selector ambiguity for 'Flour' text**
- **Found during:** Task 3 test execution
- **Issue:** `findByText('Flour')` threw "Found multiple elements with the text: Flour" — RecipeDetail renders 'Flour' in its ingredient list AND RecipeCheckSheet renders it in the check sheet simultaneously
- **Fix:** Replaced `findByText('Flour')` + `getByText('Milk')` assertions with `findByRole('dialog')` (unique to sheet) + status icon aria-label assertions (unique to sheet icons)
- **Files modified:** frontend/src/pages/Recipes.test.jsx
- **Commit:** 7bb4a18

## Known Stubs

None. All RECP-03/04/05 flows are fully wired. The previous Plan 04 stubs (`onCheck`/`onCook` no-ops) have been replaced with real handlers.

## Threat Flags

No new security surface beyond the plan's declared threat model:
- T-05-25: Stepper floors at 0 via `Math.max(0, next)` — implemented in `setAmount`
- T-05-28: `saving`/`adding` state disables buttons during in-flight calls — implemented
- T-05-29: Skipped row `aria-label` + status icon `aria-label` — implemented

## Self-Check: PASSED

- `frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.jsx` — FOUND
- `frontend/src/components/RecipeCheckSheet/RecipeCheckSheet.module.css` — FOUND
- `frontend/src/components/CookConfirmSheet/CookConfirmSheet.jsx` — FOUND
- `frontend/src/components/CookConfirmSheet/CookConfirmSheet.module.css` — FOUND
- `frontend/src/pages/Recipes.jsx` (updated) — FOUND
- `frontend/src/pages/Recipes.test.jsx` (updated) — FOUND
- Commit 0747232 — FOUND
- Commit fafd512 — FOUND
- Commit 7bb4a18 — FOUND
- 218 frontend tests pass — VERIFIED
- 152 backend tests pass — VERIFIED
- Build succeeds — VERIFIED
