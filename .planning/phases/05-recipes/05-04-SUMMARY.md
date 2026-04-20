---
phase: 05-recipes
plan: 04
subsystem: frontend
tags: [recipes, frontend, react, hook, page, components, ui, tdd]
one_liner: "useRecipes hook + RecipeCard + RecipeForm drawer + RecipeDetail + Recipes page with /recipes route and Recipes nav item; 14 new tests all green, full suite 215 tests passing"
dependency_graph:
  requires:
    - backend/routers/recipes.py (Plans 02-03 — CRUD + check/cook endpoints)
    - frontend/src/lib/api.js apiFetch contract
    - frontend/src/components/FAB/FAB.jsx
    - frontend/src/components/EmptyState/EmptyState.jsx
    - frontend/src/components/Toast/Toast.jsx
  provides:
    - frontend/src/hooks/useRecipes.js (React hook with all 9 mutations)
    - frontend/src/components/RecipeCard/RecipeCard.jsx
    - frontend/src/components/RecipeForm/RecipeForm.jsx (drawer, add/edit, two-step delete)
    - frontend/src/components/RecipeDetail/RecipeDetail.jsx (full-page detail)
    - frontend/src/pages/Recipes.jsx (route /recipes)
  affects:
    - frontend/src/App.jsx (added /recipes route)
    - frontend/src/layout/AppLayout.jsx (added Recipes nav item)
    - frontend/src/layout/AppLayout.test.jsx (updated nav-item count assertion 3→4)
tech_stack:
  added: []
  patterns:
    - useRecipes mirrors useShoppingList pattern (module-level json helper + useCallback mutations)
    - RecipeForm follows ItemDrawer pattern (translateX slide-in, role=dialog, aria-modal)
    - Two-step delete confirmation inline in footer (no modal) per UI-SPEC Copywriting Contract
    - RecipeDetail is a full-page view (not drawer) with Check/Cook action stubs for Plan 05
    - Recipes page manages all local state (viewMode, formOpen, importBar, toast)
key_files:
  created:
    - frontend/src/hooks/useRecipes.js
    - frontend/src/hooks/useRecipes.test.js
    - frontend/src/components/RecipeCard/RecipeCard.jsx
    - frontend/src/components/RecipeCard/RecipeCard.module.css
    - frontend/src/components/RecipeForm/RecipeForm.jsx
    - frontend/src/components/RecipeForm/RecipeForm.module.css
    - frontend/src/components/RecipeDetail/RecipeDetail.jsx
    - frontend/src/components/RecipeDetail/RecipeDetail.module.css
    - frontend/src/pages/Recipes.jsx
    - frontend/src/pages/Recipes.module.css
    - frontend/src/pages/Recipes.test.jsx
  modified:
    - frontend/src/App.jsx (added /recipes route + Recipes import)
    - frontend/src/layout/AppLayout.jsx (added UtensilsCrossed + Recipes NavItem)
    - frontend/src/layout/AppLayout.test.jsx (updated nav count 3→4, added Recipes link assertion)
decisions:
  - "RecipeDetail is a full-page view (not a drawer) — recipe detail deserves full focus per UI-SPEC"
  - "Check/Cook onClick handlers are console-log stubs — Plan 05 wires RecipeCheckSheet and CookConfirmSheet"
  - "importUrl error opens RecipeForm with null initialRecipe (blank form) — fallback per D-06; user can manually enter the name"
  - "AppLayout.test.jsx updated from 3→4 nav items — expected consequence of adding /recipes nav item"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-20"
  tasks_completed: 2
  files_created: 11
  files_modified: 3
requirements: [RECP-01, RECP-02]
---

# Phase 5 Plan 04: Frontend Foundation — Hook, Page, Components Summary

**One-liner:** useRecipes hook + RecipeCard + RecipeForm drawer + RecipeDetail + Recipes page with /recipes route and Recipes nav item; 14 new tests all green, full suite 215 tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useRecipes hook + hook tests + RecipeCard component | a5077d0 | frontend/src/hooks/useRecipes.js, frontend/src/hooks/useRecipes.test.js, frontend/src/components/RecipeCard/RecipeCard.jsx, frontend/src/components/RecipeCard/RecipeCard.module.css |
| 2 | RecipeForm drawer + RecipeDetail + Recipes page + route/nav integration + page tests | a68270b | frontend/src/components/RecipeForm/RecipeForm.jsx, RecipeForm.module.css, frontend/src/components/RecipeDetail/RecipeDetail.jsx, RecipeDetail.module.css, frontend/src/pages/Recipes.jsx, Recipes.module.css, Recipes.test.jsx, frontend/src/App.jsx, frontend/src/layout/AppLayout.jsx, AppLayout.test.jsx |

## Decisions Made

1. **RecipeDetail as full-page view** — UI-SPEC explicitly calls for a full-page view (not a drawer) so recipe detail gets full viewport focus. Renders inside Recipes page state machine (viewMode list/detail).

2. **Check/Cook as NOOP stubs** — `onCheck` and `onCook` handlers in Recipes.jsx log nothing; Plan 05 replaces them with RecipeCheckSheet and CookConfirmSheet. Tests assert the buttons exist and are correctly labeled.

3. **importUrl failure opens blank RecipeForm** — When URL import fails (D-06), toast is shown AND RecipeForm opens with `formInitial=null` (blank). The plan spec says "name pre-filled (fallback from page title if available)" — since the client has no page title at this point, blank is the correct fallback.

4. **AppLayout test updated 3→4** — The "renders exactly three nav links" assertion was updated to four as a direct consequence of adding the /recipes nav item. This is expected behavior, not a regression.

## Verification Results

- `frontend/src/hooks/useRecipes.test.js` — 9 tests pass
- `frontend/src/pages/Recipes.test.jsx` — 5 tests pass
- `frontend/src/layout/AppLayout.test.jsx` — 7 tests pass (including updated nav-count)
- Full frontend suite — 215 tests across 26 files, 0 failures
- `npm run build` — succeeds, 486KB JS bundle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] AppLayout.test.jsx nav-count update**
- **Found during:** Task 2 (pre-emptive — test would fail after AppLayout update)
- **Issue:** AppLayout.test.jsx had `expect(nav.querySelectorAll('a')).toHaveLength(3)` which would fail after adding the 4th Recipes nav item
- **Fix:** Updated assertion to `toHaveLength(4)` and added `expect(screen.getByRole('link', { name: /recipes/i })).toBeInTheDocument()`
- **Files modified:** frontend/src/layout/AppLayout.test.jsx
- **Commit:** a68270b

## Known Stubs

- `onCheck` and `onCook` in `Recipes.jsx` are empty inline functions (no-op). Plan 05 wires RecipeCheckSheet and CookConfirmSheet to these handlers. The stubs do not prevent Plan 04's goal (RECP-01/02 CRUD + import) from being achieved.

## Threat Flags

No new security surface beyond what is declared in the plan's threat model:
- T-05-20: URL passed as-is to backend; client shows toast on importUrl returning ok=false (422 handled)
- T-05-21: JSX auto-escapes all recipe name/instructions; no dangerouslySetInnerHTML used
- T-05-23: All API calls go through useRecipes.js → json() helper → apiFetch(); no direct fetch() calls

## Self-Check: PASSED

- `frontend/src/hooks/useRecipes.js` — FOUND
- `frontend/src/hooks/useRecipes.test.js` — FOUND
- `frontend/src/components/RecipeCard/RecipeCard.jsx` — FOUND
- `frontend/src/components/RecipeForm/RecipeForm.jsx` — FOUND
- `frontend/src/components/RecipeDetail/RecipeDetail.jsx` — FOUND
- `frontend/src/pages/Recipes.jsx` — FOUND
- `frontend/src/pages/Recipes.test.jsx` — FOUND
- Commit a5077d0 — FOUND
- Commit a68270b — FOUND
- 215 frontend tests pass — VERIFIED
- Build succeeds — VERIFIED
