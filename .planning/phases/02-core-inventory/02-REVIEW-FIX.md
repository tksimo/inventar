---
phase: 02-core-inventory
fixed_at: 2026-04-16T00:00:00Z
review_path: .planning/phases/02-core-inventory/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-16T00:00:00Z
**Source review:** .planning/phases/02-core-inventory/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Null dereference — `item.name` accessed without guard in delete-confirm block

**Files modified:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx`
**Commit:** 1644d5e
**Applied fix:** Changed `{deleteConfirming && (` to `{deleteConfirming && mode === 'edit' && item && (` so the delete-confirm JSX block is only rendered when all three conditions hold, preventing a null dereference if `item` is ever null while `deleteConfirming` is true.

---

### CR-02: Wrong error message displayed on item delete failure

**Files modified:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx`
**Commit:** 635063f
**Applied fix:** Changed `setSaveError('Could not save. Check your connection and try again.')` to `setSaveError('Could not delete. Check your connection and try again.')` in the `handleConfirmDelete` catch block so the user sees a delete-specific error message instead of the misleading "Could not save" copy.

---

### WR-01: Potential double-toggle on FilterChip dismiss in FilterPicker

**Files modified:** `frontend/src/components/FilterPicker/FilterPicker.jsx`
**Commit:** 09f3c0d
**Applied fix:** Audited `FilterChip.jsx` — the dismiss span already calls `e.stopPropagation()`, so no actual double-toggle occurs. Removed the redundant `onDismiss` prop from all chips in `FilterPicker` (both category and location chips) so `onClick` alone handles the toggle, eliminating the dual-wiring that created the appearance of a potential bug and making the intent explicit.

---

### WR-02: `initialRef` is never refreshed — stale dirty detection after save in edit mode

**Files modified:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx`
**Commit:** 1e7f825
**Applied fix:** Added a `useEffect` that updates `initialRef.current = toInitial(item)` whenever `item` or `mode` changes (guarded to edit mode only). This ensures the dirty-detection baseline stays in sync if the parent passes a server-confirmed item after a save, preventing a clean form from appearing dirty on future interactions.

---

### WR-03: Redundant inline filter recalculation in `renderContent` empty-state check

**Files modified:** `frontend/src/pages/Inventory.jsx`
**Commit:** cd7f6c3
**Applied fix:** Replaced `items.filter((i) => !i.archived).length === 0` with `filtered.length === 0` in the "total empty" guard. The `filtered` memo already starts by filtering out archived items, so this is semantically equivalent when no search or active filters are present, and eliminates the risk of the two archived-filtering expressions diverging in the future.

---

### WR-04: `confirmDelete` in `SettingsListItem` leaves the button permanently disabled on non-unmount success

**Files modified:** `frontend/src/components/SettingsListItem/SettingsListItem.jsx`
**Commit:** d8168b4
**Applied fix:** Moved `setBusy(false)` out of the `catch` block and into a new `finally` block, matching the pattern already used by `submitRename`. This ensures `busy` is always reset regardless of whether the delete succeeds or fails, preventing the "Yes, delete" button from being permanently disabled if the component remains mounted after a success (e.g., due to exit animations or rolled-back optimistic updates).

---

_Fixed: 2026-04-16T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
