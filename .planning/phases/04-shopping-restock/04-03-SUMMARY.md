---
phase: "04-shopping-restock"
plan: "03"
subsystem: "frontend"
tags: [shopping-list, frontend, react, dnd-kit, web-share, nav-badge, ui]
dependency_graph:
  requires: ["04-01", "04-02"]
  provides: ["ShoppingList page", "useShoppingList hook", "lib/share.js", "ShoppingListRow", "CheckOffSheet", "NavItem badge", "itemsApi prop lift"]
  affects: ["frontend/src/App.jsx", "frontend/src/pages/Inventory.jsx", "frontend/src/layout/AppLayout.jsx", "frontend/src/layout/NavItem.jsx"]
tech_stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0", "@dnd-kit/utilities@3.2.2"]
  patterns: ["useSortable drag handle", "Web Share API + clipboard fallback", "optimistic removeEntry", "backward-compatible props fallback hook"]
key_files:
  created:
    - frontend/src/lib/share.js
    - frontend/src/lib/share.test.js
    - frontend/src/hooks/useShoppingList.js
    - frontend/src/hooks/useShoppingList.test.js
    - frontend/src/components/ShoppingListRow/ShoppingListRow.jsx
    - frontend/src/components/ShoppingListRow/ShoppingListRow.module.css
    - frontend/src/components/ShoppingListRow/ShoppingListRow.test.jsx
    - frontend/src/components/CheckOffSheet/CheckOffSheet.jsx
    - frontend/src/components/CheckOffSheet/CheckOffSheet.module.css
    - frontend/src/components/CheckOffSheet/CheckOffSheet.test.jsx
    - frontend/src/pages/ShoppingList.jsx
    - frontend/src/pages/ShoppingList.module.css
    - frontend/src/pages/ShoppingList.test.jsx
  modified:
    - frontend/package.json
    - frontend/src/layout/NavItem.jsx
    - frontend/src/layout/NavItem.module.css
    - frontend/src/layout/AppLayout.jsx
    - frontend/src/App.jsx
    - frontend/src/pages/Inventory.jsx
decisions:
  - "Inventory.jsx gets backward-compatible itemsApi prop with fallback to useItemsHook() — avoids breaking existing tests without modifying them"
  - "AppLayout calls useShoppingList independently for nav badge count — acceptable duplicate fetch at household scale; avoids prop-drilling through router"
  - "Start restocking button rendered but disabled in Plan 03 — Plan 04 provides onStartRestock callback to enable it"
  - "Auto entries (id==null) rendered in unsortable tail list outside SortableContext — prevents @dnd-kit errors on null ids"
metrics:
  duration: "~25min"
  completed: "2026-04-18"
  tasks_completed: 3
  files_created: 13
  files_modified: 6
---

# Phase 04 Plan 03: Shopping List Frontend Summary

Full frontend Shopping List experience: a draggable, tappable, shareable shopping list with empty state, manual-add picker, check-off bottom sheet, remove-with-undo, and nav badge. SHOP-01 through SHOP-05 are all satisfied by this plan.

## What Was Built

**useShoppingList hook** (`frontend/src/hooks/useShoppingList.js`) — data layer for the entire shopping list UI. Provides `entries`, `loading`, `error`, `refetch`, `addManual`, `removeEntry`, `reorder`, `checkOff`. Optimistic updates for remove and reorder; refetch on addManual and checkOff. All calls via `apiFetch` (relative paths).

**lib/share.js** — `formatShoppingList(entries)` produces D-18 format ("Einkaufsliste\n\n• Item (N left)"); `shareText({title, text})` calls navigator.share with clipboard fallback returning `{method}` for toast decision.

**ShoppingListRow** — draggable list row using `useSortable` from @dnd-kit/sortable. Drag handle (GripVertical), checkbox (role=checkbox), name + quantity sub-label, remove button (Trash2). Accepts `draggable=false` for auto entries (id==null).

**CheckOffSheet** — bottom sheet quantity prompt (z-index 65, slideUp animation matching QuickUpdateSheet). Stepper defaulting to 1, minus disabled at 1. "Add to stock" → onConfirm(value), "Keep on list" / Escape / backdrop → onDismiss.

**NavItem badge** — optional `badge` prop renders accent pill (99+ cap, aria-label "{N} items to buy").

**AppLayout** — calls `useShoppingList()` to compute `entries.length` and passes as `badge` to Shopping List NavItem (SHOP-04, D-16).

**App.jsx** — lifts `useItems` to `AppInner`; passes `itemsApi` prop to Inventory and ShoppingList.

**Inventory.jsx** — backward-compatible: accepts `itemsApi` prop, falls back to `useItemsHook()` if prop absent.

**ShoppingList page** — full implementation replacing Phase 1 stub. DnD sortable list (PointerSensor + TouchSensor), manual-add picker modal (search + filtered by existing list), check-off via CheckOffSheet, remove with undo toast (3s), Web Share + clipboard fallback, "Start restocking" button (disabled — Plan 04 wires handler).

## Test Results

| File | Tests | Status |
|------|-------|--------|
| share.test.js | 7 | Green |
| useShoppingList.test.js | 6 | Green |
| ShoppingListRow.test.jsx | 6 | Green |
| CheckOffSheet.test.jsx | 5 | Green |
| ShoppingList.test.jsx | 5 | Green |
| All existing tests | 148 | No regressions |
| **Total** | **177** | **All pass** |

## Commits

| Hash | Message |
|------|---------|
| cec98db | feat(04-03): add useShoppingList hook + share helpers + Wave 0 test scaffolds |
| b7b1490 | feat(04-03): add ShoppingListRow + CheckOffSheet + nav badge + lift itemsApi to App |
| d93a9f3 | feat(04-03): assemble ShoppingList page — list, drag-drop, add, check-off, share, undo |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

**"Start restocking" button** (`frontend/src/pages/ShoppingList.jsx`, rendered when `entries.length > 0`): button is visible and styled but `disabled={!onStartRestock}`. Plan 04 passes the `onStartRestock` callback to enable it. This is an intentional placeholder per plan spec ("Plan 04 wires the real handler").

## Threat Flags

No new threat surface beyond what Plan 02's threat model already covers. Manual-add picker sends `item_id` values sourced from the backend-validated `itemsApi.items` list; backend enforces 404/409 (T-04-15). Share payload contains only item names and quantities — no PII (T-04-16/17).

## Self-Check: PASSED

All key files verified present. All 3 task commits verified in git log.
