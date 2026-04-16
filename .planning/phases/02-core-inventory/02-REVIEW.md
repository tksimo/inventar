---
phase: 02-core-inventory
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - frontend/src/components/EmptyState/EmptyState.jsx
  - frontend/src/components/FAB/FAB.jsx
  - frontend/src/components/FAB/FAB.module.css
  - frontend/src/components/FilterPicker/FilterPicker.jsx
  - frontend/src/components/FilterPicker/FilterPicker.module.css
  - frontend/src/components/ItemCard/ItemCard.jsx
  - frontend/src/components/ItemCard/ItemCard.module.css
  - frontend/src/components/ItemDrawer/ItemDrawer.jsx
  - frontend/src/components/ItemDrawer/ItemDrawer.module.css
  - frontend/src/components/ItemDrawer/ItemDrawer.test.jsx
  - frontend/src/components/ItemRow/ItemRow.jsx
  - frontend/src/components/ItemRow/ItemRow.module.css
  - frontend/src/components/QuantityControls/QuantityControls.jsx
  - frontend/src/components/QuantityControls/QuantityControls.module.css
  - frontend/src/components/QuantityControls/QuantityControls.test.jsx
  - frontend/src/components/SettingsListItem/SettingsListItem.jsx
  - frontend/src/components/SettingsListItem/SettingsListItem.module.css
  - frontend/src/components/SettingsListItem/SettingsListItem.test.jsx
  - frontend/src/layout/AppLayout.test.jsx
  - frontend/src/pages/Inventory.jsx
  - frontend/src/pages/Inventory.module.css
  - frontend/src/pages/Inventory.test.jsx
  - frontend/src/pages/Settings.jsx
  - frontend/src/pages/Settings.module.css
  - frontend/src/pages/Settings.test.jsx
findings:
  critical: 2
  warning: 4
  info: 5
  total: 11
status: issues_found
---

# Phase 02: Code Review Report (Frontend Components)

**Reviewed:** 2026-04-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This review covers the core inventory frontend: `ItemDrawer` (add/edit/delete form), `ItemRow`/`ItemCard` list renderers, `QuantityControls`, `FilterPicker`, `SettingsListItem`, and the `Inventory` and `Settings` page components, along with their CSS modules and test files.

Overall quality is high. Accessibility attributes are used carefully throughout (ARIA labels on all interactive controls, `role="radiogroup"` on segmented controls, `role="alert"` on validation errors, `aria-live` on quantity counts). The dirty-detection logic in `ItemDrawer` is thorough, the optimistic filter/search memoisation in `Inventory` is correct, and test coverage is solid and well-structured.

Two critical issues were found: a null-dereference crash path in `ItemDrawer` when the delete-confirm UI renders with a null item, and a misleading "Could not save" error message shown when a delete operation fails. Four warnings cover a potential double-toggle bug in `FilterPicker`, a stale initial snapshot in `ItemDrawer`, a redundant inline filter calculation in `Inventory`, and a permanently-disabled button edge case in `SettingsListItem`. Five info items cover swallowed errors, a minor loading-state gap, an ARIA semantic mismatch, a missing accessible label, and an undocumented prop.

---

## Critical Issues

### CR-01: Null dereference — `item.name` accessed without guard in delete-confirm block

**File:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx:487`

**Issue:** When `deleteConfirming` is `true`, the JSX at line 487 renders `{item.name}` and `handleConfirmDelete` at line 243 calls `item.id` — both without a null guard. The "Delete" button that sets `deleteConfirming` is gated on `mode === 'edit'` (line 474), so in normal use `item` is never null here. However the `deleteConfirming` render block itself (lines 485-504) has no null check. If the component is instantiated with `mode="add"` and `deleteConfirming` is somehow set to `true` (via a unit test, future refactor, or parent state bug), both accesses throw a TypeError that crashes the drawer. There is no error boundary in scope.

**Fix:** Guard `item` access in the delete-confirm block:
```jsx
{deleteConfirming && mode === 'edit' && item && (
  <>
    <span className={styles.confirmText}>Delete {item.name}?</span>
    <button
      type="button"
      className={styles.confirmYes}
      disabled={deleting}
      onClick={handleConfirmDelete}
    >
      Yes, delete
    </button>
    <button
      type="button"
      className={styles.confirmCancel}
      onClick={() => setDeleteConfirming(false)}
    >
      Cancel
    </button>
  </>
)}
```
Alternatively add optional chaining at the point of access: `item?.name ?? 'this item'` and `item?.id`.

---

### CR-02: Wrong error message displayed on item delete failure

**File:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx:245`

**Issue:** The `catch` block inside `handleConfirmDelete` sets the error to the generic save message:
```js
setSaveError('Could not save. Check your connection and try again.')
```
The user just clicked "Yes, delete" — telling them "Could not save" is misleading and confusing. The delete flow reuses the same `saveError` state but needs its own user-facing copy.

**Fix:**
```js
} catch {
  setSaveError('Could not delete. Check your connection and try again.')
}
```

---

## Warnings

### WR-01: Potential double-toggle on FilterChip dismiss in FilterPicker

**File:** `frontend/src/components/FilterPicker/FilterPicker.jsx:30-34, 44-48`

**Issue:** Each `FilterChip` inside the picker receives both `onClick` and `onDismiss` wired to the same handler (e.g., `() => onToggleCategory(c.id)`). If `FilterChip` fires both `onClick` and `onDismiss` when the user clicks the dismiss icon — a common implementation where the dismiss button's click also bubbles to the parent chip's `onClick` — the toggle handler fires twice, toggling the filter on and immediately back off (net zero effect). The active chips rendered directly in `Inventory.jsx` lines 209-225 use the same dual-wiring pattern; whether this is a bug depends on `FilterChip`'s internal event flow.

**Fix:** Audit `FilterChip` to confirm that `onDismiss` and `onClick` cannot both fire on the same user action. If they can, use `e.stopPropagation()` inside the dismiss handler, or pass `onDismiss={undefined}` to picker chips and rely solely on `onClick`:
```jsx
<FilterChip
  key={`c${c.id}`}
  label={c.name}
  active={activeCategoryIds.includes(c.id)}
  onClick={() => onToggleCategory(c.id)}
  // omit onDismiss — toggle is symmetric, onClick alone suffices
/>
```

---

### WR-02: `initialRef` is never refreshed — stale dirty detection after save in edit mode

**File:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx:118`

**Issue:** `initialRef` is populated once at component mount:
```js
const initialRef = useRef(toInitial(mode === 'edit' ? item : null))
```
If the parent's `item` prop is updated after mount (e.g., after a successful optimistic update returns a server-confirmed item with normalised field values), `initialRef.current` remains the original snapshot. The dirty flag then compares against stale values, potentially marking a clean form as dirty or a dirty form as clean. Currently `onClose()` is always called immediately after a successful save, so this is latent — but it is a correctness trap for any future change that keeps the drawer open after saving.

**Fix:** Synchronise `initialRef` when `item` identity changes, or refresh it explicitly after a successful save:
```js
// At the top level of the component, keep initialRef in sync with item prop (edit mode only)
useEffect(() => {
  if (mode === 'edit' && item) {
    initialRef.current = toInitial(item)
  }
}, [item, mode])
```

---

### WR-03: Redundant inline filter recalculation in `renderContent` empty-state check

**File:** `frontend/src/pages/Inventory.jsx:124`

**Issue:** The "total empty" guard recomputes the unarchived count inline:
```js
if (items.filter((i) => !i.archived).length === 0 && !debouncedSearch.trim() && !hasActiveFilters) {
```
This duplicates the `filtered` memo (line 73), which already starts with `items.filter((it) => !it.archived)`. When no search or active filters are set, `filtered.length === 0` is equivalent. The inline recalculation means the logic is in two places: if the archived-filtering logic ever changes in the memo, the empty-state check will silently diverge and show the wrong state.

**Fix:** Reuse the memo:
```js
if (filtered.length === 0 && !debouncedSearch.trim() && !hasActiveFilters) {
```

---

### WR-04: `confirmDelete` in `SettingsListItem` leaves the button permanently disabled on non-unmount success

**File:** `frontend/src/components/SettingsListItem/SettingsListItem.jsx:83-93`

**Issue:** `confirmDelete` sets `busy = true` before calling `onDelete`, but only resets it in the `catch` block. The comment says "Parent removes entry; component unmounts" — but if the parent uses an exit animation, batches state updates, or does not remove the entry (e.g., on a rolled-back optimistic update), the component stays mounted with `busy = true`. The "Yes, delete" button is then permanently disabled with no way for the user to retry or cancel.

**Fix:** Use a `finally` block to always reset `busy`, matching the `submitRename` pattern:
```js
const confirmDelete = async () => {
  setBusy(true)
  setLocalError(null)
  try {
    await onDelete(entry.id)
  } catch (e) {
    setLocalError(deleteErrorCopy(e?.message))
  } finally {
    setBusy(false)
  }
}
```

---

## Info

### IN-01: Save and delete errors are silently swallowed — no console logging

**File:** `frontend/src/components/ItemDrawer/ItemDrawer.jsx:230, 244`

**Issue:** Both `catch` blocks catch the error silently:
```js
} catch {
  setSaveError('Could not save...')
}
```
The underlying error object is not logged, making it impossible to diagnose failures in production or during debugging without a network inspector.

**Fix:**
```js
} catch (e) {
  console.error('[ItemDrawer] save failed', e)
  setSaveError('Could not save. Check your connection and try again.')
}
```
Apply the same pattern to `handleConfirmDelete`.

---

### IN-02: Loading indicator does not cover the categories/locations loading phase

**File:** `frontend/src/pages/Inventory.jsx:106`

**Issue:** `isLoading` is only truthy while `items.length === 0`:
```js
const isLoading = (itemsLoading || catsLoading || locsLoading) && items.length === 0
```
Once items arrive, the loading state is hidden even if categories and locations are still pending. This causes a brief flash where item rows render with `'—'` placeholders for location names before the lookup map fills in. It is a UX roughness rather than a correctness bug, but worth noting as an explicit trade-off.

**Fix (optional):** Either extend the condition to require all three hooks to resolve before hiding the skeleton:
```js
const isLoading = (itemsLoading || catsLoading || locsLoading) && items.length === 0 && categories.length === 0
```
Or accept the progressive disclosure behaviour and document it as intentional.

---

### IN-03: `role="dialog"` with `aria-modal="false"` is semantically mismatched for a popover

**File:** `frontend/src/components/FilterPicker/FilterPicker.jsx:15`

**Issue:** `FilterPicker` uses `role="dialog" aria-modal="false"`. A dialog is expected to trap focus and block interaction with the rest of the page per ARIA spec. This panel is a dropdown/popover — there is no focus trap and no backdrop. Screen readers will announce it as a dialog, which may confuse users who expect standard dialog keyboard behaviour (Escape to close is present; focus trap is not).

**Fix:** Use a semantically appropriate role. Since the panel contains chips that toggle filters, `role="region"` with an accessible name matches the intent, or omit the role entirely:
```jsx
<div className={styles.panel} aria-label="Filter picker">
```
Note: `Inventory.test.jsx` line 185 queries `getByRole('dialog', { name: 'Filter picker' })`, so changing the role will require updating that test assertion.

---

### IN-04: `AddRow` input in `Settings.jsx` has no accessible label

**File:** `frontend/src/pages/Settings.jsx:45-47`

**Issue:** The `<input>` in `AddRow` uses only a `placeholder` attribute for identification. Placeholders disappear when the user starts typing and are not reliably announced by all screen readers as a field label. There is no associated `<label>` element and no `aria-label`.

**Fix:**
```jsx
<input
  className={styles.addInput}
  placeholder={placeholder}
  aria-label={placeholder}
  value={value}
  onChange={...}
  onKeyDown={onKeyDown}
  disabled={busy}
/>
```

---

### IN-05: `onCtaClick` prop is undocumented in `EmptyState` JSDoc

**File:** `frontend/src/components/EmptyState/EmptyState.jsx:15`

**Issue:** The JSDoc block at lines 3-13 documents `icon`, `heading`, `body`, and `cta` but omits `onCtaClick`. A caller reading only the JSDoc will not know the companion prop is required when `cta` is provided.

**Fix:**
```js
/**
 *   cta        — optional React node or string; when provided renders as --color-accent button
 *   onCtaClick — optional click handler called when the cta button is clicked
 */
```

---

_Reviewed: 2026-04-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
