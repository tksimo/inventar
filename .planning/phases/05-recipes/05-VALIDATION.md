---
phase: 5
slug: recipes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 8.4.2 |
| **Framework (frontend)** | vitest 3.2.4 + @testing-library/react 16.3.0 |
| **Config file (backend)** | `backend/pytest.ini` |
| **Config file (frontend)** | `frontend/vitest.config.js` |
| **Quick run command (backend)** | `cd backend && python -m pytest tests/test_recipes.py -q` |
| **Quick run command (frontend)** | `cd frontend && npm test -- --run src/hooks/useRecipes.test.js` |
| **Full suite command** | `cd backend && python -m pytest -q && cd ../frontend && npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_recipes.py -q`
- **After every plan wave:** Run `cd backend && python -m pytest -q && cd ../frontend && npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | RECP-01 | — | N/A | unit | `pytest tests/test_recipes.py -q` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | RECP-02 | — | N/A | unit | `pytest tests/test_recipes.py::test_import_url_json_ld -xq` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | RECP-03–05 | — | N/A | unit | `pytest tests/test_recipes.py -q` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | RECP-01 | T-SSRF | extra='forbid'; ORM only | unit | `pytest tests/test_recipes.py::test_create_recipe -xq` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | RECP-01 | — | N/A | unit | `pytest tests/test_recipes.py::test_list_recipes -xq` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 1 | RECP-01 | — | N/A | unit | `pytest tests/test_recipes.py::test_get_recipe_detail -xq` | ❌ W0 | ⬜ pending |
| 5-02-04 | 02 | 1 | RECP-01 | — | N/A | unit | `pytest tests/test_recipes.py::test_update_recipe -xq` | ❌ W0 | ⬜ pending |
| 5-02-05 | 02 | 1 | RECP-01 | — | N/A | unit | `pytest tests/test_recipes.py::test_delete_recipe_cascades -xq` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | RECP-02 | T-SSRF | URL scheme validation; private IP rejection | unit | `pytest tests/test_recipes.py::test_import_url_json_ld -xq` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | RECP-02 | — | N/A | unit | `pytest tests/test_recipes.py::test_import_url_fallback -xq` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | RECP-03 | — | N/A | unit | `pytest tests/test_recipes.py::test_check_ingredients -xq` | ❌ W0 | ⬜ pending |
| 5-04-02 | 04 | 2 | RECP-04 | — | N/A | unit | `pytest tests/test_recipes.py::test_add_missing_to_shopping_list -xq` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 2 | RECP-05 | — | Append-only transactions | unit | `pytest tests/test_recipes.py::test_cook_deducts_exact -xq` | ❌ W0 | ⬜ pending |
| 5-05-02 | 05 | 2 | RECP-05 | — | N/A | unit | `pytest tests/test_recipes.py::test_cook_steps_down_status -xq` | ❌ W0 | ⬜ pending |
| 5-05-03 | 05 | 2 | RECP-05 | — | N/A | unit | `pytest tests/test_recipes.py::test_cook_writes_transactions -xq` | ❌ W0 | ⬜ pending |
| 5-05-04 | 05 | 2 | RECP-05 | — | N/A | unit | `pytest tests/test_recipes.py::test_cook_skips_unlinked -xq` | ❌ W0 | ⬜ pending |
| 5-06-01 | 06 | 3 | RECP-01 | — | N/A | integration | `cd frontend && npm test -- --run src/hooks/useRecipes.test.js` | ❌ W0 | ⬜ pending |
| 5-06-02 | 06 | 3 | RECP-03 | — | N/A | integration | `cd frontend && npm test -- --run src/pages/Recipes.test.jsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/alembic/versions/0005_add_recipes.py` — migration (recipes + recipe_ingredients + shopping_list free_text column) must exist before any test can import models
- [ ] `backend/tests/test_recipes.py` — stubs for all RECP-01 through RECP-05 backend tests
- [ ] `frontend/src/hooks/useRecipes.test.js` — stubs for hook API contract (RECP-01 through RECP-05)
- [ ] `frontend/src/pages/Recipes.test.jsx` — stubs for page rendering + check screen display (RECP-03)

*Existing infrastructure (conftest.py, vitest.config.js, setup.js) fully covers all phase requirements. Only new test files and the migration are needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL import handles @graph-wrapped JSON-LD (e.g. Chefkoch) | RECP-02 | Requires live HTTP fetch to third-party site | Paste a Chefkoch.de recipe URL into import form; verify ingredients extracted correctly |
| Unit-mismatch shows ⚠️ with note (D-09) | RECP-03 | Visual/UX behavior | Create recipe with "250g flour"; ensure inventory item tracks count-only; open check screen; verify ⚠️ with mismatch note appears |
| Cook confirmation sheet pre-fills quantities correctly (D-11/D-12) | RECP-05 | Bottom sheet rendering; pre-fill logic | Mark recipe as cooked; verify each matched ingredient shows pre-filled quantity; mismatched-unit ingredients show 1 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
