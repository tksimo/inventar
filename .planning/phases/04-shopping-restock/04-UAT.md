---
status: complete
phase: 04-shopping-restock
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, Alembic migration 0004 (sort_order column) completes, and the app is reachable — shopping list page loads without errors.
result: pass

### 2. Shopping list auto-population
expected: Navigate to the Shopping List tab. Any items with quantity at or below their reorder threshold (exact mode) or status "out" (status mode) appear automatically in the list — no manual action needed. If no items qualify, an empty state message is shown.
result: pass

### 3. Nav badge count
expected: The Shopping List icon in the bottom navigation shows a badge pill with the number of current shopping list entries (capped at "99+" for large counts). The badge updates when items are added or removed.
result: pass

### 4. Manual item add via picker
expected: On the Shopping List page, tap the add button. A modal picker opens with a searchable list of inventory items (items already on the list are excluded). Selecting an item adds it to the shopping list. The picker closes and the new item appears in the list.
result: pass
note: "User wants to add items not yet in inventory (new products) directly from the shopping list — feature request for backlog"

### 5. Drag-to-reorder
expected: On the Shopping List page, grab a manually-added item by its drag handle (grip icon on the left) and drag it to a new position. The item snaps to the new position on drop and stays there on the next load. Auto-populated items (shown below manual items) cannot be dragged.
result: pass

### 6. Check off an item
expected: Tap the checkbox on a shopping list item. A CheckOffSheet bottom sheet slides up showing the item name and a "Quantity added" stepper defaulting to 1 (minimum 1). Tap "Add to stock" — the sheet dismisses, the item is removed from the shopping list (if quantity now meets threshold), and the item's inventory count is updated.
result: issue
reported: "when trying to restock the automatically added items i get this 'Couldn't load shopping list. Check your connection and try again.'"
severity: major

### 7. Remove item with undo
expected: Tap the trash/remove button on a shopping list item. The item disappears from the list immediately. A toast notification appears for ~3 seconds with an "Undo" option. Tapping "Undo" within that window restores the item to the list. If the toast expires without action, the removal is permanent.
result: issue
reported: "yes but i cant remove automatically added items, only manual"
severity: minor

### 8. Share the shopping list
expected: Tap the share button on the Shopping List page. On supported devices, the OS share sheet appears with the list formatted as "Einkaufsliste" followed by each item as "• Item name (N left)". On unsupported devices, the list text is copied to the clipboard and a confirmation toast appears.
result: pass

### 9. Start restocking button visibility
expected: The "Start restocking" button is visible on the Shopping List page even when the list is empty (not hidden behind an entries gate). It is not shown while restock mode is active.
result: pass

### 10. Restock scan — match found
expected: Tap "Start restocking". The camera overlay opens (aria-label "Restock scanner"). Scan a barcode that belongs to an item currently on the shopping list. A RestockQuickSheet slides up showing the item name and a quantity stepper (default 1, minimum 1). Tap "Add to stock" — the item's inventory count is updated, it is removed from the shopping list, and the camera re-arms automatically for the next scan.
result: pass

### 11. Restock scan — no match
expected: While in restock mode (camera overlay open), scan a barcode that does not match any shopping list item. A toast appears with "Item not found". The camera re-arms automatically — no sheet is shown and no data is changed.
result: pass

### 12. Exit restock mode
expected: While in restock mode (camera overlay active), tap the "Done restocking" button inside the overlay. The camera overlay closes and the Shopping List page returns to its normal view with the "Start restocking" button visible again.
result: pass

## Summary

total: 12
passed: 10
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Tapping the checkbox on an auto-populated shopping list item opens CheckOffSheet; completing it updates inventory and removes the item"
  status: failed
  reason: "User reported: error 'Couldn't load shopping list. Check your connection and try again.' appears after tapping Add to stock — only for auto-populated items (id=null), not manually-added items"
  severity: major
  test: 6
  root_cause: "Auto entries have id=null (no persisted row); checkOff(null, delta) calls POST /api/shopping-list/null/check-off which fails — the null entry_id is never a valid route param"
  artifacts:
    - path: "frontend/src/hooks/useShoppingList.js"
      issue: "checkOff called with null entryId for auto entries"
    - path: "backend/routers/shopping_list.py"
      issue: "POST /{entry_id}/check-off receives null/invalid id"
  missing:
    - "Handle auto entries (id=null) in check-off flow — either POST to create a persisted row first, or add a separate endpoint/query-param path for auto-entry restocking"
  debug_session: ""

- truth: "Auto-populated shopping list items can be dismissed/removed (temporarily suppressed until next threshold check)"
  status: failed
  reason: "User reported: can't remove automatically added items, only manual items have a remove button"
  severity: minor
  test: 7
  root_cause: "Auto entries (id=null) have no persisted row to DELETE; ShoppingListRow likely hides/disables remove button for auto entries by design, but users expect to be able to dismiss suggestions"
  artifacts:
    - path: "frontend/src/components/ShoppingListRow/ShoppingListRow.jsx"
      issue: "Remove button not rendered or disabled when draggable=false (auto entry)"
  missing:
    - "Allow dismissing auto entries — either add a backend endpoint to suppress an auto-entry until next restock, or persist a 'dismissed' flag on the item"
  debug_session: ""
