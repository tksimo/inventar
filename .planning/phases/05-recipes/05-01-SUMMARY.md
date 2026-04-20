---
phase: 05-recipes
plan: 01
subsystem: backend
tags: [recipes, alembic, sqlalchemy, pydantic, wave0, tdd-red]
one_liner: "Alembic migration 0005 adds recipes+recipe_ingredients tables; ORM models and 11 Pydantic schemas with extra=forbid; Wave 0 RED test scaffolding for RECP-01 through RECP-05"
dependency_graph:
  requires: []
  provides:
    - backend/alembic/versions/0005_add_recipes.py
    - backend/models Recipe + RecipeIngredient ORM classes
    - backend/schemas/recipe.py (11 Pydantic v2 schemas)
    - backend/schemas/shopping_list.py ShoppingListCreate xor validator + free_text
    - backend/tests/test_recipes.py Wave 0 RED tests
  affects:
    - backend/models/__init__.py (ShoppingListEntry item_id now nullable, free_text added)
    - backend/schemas/shopping_list.py (ShoppingListCreate + ShoppingListEntryResponse updated)
    - backend/schemas/__init__.py (recipe schemas re-exported)
tech_stack:
  added: []
  patterns:
    - Alembic batch_alter_table for SQLite column nullability changes
    - Pydantic v2 model_validator(mode=after) for xor field validation
    - SQLAlchemy cascade="all, delete-orphan" for Recipe -> RecipeIngredient
    - ON DELETE CASCADE (recipe_id FK) / ON DELETE SET NULL (item_id FK) in migration
key_files:
  created:
    - backend/alembic/versions/0005_add_recipes.py
    - backend/schemas/recipe.py
    - backend/tests/test_recipes.py
  modified:
    - backend/models/__init__.py
    - backend/schemas/shopping_list.py
    - backend/schemas/__init__.py
decisions:
  - "ON DELETE CASCADE for recipe_ingredients.recipe_id: deleting a recipe removes all its ingredients"
  - "ON DELETE SET NULL for recipe_ingredients.item_id: deleting an inventory item leaves the ingredient intact but unlinked (D-03)"
  - "ShoppingListCreate uses model_validator(mode=after) xor: exactly one of {item_id, free_text} must be set (D-10, T-05-03)"
  - "ShoppingListEntryResponse item_id/item_name/quantity_mode made Optional to support free-text rows"
  - "Wave 0 RED tests use db_session fixture with full table wipes for isolation; test_recipes_tables_exist uses sqlalchemy.inspect to verify schema"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-20"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
requirements: [RECP-01, RECP-02, RECP-03, RECP-04, RECP-05]
---

# Phase 5 Plan 01: DB Migration, ORM Models, Pydantic Schemas, Wave 0 RED Tests Summary

**One-liner:** Alembic migration 0005 adds recipes+recipe_ingredients tables with CASCADE/SET NULL FK rules; ORM classes Recipe+RecipeIngredient added to models; 11 Pydantic v2 schemas with extra=forbid; ShoppingListCreate updated for item_id XOR free_text; 34 Wave 0 RED test stubs covering RECP-01 through RECP-05.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Alembic migration 0005 + ORM updates | a8e19a5 | backend/alembic/versions/0005_add_recipes.py, backend/models/__init__.py |
| 2 | Pydantic schemas for all recipe endpoints + shopping_list updates | aa5a2e6 | backend/schemas/recipe.py, backend/schemas/shopping_list.py, backend/schemas/__init__.py |
| 3 | Wave 0 RED test scaffolding covering RECP-01 through RECP-05 | 0df9ece | backend/tests/test_recipes.py |

## Decisions Made

1. **ON DELETE CASCADE for recipe_ingredients.recipe_id** — deleting a recipe removes all its ingredients atomically (Pitfall 3 from RESEARCH.md).
2. **ON DELETE SET NULL for recipe_ingredients.item_id** — deleting an inventory item leaves the ingredient intact but unlinked (D-03), allowing recipes to remain usable even if item is archived.
3. **ShoppingListCreate xor validator** — `model_validator(mode="after")` enforces exactly one of `{item_id, free_text}` is set, preventing ambiguous rows (D-10, T-05-03).
4. **ShoppingListEntryResponse made Optional fields** — `item_id`, `item_name`, `quantity_mode` changed from required to Optional to support free-text shopping list rows that have no linked inventory item.
5. **Wave 0 RED tests** — all router-dependent tests fail with 404 (router not yet registered); `test_recipes_tables_exist` passes immediately via `sqlalchemy.inspect` since `Base.metadata.create_all` creates the tables in the test DB session.

## Verification Results

- `from models import Recipe, RecipeIngredient, ShoppingListEntry` — OK
- `from schemas import RecipeCreate, RecipeResponse, IngredientCheckResponse, RecipeCookBody, ShoppingListCreate` — OK
- `alembic upgrade head` on clean DB → revision 0005 (head) — OK
- `tests/test_shopping_list.py` — 37 passed (no regression)
- `tests/test_items.py` + all other tests (ignoring recipes) — 118 passed (no regression)
- `tests/test_recipes.py::test_recipes_tables_exist` — PASSED (schema present)
- `tests/test_recipes.py` (full run) — 29 failed / 5 passed — RED state confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates foundation artifacts (migration, ORM, schemas, test stubs). The test stubs are intentionally RED; Plans 02-03 will implement the router and turn them green.

## Threat Flags

No new security surface introduced beyond what is declared in the plan's threat model. All schemas have `extra="forbid"`. The `ShoppingListCreate` xor validator (T-05-03) is implemented.

## Self-Check: PASSED

- `backend/alembic/versions/0005_add_recipes.py` — FOUND
- `backend/schemas/recipe.py` — FOUND
- `backend/tests/test_recipes.py` — FOUND
- Commit a8e19a5 — FOUND
- Commit aa5a2e6 — FOUND
- Commit 0df9ece — FOUND
