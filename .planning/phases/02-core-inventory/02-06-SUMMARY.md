---
phase: 02-core-inventory
plan: "06"
subsystem: frontend/settings-ui
tags: [react, settings, categories, locations, ui, css-modules, crud, inline-edit]
dependency_graph:
  requires: ["02-02", "02-03"]
  provides: ["settings-page", "settings-list-item"]
  affects: ["uat-10", "uat-11", "uat-12"]
tech_stack:
  added: []
  patterns:
    - CSS Modules with design token variables only (no hardcoded hex)
    - Internal state machine (view / rename / confirmDelete) per list item
    - Error copy mapping: 409 -> "That name is already taken.", 403 -> specific locked-item messages
    - AddRow sub-component encapsulates create + error state per section
    - useCategories / useLocations hooks drive all CRUD; hooks handle optimistic list updates
key_files:
  created:
    - frontend/src/components/SettingsListItem/SettingsListItem.jsx
    - frontend/src/components/SettingsListItem/SettingsListItem.module.css
    - frontend/src/components/SettingsListItem/SettingsListItem.test.jsx
    - frontend/src/pages/Settings.module.css
    - frontend/src/pages/Settings.test.jsx
  modified:
    - frontend/src/pages/Settings.jsx
decisions:
  - "SettingsListItem internal state machine (view/rename/confirmDelete) keeps all row interaction local; parent only receives onRename/onDelete callbacks"
  - "AddRow extracted as sub-component inside Settings.jsx to keep per-section create state isolated"
  - "T4 test uses getAllByRole('button', { name: /^Add$/i })[0] since both sections render an Add button — targeting by index is clearest given placeholder-scoped input already identifies the correct section"
metrics:
  duration: "~20min"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
  tests_added: 21
  tests_total: 69
---

# Phase 02 Plan 06: Settings Page Summary

**One-liner:** Settings page with SettingsListItem state-machine component (view/rename/confirmDelete), default-category locking, 409/403 inline error copy, and full add/rename/delete UX for both categories and locations.

---

## What Was Built

Replaced the `StubPage` placeholder at `/settings` with a complete Settings page that satisfies UAT tests 10, 11, and 12.

### Components Created

**SettingsListItem** — reusable list item with three internal modes:

- **View mode:** Renders entry name; locked=true hides Pencil/Trash2 buttons (default categories protected at UI level); locked=false shows 44x44 tap-target icon buttons.
- **Rename mode:** Inline text input auto-focused, Enter submits, Escape cancels, Check/X buttons mirror keyboard semantics. No-op guard: if trimmed value equals current name, cancel silently. Error copy: 409 → "That name is already taken.", 403 → "This category can't be renamed.", else "Could not rename. Try again."
- **Confirm-delete mode:** Replaces row content with `deleteConfirmText` + "Yes, delete" (destructive) + "Cancel" buttons. Error copy: 403 → "Default categories can't be deleted.", else "Could not delete. Try again."
- `errorMessage` prop for externally-controlled error display (consistent layout).
- 11 unit tests: unlocked view, locked view, enter rename, Enter submit, Escape cancel, no-op guard, 409/403 rename errors, confirm-delete enter/cancel/confirm/403-error.

**Settings page** — composition layer:

- Two `<section>` blocks: "Categories" and "Storage Locations".
- LoadingState (count=3) shown while hook loading AND list empty.
- ErrorState with section-specific heading on hook error.
- `AddRow` sub-component: inline input + Add button per section, busy state disables both, 409 error surfaces as "That name is already taken.", error clears on next keystroke.
- SettingsListItem per entry: categories pass `locked={c.is_default}`; locations always `locked={false}`.
- Correct `deleteConfirmText` per section per UI-SPEC copywriting.
- 10 page-level tests covering: loading skeletons, category/location errors, default-lock assertion, add new item, duplicate 409, rename, delete confirm, whitespace-only add guard, all-locations-unlocked.

### Tests

| File | Tests | Coverage |
|------|-------|----------|
| SettingsListItem.test.jsx | 11 | all three modes, keyboard + pointer, 409/403 errors, locked view |
| Settings.test.jsx | 10 | loading, errors, default lock, add, duplicate, rename, delete, empty name guard, locations unlocked |

Full suite: 69 tests, 0 failed. Vite build: clean.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] T4 test targeted ambiguous Add button by role**
- **Found during:** Task 2 test run
- **Issue:** `getByRole('button', { name: /^Add$/i })` threw "Found multiple elements" because both Categories and Locations sections each render an "Add" button
- **Fix:** Changed to `getAllByRole('button', { name: /^Add$/i })[0]` to target the first (Categories) Add button unambiguously; the input's `placeholder` already scopes the context
- **Files modified:** `frontend/src/pages/Settings.test.jsx`
- **Commit:** c41f8b9

---

## Known Stubs

None — all data is wired to live `useCategories` and `useLocations` hooks. The Settings page is fully functional.

---

## Threat Surface Review

All threat model items from the plan are mitigated:

- **T-02-33 (is_default elevation):** `AddRow` sends only `{ name }` to `categoriesHook.create({ name })` — backend `CategoryCreate` schema rejects extras.
- **T-02-34 (rename/delete default category):** `locked={c.is_default}` hides Pencil/Trash2 so user cannot initiate; backend 403 covers crafted requests (02-02 backend enforcement).
- **T-02-35 (XSS via names):** All names rendered as JSX string children (auto-escaped). `deleteConfirmText` is a static string literal, not user data.
- **T-02-36 (stack trace exposure):** `renameErrorCopy` / `deleteErrorCopy` + `AddRow` error mapping collapse all server errors to fixed user-facing strings. No raw error messages reach the DOM.
- **T-02-38 (rapid add clicks):** `AddRow` disables input + button while busy; server unique constraint + 409 covers race.

No new trust boundary surfaces beyond the plan's threat model.

---

## Self-Check

### Files exist:
- `frontend/src/components/SettingsListItem/SettingsListItem.jsx` — FOUND
- `frontend/src/components/SettingsListItem/SettingsListItem.module.css` — FOUND
- `frontend/src/components/SettingsListItem/SettingsListItem.test.jsx` — FOUND
- `frontend/src/pages/Settings.jsx` — FOUND
- `frontend/src/pages/Settings.module.css` — FOUND
- `frontend/src/pages/Settings.test.jsx` — FOUND

### Commits:
- 4e58033: feat(02-06): add SettingsListItem component with view/rename/delete-confirm states
- c41f8b9: feat(02-06): build Settings page with Categories + Locations management

## Self-Check: PASSED
