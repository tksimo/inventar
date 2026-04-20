---
phase: 05-recipes
plan: 03
subsystem: backend
tags: [recipes, backend, fastapi, inventory-check, cook, deduct, transactions, shopping-list]
one_liner: "Three RECP-03/04/05 endpoints: per-ingredient check with unit_mismatch detection, add-missing-to-shopping-list with item_id/free_text dedupe, cook-and-deduct with EXACT clamp + STATUS step-down + Transaction audit rows"
dependency_graph:
  requires:
    - backend/routers/recipes.py (Plan 02 CRUD + helpers)
    - backend/models/__init__.py Recipe, RecipeIngredient, ShoppingListEntry, Item, Transaction, QuantityMode, StockStatus
    - backend/schemas/recipe.py IngredientCheckItem, IngredientCheckResponse, RecipeCookBody
  provides:
    - GET /api/recipes/{id}/check -> IngredientCheckResponse
    - POST /api/recipes/{id}/add-missing -> {"added": int, "skipped": int}
    - POST /api/recipes/{id}/cook -> {"ok": True, "deducted": int, "recipe_id": int}
  affects:
    - backend/routers/recipes.py (256 lines appended)
tech_stack:
  added: []
  patterns:
    - _find_matched_item: explicit item_id FK lookup + case-insensitive substring LIKE fallback
    - _classify_ingredient: EXACT/STATUS mode dispatch with Pitfall-7 unit_mismatch downgrade
    - _step_down_status: HAVE->LOW, LOW/OUT->OUT enum clamp
    - _cook_record_txn: append-only Transaction insert (action="cook", delta=-amount)
    - _next_sort_order: max(sort_order)+1 via func.max for stable ordering
    - db.flush() after each ShoppingListEntry insert so sort_order is monotonic
key_files:
  created: []
  modified:
    - backend/routers/recipes.py
decisions:
  - "Both tasks committed in single commit — all new code appended to same file; clean atomic boundary"
  - "unit_mismatch on EXACT mode items: any recipe-side unit triggers mismatch (Item model has no unit field); status downgraded from have->low per Pitfall 7 to force user verification"
  - "cook endpoint uses getattr(request.state, 'user', None) — graceful fallback when IngressUserMiddleware absent (direct-port access, T-05-19)"
  - "add-missing dedupes case-insensitively via func.lower on free_text (T-05-16 anti-spam)"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-20"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
requirements: [RECP-03, RECP-04, RECP-05]
---

# Phase 5 Plan 03: Check-Ingredients + Add-Missing + Cook-and-Deduct Summary

**One-liner:** Three RECP-03/04/05 endpoints appended to the recipes router: per-ingredient check with unit_mismatch detection and Pitfall-7 downgrade, add-missing-to-shopping-list with item_id/free_text XOR dedupe, cook-and-deduct with EXACT quantity clamp + STATUS step-down + append-only Transaction audit rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Check-ingredients + add-missing-to-shopping-list (RECP-03, RECP-04) | 86ac80d | backend/routers/recipes.py |
| 2 | Cook-and-deduct with status step-down + Transaction logging (RECP-05) | 86ac80d | backend/routers/recipes.py |

Note: Both tasks were committed atomically in a single commit — they append to the same file and share helpers (`_find_matched_item`, `_classify_ingredient`). Both task test suites pass (9 RECP-03/04 + 7 RECP-05 = 16 tests).

## Decisions Made

1. **Single commit for both tasks** — Task 1 helpers (`_classify_ingredient`, `_find_matched_item`) are directly reused by Task 2's cook validation path. Splitting mid-file would have created an inconsistent intermediate state.

2. **unit_mismatch + status downgrade (Pitfall 7)** — When a recipe ingredient has a unit (e.g., "250g") but the matched Item tracks only a count, `unit_mismatch=True` is set. If the count-based status would have been "have", it is downgraded to "low" so the user is prompted to verify before cooking. This prevents false confidence when units are incomparable.

3. **getattr(request.state, "user", None)** — The cook endpoint accesses `request.state.user` defensively. IngressUserMiddleware always sets it in production; direct-port tests lack middleware, so `getattr` returns None cleanly. Transaction rows record NULL ha_user_id/name, consistent with Phase 2 check-off behavior (T-05-19).

4. **db.flush() after each ShoppingListEntry insert** — `_next_sort_order` queries `func.max(ShoppingListEntry.sort_order)`. Without flush, newly added rows in the same transaction are invisible to the next max() call, causing sort_order collisions. Flush makes them visible within the same session.

5. **add-missing dedupes free_text case-insensitively** — `func.lower(ShoppingListEntry.free_text) == name.lower()` ensures that calling add-missing twice for the same unlinked ingredient (e.g., "Truffle oil" vs "truffle oil") does not create duplicate rows (T-05-16 anti-spam).

## Verification Results

- `tests/test_recipes.py -k "check_ingredients or add_missing"` — 9 passed (RECP-03/04)
- `tests/test_recipes.py -k "cook"` — 7 passed (RECP-05)
- `tests/test_recipes.py` (full) — 34 passed, 0 failed
- `python -m pytest` (full backend) — 152 passed, 0 failed, 0 regressions

## Deviations from Plan

### Combined Task Commits

**[Rule — Process] Both tasks committed in single commit 86ac80d**
- **Found during:** Implementation
- **Issue:** Plan called for two separate TDD commits, but both tasks append to the same `recipes.py` file and share helpers. Implementing and committing them together is consistent with Plan 02 precedent and avoids a broken intermediate state.
- **Fix:** Single commit covers both task deliverables. All 16 acceptance criteria tests pass.
- **Impact:** No functional difference.

## Known Stubs

None — all three endpoints are fully implemented and return real data from the database. No placeholder values.

## Threat Flags

All mitigations from the plan's threat register are implemented:
- T-05-13: ingredient_id and item_id validated against recipe membership and non-archived items respectively (404 on mismatch)
- T-05-14: `max(0, current - int(amount))` clamps EXACT mode; STATUS mode uses explicit step-down enum
- T-05-15: `_cook_record_txn` writes Transaction(action="cook", delta=-amount, ha_user_id, ha_user_name) for every deduction
- T-05-16: free_text dedupe via `func.lower` parameterized query; no raw SQL
- T-05-17: archived items filtered in `_find_matched_item`; matched_item_name intentionally exposed
- T-05-18: accepted (no list-length cap; household scale)
- T-05-19: `getattr(request.state, "user", None)` handles missing middleware gracefully

## Self-Check: PASSED

- `backend/routers/recipes.py` — FOUND
- `def check_ingredients` in recipes.py — FOUND
- `def add_missing_to_shopping_list` in recipes.py — FOUND
- `def cook_recipe` in recipes.py — FOUND
- `def _classify_ingredient` in recipes.py — FOUND
- `def _find_matched_item` in recipes.py — FOUND
- `def _step_down_status` in recipes.py — FOUND
- `def _cook_record_txn` in recipes.py — FOUND
- `def _next_sort_order` in recipes.py — FOUND
- Commit 86ac80d — FOUND
- 34 recipe tests pass — VERIFIED
- 152 total backend tests pass — VERIFIED
