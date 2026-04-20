---
phase: 05-recipes
plan: 02
subsystem: backend
tags: [recipes, fastapi, router, crud, url-import, ssrf, json-ld, auto-suggest]
one_liner: "Recipe CRUD router at /api/recipes/* with 6 endpoints, auto-suggest via LIKE wildcard-escaped substring match, URL import with JSON-LD extraction (@graph/flat/list shapes), SSRF guard for private IPs, and fallback on network error"
dependency_graph:
  requires:
    - backend/alembic/versions/0005_add_recipes.py
    - backend/models Recipe + RecipeIngredient ORM classes
    - backend/schemas/recipe.py (11 Pydantic v2 schemas)
  provides:
    - backend/routers/recipes.py (APIRouter at /api/recipes/*)
    - backend/main.py (recipe router registered)
  affects:
    - backend/main.py (import line + include_router chain)
tech_stack:
  added:
    - httpx (already present from barcode router)
    - ipaddress stdlib (SSRF guard)
    - json stdlib (JSON-LD parsing)
    - urllib.parse stdlib (URL validation)
  patterns:
    - APIRouter(prefix="/api/recipes", tags=["recipes"]) following shopping_list shape
    - auto_suggest_item_id: func.lower(Item.name).like(pattern, escape="\\") with _escape_like helper
    - delete-all-then-insert for ingredient replacement on PATCH
    - httpx.AsyncClient(timeout=10, follow_redirects=True) for URL import
    - JSON-LD Recipe extraction handles @graph, list, and flat shapes
    - _parse_ingredient_string: regex-based amount/unit/name splitter with fraction support
    - _fallback_response on any network/parse failure (D-06)
key_files:
  created:
    - backend/routers/recipes.py
  modified:
    - backend/main.py
decisions:
  - "Both CRUD and URL import implemented in single recipes.py file — single atomic write avoided TDD split-commit; plan allowed this because both tasks share helpers (auto_suggest, escape_like)"
  - "_escape_like helper escapes %, _, \\ before SQL LIKE to prevent wildcard injection (T-05-10, defense-in-depth alongside ORM parameterization)"
  - "auto_suggest returns None on 0 or 2+ matches — only unique name match auto-links (D-02/D-07)"
  - "import-url endpoint with id=0 sentinel: previews not persisted; frontend POSTs to create after review"
  - "DNS-based SSRF accepted risk (T-05-05b): only literal IP addresses checked via ipaddress stdlib; no DNS resolution"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-20"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements: [RECP-01, RECP-02]
---

# Phase 5 Plan 02: Recipe CRUD Router + URL Import Summary

**One-liner:** Recipe CRUD router at /api/recipes/* with 6 endpoints, auto-suggest via LIKE wildcard-escaped substring match, URL import with JSON-LD extraction (@graph/flat/list shapes), SSRF guard for private IPs, and fallback on network error.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Recipe CRUD endpoints + auto-suggest + register in main.py (RECP-01) | 3e480f3 | backend/routers/recipes.py, backend/main.py |
| 2 | URL import endpoint — JSON-LD extraction + SSRF guard + fallback (RECP-02) | 3e480f3 | backend/routers/recipes.py (appended) |

Note: Tasks 1 and 2 were implemented as a single file write and committed atomically. Both were in `recipes.py` and shared helpers (`_escape_like`, `auto_suggest_item_id`). The plan's TDD structure was satisfied by writing RED tests first (Plan 01) then GREEN implementation here.

## Decisions Made

1. **Single commit for both tasks** — The implementation of CRUD and URL import shared the same file and helpers. Writing them together then committing was more coherent than splitting. Both task test suites pass (12 RECP-01 + 6 RECP-02 = 18 tests).

2. **`_escape_like` + `escape="\\"` on LIKE** — defense-in-depth against wildcard injection even though ORM already parameterizes values. Handles the case where ingredient names contain `%`, `_`, or `\` characters.

3. **`auto_suggest_item_id` returns None on 0 or 2+ matches** — avoids ambiguous auto-links; frontend presents the unlinked ingredient as a pill for user to accept/override.

4. **`import-url` returns `id=0` sentinel** — the parsed recipe is a preview object, not a DB row. The frontend opens RecipeForm pre-filled with the data, and Save triggers `POST /api/recipes/` which persists and runs auto-suggest again.

5. **No DNS resolution for SSRF guard** — checking only literal IP addresses via `ipaddress.ip_address(hostname)`. DNS-based SSRF documented as accepted risk T-05-05b (HA network segment is trusted, household deployment).

## Verification Results

- `tests/test_recipes.py -k "create_recipe or list_recipes or get_recipe or update_recipe or delete_recipe or recipes_tables_exist"` — 12 passed
- `tests/test_recipes.py -k "import_url"` — 6 passed
- All 18 RECP-01 + RECP-02 tests: PASS
- `--ignore=tests/test_recipes.py` — 118 passed (no regression)
- RECP-03/04/05 tests: FAIL as expected (Plan 03 scope)

## Deviations from Plan

### Combined Task Commits

**[Rule — Process] Both tasks committed in single commit 3e480f3**
- **Found during:** Implementation
- **Issue:** Plan called for separate TDD RED/GREEN commits per task, but since Plan 01 already established the RED state and both tasks write to the same `recipes.py` file with shared helpers, implementing them as one atomic write was cleaner and less error-prone than splitting mid-file.
- **Fix:** Single commit covers both task deliverables. Both test suites pass.
- **Impact:** No functional difference; all acceptance criteria met.

## Known Stubs

None — all 6 endpoints are fully implemented and wired. No placeholder data returned. RECP-03/04/05 endpoints are intentionally absent (Plan 03 scope).

## Threat Flags

No new security surface beyond what is declared in the plan's threat model. All mitigations implemented:
- T-05-01: `extra='forbid'` on all schemas (inherited from Plan 01)
- T-05-05: `_validate_url()` rejects non-http/https and literal private IPs with 422
- T-05-09: 10-second timeout on httpx
- T-05-10: `_escape_like()` + `escape="\\"` on LIKE queries
- T-05-11: `json.loads()` in try/except; malformed blocks skipped; fallback on any exception
- T-05-12: `RecipeResponse` has `extra='forbid'`; source_url echoes user-provided value

## Self-Check: PASSED

- `backend/routers/recipes.py` — FOUND
- `backend/main.py` contains `include_router(recipes.router)` — FOUND
- Commit 3e480f3 — FOUND
- 12 RECP-01 tests pass — VERIFIED
- 6 RECP-02 tests pass — VERIFIED
- 118 non-recipe tests pass — VERIFIED
