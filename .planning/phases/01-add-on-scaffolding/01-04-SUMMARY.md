---
phase: 01-add-on-scaffolding
plan: "04"
subsystem: infra
tags: [integration, fastapi, spa, home-assistant, ingress, smoke-test]

requires:
  - phase: 01-02
    provides: "FastAPI app with conditional SPA mount, /healthz, IngressUserMiddleware, conftest.py"
  - phase: 01-03
    provides: "frontend/dist/ built artifact (index.html + assets/) with base: './' relative paths"

provides:
  - FastAPI app (backend/main.py) with UNCONDITIONAL SPA mount + fail-fast RuntimeError when dist/ missing
  - INVENTAR_SKIP_SPA=1 env flag for unit test isolation (set in conftest.py)
  - test_spa_integration.py: 5 integration tests proving SPA+API coexistence
  - test_smoke_stack.py: 7 smoke tests covering INFRA-01 through INFRA-05 end-to-end
  - scripts/build.sh: Linux/macOS frontend build helper (LF-only, verified shebang)
  - scripts/build.ps1: Windows PowerShell equivalent with -Clean flag
  - README.md: complete clone → build → docker build → HAOS install documentation

affects:
  - Phase 2+ (all 24 backend tests pass; integration test pattern established for future plans)

tech-stack:
  added: []
  patterns:
    - INVENTAR_SKIP_SPA=1 env flag — unit tests opt out of SPA; integration tests opt in
    - Unconditional SPA mount with fail-fast RuntimeError pointing at build helper
    - Module-scope fixture reload pattern for integration tests (pop sys.modules, reimport)

key-files:
  created:
    - backend/tests/test_spa_integration.py
    - backend/tests/test_smoke_stack.py
    - scripts/build.sh
    - scripts/build.ps1
    - README.md
  modified:
    - backend/main.py
    - backend/tests/conftest.py

key-decisions:
  - "INVENTAR_SKIP_SPA=1 set in conftest.py before main import — unit tests never touch frontend/dist; integration tests explicitly clear it"
  - "Unconditional SPA mount with RuntimeError (not silent no-op) — fail-fast at container startup is easier to diagnose than blank UI"
  - "Module-level sys.modules pop + importlib.reload in spa_client fixture — forces main.py module code to re-execute with flag cleared"

patterns-established:
  - "Pattern: Integration test isolation — clear INVENTAR_SKIP_SPA before reload, restore after yield"
  - "Pattern: Build helper pre-step — scripts/build.sh must run before docker build (documented in README)"

requirements-completed: [INFRA-01, INFRA-02, INFRA-04, INFRA-05]

duration: 4min
completed: 2026-04-15
---

# Phase 01 Plan 04: Integration Wiring + Smoke Tests Summary

**FastAPI unconditionally mounts frontend/dist/ as the SPA (fail-fast RuntimeError if missing), INVENTAR_SKIP_SPA=1 isolates unit tests, 12 new integration+smoke tests cover all INFRA-01 through INFRA-05 requirements end-to-end, and build helper scripts + README document the complete local workflow.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-15T11:41:54Z
- **Completed:** 2026-04-15T11:45:33Z
- **Tasks:** 2 completed
- **Files modified:** 5 created, 2 modified

## Accomplishments

- Replaced conditional `if os.path.isdir(_ASSETS_DIR)` SPA mount with unconditional mount + fail-fast `RuntimeError` pointing at `scripts/build.sh` when `frontend/dist/` is missing
- Added `INVENTAR_SKIP_SPA=1` env flag; set it in `conftest.py` before `main` is imported — unit tests remain isolated from the SPA requirement
- Created `test_spa_integration.py` (5 tests): `/healthz` API route wins catch-all, root returns HTML, relative assets, assets mount live, deep-links return index.html
- Created `test_smoke_stack.py` (7 tests): all five INFRA-0X requirements exercised end-to-end including HA ingress header passthrough
- Created `scripts/build.sh` (LF-only) and `scripts/build.ps1` for pre-docker frontend build
- Created `README.md` documenting complete local build + HAOS install workflow

## Task Commits

Each task was committed atomically:

1. **Task 1: Unconditional SPA mount + INVENTAR_SKIP_SPA guard + integration tests** - `1b9059b` (feat)
2. **Task 2: Build helper scripts and root README** - `c1e2dfe` (feat)

## Files Created/Modified

- `backend/main.py` - Replaced conditional mount with unconditional mount + RuntimeError guard + INVENTAR_SKIP_SPA opt-out
- `backend/tests/conftest.py` - Added `os.environ["INVENTAR_SKIP_SPA"] = "1"` after INVENTAR_DB_URL line
- `backend/tests/test_spa_integration.py` - 5 integration tests: healthz regression, root HTML, relative assets, assets mount, deep-links
- `backend/tests/test_smoke_stack.py` - 7 smoke tests: INFRA-01 through INFRA-05 with and without ingress headers
- `scripts/build.sh` - Linux/macOS build helper: npm install + npm run build, verifies dist/index.html
- `scripts/build.ps1` - Windows PowerShell build helper with -Clean flag
- `README.md` - Architecture, local build workflow, test commands, HAOS install steps, critical constraints, project layout

## Decisions Made

- `INVENTAR_SKIP_SPA=1` in conftest.py before `main` import — the existing conditional mount was live in unit tests when `frontend/dist/` existed (on dev machines), which caused `test_ingress_user_populated` to fail because the catch-all ate the dynamically registered `/_test_user` route. Setting the skip flag before import ensures unit tests always run without the catch-all.
- Unconditional mount over conditional — fails loudly at container startup with a clear remediation message instead of silently booting with a broken UI.
- Module reload pattern in fixtures — `sys.modules.pop("main", None)` + `importlib.reload(main)` forces the module-level SPA mount code to re-execute with `INVENTAR_SKIP_SPA` cleared.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test_auth::test_ingress_user_populated failing due to catch-all eating dynamic route**
- **Found during:** Task 1 (running full test suite after conftest.py update)
- **Issue:** Before adding `INVENTAR_SKIP_SPA=1` to conftest.py, the module-level SPA mount activated on import when `frontend/dist/` existed. The `test_ingress_user_populated` test dynamically registers `GET /_test_user` on `app`, then creates a new `TestClient`. The catch-all `/{full_path:path}` was already registered and matched `/_test_user` before the new route, so `captured` dict was never populated.
- **Fix:** Setting `INVENTAR_SKIP_SPA=1` before `main` import in conftest.py ensures unit tests always import the app without the catch-all registered. The dynamic route test now works correctly.
- **Files modified:** `backend/tests/conftest.py`
- **Verification:** `pytest tests/ -q` — 24 passed
- **Committed in:** 1b9059b

---

**Total deviations:** 1 (pre-existing bug surfaced by correct conftest.py behavior — fixed inline)
**Impact on plan:** Positive. All 24 tests now pass; test suite is more reliable.

## Known Stubs

None. All routes are implemented. The three SPA page components remain intentional scaffolding stubs (from Plan 01-03) pending Phase 2 feature content — this is documented in the 01-03 SUMMARY.

## Threat Flags

None. All threat mitigations from the plan's threat model are addressed:
- T-01-21: FastAPI `StaticFiles` handles path traversal — no custom file handler written
- T-01-22: `test_healthz_still_returns_json` in `test_spa_integration.py` is the regression guard for route ordering
- T-01-23: RuntimeError accepted — container startup only, supervisor logs, no user data
- T-01-24: Catch-all returning small static file — accepted for household scale
- T-01-25: `test_infra_04_ingress_headers_do_not_break_anything` asserts header passthrough does not alter response body
- T-01-26: npm supply-chain risk accepted — pinned exact versions in package.json
- T-01-27: `/data/inventar.db` path documented in README — accepted (well-known HA convention)

## Self-Check: PASSED

- backend/main.py: FOUND (contains `raise RuntimeError(`, `INVENTAR_SKIP_SPA`, `app.mount("/assets"`)
- backend/tests/conftest.py: FOUND (contains `INVENTAR_SKIP_SPA`)
- backend/tests/test_spa_integration.py: FOUND (contains `test_root_serves_index_html`)
- backend/tests/test_smoke_stack.py: FOUND (contains `test_deep_link_returns_index_html`)
- scripts/build.sh: FOUND (LF-only, correct shebang)
- scripts/build.ps1: FOUND
- README.md: FOUND
- Commit 1b9059b: FOUND
- Commit c1e2dfe: FOUND
- pytest: 24 passed

---
*Phase: 01-add-on-scaffolding*
*Completed: 2026-04-15*
