---
phase: 04-shopping-restock
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/routers/shopping_list.py
  - backend/tests/test_shopping_list.py
  - frontend/src/hooks/useShoppingList.js
  - frontend/src/hooks/useShoppingList.test.js
  - frontend/src/pages/ShoppingList.jsx
  - frontend/src/pages/ShoppingList.test.jsx
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 04: Code Review Report (Updated — Plans 04-05 and 04-06)

**Reviewed:** 2026-04-19
**Depth:** standard
**Files Reviewed:** 6 (gap-closure files only; prior 33-file review on 2026-04-18 is superseded for these files)
**Status:** issues_found

## Summary

This review covers the gap-closure changes from Plans 04-05 and 04-06:

- **Plan 04-05**: new `POST /api/shopping-list/items/{item_id}/restock` backend endpoint; `checkOff`
  hook updated to route to the new endpoint for auto-entries; `CheckOffSheet` confirm handler updated
  to pass `item_id`; 13 new tests across backend and frontend.
- **Plan 04-06**: `suppressedItemIds` Set state, `handleRemoveAuto`, updated `handleUndo`, filtered
  `autoEntries` useMemo; 4 new frontend page tests (H–K).

There are no critical issues. The backend endpoint is correct and its test suite is comprehensive.
The `checkOff` routing logic is sound. The auto-entry suppress/undo flow is implemented correctly
for the dismiss case.

**WR-03 from the prior review is now resolved**: auto-entries now pass `handleRemoveAuto` as
`onRemove`, so the remove button is functional.

Two new warnings are introduced by the gap-closure changes:

- WR-05-NEW (extends prior WR-02): the `onAddToStock` restock-scan handler still does not invoke
  `checkOff` for auto-entries (id=null), so the shopping list is not refreshed after scanning and
  restocking an auto-entry item.
- WR-06-NEW: `restock_by_item` contains the same redundant `db.refresh(item)` call identified in
  WR-04 for `check_off_shopping_list_entry`.

Two new info items are introduced:

- IN-05-NEW: the EmptyState guard checks `entries.length === 0` (raw hook array) rather than the
  filtered view, so suppressing all auto-entries leaves a blank body with no "Nothing to buy" text.
- IN-06-NEW: Test 7 covers only the persisted-entry (id=7) restock scan path; the auto-entry
  (id=null) scan-restock code path has no test.

---

## Warnings

### WR-01: `removeEntry` captures `entries` at closure time — stale snapshot on rapid calls

**File:** `frontend/src/hooks/useShoppingList.js:63-74`

**Issue:** The `removeEntry` callback captures `entries` directly in its closure (used as the
rollback snapshot). Because `useCallback` is memoised on `[entries]`, the ref updates on every
render, so single-call usage is fine. However, the optimistic `setEntries((prev) => ...)` uses a
functional updater, while the snapshot variable still refers to the array captured at
callback-creation time. If two removes are dispatched in the same render cycle (e.g., rapid
double-tap), the second call's snapshot already excludes the first removal, so a failure of the
second DELETE would restore one more item than expected. The `reorder` callback (line 79) captures
`snapshot = entries` for the same purpose and has the same hazard.

**Fix:** Capture the snapshot inside a `setEntries` functional updater:

```js
const removeEntry = useCallback(async (entry_id) => {
  let snapshot
  setEntries((prev) => {
    snapshot = prev
    return prev.filter((e) => e.id !== entry_id)
  })
  try {
    await json(`api/shopping-list/${entry_id}`, { method: 'DELETE' })
    return { ok: true }
  } catch (e) {
    setEntries(snapshot)
    setError(e.message)
    return { ok: false }
  }
}, []) // no entries dep needed
```

---

### WR-02: `onAddToStock` double-writes quantity when item has a persisted shopping-list entry

**File:** `frontend/src/pages/ShoppingList.jsx:145-163`

**Issue:** `onAddToStock` first calls `itemsApi.updateQuantity(matched.id, delta)` (which PATCHes
the item quantity directly), and then, if the entry exists on the shopping list with `entry.id != null`,
calls `checkOff(entry.id, delta)` (which also increments `item.quantity` on the backend via the
`POST /check-off` endpoint). When both calls succeed for an item that has a persisted shopping-list
row, the quantity is incremented **twice** — once by `updateQuantity` and once by the check-off
endpoint's restock logic.

**Fix:** Remove the separate `updateQuantity` call. The check-off endpoint handles the quantity
increment atomically and records the transaction. Only call `updateQuantity` when no shopping-list
entry exists:

```js
const onAddToStock = async (delta) => {
  const matched = restockScanner.matchedItem
  if (!matched) return
  setRestockSaving(true)
  setRestockSaveError(null)
  try {
    const entry = entries.find((e) => e.item_id === matched.id)
    if (entry && entry.id != null) {
      // check-off handles quantity increment + list removal atomically
      await checkOff(entry.id, delta)
    } else if (entry && entry.id == null) {
      // auto-entry: use item-keyed restock endpoint
      await checkOff(null, delta, entry.item_id)
    } else {
      // not on the shopping list — update quantity directly
      await itemsApi.updateQuantity(matched.id, delta)
    }
    setRestockSaving(false)
    restockScanner.reset()
    restockScanner.openScanner()
  } catch {
    setRestockSaving(false)
    setRestockSaveError("Couldn't save. Try again.")
  }
}
```

---

### WR-03: ~~Auto-entries rendered with no-op `onRemove`~~ — RESOLVED in Plan 04-06

**Status:** Resolved. Auto-entries now pass `handleRemoveAuto` as `onRemove`
(`frontend/src/pages/ShoppingList.jsx:219`). No action needed.

---

### WR-04: Redundant `db.refresh(item)` after commit in `check_off_shopping_list_entry`

**File:** `backend/routers/shopping_list.py:271-272`

**Issue:** After `db.commit()`, `db.refresh(item)` is called but the refreshed values are not used
in the returned dict — `new_quantity` is the locally-computed value. The refresh is therefore
redundant. Additionally, accessing `entry` attributes after `db.delete(entry)` (before commit) can
raise `DetachedInstanceError` in future edits; the current code avoids this, but it is fragile.

**Fix:** Remove the unnecessary `db.refresh(item)` call and null out `entry` after deletion:

```python
    if should_remove:
        db.delete(entry)
        entry = None  # prevent accidental post-delete access

    db.commit()
    # db.refresh(item) removed — new_quantity is computed locally

    return {
        "ok": True,
        "removed": should_remove,
        "item_id": item.id,
        "new_quantity": new_quantity,
    }
```

---

### WR-05: `formatShoppingList` test asserts current behaviour that diverges from spec for empty list

**File:** `frontend/src/lib/share.test.js:6-8`

**Issue:** The test asserts `formatShoppingList([])` returns `'Einkaufsliste\n'` (trailing newline).
The implementation produces this via `['Einkaufsliste', ''].join('\n')`. The trailing blank line is
inconsistent with the stated spec ("blank line, then one bullet per entry"). The test validates
the current bug rather than the specified behaviour; if the implementation is corrected, this test
fails confusingly.

**Fix:**

```js
// share.js — conditionally add blank separator only when entries exist
export function formatShoppingList(entries) {
  if (entries.length === 0) return 'Einkaufsliste'
  const lines = ['Einkaufsliste', '']
  for (const e of entries) {
    const label = quantityLabel(e)
    lines.push(label != null ? `• ${e.item_name} (${label})` : `• ${e.item_name}`)
  }
  return lines.join('\n')
}
```

---

### WR-06 (NEW — Plan 04-05): `onAddToStock` does not invoke `checkOff` for auto-entries — list stays stale after scan-restock

**File:** `frontend/src/pages/ShoppingList.jsx:152-155`

**Issue:** The restock scan handler (`onAddToStock`) checks `entry.id != null` before calling
`checkOff`. If the scanned item has an auto-entry (id=null), the condition is false: `updateQuantity`
fires but `checkOff` is skipped. Because `checkOff` is the only caller of `refetch()` in this path,
the shopping list is never refreshed and the auto-entry remains visible to the user even after the
item has been physically restocked. The server-side threshold check will eventually remove it on
the next full page load, but the immediate UI state is incorrect.

This combines with WR-02: a single fix handles both issues by replacing `updateQuantity +
conditional checkOff` with a unified `checkOff`-first approach (see fix in WR-02 above). The
auto-entry branch uses `checkOff(null, delta, entry.item_id)` which routes to the new
`/items/{item_id}/restock` endpoint added in Plan 04-05.

**Fix:** Apply the WR-02 fix, which includes the auto-entry branch. No separate fix needed.

---

### WR-07 (NEW — Plan 04-05): `restock_by_item` contains redundant `db.refresh(item)` — same as WR-04

**File:** `backend/routers/shopping_list.py:328`

**Issue:** `restock_by_item` calls `db.refresh(item)` after commit (line 328). As in `check_off_shopping_list_entry` (WR-04), the refreshed item is not used in the returned dict — `new_quantity` is already computed locally. The refresh is a no-op that adds an unnecessary SELECT round-trip.

**Fix:**

```python
    db.commit()
    # db.refresh(item) is redundant — new_quantity is computed locally above
    no_longer_auto = not _item_is_below_threshold(item)
    return {
        "ok": True,
        "removed": bool(removed_entry or no_longer_auto),
        "item_id": item.id,
        "new_quantity": new_quantity,
    }
```

---

## Info

### IN-01: `ShoppingListRow` uses `role="checkbox"` on a `<button>` element — redundant ARIA

**File:** `frontend/src/components/ShoppingListRow/ShoppingListRow.jsx:42-48`

**Issue:** The checkbox button has `role="checkbox"` but is a `<button>` element. Adding
`role="checkbox"` overrides the implicit button role and requires `aria-checked` state management.
`aria-checked` is hardcoded to `false` — screen readers announce a checkbox that never gets checked.

**Fix:** Use a `<button>` without overriding role (the visual checkbox is CSS `::before`):

```jsx
<button
  type="button"
  aria-label={entry.item_name}
  className={styles.checkbox}
  onClick={() => onCheck(entry)}
/>
```

---

### IN-02: `checkOff` errors are silently swallowed in the `CheckOffSheet` confirm handler

**File:** `frontend/src/pages/ShoppingList.jsx:246-249`

**Issue:** `checkOff` returns `{ ok: false }` on error and sets `error` state in the hook, but the
confirm handler does not inspect the return value — any check-off failure produces no toast or
user-visible feedback.

**Fix:**

```jsx
onConfirm={async (q) => {
  const res = await checkOff(checkingOff.id, q, checkingOff.item_id)
  if (!res.ok) {
    // show error toast or keep sheet open with error message
  }
  setCheckingOff(null)
}}
```

---

### IN-03: `AppLayout` and `ShoppingList` page each instantiate `useShoppingList()` — two fetches on load

**File:** `frontend/src/layout/AppLayout.jsx:19`

**Issue:** Two independent instances of `useShoppingList()` result in two `GET /api/shopping-list/`
fetches on every page load. The code comment acknowledges this as an "acceptable cost at household
scale," but it is an architectural trade-off worth flagging.

**Fix (optional):** Lift `useShoppingList` to `App.jsx` alongside `useItems` and pass the result
down as a prop.

---

### IN-04: `backend/models/__init__.py` uses `datetime.utcnow` (deprecated in Python 3.12+)

**File:** `backend/models/__init__.py:73-74`

**Issue:** `default=datetime.utcnow` and `onupdate=datetime.utcnow` use the deprecated class method.
Python 3.12+ emits deprecation warnings; a future version may make it a hard error.

**Fix:**

```python
from datetime import datetime, timezone

def _utcnow():
    return datetime.now(timezone.utc)

created_at = Column(DateTime, nullable=False, default=_utcnow)
updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
```

---

### IN-05 (NEW — Plan 04-06): EmptyState not shown when all entries are suppressed auto-entries

**File:** `frontend/src/pages/ShoppingList.jsx:190-196`

**Issue:** The EmptyState guard at line 190 checks `entries.length === 0` against the raw hook
array. If all entries are auto-entries and the user dismisses them all via `handleRemoveAuto`,
`entries.length` remains > 0 (the hook still reports them), but neither `persistedEntries` nor
`autoEntries` produce any rows. The rendered body is empty, but the "Nothing to buy / All stocked
up!" EmptyState is not shown.

**Fix:** Change the guard to use the derived lists:

```jsx
const totalVisible = persistedEntries.length + autoEntries.length

{!loading && totalVisible === 0 && !error && (
  <EmptyState
    icon={<ShoppingCart size={48} />}
    heading="Nothing to buy"
    body="All stocked up! Items will appear here when stock runs low."
  />
)}
```

---

### IN-06 (NEW — Plan 04-05): No test covers the auto-entry (id=null) path in `onAddToStock` scan-restock

**File:** `frontend/src/pages/ShoppingList.test.jsx:155-192`

**Issue:** Test 7 sets up a persisted entry (`id: 7`) and asserts that `checkOff` is called with
`(7, 1)`. The case where the scanned item has only an auto-entry (`id=null`) is not tested. In
the current implementation this path silently skips `checkOff`, leaving the UI stale (WR-06). A
dedicated test would have caught this gap.

**Fix:** Add a test variant where `entries` contains an auto-entry (id=null) for the scanned item,
and assert that `checkOff` is called with `(null, 1, item_id)` after `Add to stock` is tapped
(pending the WR-02/WR-06 fix).

---

_Reviewed: 2026-04-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
