---
phase: 04-shopping-restock
plan: "04"
subsystem: frontend
tags: [restock, barcode, scanner, shopping-list, toast, bottom-sheet]
dependency_graph:
  requires: ["04-03"]
  provides: [restock-scan-loop, Toast, RestockQuickSheet]
  affects: [ShoppingList, useBarcodeScanner, CameraOverlay]
tech_stack:
  added: []
  patterns: [TDD-red-green, mode-parameter-hook-extension, restock-scan-loop]
key_files:
  created:
    - frontend/src/components/Toast/Toast.jsx
    - frontend/src/components/Toast/Toast.module.css
    - frontend/src/components/Toast/Toast.test.jsx
    - frontend/src/components/RestockQuickSheet/RestockQuickSheet.jsx
    - frontend/src/components/RestockQuickSheet/RestockQuickSheet.module.css
    - frontend/src/components/RestockQuickSheet/RestockQuickSheet.test.jsx
  modified:
    - frontend/src/hooks/useBarcodeScanner.js
    - frontend/src/hooks/useBarcodeScanner.test.js
    - frontend/src/components/CameraOverlay/CameraOverlay.jsx
    - frontend/src/pages/ShoppingList.jsx
    - frontend/src/pages/ShoppingList.module.css
    - frontend/src/pages/ShoppingList.test.jsx
decisions:
  - "Start restocking button always visible (not gated on entries.length > 0) so restock mode is accessible even on an empty list"
  - "restockMode hides the Start restocking button while active to avoid double-activation"
  - "Test 8 uses findAllByRole('status') to handle EmptyState also having role=status"
metrics:
  duration_seconds: 586
  completed_date: "2026-04-18"
  tasks_completed: 3
  files_created: 6
  files_modified: 6
---

# Phase 4 Plan 04: Restock Scan Loop Summary

Wired the complete restock scan flow — scan-quantity-remove loop — closing RSTO-01, RSTO-02, and RSTO-03. The "Start restocking" button on the shopping list page now opens a CameraOverlay (ariaLabel="Restock scanner"), matches barcodes locally, shows a RestockQuickSheet for quantity entry, POSTs the delta, removes matched items from the list, and re-arms the camera — all with no Open Food Facts roundtrip.

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| 1: Extend useBarcodeScanner | 97bbb78 | mode='restock' param, restockNoMatch flag, 6 new tests |
| 2: Toast + RestockQuickSheet + CameraOverlay | e5a0077 | 3 new components, ariaLabel/children props on overlay |
| 3: Wire ShoppingList restock flow | ed4f477 | Full scan loop, Tests 6-10, RSTO-01/02/03 closed |

## Requirements Closed

- **RSTO-01**: Dedicated restock mode — "Start restocking" opens CameraOverlay with aria-label "Restock scanner", scan loop stays active until user exits
- **RSTO-02**: Scan finds existing item — RestockQuickSheet shows item name + "Quantity added" stepper (default 1, min 1), single "Add to stock" POST
- **RSTO-03**: Restocked items removed from list — `checkOff(entryId, delta)` called for persisted entries; auto-surfaced entries dropped on next fetch via Plan 02's threshold rule

## Tests Added

| Suite | Tests Added | Total |
|-------|-------------|-------|
| useBarcodeScanner.test.js | 6 (Tests 9–14) | 14 |
| Toast.test.jsx | 3 | 3 |
| RestockQuickSheet.test.jsx | 5 | 5 |
| ShoppingList.test.jsx | 5 (Tests 6–10) | 10 |
| **Total new** | **19** | — |

## Decisions Made

1. **Start restocking button always visible**: removed the `entries.length > 0` gate so the button is accessible even when the shopping list is empty (enables restocking without needing items on the list first).
2. **restockMode hides the button**: when restock mode is active the button is unmounted to prevent double-activation — the CameraOverlay's "Done restocking" button is the clear exit path.
3. **Test 8 multi-status workaround**: EmptyState renders with `role="status"` when entries are empty; used `findAllByRole('status')` and filtered by text content to isolate the Toast assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Start restocking button hidden when entries empty**
- **Found during:** Task 3 - Tests 6-10 RED run
- **Issue:** Plan 03 gated the button inside `entries.length > 0` block; tests pass empty entries so button was never rendered
- **Fix:** Moved button outside the entries gate — always visible, hidden only when `restockMode === true`
- **Files modified:** `frontend/src/pages/ShoppingList.jsx`
- **Commit:** ed4f477

**2. [Rule 1 - Bug] Multiple role=status elements caused findByRole to throw**
- **Found during:** Task 3 - Test 8
- **Issue:** EmptyState component also has `role="status"`, causing `findByRole('status')` to find multiple elements
- **Fix:** Changed to `findAllByRole('status')` with `.find()` filter on text content
- **Files modified:** `frontend/src/pages/ShoppingList.test.jsx`
- **Commit:** ed4f477

## Threat Register Coverage

All T-04-22 through T-04-29 mitigations are in place:

| Threat | Mitigation Location |
|--------|---------------------|
| T-04-22 Spoofing barcode | useBarcodeScanner restock mode requires user tap "Add to stock" — no silent mutation |
| T-04-23 Tampering quantity delta | Stepper min=1, client-side clamp; backend Pydantic QuantityDelta validates |
| T-04-24 Tampering check-off | Plan 02 CheckOffBody extra="forbid" + positive-integer validator |
| T-04-25 Info disclosure toast | Toast shows literal "Item not found" — no raw barcode rendered |
| T-04-26 DoS scan loop | CameraOverlay dispatchedRef guard; Toast timeout cleared on unmount |
| T-04-27 DoS share/clipboard | Restock mode overlays page; share button unreachable while active |
| T-04-28 EoP remote user header | Phase 1 ingress middleware enforced; HA Supervisor strips/re-sets headers |
| T-04-29 Repudiation transaction | Phase 2 transactions table records every quantity delta |

## Known Stubs

None — all functionality implemented at full fidelity per D-11/D-12/D-13/D-14/D-15.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All mutations flow through existing Phase 2 endpoints.

## Self-Check: PASSED

Files created/exist:
- frontend/src/components/Toast/Toast.jsx — FOUND
- frontend/src/components/Toast/Toast.module.css — FOUND
- frontend/src/components/Toast/Toast.test.jsx — FOUND
- frontend/src/components/RestockQuickSheet/RestockQuickSheet.jsx — FOUND
- frontend/src/components/RestockQuickSheet/RestockQuickSheet.module.css — FOUND
- frontend/src/components/RestockQuickSheet/RestockQuickSheet.test.jsx — FOUND

Commits verified:
- 97bbb78 — FOUND (useBarcodeScanner extension)
- e5a0077 — FOUND (Toast + RestockQuickSheet + CameraOverlay)
- ed4f477 — FOUND (ShoppingList restock wiring)

Full suites: 190 frontend tests pass, 111 backend tests pass.
