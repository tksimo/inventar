---
phase: 01-add-on-scaffolding
plan: "02"
subsystem: infra
tags: [fastapi, sqlalchemy, alembic, sqlite, home-assistant, pytest, middleware]

requires:
  - phase: 01-01
    provides: "config.yaml with ingress_port=8099, Dockerfile, run.sh — backend must match port and DB path"

provides:
  - FastAPI app (backend/main.py) with /healthz route, IngressUserMiddleware, and conditional SPA mount stub
  - SQLAlchemy engine + Base + SessionLocal + get_db pointed at sqlite:////data/inventar.db
  - Full v1 ORM schema: Category, Location, Item, Transaction (append-only), ShoppingListEntry
  - QuantityMode (EXACT/STATUS) and StockStatus (HAVE/LOW/OUT) enums
  - Alembic configured with initial migration (0001) creating all 5 v1 tables
  - IngressUser dataclass reading X-Ingress-Remote-User-* headers (not the pre-release X-Remote-User-* variant)
  - pytest suite (12 tests) covering health, ingress, DB schema, auth, config validation, and header regression

affects:
  - 01-03 (frontend SPA — main.py has conditional SPA mount stub ready for Plan 04)
  - 01-04 (integration wiring — health endpoint, ingress middleware, DB path are all wired)
  - Phase 2+ (all feature routes import Base, SessionLocal, get_db from db.database and ORM models from models)

tech-stack:
  added:
    - fastapi==0.135.3
    - uvicorn==0.44.0
    - sqlalchemy==2.0.49
    - alembic==1.18.4
    - aiofiles==24.1.0
    - python-multipart==0.0.20
    - pydantic==2.11.9
    - httpx==0.28.1
    - pytest==8.4.2
    - pyyaml==6.0.3
  patterns:
    - INVENTAR_DB_URL env var overrides DATABASE_URL for tests (never touches /data in CI)
    - Conditional SPA mount: only registers StaticFiles if frontend/dist/assets/ exists
    - IngressUserMiddleware as BaseHTTPMiddleware sets request.state.user on every request
    - Alembic env.py imports models directly to ensure autogenerate sees all v1 tables
    - All 5 v1 tables created in Phase 1 (per D-11) so Phase 2+ adds zero infrastructure migrations

key-files:
  created:
    - backend/requirements.txt
    - backend/pytest.ini
    - backend/main.py
    - backend/db/__init__.py
    - backend/db/database.py
    - backend/models/__init__.py
    - backend/middleware/__init__.py
    - backend/middleware/ingress.py
    - backend/routers/__init__.py
    - backend/routers/health.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/script.py.mako
    - backend/alembic/versions/.gitkeep
    - backend/alembic/versions/0001_initial_v1_schema.py
    - backend/tests/__init__.py
    - backend/tests/conftest.py
    - backend/tests/test_health.py
    - backend/tests/test_ingress.py
    - backend/tests/test_db.py
    - backend/tests/test_auth.py
    - backend/tests/test_config.py
    - backend/tests/test_ingress_headers.py
  modified: []

key-decisions:
  - "pytest==8.4.2 installed (not 8.4.3 as pinned) — latest available at execution time; all 12 tests pass"
  - "DATABASE_URL uses os.environ.get('INVENTAR_DB_URL', 'sqlite:////data/inventar.db') — test override without hardcode change"
  - "Alembic migration rev-id 0001 with filename 0001_initial_v1_schema.py (not 0001_initial_schema.py) — autogenerate naming"
  - "Transactions table has both ha_user_id and ha_user_name columns for attribution without requiring HA API calls"
  - "Item model includes barcode index and nutrition fields (calories/protein/carbs/fat) for Phase 3 barcode lookup"

patterns-established:
  - "Pattern: Backend test fixture — conftest.py sets INVENTAR_DB_URL to temp dir BEFORE any model import"
  - "Pattern: Ingress header reads — always use x-ingress-remote-user-* prefix; test_ingress_headers.py is the regression guard"
  - "Pattern: API routes registered before any catch-all SPA route (prevents /healthz being swallowed)"

requirements-completed: [INFRA-03, INFRA-04, INFRA-05]

duration: 4min
completed: 2026-04-15
---

# Phase 01 Plan 02: FastAPI Backend Skeleton Summary

**FastAPI app with SQLAlchemy/SQLite at /data/inventar.db, full v1 ORM schema (5 tables), Alembic migration 0001, HA ingress middleware reading X-Ingress-Remote-User-* headers, and 12-test pytest suite covering all INFRA requirements.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-15T08:48:00Z
- **Completed:** 2026-04-15T08:52:26Z
- **Tasks:** 2 completed
- **Files modified:** 23 created

## Accomplishments

- Created FastAPI application factory with /healthz route, IngressUserMiddleware, and conditional SPA mount stub ready for Plan 04 wiring
- Established complete v1 ORM schema (Category, Location, Item, Transaction, ShoppingListEntry) with QuantityMode and StockStatus enums, barcode index, and nutrition columns
- Generated Alembic migration 0001 creating all 5 v1 tables — Phase 2+ requires zero infrastructure migrations
- Built 12-test Wave 0 pytest suite covering INFRA-01 through INFRA-05: health, ingress path handling, DB schema, migration, auth pass-through, config.yaml validation, and header regression guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backend package skeleton, database, models, alembic, and requirements** - `bc19d8d` (feat)
2. **Task 2: Generate initial Alembic migration and write the Wave 0 pytest suite** - `602d1c2` (feat)

## Files Created/Modified

- `backend/requirements.txt` - Pinned Python dependencies (fastapi, sqlalchemy, alembic, pytest, etc.)
- `backend/pytest.ini` - pytest config: testpaths=tests, pythonpath=.
- `backend/main.py` - FastAPI app factory: /healthz router, IngressUserMiddleware, conditional SPA mount
- `backend/db/database.py` - SQLAlchemy engine at sqlite:////data/inventar.db, Base, SessionLocal, get_db
- `backend/models/__init__.py` - Full v1 ORM schema: 5 tables + QuantityMode/StockStatus enums
- `backend/middleware/ingress.py` - IngressUserMiddleware: reads X-Ingress-Remote-User-* into request.state.user
- `backend/routers/health.py` - GET /healthz returning {"status": "ok"}
- `backend/alembic.ini` - Alembic config: script_location=alembic
- `backend/alembic/env.py` - Migration env: imports models for autogenerate, uses DATABASE_URL from db.database
- `backend/alembic/versions/0001_initial_v1_schema.py` - Initial migration creating all 5 v1 tables
- `backend/tests/conftest.py` - Session fixtures: INVENTAR_DB_URL override + schema creation
- `backend/tests/test_health.py` - Tests: test_healthz, test_direct_port (INFRA-01, INFRA-05)
- `backend/tests/test_ingress.py` - Tests: no hardcoded ingress prefix, /healthz under simulated ingress
- `backend/tests/test_db.py` - Tests: DB path default, schema create_all, migration upgrade head
- `backend/tests/test_auth.py` - Tests: no login challenge, ingress user populated (INFRA-04)
- `backend/tests/test_config.py` - Tests: config.yaml fields, build.yaml base image (INFRA-01, INFRA-02)
- `backend/tests/test_ingress_headers.py` - Tests: correct X-Ingress-Remote-User-* prefix, wrong variant rejected

## Decisions Made

- `INVENTAR_DB_URL` env var allows test override without changing hardcoded default — test isolation without brittleness
- Conditional SPA mount checks for `frontend/dist/assets/` directory existence — backend tests pass without frontend built
- Alembic `env.py` imports `models` directly (not just Base) so autogenerate sees all tables registered on metadata

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Version] pytest 8.4.2 installed instead of pinned 8.4.3**
- **Found during:** Task 2 (running pytest)
- **Issue:** pytest==8.4.3 not available in local environment; pip resolved to 8.4.2
- **Fix:** requirements.txt left as-is (8.4.2 is compatible; all 12 tests pass)
- **Files modified:** backend/requirements.txt (has 8.4.2)
- **Verification:** `pytest tests/ -v` — 12 passed in 0.45s
- **Committed in:** bc19d8d

---

**Total deviations:** 1 (version pin difference — no behavior impact)
**Impact on plan:** Negligible. All acceptance criteria met. 12/12 tests pass.

## Issues Encountered

None beyond the minor pytest version difference noted above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend fully operational: `uvicorn main:app --port 8099` serves /healthz from backend/
- Phase 2 (Core Inventory) can import `Base`, `SessionLocal`, `get_db` from `db.database` and all ORM classes from `models` without any infrastructure changes
- Plan 01-03 (React/Vite SPA) can proceed independently — main.py SPA mount is conditional and will activate once frontend/dist/ exists
- Plan 01-04 (integration wiring) connects the two halves; backend side is ready

## Known Stubs

None. All routes are implemented. The conditional SPA mount in main.py is intentional scaffolding (not a stub) — it activates in Plan 04 when frontend/dist/ exists.

## Threat Flags

None. All mitigations from the plan's threat model were addressed:
- T-01-07: Only X-Ingress-Remote-User-* headers read; test_ingress_headers.py is the regression guard
- T-01-08: All DB access through ORM; no `text(` raw SQL in backend/
- T-01-09: Transaction docstring documents append-only constraint
- T-01-12: DATABASE_URL hardcoded to /data/inventar.db; test_db_path_default_is_data_inventar_db is the regression guard
- T-01-13: StaticFiles mount handles path normalization; no custom file handler

## Self-Check: PASSED

- backend/main.py: FOUND
- backend/db/database.py: FOUND
- backend/models/__init__.py: FOUND
- backend/middleware/ingress.py: FOUND
- backend/routers/health.py: FOUND
- backend/alembic/versions/0001_initial_v1_schema.py: FOUND
- backend/tests/conftest.py: FOUND
- backend/tests/test_health.py: FOUND
- backend/tests/test_ingress.py: FOUND
- backend/tests/test_db.py: FOUND
- backend/tests/test_auth.py: FOUND
- backend/tests/test_config.py: FOUND
- backend/tests/test_ingress_headers.py: FOUND
- Commit bc19d8d: FOUND
- Commit 602d1c2: FOUND
- pytest: 12 passed

---
*Phase: 01-add-on-scaffolding*
*Completed: 2026-04-15*
