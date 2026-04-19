---
phase: 04-shopping-restock
plan: 05
subsystem: api, ui
tags: [shopping-list, fastapi, react, hooks, gap-closure]

requires:
  - phase: 04-01
    provides: GET /api/shopping-list/ with auto-entries (id=null)
  - phase: 04-02
    provides: POST /{entry_id}/check-off and _record_txn helper
  - phase: 04-03
    provides: useShoppingList hook, ShoppingList page, CheckOffSheet

provides:
  - "POST /api/shopping-list/items/{item_id}/restock — direct item restock without persisted entry"
  - "useShoppingList.checkOff(entryId, qty, itemId) — routes to items-restock when entryId is null"
  - "ShoppingList.jsx passes entry.item_id to checkOff for auto-entry routing"

affects: [verify, uat]

tech-stack:
  added: []
  patterns:
    - "Item-keyed restock endpoint mirrors entry-keyed check-off semantics for auto entries"
    - "Hook routing: null entryId + itemId → /items/{id}/restock; positive entryId → /{id}/check-off"

key-files:
  created: []
  modified:
    - backend/routers/shopping_list.py
    - backend/tests/test_shopping_list.py
    - frontend/src/hooks/useShoppingList.js
    - frontend/src/hooks/useShoppingList.test.js
    - frontend/src/pages/ShoppingList.jsx
    - frontend/src/pages/ShoppingList.test.jsx

key-decisions:
  - "Reused CheckOffBody schema verbatim — no new schema needed"
  - "Transaction assertion changed to .order_by(id.desc()).first() to avoid cross-test accumulation in non-autoincrement SQLite"

patterns-established:
  - "Auto-entry gap fix pattern: add item-keyed endpoint mirroring entry-keyed semantics; hook routes by checking entryId nullability"

requirements-completed: [SHOP-03, RSTO-03]

duration: 25min
completed: 2026-04-19
---

# Plan 04-05: Gap 1 Fix — Auto-Entry Check-Off Summary

**New `POST /api/shopping-list/items/{item_id}/restock` endpoint + hook routing fix eliminates "Couldn't load shopping list" error when checking off auto-populated shopping list items**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `restock_by_item` endpoint: atomically restocks item, records Transaction, handles D-08 entry deletion — identical semantics to entry-keyed check-off but keyed by item_id
- Updated `useShoppingList.checkOff` to accept optional third `item_id` arg; routes to `/items/{id}/restock` when `entryId` is null
- Updated `ShoppingList.jsx` CheckOffSheet confirm handler to pass `entry.item_id` alongside `entry.id`
- 7 new backend tests (37 total, all green); 7 new frontend tests (197 total, all green)

## Task Commits

1. **Task 1: Backend endpoint + tests** — `cdd2834`
2. **Task 2: Hook routing + page wiring + tests** — `7497119`

## Files Created/Modified
- `backend/routers/shopping_list.py` — new `restock_by_item` endpoint appended
- `backend/tests/test_shopping_list.py` — 7 new tests (tests 31-37)
- `frontend/src/hooks/useShoppingList.js` — `checkOff` gains optional `item_id` param with routing logic
- `frontend/src/hooks/useShoppingList.test.js` — 6 new tests covering auto-entry routing paths
- `frontend/src/pages/ShoppingList.jsx` — CheckOffSheet `onConfirm` passes `checkingOff.item_id`
- `frontend/src/pages/ShoppingList.test.jsx` — Test G verifying auto-entry wiring

## Decisions Made
- Transaction count assertion changed from `len(txns) == 1` to `.order_by(id.desc()).first()` because SQLite (without AUTOINCREMENT) reuses item IDs after deletion, causing transactions from prior tests to accumulate for the same item_id.

## Deviations from Plan
None — plan executed as specified. One test assertion style adjusted to match existing codebase pattern.

## Issues Encountered
- Test 31 initially failed with `6 == 1` on transaction count assertion — root cause: SQLite reuses primary key IDs after table-level DELETE in test fixture, causing cross-test transaction accumulation. Fixed by querying latest transaction via `order_by(id.desc()).first()`.

## Next Phase Readiness
- Gap 1 closed: UAT Test 6 should now pass for auto-populated entries
- Gap 2 (plan 04-06) remains: dismiss button for auto-populated items
