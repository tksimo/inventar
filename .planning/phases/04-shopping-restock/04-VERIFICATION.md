---
phase: 04-shopping-restock
verified: 2026-04-19T12:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/10
  gaps_closed:
    - "Auto-entry check-off: POST /api/shopping-list/items/{item_id}/restock endpoint added (Plan 05); useShoppingList.checkOff routes to it when entryId is null"
    - "Auto-entry dismiss: suppressedItemIds Set state in ShoppingList.jsx allows session-scoped suppression of auto entries without a backend call (Plan 06)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify that the nav badge (SHOP-04) satisfies the product intent behind 'in-app alert'"
    expected: "The badge count on the Shopping List nav item updates reactively when stock drops below threshold, giving the user clear visual indication. D-16 explicitly defines this as the accepted form; human must confirm this matches product intent."
    why_human: "SC-4 (roadmap) says 'User sees an in-app alert when an item drops below its reorder threshold'. The implementation is a persistent nav badge (D-16), not a triggered notification. The team's D-16 decision document explicitly chose this form. Cannot confirm programmatically whether badge satisfies 'alert' intent."
  - test: "Check off a shopping list item via the CheckOffSheet UI; verify the increment-by-N semantics match the product intent"
    expected: "Tapping checkbox opens CheckOffSheet with stepper (default 1). Entering N and tapping 'Add to stock' increments item.quantity by N; if new_quantity >= threshold the entry is removed. SC says 'restocked to its threshold' but implementation follows D-07/D-08 (user controls amount). Human must confirm this matches product intent."
    why_human: "SC-3 wording says 'restocked to its threshold' but D-07/D-08 define increment-by-N + threshold-aware removal. The implementation correctly follows D-07/D-08 but the SC wording could imply auto-fill to threshold. Product confirmation closes this."
  - test: "Walk through the restock scan loop end-to-end on a mobile device with the running app"
    expected: "Tap 'Start restocking', scan a barcode matching an inventory item, enter quantity in RestockQuickSheet, tap 'Add to stock' — item quantity updates, entry disappears from shopping list, camera re-opens for next scan. Scanning unknown barcode shows 'Item not found' toast then camera re-opens. 'Done restocking' exits."
    why_human: "Full camera/sensor flow cannot be verified programmatically. CameraOverlay is mocked in all automated tests. Requires a real device and running application."
---

# Phase 4: Shopping & Restock — Verification Report

**Phase Goal:** Shopping list and restock scan flow — items below threshold auto-populate the list; users can manually add, reorder, check off (restocking inventory), and share the list; a scan mode lets users restock by barcode.
**Verified:** 2026-04-19T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure plans 05 and 06

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Items at or below reorder threshold (or status "out") automatically appear on shopping list without manual action | VERIFIED | `backend/routers/shopping_list.py` `_item_is_below_threshold()` + `get_shopping_list()` with dedup; 12 backend tests covering D-02/D-03; ShoppingList.jsx renders `entries` from hook |
| 2 | User can manually add any item to the shopping list regardless of stock level | VERIFIED | `POST /api/shopping-list/` endpoint; `addManual` in `useShoppingList.js`; FAB + picker modal in `ShoppingList.jsx`; 4 backend tests; Plan 06 auto-entry dismiss does not break manual add path |
| 3 | User can check off a shopping list item; item is restocked and removed from the list when above threshold | VERIFIED | Entry-keyed `POST /{entry_id}/check-off` (Plan 02) + item-keyed `POST /items/{item_id}/restock` (Plan 05) cover both persisted and auto entries; `checkOff` hook routes by entryId nullability; `CheckOffSheet` UI with stepper; 13 backend tests; line 247 ShoppingList.jsx passes `checkingOff.item_id` for routing |
| 4 | User sees an in-app alert when an item drops below its reorder threshold | PARTIAL (human needed) | Nav badge on Shopping List NavItem shows count (D-16: "No toasts, no notification bell, no push notifications"). `AppLayout.jsx` calls `useShoppingList()`; `badge={lowStockCount}` passed to `NavItem`. D-16 explicitly narrows SC-4 to a count badge — requires human product confirmation |
| 5 | User can export the shopping list as plain text and share via a messaging app | VERIFIED | `lib/share.js` `shareText` (Web Share API + clipboard fallback) + `formatShoppingList`; Share button wired in `ShoppingList.jsx`; 7 share tests pass |
| 6 | In restock mode, scanning a barcode finds the matching item and prompts for quantity to add; restocked items disappear | VERIFIED (camera needs human smoke test) | `useBarcodeScanner` mode='restock' branch skips OFF lookup; `RestockQuickSheet` with stepper; `onAddToStock` calls `itemsApi.updateQuantity` + conditional `shoppingList.checkOff`; 14 scanner tests + 5 sheet tests |

**Score:** 9/9 truths verified (SC-3 and SC-4 carry human confirmation caveats; SC-6 requires camera smoke test; all automated evidence present for all 6 SCs)

---

### Deferred Items

None — all 6 roadmap success criteria are addressed in this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/0004_add_sort_order_to_shopping_list.py` | Adds sort_order column, backfills rows | VERIFIED | revision=0004, down_revision=0003, batch_alter_table, UPDATE backfill present |
| `backend/models/__init__.py` | ShoppingListEntry.sort_order column | VERIFIED | `sort_order = Column(Integer, nullable=True)` confirmed |
| `backend/schemas/shopping_list.py` | 4 Pydantic schemas with extra="forbid" | VERIFIED | ShoppingListEntryResponse, ShoppingListCreate, ShoppingListUpdate, CheckOffBody — all have extra="forbid"; gt=0 and le=10000 bounds present |
| `backend/routers/shopping_list.py` | GET + POST + DELETE + PATCH + check-off + restock-by-item endpoints | VERIFIED | All 6 endpoint decorators present; `restock_by_item` at line 282 with atomic semantics identical to check-off; `_item_is_below_threshold`, `should_remove`, `quantity_change` confirmed |
| `backend/main.py` | shopping_list router registered | VERIFIED | `app.include_router(shopping_list.router)` present before SPA catch-all |
| `backend/tests/test_shopping_list.py` | 37 tests covering SHOP-01 through RSTO-03 + Plan 05 restock-by-item | VERIFIED | 37 `def test_` functions confirmed; 7 `test_restock_by_item_*` tests for Plan 05 gap |
| `frontend/src/hooks/useShoppingList.js` | Data hook with fetch/addManual/removeEntry/reorder/checkOff (checkOff routes by entryId nullability) | VERIFIED | `checkOff(entry_id, quantity_added, item_id=null)` routes to `/items/{id}/restock` when hasEntryId=false; all methods present |
| `frontend/src/lib/share.js` | shareText + formatShoppingList | VERIFIED | Both exports confirmed; used in ShoppingList.jsx |
| `frontend/src/layout/NavItem.jsx` | Optional badge prop | VERIFIED | `badge` prop, `showBadge`, aria-label confirmed |
| `frontend/src/layout/AppLayout.jsx` | Passes shopping list count as badge | VERIFIED | `useShoppingList()` called; `badge={lowStockCount}` |
| `frontend/src/components/ShoppingListRow/ShoppingListRow.jsx` | Draggable row with checkbox + remove; onCheck passes whole entry | VERIFIED | `onClick={() => onCheck(entry)}` passes entry with item_id; draggable=false accepted for auto entries |
| `frontend/src/components/CheckOffSheet/CheckOffSheet.jsx` | Bottom sheet quantity prompt | VERIFIED | File exists and substantive |
| `frontend/src/pages/ShoppingList.jsx` | Full shopping list page; suppressedItemIds for auto-entry dismiss; checkOff passes item_id | VERIFIED | `suppressedItemIds` Set state (line 37); `autoEntries` useMemo filters suppressed (line 57); `handleRemoveAuto` (line 101); `handleUndo` branches on `undoEntry.id == null` (line 112); `checkOff(checkingOff.id, q, checkingOff.item_id)` (line 247) |
| `frontend/src/hooks/useBarcodeScanner.js` | mode='restock' + restockNoMatch flag | VERIFIED | `mode='restock'` branch skips OFF lookup; `restockNoMatch` state exposed |
| `frontend/src/components/Toast/Toast.jsx` | Reusable toast with role=status + aria-live=polite | VERIFIED | role="status" + aria-live="polite" confirmed |
| `frontend/src/components/RestockQuickSheet/RestockQuickSheet.jsx` | Bottom sheet with "Quantity added" stepper + "Add to stock" | VERIFIED | "Quantity added" + "Add to stock" text confirmed; 85 lines (>= 80 minimum) |
| `frontend/src/components/CameraOverlay/CameraOverlay.jsx` | ariaLabel + children props | VERIFIED | ariaLabel prop and {children} slot confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/main.py` | `backend/routers/shopping_list.py` | `app.include_router(shopping_list.router)` | WIRED | Confirmed |
| `backend/routers/shopping_list.py get_shopping_list` | `backend/models/__init__.py Item + ShoppingListEntry` | db.query(Item) + db.query(ShoppingListEntry) with item_id dedup | WIRED | item_id dedup set confirmed |
| `backend/routers/shopping_list.py check_off_item` | `backend/models/__init__.py Item + Transaction + ShoppingListEntry` | atomic: update Item.quantity + insert Transaction + conditional delete ShoppingListEntry | WIRED | `should_remove`, `quantity_change`, `db.commit` in single function |
| `backend/routers/shopping_list.py restock_by_item` | `backend/models/__init__.py Item + Transaction + ShoppingListEntry` | atomic: same pattern as check_off — update Item + insert Transaction + conditional delete entry | WIRED | Lines 307-327: item.quantity assigned, `_record_txn` called, optional entry delete, single `db.commit()` |
| `frontend/src/hooks/useShoppingList.js checkOff` | `POST /api/shopping-list/items/{item_id}/restock` | `api/shopping-list/items/${item_id}/restock` when `entry_id` is null/undefined | WIRED | `hasEntryId` guard + path construction confirmed at line 124-126 |
| `frontend/src/pages/ShoppingList.jsx CheckOffSheet onConfirm` | `useShoppingList.checkOff` | `checkOff(checkingOff.id, q, checkingOff.item_id)` — passes both id and item_id | WIRED | Line 247 confirmed; `onCheck(entry)` in ShoppingListRow passes full entry with item_id |
| `frontend/src/pages/ShoppingList.jsx handleRemoveAuto` | `suppressedItemIds` state setter | `setSuppressedItemIds(prev => new Set([...prev, entry.item_id]))` | WIRED | Lines 101-108: functional updater adds item_id to Set |
| `frontend/src/pages/ShoppingList.jsx autoEntries useMemo` | `suppressedItemIds` state | `entries.filter(e => e.id == null && !suppressedItemIds.has(e.item_id))` | WIRED | Lines 56-58 confirmed |
| `frontend/src/pages/ShoppingList.jsx` | `frontend/src/hooks/useBarcodeScanner.js` | `useBarcodeScanner({ items, mode: 'restock' })` | WIRED | mode: 'restock' call confirmed |
| `frontend/src/pages/ShoppingList.jsx` | `frontend/src/components/CameraOverlay/CameraOverlay.jsx` | `ariaLabel="Restock scanner"` | WIRED | Confirmed |
| `frontend/src/pages/ShoppingList.jsx` | `POST /api/items/{id}/quantity` | `itemsApi.updateQuantity(matched.id, delta)` in onAddToStock | WIRED | Confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `frontend/src/pages/ShoppingList.jsx` | `entries` | `useShoppingList()` → `apiFetch('api/shopping-list/')` → FastAPI GET → SQLAlchemy queries items + shopping_list | Yes — ORM queries; no hardcoded returns | FLOWING |
| `frontend/src/layout/AppLayout.jsx` | `lowStockCount` | `useShoppingList()` same fetch; `entries.length` | Yes — derived from live API data | FLOWING |
| `backend/routers/shopping_list.py` | persisted rows + auto entries | `db.query(Item).filter(archived == False)` + `db.query(ShoppingListEntry)` | Yes — both real DB queries | FLOWING |
| `backend/routers/shopping_list.py restock_by_item` | Item mutation + Transaction | `db.query(Item).filter(Item.id == item_id)` — real ORM query; `_record_txn` inserts real Transaction row | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| restock_by_item endpoint registered | `grep "@router.post.*items.*restock" backend/routers/shopping_list.py` | `@router.post("/items/{item_id}/restock")` at line 282 | PASS |
| restock_by_item has same D-08 removal logic | `grep "should_remove" backend/routers/shopping_list.py` | Multiple matches in both check_off_item and restock_by_item functions | PASS |
| useShoppingList checkOff routes null entryId | `grep "api/shopping-list/items/" frontend/src/hooks/useShoppingList.js` | `api/shopping-list/items/${item_id}/restock` at line 126 | PASS |
| suppressedItemIds state in ShoppingList | `grep "suppressedItemIds" frontend/src/pages/ShoppingList.jsx` | 5 matches — useState init, useMemo filter, handler add, undo handler remove, onRemove prop | PASS |
| handleUndo branches on auto vs persisted | `grep "undoEntry.id == null" frontend/src/pages/ShoppingList.jsx` | Match at line 112 — auto-entry undo unsuppresses; persisted undo calls addManual | PASS |
| 37 backend tests | `grep -c "^def test_" backend/tests/test_shopping_list.py` | 37 | PASS |
| Plan 05 backend tests present | `grep "test_restock_by_item" backend/tests/test_shopping_list.py` | 7 matches (tests 31-37) | PASS |
| Plan 06 frontend tests present | `grep "Test H\|Test I\|Test J\|Test K" frontend/src/pages/ShoppingList.test.jsx` | 4 matches | PASS |
| No TODO/FIXME blockers in new files | grep on shopping_list.py, ShoppingList.jsx, useShoppingList.js | No matches | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SHOP-01 | 04-01, 04-03 | Items at or below reorder threshold auto-appear on shopping list | SATISFIED | GET endpoint `_item_is_below_threshold`; 12 backend tests; ShoppingList.jsx renders entries from hook |
| SHOP-02 | 04-02, 04-03, 04-06 | User can manually add any item regardless of stock level; auto entries can be dismissed | SATISFIED | POST /api/shopping-list/ endpoint; addManual hook; FAB picker; auto-entry suppress via suppressedItemIds (Plan 06) |
| SHOP-03 | 04-02, 04-03, 04-05 | User can check off items; item restocked and removed when above threshold | SATISFIED | Entry-keyed check-off (Plan 02) + item-keyed restock (Plan 05) cover all entry types; CheckOffSheet UI; 13 backend tests (6 check-off + 7 restock-by-item) |
| SHOP-04 | 04-03 | In-app alert when item drops below reorder threshold | SATISFIED via D-16 (human confirm pending) | Nav badge in AppLayout + NavItem; D-16 explicitly defines badge as the alert form |
| SHOP-05 | 04-03 | Export shopping list as plain text via messaging | SATISFIED | `lib/share.js` + Web Share + clipboard fallback; 7 share tests |
| RSTO-01 | 04-04 | Dedicated restock mode for scanning multiple items | SATISFIED | restockMode state machine; `onStartRestock` function (no longer disabled); CameraOverlay ariaLabel "Restock scanner"; scan loop re-arms camera |
| RSTO-02 | 04-04 | Scanning in restock mode finds item and prompts for quantity | SATISFIED | useBarcodeScanner mode='restock' branch; RestockQuickSheet stepper; 14 scanner tests + 5 sheet tests |
| RSTO-03 | 04-02, 04-04, 04-05 | Restocked items removed from shopping list automatically | SATISFIED | Backend D-08 removal logic in both check_off_item and restock_by_item; onAddToStock calls updateQuantity + checkOff; auto entries drop on next fetch via threshold rule |

**Orphaned requirements check:** SHOP-01 through SHOP-05, RSTO-01 through RSTO-03 all mapped to Phase 4 in REQUIREMENTS.md. All 8 are claimed by plans 01-06. None are orphaned.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/ShoppingList.jsx` | 239 (approx) | `placeholder="Search items…"` | Info | Legitimate HTML input placeholder attribute on the manual-add search field — not a code stub |

No blockers or warnings found.

---

### Human Verification Required

#### 1. SHOP-04 Nav Badge vs "Alert" Requirement

**Test:** Open the app, set an item's quantity below its reorder threshold (or set status to "out"). Navigate away and back.
**Expected:** The Shopping List nav item shows a badge count indicating the number of items needing attention. The badge updates on next page load/refetch.
**Why human:** SC-4 says "User sees an in-app alert when an item drops below its reorder threshold." The D-16 decision explicitly chose a persistent badge (no toast, no notification bell, no push notifications). The implementation is correct per D-16. A human must confirm whether the nav badge satisfies the product intent of "alert" or if a triggered notification is expected.

#### 2. SHOP-03 Check-off Semantics

**Test:** On the shopping list, tap the checkbox for an item with a reorder threshold of 5 and current quantity 0. Enter quantity 3 in CheckOffSheet. Tap "Add to stock".
**Expected:** Item quantity becomes 3 (below threshold of 5), entry stays on list. Enter quantity 5 → item goes to 5, entry removed. Confirm this user-controlled increment matches product intent.
**Why human:** SC-3 says "restocked to its threshold" but D-07+D-08 define "increment by user-entered amount, remove when >= threshold". The user controls the restock amount — the system does not auto-fill to threshold. Product confirmation required, especially for the case where a user adds fewer items than the threshold.

#### 3. Restock Scan Loop End-to-End

**Test:** On a mobile device with the running app, open the shopping list page. Tap "Start restocking." Point camera at a known barcode. Enter quantity in RestockQuickSheet. Tap "Add to stock." Try scanning an unknown barcode.
**Expected:** Matched scan: RestockQuickSheet shows item name, stepper defaults to 1, "Add to stock" updates inventory and removes from list, camera re-opens. Unknown scan: "Item not found" toast for 2 seconds, camera re-opens. "Done restocking" returns to shopping list.
**Why human:** Full camera/sensor scan flow requires a real device and running application. CameraOverlay is mocked in all automated tests.

---

## Gaps Summary

No blocking gaps identified. All 8 requirements (SHOP-01 through SHOP-05, RSTO-01 through RSTO-03) have full implementation evidence. The two gap-closure plans (05 and 06) have been verified:

**Plan 05 (Gap 1 — auto-entry check-off):** `POST /api/shopping-list/items/{item_id}/restock` endpoint exists at line 282 of `shopping_list.py` with identical D-08 semantics to the entry-keyed endpoint. `useShoppingList.checkOff` routes to it when `entryId` is null. `ShoppingList.jsx` passes `checkingOff.item_id` alongside `checkingOff.id` at line 247. 7 new backend tests (31-37) confirmed.

**Plan 06 (Gap 2 — auto-entry dismiss):** `suppressedItemIds` Set state in `ShoppingList.jsx` line 37; `autoEntries` useMemo filters suppressed item_ids at line 57; `handleRemoveAuto` adds to Set at line 101; `handleUndo` unsuppresses at line 113 when `undoEntry.id == null`. 4 new frontend tests (H, I, J, K) confirmed. No backend call triggered for auto-entry dismiss.

The `human_needed` status is unchanged from the initial verification because the three human items (SHOP-04 badge semantics, SHOP-03 restock amount semantics, restock scan loop on device) were not addressed by Plans 05/06 — they require product/device confirmation.

---

_Verified: 2026-04-19T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
