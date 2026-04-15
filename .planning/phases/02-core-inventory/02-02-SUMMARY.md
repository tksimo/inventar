---
phase: 02-core-inventory
plan: 02
subsystem: backend-routers
tags: [fastapi, sqlalchemy, sqlite, pytest, tdd, transactions, audit-trail]

# Dependency graph
requires:
  - phase: 02-core-inventory/02-01
    provides: Pydantic schemas, ORM models with is_default, Wave 0 RED tests

provides:
  - GET/POST/PATCH/DELETE /api/items/ — full CRUD with Transaction audit trail
  - GET/POST/PATCH/DELETE /api/categories/ — with default-lock enforcement
  - GET/POST/PATCH/DELETE /api/locations/ — with FK null-out on delete
  - last_updated_by_name populated via MAX(timestamp) subquery (N+1 avoided)
  - D-03 auto-flip: quantity_mode=status+status=out+quantity=null in one PATCH
  - Transaction append-only: every mutation inserts exactly one row

affects: [02-04-inventory-page, 02-05-settings-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "passive_deletes=True on Item.transactions relationship prevents ORM null-out FK on item delete"
    - "_restore_schema_modules() helper reloads models+schemas after db.database reload to keep Pydantic class identity consistent across test session"
    - "Two-query N+1 avoidance: fetch items, then MAX(timestamp) subquery for last_updated_by_name, hydrate in Python"
    - "Transaction committed before item delete — item row must exist when txn FK is inserted"
    - "model_copy(update={...}) to inject computed last_updated_by_name into frozen Pydantic response"

key-files:
  created:
    - backend/routers/items.py
    - backend/routers/categories.py
    - backend/routers/locations.py
  modified:
    - backend/main.py
    - backend/models/__init__.py
    - backend/tests/test_categories.py
    - backend/tests/test_db.py

key-decisions:
  - "passive_deletes=True on Item.transactions: prevents SQLAlchemy from emitting UPDATE transactions SET item_id=NULL before DELETE — required because Transaction.item_id is NOT NULL and the ORM relationship default cascade would violate it"
  - "_restore_schema_modules() called after every importlib.reload(db.database): ensures models and Pydantic schemas are re-imported together so enum class identity stays consistent across the session-scoped test DB"
  - "Transaction committed in two steps for delete: txn inserted+committed first, item deleted second — FK constraint on transactions.item_id requires item row to exist when txn is committed"
  - "model_copy(update={'last_updated_by_name': name}) chosen over rebuilding ItemResponse from dict — preserves all validated fields while injecting computed value"

# Metrics
duration: ~25min
completed: 2026-04-15
---

# Phase 02 Plan 02: Backend Routers — Items, Categories, Locations Summary

**Three FastAPI routers turning 18 Wave-0 RED tests GREEN: full item CRUD with append-only transaction audit trail and last_updated_by_name JOIN; category default-lock with 403 enforcement; location/category FK null-out on delete; D-03 auto-flip; 57 total backend tests green**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-15T21:45:00Z
- **Completed:** 2026-04-15T22:10:00Z
- **Tasks:** 2
- **Files modified/created:** 7

## Accomplishments

### Task 1: Items router

- `POST /api/items/` — creates item, flushes to get ID, inserts `Transaction(action="add")`, returns 201 + ItemResponse
- `GET /api/items/` — filters archived by default (`?include_archived=true` to include); populates `last_updated_by_name` via two-query approach (items query + MAX(timestamp) subquery grouped by item_id, hydrated in Python — N+1 avoided at household scale)
- `GET /api/items/{id}` — single item with same last_updated_by_name logic; 404 if missing/archived
- `PATCH /api/items/{id}` — `model_dump(exclude_unset=True)` → `setattr` on ORM instance (never raw SQL, T-02-06); detects quantity-only change for `action="quantity_change"` with delta; D-03 auto-flip (`quantity_mode=status + status=out + quantity=None`) treated as `action="update"` with explicit null
- `DELETE /api/items/{id}` — inserts Transaction(action="delete") and commits BEFORE deleting item (FK constraint); uses `db.expire(item, ["transactions"])` → separate commit cycle
- Added `passive_deletes=True` to `Item.transactions` relationship (Rule 1 bug fix)
- All 4 transaction actions (`add`, `update`, `quantity_change`, `delete`) tested and green

### Task 2: Categories and locations routers

- `GET /api/categories/` — ordered `is_default DESC, name ASC` (defaults first in dropdowns)
- `POST /api/categories/` — hard-sets `is_default=False` server-side regardless of body (T-02-15); 409 on IntegrityError (duplicate name)
- `PATCH /api/categories/{id}` — 403 if `is_default=True` ("Default categories cannot be renamed")
- `DELETE /api/categories/{id}` — 403 if `is_default=True`; else bulk-update `Item.category_id = None` then delete (T-02-14)
- Locations router mirrors categories but without default-lock; DELETE nullifies `Item.location_id`
- Both routers registered in `main.py` lines 27-28, before SPA catch-all at line 52
- Fixed `test_categories.py` and `test_db.py`: added `_restore_schema_modules()` helper to reload models+schemas after `importlib.reload(db.database)` — prevents Pydantic enum class identity mismatch

## Task Commits

1. **Task 1: Items router** — `1d25639` (feat)
2. **Task 2: Categories + locations routers** — `c3c3ab7` (feat)

## Files Created/Modified

- `backend/routers/items.py` — 5 endpoints, 4 transaction actions, last_updated_by_name helper
- `backend/routers/categories.py` — 5 endpoints, default-lock enforcement, FK null-out
- `backend/routers/locations.py` — 5 endpoints, FK null-out on delete
- `backend/main.py` — added `from routers import health, items, categories, locations`; 4 include_router calls before SPA
- `backend/models/__init__.py` — `passive_deletes=True` on `Item.transactions` relationship
- `backend/tests/test_categories.py` — `_restore_schema_modules()` in alembic helpers; removed `importlib.reload(mdl)` from `test_custom_category_defaults_to_false`
- `backend/tests/test_db.py` — `_restore_schema_modules()` helper + called from all three test finally blocks

## Decisions Made

- `passive_deletes=True` on `Item.transactions`: the `Transaction.item_id` column is `NOT NULL`. Without this flag, SQLAlchemy tries to emit `UPDATE transactions SET item_id=NULL` before deleting the parent item — violating the constraint. With `passive_deletes=True` the ORM leaves FK rows untouched and lets the DB enforce (or not) the constraint.
- Two-step delete for Transaction: commit the `Transaction(action="delete")` row first in its own transaction, then re-query and delete the item. This ensures the FK is satisfied at commit time without needing to change the schema or disable constraints.
- `model_copy(update={"last_updated_by_name": ...})` on Pydantic responses: avoids re-validating the full ORM object after adding the computed field; uses Pydantic v2's supported mutation path.
- `_restore_schema_modules()` pattern: when test infrastructure reloads `db.database` + `models` (for alembic isolation), Pydantic's compiled validator for `ItemResponse` retains a reference to the old `QuantityMode` class. Reloading `schemas.*` after the module reloads keeps class identity consistent across the session.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLAlchemy ORM cascade null-out violated NOT NULL on transactions.item_id**
- **Found during:** Task 1, `test_delete_item`
- **Issue:** `db.delete(item)` triggered SQLAlchemy to emit `UPDATE transactions SET item_id=NULL` for all related transaction rows (from prior tests in the session), violating `NOT NULL` constraint on `transactions.item_id`
- **Fix:** Added `passive_deletes=True` to `Item.transactions` relationship in `backend/models/__init__.py`, preventing the ORM cascade null-out. Also restructured delete endpoint to commit the transaction row before the item deletion.
- **Files modified:** `backend/models/__init__.py`, `backend/routers/items.py`
- **Commit:** 1d25639

**2. [Rule 1 - Bug] Pydantic QuantityMode class identity broken after importlib.reload in test_categories.py and test_db.py**
- **Found during:** Task 2, full suite run
- **Issue:** `test_categories.py::test_custom_category_defaults_to_false` and `test_db.py::test_schema_create_all_v1_tables` used `importlib.reload(models)` which created a new `QuantityMode` class. Pydantic's cached `ItemResponse` validator still referenced the OLD class, causing `ValidationError: Input should be 'exact' or 'status'` on subsequent schema unit tests
- **Fix:** Added `_restore_schema_modules()` helper to both files that reloads `models`, `schemas.item`, `schemas.category`, `schemas.location`, and `schemas` in sequence after restoring the DB URL. Called from every `finally` block that does `importlib.reload(db.database)`
- **Files modified:** `backend/tests/test_categories.py`, `backend/tests/test_db.py`
- **Commit:** c3c3ab7

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in ORM cascade config and test infrastructure module reloading)
**Impact on plan:** Both fixes were confined to the files listed in the plan. No scope creep.

## Known Stubs

None — all endpoints return real data from the SQLite DB. No hardcoded empty arrays, placeholder text, or TODO markers.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers. T-02-06 through T-02-15 are all mitigated as designed:
- T-02-06: Pydantic ItemUpdate `extra='forbid'` + `setattr` ORM assignment — no raw SQL
- T-02-07/08: is_default check on PATCH/DELETE → 403
- T-02-09: Every mutation inserts Transaction row with ha_user_name
- T-02-10: No UPDATE/DELETE on Transaction rows anywhere in routers
- T-02-13: IntegrityError → 409 + rollback on duplicate name
- T-02-14: Explicit bulk-update to NULL before category/location delete
- T-02-15: CategoryCreate schema excludes is_default; router hard-sets False

## Self-Check

**Files verified to exist:**
- backend/routers/items.py — FOUND
- backend/routers/categories.py — FOUND
- backend/routers/locations.py — FOUND

**Commits verified:**
- 1d25639 — feat(02-02): implement items router with CRUD, transaction audit, and last_updated_by_name
- c3c3ab7 — feat(02-02): implement categories and locations routers with default-lock and FK null-out

## Self-Check: PASSED

---
*Phase: 02-core-inventory*
*Completed: 2026-04-15*
