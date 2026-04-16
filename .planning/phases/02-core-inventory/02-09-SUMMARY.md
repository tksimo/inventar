---
phase: 02-core-inventory
plan: "09"
subsystem: categories
tags: [gap-closure, uat, categories, settings, default-lock-removal]
dependency_graph:
  requires: [02-02, 02-06]
  provides: [editable-default-categories]
  affects: [frontend/src/pages/Settings.jsx, backend/routers/categories.py]
tech_stack:
  added: []
  patterns: [TDD red-green, UAT-driven gap closure]
key_files:
  created: []
  modified:
    - backend/routers/categories.py
    - backend/tests/test_categories.py
    - frontend/src/pages/Settings.jsx
    - frontend/src/pages/Settings.test.jsx
decisions:
  - "is_default column retained for GET ordering only — not for write-protection"
  - "SettingsListItem locked prop contract unchanged — component still honours locked=true for future callers"
  - "Migration 0002 INSERT OR IGNORE does not re-seed deleted defaults (alembic_version gate)"
metrics:
  duration: "~10min"
  completed: "2026-04-16"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 09: Default Category Edit/Delete Summary

**One-liner:** Removed default-lock from category PATCH/DELETE endpoints and Settings UI so all 4 default categories are fully renameable and deletable per UAT Test 11 user request.

## What Was Built

**User-facing change:** The 4 default categories (Food & pantry, Fridge & freezer, Cleaning & household, Personal care) can now be renamed and deleted from /settings, just like custom categories. Previously they showed no Pencil/Trash icons and the backend returned 403 on PATCH/DELETE.

**Backend (`backend/routers/categories.py`):**
- Removed `if cat.is_default: raise HTTPException(403, ...)` from `update_category`
- Removed `if cat.is_default: raise HTTPException(403, ...)` from `delete_category`
- Updated module and docstrings to reflect new intent: `is_default` is now an ordering hint only
- All preserved invariants:
  - POST still hardcodes `is_default=False` (T-02-15: clients cannot self-promote)
  - DELETE still nullifies `item.category_id` before removing the category row (T-02-14)
  - GET still orders defaults first via `Category.is_default.desc()`

**Frontend (`frontend/src/pages/Settings.jsx`):**
- Changed `locked={c.is_default}` to `locked={false}` on the categories `SettingsListItem`
- `SettingsListItem` component itself unchanged — still honours `locked={true}` for any future caller

## Preserved Invariants

| Invariant | Threat ID | Status |
|-----------|-----------|--------|
| FK null-out on delete (items get category_id=NULL) | T-02-14 | Preserved |
| POST cannot self-promote to is_default=True | T-02-15 | Preserved |
| Migration 0002 still seeds 4 defaults on fresh install | ORG-01 | Preserved |

## Seeding Behaviour After Deletion

Migration 0002 uses `INSERT OR IGNORE` keyed on the UNIQUE `name` column. **Alembic does NOT re-run a migration whose version is already in `alembic_version`.** So once migration 0002 has run once on a DB:

- Deleted defaults stay deleted across container restarts and `alembic upgrade head` calls
- Only a fresh DB (no `alembic_version` row) would re-seed the 4 defaults
- T4 test confirms this: delete "Food & pantry", re-run upgrade head, row stays gone

## Tests Added / Updated

**backend/tests/test_categories.py** (4 new tests):
- `test_patch_default_category_returns_200` — T1: PATCH on is_default=True returns 200, new name in response
- `test_delete_default_category_returns_200` — T2: DELETE on is_default=True returns 200; row gone from GET; referring items get category_id=NULL
- `test_post_category_always_sets_is_default_false` — T3: POST still produces is_default=False
- `test_deleted_default_not_resurrected_by_upgrade` — T4: deleted default survives alembic upgrade head re-run

**frontend/src/pages/Settings.test.jsx** (updated):
- T3 inverted: now asserts default categories SHOW Pencil+Trash (was: assert hidden)
- T3b added: clicking Pencil on default category enters rename mode (locked=false wiring end-to-end)

**frontend/src/components/SettingsListItem/SettingsListItem.test.jsx** — unchanged. Component locked contract still tested and green.

## Note for Downstream Phases (3, 4, 5)

**Do NOT assume the 4 default categories exist.** A user may have deleted any or all of them. Code that assigns or filters by category must handle `category_id=NULL` items gracefully — render them as "Uncategorised" rather than crashing or hiding them.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 5f7854f | test(02-09): add failing tests T1-T4 for default-category edit/delete |
| 9a54993 | feat(02-09): remove default-lock from categories PATCH/DELETE |
| 2c26a51 | test(02-09): update Settings.test.jsx to expect Pencil+Trash on default categories |
| 497a522 | feat(02-09): pass locked={false} for all categories in Settings.jsx |

## Self-Check: PASSED

All modified files exist. All 4 commits verified in git log. Backend: 73 passed. Frontend: 82 passed.
