---
phase: "03-barcode-scanning"
plan: "03"
subsystem: "frontend"
tags: ["barcode", "integration", "tdd", "react", "useBarcodeScanner", "ItemDrawer", "Inventory"]
dependency_graph:
  requires:
    - "GET /api/barcode/{code} (Plan 01)"
    - "ScanFAB, CameraOverlay, QuickUpdateSheet, NutritionSection (Plan 02)"
  provides:
    - "useBarcodeScanner hook (matched / prefill / fallback state machine)"
    - "ItemDrawer extended with initialName, initialBarcode, initialImageUrl, initialNutrition props"
    - "Inventory.jsx wired end-to-end with ScanFAB, CameraOverlay, QuickUpdateSheet, scan-prefill ItemDrawer"
  affects:
    - frontend/src/hooks/useBarcodeScanner.js
    - frontend/src/hooks/useBarcodeScanner.test.js
    - frontend/src/components/ItemDrawer/ItemDrawer.jsx
    - frontend/src/components/ItemDrawer/ItemDrawer.test.jsx
    - frontend/src/pages/Inventory.jsx
    - frontend/src/pages/Inventory.test.jsx
tech_stack:
  added: []
  patterns:
    - "TDD red-green (failing tests committed before implementation)"
    - "renderHook + vi.stubGlobal('fetch') for hook unit tests"
    - "window.__triggerScan helper for integration scan simulation"
    - "Scan-state machine: idle → looking_up → matched | prefill | fallback"
    - "encodeURIComponent on rawValue before URL interpolation (T-03-11)"
    - "No error field on hook return — D-08 silent fallback guarantee"
key_files:
  created:
    - frontend/src/hooks/useBarcodeScanner.js
    - frontend/src/hooks/useBarcodeScanner.test.js
  modified:
    - frontend/src/components/ItemDrawer/ItemDrawer.jsx
    - frontend/src/components/ItemDrawer/ItemDrawer.test.jsx
    - frontend/src/pages/Inventory.jsx
    - frontend/src/pages/Inventory.test.jsx
decisions:
  - "Hook deliberately omits an 'error' field — D-08 requires 'barcode not in OFF' and 'OFF unreachable' to have identical silent-fallback UX; exposing error would create a second code path"
  - "handleDetected sets isOpen=false synchronously before any async work — D-02 requires camera to dismiss before sheet/drawer appears"
  - "Existing add/edit ItemDrawer gated with scanner.scanState !== 'prefill' && !== 'fallback' to prevent drawer collision"
  - "scan-prefill onCreate wraps create() with scanner.reset() so state clears on successful save"
  - "No OFF lookup for items already in inventory (D-13) — local barcode match short-circuits before fetch"
metrics:
  duration_seconds: 420
  completed_date: "2026-04-17T00:00:00Z"
  tasks_completed: 4
  tasks_total: 4
  files_changed: 6
checkpoint:
  type: "human-verify"
  result: "approved"
  criteria_passed:
    - "Criterion 1: ScanFAB opens CameraOverlay; overlay dismisses on barcode detect"
    - "Criterion 2: Existing-item barcode shows QuickUpdateSheet (not ItemDrawer)"
    - "Criterion 3: OFF-matched barcode opens ItemDrawer with name/image/nutrition pre-filled"
    - "Criterion 4: OFF-miss barcode opens ItemDrawer barcode-only, no error state"
    - "Criterion 5: HA ingress HTTPS camera access confirmed on real mobile device"
---

# Phase 3 Plan 3: Scan Flow Integration Summary

**One-liner:** `useBarcodeScanner` hook wires Plans 01 and 02 into a complete end-to-end scan flow in Inventory.jsx — 8 hook unit tests, 6 ItemDrawer pre-fill tests, 4 integration tests, all five ROADMAP Phase 3 success criteria passing, real-device checkpoint approved.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for useBarcodeScanner hook (8 tests) | 6f44d6e | frontend/src/hooks/useBarcodeScanner.test.js |
| 1 GREEN | useBarcodeScanner hook implementation | 8548b88 | frontend/src/hooks/useBarcodeScanner.js |
| 2 RED | Failing tests for ItemDrawer barcode pre-fill (Tests 11–16) | 4d1a855 | frontend/src/components/ItemDrawer/ItemDrawer.test.jsx |
| 2 GREEN | ItemDrawer extended with pre-fill props + NutritionSection embed | db55406 | frontend/src/components/ItemDrawer/ItemDrawer.jsx |
| 3 RED | Failing integration tests for scan flow (Tests A–D) | e076a98 | frontend/src/pages/Inventory.test.jsx |
| 3 GREEN | Inventory.jsx wired to full scan flow | f8951b1 | frontend/src/pages/Inventory.jsx |
| 4 CHECKPOINT | Real-device UAT via HA ingress HTTPS | — | — |

---

## What Was Built

### `frontend/src/hooks/useBarcodeScanner.js`

Stateful React hook that orchestrates the three scan outcomes:

- **State machine:** `idle → (openScanner) → idle → (handleDetected) → matched | looking_up → prefill | fallback`
- **`openScanner()`** resets all derived state to `idle` and flips `isOpen=true`.
- **`closeScanner()`** sets `isOpen=false` without clearing `scanState` (downstream sheet/drawer persists after camera closes).
- **`handleDetected(rawValue)`** sets `isOpen=false` synchronously (D-02), then:
  - Local match: `items.find(i => i.barcode === rawValue)` → `scanState='matched'`, `matchedItem=item`. No OFF fetch (D-13).
  - No local match: `apiFetch('api/barcode/' + encodeURIComponent(rawValue))` (T-03-11 path injection mitigation).
    - `res.ok` → `scanState='prefill'`, `prefillProduct={barcode,name,image_url,calories,protein,carbs,fat}`.
    - `!res.ok` or fetch throw → `scanState='fallback'`, `fallbackBarcode=rawValue`. Silent — no error field (D-08).
- **`reset()`** clears `scanState` back to `idle` and nulls all derived fields.
- Return value deliberately has **no `error` field** — D-08 type-surface guarantee.

### `frontend/src/hooks/useBarcodeScanner.test.js`

8 unit tests covering the full hook contract:

1. `openScanner flips isOpen to true and scanState to idle`
2. `closeScanner flips isOpen to false`
3. `handleDetected matches existing item by barcode and sets scanState matched` (asserts fetch never called)
4. `handleDetected calls OFF proxy for unknown barcode and sets prefill on 200`
5. `handleDetected falls back to barcode-only on 404`
6. `handleDetected falls back on network error (fetch throws)`
7. `handleDetected URL-encodes the barcode` (path injection test — `../secret` → `..%2Fsecret`)
8. `reset clears scanState back to idle`

### `frontend/src/components/ItemDrawer/ItemDrawer.jsx`

Extended with four new optional props (add-mode only):

- `initialName` — pre-fills Name input from OFF product_name.
- `initialBarcode` — pre-fills new visible Barcode input (user-editable to correct misreads).
- `initialImageUrl` — stored on form state; forwarded to `create` payload as `image_url`; passed to NutritionSection.
- `initialNutrition` — `{calories, protein, carbs, fat}` seeds form state and create payload.

Additional changes:
- `toInitial()` accepts an `overrides` second argument; add-mode applies overrides before defaults.
- New Barcode `<input>` rendered below Name with `id="item-barcode"` and `inputMode="numeric"`.
- `buildCreatePayload()` conditionally includes `barcode`, `image_url`, `calories`, `protein`, `carbs`, `fat`.
- `<NutritionSection>` embedded at the bottom of the body; in add-mode fed from form state (seeded by `initialNutrition`/`initialImageUrl`); in edit-mode fed from `item.*` fields.
- `isDirty` memo extended to cover the 6 new form fields.

### `frontend/src/pages/Inventory.jsx`

Four additions to the page, preserving all existing behavior:

1. `const scanner = useBarcodeScanner({ items })` after `useItems()` destructure.
2. `<ScanFAB onClick={scanner.openScanner} />` rendered alongside the existing `<FAB>`.
3. `{scanner.isOpen && <CameraOverlay onDetected={scanner.handleDetected} onClose={scanner.closeScanner} />}` — camera viewfinder.
4. `{scanner.scanState === 'matched' && scanner.matchedItem && <QuickUpdateSheet ... />}` — wired with `updateQuantity`, `openEdit`, and `scanner.reset` callbacks.
5. Existing add/edit `<ItemDrawer>` gated with `scanner.scanState !== 'prefill' && scanner.scanState !== 'fallback'` to prevent collision.
6. `{scanner.scanState === 'prefill' && scanner.prefillProduct && <ItemDrawer mode="add" initialName={...} ... />}` — OFF pre-fill drawer.
7. `{scanner.scanState === 'fallback' && scanner.fallbackBarcode && <ItemDrawer mode="add" initialBarcode={scanner.fallbackBarcode} ... />}` — barcode-only fallback drawer.

Both scan-prefill drawers call `scanner.reset()` on successful `onCreate` to clear state after item is saved.

---

## Verification

```
cd frontend && npm test -- --run useBarcodeScanner
# 8 passed

cd frontend && npm test -- --run ItemDrawer
# 22+ passed (10 original + 6 integer + 6 new pre-fill tests)

cd frontend && npm test -- --run Inventory
# All existing + 4 new integration tests passed

cd frontend && npm test -- --run
# Full frontend suite green, no regressions

cd backend && python -m pytest -x -q
# Full backend suite green, barcode router unchanged
```

### Real-Device Checkpoint (ROADMAP Criterion 5)

Verified on mobile device via HA ingress HTTPS. All four manual criteria observed:

1. ScanFAB opens CameraOverlay; overlay dismisses immediately on barcode detect.
2. Scanning an existing-inventory barcode shows QuickUpdateSheet with −/+ controls; ItemDrawer does not appear.
3. Scanning a recognized OFF barcode opens ItemDrawer with name, product image, and nutrition values pre-filled.
4. Scanning an unrecognized barcode opens ItemDrawer with barcode field only; no error state anywhere on screen.

---

## Deviations from Plan

None — all tasks executed per specification with no auto-fixes required.

---

## Known Stubs

None — all three scan outcomes are fully wired. No hardcoded placeholder data flows to rendering.

---

## Threat Flags

All six STRIDE threats declared in the plan (T-03-11 through T-03-16) are addressed as designed:

- **T-03-11 (Tampering):** `encodeURIComponent(rawValue)` applied before URL interpolation; verified by Test 7.
- **T-03-12 (Information Disclosure):** Only 7 whitelisted `BarcodeProduct` fields reach NutritionSection.
- **T-03-13 (Spoofing):** Accepted — household-internal trust scope (USER-01).
- **T-03-14 (DoS):** `dispatchedRef` guard in CameraOverlay + synchronous `setIsOpen(false)` in hook prevent scan loop.
- **T-03-15 (Information Disclosure):** `alt=""` on product image; future CSP `img-src` header out of scope for Phase 3.
- **T-03-16 (EoP):** Accepted — scan-prefill drawer uses the same `onCreate` function as manual add; no elevated capability.

---

## Self-Check: PASSED

- [x] `frontend/src/hooks/useBarcodeScanner.js` exists
- [x] `frontend/src/hooks/useBarcodeScanner.test.js` exists (8 test functions)
- [x] `grep "export function useBarcodeScanner"` matches
- [x] `grep "apiFetch(\`api/barcode/"` matches (correct relative-path contract)
- [x] `grep "encodeURIComponent"` matches
- [x] No `error` field on hook return value (D-08 guarantee)
- [x] `grep "initialBarcode"` in ItemDrawer.jsx matches
- [x] `grep "initialNutrition"` in ItemDrawer.jsx matches
- [x] `grep "<NutritionSection"` in ItemDrawer.jsx matches
- [x] `grep "import { useBarcodeScanner }"` in Inventory.jsx matches
- [x] `grep "scanner.scanState === 'matched'"` in Inventory.jsx matches
- [x] `grep "scanner.scanState === 'prefill'"` in Inventory.jsx matches
- [x] `grep "scanner.scanState === 'fallback'"` in Inventory.jsx matches
- [x] All 8 useBarcodeScanner tests pass
- [x] All 22+ ItemDrawer tests pass
- [x] All existing + 4 new Inventory integration tests pass
- [x] Full frontend suite green, full backend suite green
- [x] Real-device UAT approved — all 5 ROADMAP Phase 3 success criteria confirmed
- [x] Commits 6f44d6e, 8548b88, 4d1a855, db55406, e076a98, f8951b1 exist in git log
