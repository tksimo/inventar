# Phase 4: Shopping & Restock — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorder thresholds per item, auto-surfaced shopping list, manual list management with drag-and-drop ordering, check-off with quantity prompt, in-app low-stock badge, plain-text list sharing via Web Share API, and a restock scan mode (barcode → quantity → remove from list) accessible from the shopping list page.

No Google Assistant / voice integration (deferred). No push notifications to phone (in-app badge only).

</domain>

<decisions>
## Implementation Decisions

### Reorder Threshold

- **D-01:** Threshold field lives in the **ItemDrawer** (add/edit item form) — a new optional numeric field "Reorder at" added below the quantity field.
- **D-02:** Default threshold for all new items is **0** — items auto-appear on the shopping list only when quantity reaches 0 or status is "out". Users who want earlier alerts set a higher threshold manually.
- **D-03:** Items with no threshold set (null/blank) never auto-appear on the list. They can still be manually added.

### Shopping List Layout & Interactions

- **D-04:** Simple **flat list** — no category grouping. Items ordered manually by the user.
- **D-05:** **Drag-and-drop reordering** — users can drag rows to set their own order. A persistent `sort_order` field per shopping list entry stores this. New auto-added items append to the bottom.
- **D-06:** Each row shows: **item name + current quantity** (e.g. "Milk — 0 left"). No category or location on the row.
- **D-07:** **Check-off = tap checkbox → small quantity prompt** — a compact bottom sheet or inline input asks "How many did you buy?" User enters quantity, taps Done. Inventory quantity is increased by that amount and the item is removed from the shopping list.
- **D-08:** If an item's threshold is set, restocking it to or above the threshold removes it from the list. If threshold is 0 (default), restocking with any quantity > 0 removes it.
- **D-09:** **Manual add** — a "+" button on the shopping list lets users search/pick any inventory item to add manually regardless of stock level.
- **D-10:** **Empty state** — when the list is empty: "Nothing to buy" with a subtle illustration or icon. No auto-redirect.

### Restock Scan Mode

- **D-11:** Entry point: a **"Start restocking" button** on the shopping list page (prominent, below the list or as a FAB). Opens a dedicated restock scan session.
- **D-12:** Restock scan reuses `useBarcodeScanner` and `CameraOverlay` from Phase 3. A new `mode: 'restock'` parameter drives different post-scan behaviour.
- **D-13:** On successful barcode match: **QuickUpdateSheet** slides up (Phase 3 component, reused) showing item name + a "Quantity added" numeric input + Done button. Tapping Done adds the entered quantity to inventory and removes the item from the shopping list if stocked above threshold.
- **D-14:** On no barcode match: **"Item not found" toast** — brief, non-blocking. Camera re-opens automatically for next scan. No fallback to add-item flow.
- **D-15:** User exits restock mode via a visible "Done restocking" button or by tapping the back/close control on CameraOverlay.

### Alerts

- **D-16:** Low-stock alert surfaces as a **count badge on the Shopping List nav item** — shows the number of items currently at or below their threshold (or "out"). Updates reactively when inventory changes. No toasts, no notification bell, no push notifications.

### List Sharing

- **D-17:** Share button on the shopping list page triggers **`navigator.share()`** (Web Share API) with a plain-text payload. On desktop or browsers without Web Share API support: falls back to **copy to clipboard** with a "Copied!" confirmation toast.
- **D-18:** Export format — **simple checklist**:
  ```
  Einkaufsliste
  
  • Milk (0 left)
  • Bread (0 left)
  • Detergent (1 left)
  ```
  Header "Einkaufsliste" (German, matches the app's household language). One item per line with bullet and current quantity.

### Claude's Discretion

- Drag-and-drop library choice (e.g. `@dnd-kit/core` — consistent with React ecosystem; or HTML5 drag events natively)
- Exact placement of "Start restocking" button vs FAB on the shopping list page
- Quantity prompt UI detail (inline input vs bottom sheet) for check-off, as long as it feels lightweight
- Toast library/component for "Item not found" and "Copied!" (can reuse existing pattern if one exists)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phase decisions to carry forward
- `.planning/phases/02-core-inventory/02-CONTEXT.md` — ItemDrawer pattern (D-02), Settings-only for categories/locations (D-04), D-06 user attribution
- `.planning/phases/03-barcode-scanning/03-CONTEXT.md` — QuickUpdateSheet (D-03/D-04), ScanFAB pattern (D-01/D-02), useBarcodeScanner hook design (D-05), CameraOverlay (D-02)

### Existing components to reuse/extend
- `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx` — reuse for restock quantity prompt (D-13)
- `frontend/src/hooks/useBarcodeScanner.js` — extend with `mode: 'restock'` (D-12)
- `frontend/src/components/CameraOverlay/CameraOverlay.jsx` — reuse as-is for restock scan (D-12)
- `frontend/src/components/ItemDrawer/ItemDrawer.jsx` — extend with threshold field (D-01)
- `frontend/src/pages/ShoppingList.jsx` — existing stub to implement

### Requirements
- `.planning/REQUIREMENTS.md` — SHOP-01 through SHOP-05, RSTO-01 through RSTO-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuickUpdateSheet`: bottom sheet with quantity controls + Done/Edit actions — extend for restock quantity input (D-13)
- `useBarcodeScanner`: hook managing scan state machine (isOpen, scanState, prefillProduct, matched item) — add `mode` param for restock behaviour (D-12)
- `CameraOverlay`: camera overlay component with `onDetected` callback — reuse unchanged (D-12)
- `FAB` / `ScanFAB`: FAB pattern for "Start restocking" button if FAB style is chosen (D-11)
- `EmptyState`: existing empty state component — use for empty shopping list (D-10)
- `useItems`: existing hook with items data — shopping list can derive auto-entries from items below threshold

### Established Patterns
- Bottom sheet (z-index 65) for quick actions — QuickUpdateSheet
- CSS Modules for component styling — follow same pattern for new shopping list components
- `apiFetch` from `frontend/src/lib/api.js` — use for shopping list API calls
- TDD red-green pattern — write failing tests first (established in all prior phases)

### Integration Points
- `ItemDrawer.jsx` — add threshold field to form state, `buildCreatePayload`, `buildUpdatePatch`
- `backend/routers/items.py` — add `reorder_threshold` column to items table/schema
- Navigation — Shopping List nav item needs badge count (low-stock count from items query)
- `ShoppingList.jsx` — full implementation replacing the Phase 1 stub

</code_context>

<specifics>
## Specific Ideas

- "Einkaufsliste" as the share export header (German, household language)
- Drag-and-drop ordering is important to the user — sort order must persist across sessions
- Check-off prompts for actual quantity (not auto-restock to threshold) — user bought different amounts than expected
- Restock mode stays in scan loop until user explicitly exits (D-15) — designed for bulk restocking after a trip

</specifics>

<deferred>
## Deferred Ideas

- **Google Nest / Google Assistant voice integration** — "Bitte X zur Einkaufsliste hinzufügen" — requires Actions on Google, account linking, and webhook endpoints. Significant new capability, warrants its own phase after Phase 6.
- **Push notifications** — alerting household members on their phones when stock drops. Beyond in-app badge for now.

</deferred>

---

*Phase: 04-shopping-restock*
*Context gathered: 2026-04-17*
