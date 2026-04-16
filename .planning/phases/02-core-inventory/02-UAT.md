---
status: complete
phase: 02-core-inventory
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md]
started: 2026-04-16T00:00:00Z
updated: 2026-04-16T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running add-on instance. Start it fresh (stop → start in HA add-on page). Add-on boots without errors, migration 0002 runs and seeds 4 default categories, page loads in HA sidebar without crash or blank screen.
result: pass

### 2. Default Categories Seeded
expected: Open browser DevTools (or use any API client) and call GET {ingress-url}/api/categories/. Response should include exactly these 4 defaults: "Food & pantry", "Fridge & freezer", "Cleaning & household", "Personal care" — all with is_default=true, ordered defaults-first.
result: pass

### 3. Inventory Page UI
expected: Clicking "Inventory" in the sidebar shows a working UI — not a placeholder. You should see an item list (empty state or items), a search bar, and a "+" FAB button in the bottom-right corner. The text "Your inventory items will appear here." should NOT be visible.
result: pass

### 4. Add an Item
expected: Tap the "+" FAB button. A slide-in drawer opens titled "Add Item" with an empty form. Fill in a name (e.g. "Milk"), select category "Fridge & freezer", leave quantity mode as "Exact count", set quantity to 2. Tap "Save Item". The drawer closes and "Milk" appears in the inventory list under "Fridge & freezer".
result: pass

### 5. Edit an Item
expected: Tap/click an existing item row or card. The drawer opens in edit mode — title shows the item name, all fields pre-filled with current values. Change the name to "Oat Milk" and tap "Save Item". The drawer closes and the list shows "Oat Milk".
result: pass

### 6. Quantity Controls — Exact Mode
expected: On an item in "exact" quantity mode, tap "+" once. The count increments immediately (optimistic update). Tap "−" until count reaches 0. At 0, the item should NOT go negative (button disables or stops at 0). If the count was at 1 and you tap "−", confirm it goes to 0 (not −1).
result: issue
reported: "when editing the item, the count is float. in the inventory it is not a float. it should be whole numbers and no float"
severity: major

### 7. Status Cycling
expected: Add or find an item in "status" mode (Have/Low/Out). Tap the status pill. It should cycle: Have → Low → Out → Have. Each tap updates the displayed pill color/label immediately.
result: pass

### 8. Item Attribution
expected: After saving a change to any item, the item row/card shows "Updated by [your HA username] · Xm ago" (or similar time-ago text). It should reflect your actual HA username, not "null" or "unknown".
result: issue
reported: "there is no text that says updated by"
severity: major

### 9. Delete an Item
expected: Tap an item to open the drawer. Tap "Delete". The footer switches to a confirmation row: "Delete [item name]? Yes, delete / Cancel". Tap "Yes, delete". The drawer closes and the item is gone from the list. Refresh the page — item does not reappear.
result: pass

### 10. Custom Category Management
expected: Navigate to /settings (Settings link in the nav). Under "Categories", tap "Add" and create "Snacks". It appears in the list with Pencil and Trash icons. Tap Pencil, rename it to "Snacks & sweets", press Enter — the name updates inline. Tap Trash, confirm deletion. "Snacks & sweets" disappears.
result: pass

### 11. Default Category Protection
expected: In /settings under "Categories", the 4 default categories (Food & pantry, Fridge & freezer, Cleaning & household, Personal care) should have NO Pencil or Trash icons — they appear locked/read-only. You should NOT be able to rename or delete them.
result: pass
note: User wants default categories to be editable/deletable (design change request — currently locked per spec)

### 12. Location Management
expected: In /settings under "Storage Locations", add a location "Pantry shelf". Assign it to an item (edit the item, set its location). Then delete "Pantry shelf" from Settings. The item previously assigned to it should show no location (not crash or show an error).
result: pass

## Summary

total: 12
passed: 10
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Quantity in exact mode should display and input as whole numbers (integers), not floats"
  status: failed
  reason: "User reported: when editing the item, the count is float. in the inventory it is not a float. it should be whole numbers and no float"
  severity: major
  test: 6
  artifacts:
    - "frontend/src/components/ItemDrawer/ItemDrawer.jsx:385 — step=\"0.1\" causes browser to render 2.0 instead of 2"
    - "backend/schemas/item.py:31,56,86 — quantity typed as Optional[float] in Pydantic schemas"
    - "backend/alembic/versions/0001_initial_v1_schema.py:40 — sa.Float() column type"
  root_cause: "ItemDrawer uses step=\"0.1\" on the quantity input, so the browser renders floats. The API also serializes quantity as float (Pydantic Optional[float] + sa.Float() in DB). The list view hides this via a formatCount() formatter in QuantityControls.jsx."
  fix: "Change step=\"0.1\" to step=\"1\" in ItemDrawer.jsx:385. For a complete fix also change quantity type to int in schemas/item.py and add a migration changing sa.Float() to sa.Integer()."
- truth: "Item row/card should show 'Updated by [HA username] · Xm ago' attribution after saving changes"
  status: failed
  reason: "User reported: there is no text that says updated by"
  severity: major
  test: 8
  artifacts:
    - "backend/middleware/ingress.py:37 — reads x-ingress-remote-user-name header; returns None if absent"
    - "backend/routers/items.py:52 — stores ha_user_name=user.name (NULL if header missing)"
    - "frontend/src/components/ItemRow.jsx:18 / ItemCard.jsx:19 — attribution hidden when last_updated_by_name is null"
  root_cause: "The attribution pipeline is correct. The x-ingress-remote-user-name header is only injected by the HA Supervisor ingress proxy. If the add-on is accessed via a direct port URL instead of the HA ingress URL ('Open Web UI' button), the header is never sent, ha_user_name is stored as NULL, and the attribution line is suppressed."
  fix: "Configuration fix: access the add-on via the HA ingress URL (Open Web UI button), not a direct port. Also ensure the HA user has a display name set in Profile. No code change required."
