---
phase: 04-shopping-restock
plan: "01"
subsystem: backend
tags: [shopping-list, backend, alembic, fastapi, sqlalchemy, pydantic, tdd]
dependency_graph:
  requires: []
  provides: [shopping-list-get-endpoint, shopping-list-schemas, sort-order-migration]
  affects: [backend/routers, backend/schemas, backend/models, backend/alembic]
tech_stack:
  added: []
  patterns: [tdd-red-green, batch_alter_table-sqlite, auto-populate-dedup-pattern]
key_files:
  created:
    - backend/alembic/versions/0004_add_sort_order_to_shopping_list.py
    - backend/schemas/shopping_list.py
    - backend/routers/shopping_list.py
    - backend/tests/test_shopping_list.py
  modified:
    - backend/models/__init__.py
    - backend/schemas/__init__.py
    - backend/main.py
decisions:
  - "Auto-population uses Python-side dedup: persisted rows queried first, auto entries only emitted for items not in persisted_item_ids set"
  - "Sort order sentinel value 10^9 for NULL sort_order to achieve NULLS LAST in Python sort"
  - "Status-mode items auto-appear on status='out' regardless of threshold (threshold irrelevant for status mode)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-18T09:18:55Z"
  tasks_completed: 2
  files_changed: 7
---

# Phase 4 Plan 01: Shopping List GET Endpoint + Migration Summary

**One-liner:** Alembic migration 0004 adds `sort_order` to `shopping_list`; GET `/api/shopping-list/` returns unified manual + auto entries (items below threshold or status=out) with deduplication and stable sort.

---

## What Was Built

### Alembic Migration 0004
`backend/alembic/versions/0004_add_sort_order_to_shopping_list.py` adds a nullable `sort_order INTEGER` column to the `shopping_list` table using `batch_alter_table` (SQLite requirement). Existing rows are backfilled with `sort_order = id`. Downgrade drops the column.

### ORM Update
`ShoppingListEntry` in `backend/models/__init__.py` gains `sort_order = Column(Integer, nullable=True)` after `created_at`.

### Pydantic Schemas (`backend/schemas/shopping_list.py`)
Four schemas exported:
- `ShoppingListCreate` — POST body: `item_id (int, gt=0)`, `extra="forbid"` (T-04-01)
- `ShoppingListUpdate` — PATCH body: `sort_order (Optional[int], ge=1, le=10000)`, `extra="forbid"` (T-04-03)
- `CheckOffBody` — check-off body: `quantity_added (int, gt=0, le=10000)`, `extra="forbid"` (T-04-02)
- `ShoppingListEntryResponse` — unified response: `id (int|None)`, `item_id`, `item_name`, `quantity`, `quantity_mode`, `status`, `reorder_threshold`, `location_id`, `added_manually`, `sort_order`, `auto (bool)`, `use_enum_values=True`, `extra="forbid"` (T-04-04)

### Router (`backend/routers/shopping_list.py`)
`GET /api/shopping-list/` implements the SHOP-01 auto-population contract:
1. Queries all non-archived items
2. Queries all persisted `shopping_list` rows; builds `persisted_item_ids` set for O(1) dedup
3. Emits persisted rows as `auto=False` entries (with their `sort_order`)
4. Emits auto entries (`auto=True`, `id=None`) for items not already in the list that are:
   - `quantity_mode='exact'` AND `reorder_threshold IS NOT NULL` AND `(quantity or 0) <= reorder_threshold`, OR
   - `quantity_mode='status'` AND `status='out'`
5. Sorts by `(sort_order if not None else 10^9, item_name)` — persisted first, auto entries alphabetically

### main.py
`shopping_list` added to the router imports and `app.include_router(shopping_list.router)` registered after `barcode.router`, before the SPA catch-all.

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| test_shopping_list.py | 12 | All pass (GREEN) |
| Full backend suite | 93 | All pass (no regressions) |

### TDD Cycle
- **RED commit** `4a5e7d2`: 12 tests written; 11 fail with 404 (router not yet registered), 1 passes (column exists via ORM)
- **GREEN commit** `cd995bd`: router + schemas implemented; all 12 pass

---

## Commits

| Hash | Message |
|------|---------|
| `4a5e7d2` | test(04-01): add failing tests for shopping list GET (SHOP-01, D-02, D-03) |
| `cd995bd` | feat(04-01): add shopping list schemas + GET endpoint with auto-population (SHOP-01) |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Surface Scan

No new security-relevant surface beyond what is documented in the plan's threat model. All endpoints inherit HA ingress auth (T-04-07). GET endpoint uses ORM-only queries (T-04-05). Response schema has `extra="forbid"` preventing `checked_off`/`created_at` disclosure (T-04-04).

---

## Known Stubs

None. The GET endpoint is fully wired. Write operations (POST, PATCH, DELETE, check-off) are deferred to Plan 02 as designed.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/alembic/versions/0004_add_sort_order_to_shopping_list.py | FOUND |
| backend/schemas/shopping_list.py | FOUND |
| backend/routers/shopping_list.py | FOUND |
| backend/tests/test_shopping_list.py | FOUND |
| .planning/phases/04-shopping-restock/04-01-SUMMARY.md | FOUND |
| commit 4a5e7d2 | FOUND |
| commit cd995bd | FOUND |
