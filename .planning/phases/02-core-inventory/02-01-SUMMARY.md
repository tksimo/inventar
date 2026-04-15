---
phase: 02-core-inventory
plan: 01
subsystem: database
tags: [alembic, pydantic, sqlite, sqlalchemy, pytest, tdd]

# Dependency graph
requires:
  - phase: 01-add-on-scaffolding
    provides: FastAPI app, SQLAlchemy ORM (all 5 v1 tables), Alembic migration 0001, conftest fixtures, IngressUserMiddleware

provides:
  - Alembic migration 0002 with is_default column on categories and 4 seeded default categories
  - Category ORM model updated with is_default Boolean NOT NULL field
  - Pydantic v2 schemas package (schemas/item.py, category.py, location.py, __init__.py)
  - Wave 0 test scaffolds: test_categories.py (4 GREEN), test_items.py (5 GREEN schema + 14 RED router), test_locations.py (2 GREEN schema + 4 RED router)

affects: [02-02-routers, 03-frontend-foundations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pydantic v2 ConfigDict(from_attributes=True, use_enum_values=True) for ORM serialization with lowercase enum values"
    - "Alembic batch_alter_table required for SQLite ADD COLUMN NOT NULL"
    - "Wave 0 TDD: write failing API tests before routers exist; schema unit tests are immediately GREEN"
    - "extra='forbid' on all create/update schemas to prevent field injection (T-02-01, T-02-02)"

key-files:
  created:
    - backend/alembic/versions/0002_seed_default_categories.py
    - backend/schemas/__init__.py
    - backend/schemas/item.py
    - backend/schemas/category.py
    - backend/schemas/location.py
    - backend/tests/test_categories.py
    - backend/tests/test_items.py
    - backend/tests/test_locations.py
  modified:
    - backend/models/__init__.py

key-decisions:
  - "Alembic data migration (0002) chosen over startup seed for ORG-01 — runs exactly once at upgrade time, is idempotent, and survives container restarts"
  - "use_enum_values=True in ItemResponse ConfigDict serializes QuantityMode/StockStatus as lowercase strings without custom validators"
  - "CategoryCreate intentionally omits is_default to prevent client self-promotion (T-02-02)"
  - "Wave 0 tests written before routers: schema unit tests GREEN immediately, router-level tests RED until Plan 02-02"
  - "INSERT OR IGNORE in migration upgrade makes seeding idempotent even if categories pre-exist"

patterns-established:
  - "Schema unit tests: import ORM class + schema, call model_validate on hand-constructed instance — zero HTTP, GREEN immediately"
  - "Router-level Wave 0 tests: use client fixture, assert HTTP status — RED until Plan 02-02 provides routers"
  - "Alembic test helper: set INVENTAR_DB_URL env + reload db.database before running command.upgrade() in isolated temp DB"

requirements-completed: [ORG-01, USER-02]

# Metrics
duration: 12min
completed: 2026-04-15
---

# Phase 02 Plan 01: Data Contract — Migration 0002, Pydantic Schemas, Wave 0 Tests Summary

**Alembic migration 0002 seeds 4 default categories with is_default flag; Pydantic v2 schemas for Item/Category/Location with lowercase enum serialization and field-injection protection; Wave 0 TDD scaffolds with 11 green schema tests and 18 red router-contract tests**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-15T21:20:00Z
- **Completed:** 2026-04-15T21:32:49Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Migration 0002 adds `is_default` Boolean column to categories via `batch_alter_table` (required for SQLite) and seeds Food & pantry, Fridge & freezer, Cleaning & household, Personal care — all `is_default=1`. Downgrade removes seeded rows then drops column; re-upgrade is idempotent.
- Pydantic v2 schemas package with `ItemCreate/Update/Response`, `CategoryCreate/Update/Response`, `LocationCreate/Update/Response`. `ItemResponse` serializes enum values as lowercase strings via `use_enum_values=True`. All create/update schemas use `extra='forbid'` against field injection. `CategoryCreate` deliberately excludes `is_default` (T-02-02).
- Wave 0 test scaffolds committed: 4 category migration tests GREEN, 5 item schema unit tests GREEN, 2 location schema unit tests GREEN, 14 item router tests RED, 4 location router tests RED — unambiguous contract for Plan 02-02.

## Task Commits

1. **Task 1: is_default column + migration 0002 + category tests** — `fb8b7b2` (feat)
2. **Task 2: Pydantic schemas + Wave 0 test scaffolds** — `3d43b89` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/models/__init__.py` — Added `is_default = Column(Boolean, nullable=False, default=False)` to Category
- `backend/alembic/versions/0002_seed_default_categories.py` — Migration: adds is_default column, seeds 4 default categories, supports downgrade
- `backend/schemas/__init__.py` — Package entry point exporting all 9 public schema names
- `backend/schemas/item.py` — ItemCreate, ItemUpdate, ItemResponse with Pydantic v2 ConfigDict
- `backend/schemas/category.py` — CategoryCreate (no is_default), CategoryUpdate, CategoryResponse
- `backend/schemas/location.py` — LocationCreate, LocationUpdate, LocationResponse
- `backend/tests/test_categories.py` — 4 migration/ORM tests (all GREEN)
- `backend/tests/test_items.py` — 5 schema unit tests (GREEN) + 14 router-level tests (RED)
- `backend/tests/test_locations.py` — 2 schema unit tests (GREEN) + 4 router-level tests (RED)

## Decisions Made

- Alembic data migration (0002) over startup seed: runs once at upgrade, survives restarts, is testable
- `use_enum_values=True` in `ConfigDict` is the idiomatic Pydantic v2 approach (avoids custom `@field_serializer`)
- `INSERT OR IGNORE` makes seed idempotent — safe to run against a DB that already has those category names
- Test isolation: alembic tests set `INVENTAR_DB_URL` env var and reload `db.database` module before each run, matching the pattern established in `test_db.py`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Windows SQLite file-locking with TemporaryDirectory**
- **Found during:** Task 1 (test_custom_category_defaults_to_false)
- **Issue:** `tempfile.TemporaryDirectory()` context manager raised `PermissionError` on Windows when trying to delete the SQLite file on exit — SQLAlchemy connection pool held an open file handle
- **Fix:** Switched from `TemporaryDirectory()` context manager to `tempfile.mkdtemp()` (no cleanup on scope exit) and called `eng.dispose()` before leaving scope; also used `importlib.reload()` after alembic tests to restore `db.database` state
- **Files modified:** `backend/tests/test_categories.py`
- **Verification:** All 4 tests pass on Windows
- **Committed in:** fb8b7b2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking Windows file-lock)
**Impact on plan:** Minor test infrastructure fix specific to Windows SQLite behavior. No scope creep.

## Issues Encountered

- The alembic `env.py` reads `DATABASE_URL` from `db.database` at import time, so the test's `cfg.set_main_option("sqlalchemy.url", ...)` was overridden. Fixed by also setting `INVENTAR_DB_URL` env var and reloading the module, matching the approach in `test_db.py::test_migration_upgrade_head_creates_v1_tables`.

## Known Stubs

None — no placeholder data or hardcoded empty values introduced. Schema unit tests use real ORM instances; router-level tests are intentionally RED (not stubs).

## Next Phase Readiness

- Plan 02-02 (routers) can start immediately: 18 RED tests define the exact HTTP contract to satisfy
- `ItemResponse.last_updated_by_name` field is ready for the transaction JOIN query
- `CategoryCreate` excludes `is_default` — router must never accept it from clients
- All 28 pre-existing Phase 1 tests remain green; 11 new schema-unit tests green; 18 router tests RED as handoff

---
*Phase: 02-core-inventory*
*Completed: 2026-04-15*
