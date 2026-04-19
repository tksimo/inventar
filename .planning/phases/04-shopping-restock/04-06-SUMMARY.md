---
phase: 04-shopping-restock
plan: 06
subsystem: ui
tags: [shopping-list, react, gap-closure, suppression]

requires:
  - phase: 04-03
    provides: ShoppingList page with autoEntries useMemo, handleRemove, undoEntry toast

provides:
  - "suppressedItemIds Set state — session-scoped client-side suppression of auto entries"
  - "handleRemoveAuto — dismiss auto entries without backend call, show undo toast"
  - "handleUndo — branches on entry.id == null to unsuppress vs addManual for persisted entries"

affects: [verify, uat]

tech-stack:
  added: []
  patterns:
    - "Session-scoped suppression via Set state: functional updater ensures immutability"
    - "Undo branch on entry.id == null to distinguish auto-entry undo from persisted-entry undo"

key-files:
  created: []
  modified:
    - frontend/src/pages/ShoppingList.jsx
    - frontend/src/pages/ShoppingList.test.jsx

key-decisions:
  - "Frontend-only suppression (no backend call): v1 scope — session-scoped dismiss matches 'temporarily suppressed until next threshold check' intent"
  - "handleUndo branches on undoEntry.id == null to avoid calling addManual for auto entries"

patterns-established:
  - "Auto-entry remove pattern: add item_id to suppressedItemIds Set; undo removes from Set; no API call"

requirements-completed: [SHOP-02]

duration: 10min
completed: 2026-04-19
---

# Plan 04-06: Gap 2 Fix — Auto-Entry Dismiss Summary

**Session-scoped client-side suppression lets users dismiss auto-populated shopping list rows with a working undo toast and no backend call**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-19
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `suppressedItemIds` Set state; `autoEntries` useMemo filters it out
- `handleRemoveAuto` adds item_id to Set and shows undo toast — no backend DELETE
- `handleUndo` branches: auto-entry undo = unsuppress; persisted-entry undo = addManual (unchanged)
- 4 new tests (H, I, J, K) — 201 total frontend tests green

## Task Commits

1. **Task 1: Wire auto-entry dismiss with suppression + undo** — `f99a8c4`

## Files Created/Modified
- `frontend/src/pages/ShoppingList.jsx` — suppressedItemIds state, handleRemoveAuto, updated handleUndo + autoEntries useMemo + onRemove prop
- `frontend/src/pages/ShoppingList.test.jsx` — Tests H, I, J, K for Gap 2 dismiss flow

## Decisions Made
- Frontend-only suppression: no schema change required; session-reset on page reload matches expected v1 behaviour

## Deviations from Plan
None.

## Issues Encountered
None.

## Next Phase Readiness
- Both Gap 1 and Gap 2 are closed
- Phase 4 ready for re-verification
