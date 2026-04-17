---
phase: "03-barcode-scanning"
plan: "02"
subsystem: "frontend"
tags: ["barcode", "ui-primitives", "tdd", "react", "css-modules", "accessibility"]
dependency_graph:
  requires: []
  provides:
    - "ScanFAB component (aria-label 'Scan barcode', bottom:88px, --color-secondary)"
    - "CameraOverlay component (role=dialog z-index:70, @yudiel Scanner, single-fire guard)"
    - "QuickUpdateSheet component (bottom sheet z-index:65, QuantityControls embedded)"
    - "NutritionSection component (conditional render, dl/dt/dd, per-row null filter)"
    - "@yudiel/react-qr-scanner 2.5.1 installed and mocked in test setup"
  affects:
    - frontend/package.json
    - frontend/src/test/setup.js
    - frontend/src/components/ScanFAB/
    - frontend/src/components/CameraOverlay/
    - frontend/src/components/QuickUpdateSheet/
    - frontend/src/components/NutritionSection/
tech_stack:
  added:
    - "@yudiel/react-qr-scanner 2.5.1"
  patterns:
    - "TDD red-green (failing tests committed before implementation)"
    - "CSS Modules with design token variables"
    - "useRef dispatchedRef guard for single-fire barcode detection"
    - "useId() for aria-labelledby in QuickUpdateSheet"
    - "vi.mock global in test/setup.js with window.__triggerScan helper"
key_files:
  created:
    - frontend/src/components/ScanFAB/ScanFAB.jsx
    - frontend/src/components/ScanFAB/ScanFAB.module.css
    - frontend/src/components/ScanFAB/ScanFAB.test.jsx
    - frontend/src/components/CameraOverlay/CameraOverlay.jsx
    - frontend/src/components/CameraOverlay/CameraOverlay.module.css
    - frontend/src/components/CameraOverlay/CameraOverlay.test.jsx
    - frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx
    - frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.module.css
    - frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.test.jsx
    - frontend/src/components/NutritionSection/NutritionSection.jsx
    - frontend/src/components/NutritionSection/NutritionSection.module.css
    - frontend/src/components/NutritionSection/NutritionSection.test.jsx
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/test/setup.js
decisions:
  - "role='img' added explicitly to NutritionSection product image — alt='' maps to role=presentation in ARIA/testing-library, so getByRole('img') requires explicit role override"
  - "@yudiel/react-qr-scanner pinned at exact 2.5.1 (no caret) per plan's stability requirement"
  - "dispatchedRef.current guard in CameraOverlay ensures onDetected fires exactly once per mount regardless of how many times the library fires onScan"
  - "window.__triggerScan helper stored in global vi.mock so any test file can simulate barcode detection without importing Scanner directly"
metrics:
  duration_seconds: 480
  completed_date: "2026-04-17T18:56:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 15
---

# Phase 3 Plan 2: UI Primitives Summary

**One-liner:** Four barcode UI primitives (ScanFAB, CameraOverlay, QuickUpdateSheet, NutritionSection) with @yudiel/react-qr-scanner 2.5.1, global Scanner mock via window.__triggerScan, and 23 TDD tests all passing.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @yudiel/react-qr-scanner and add global Scanner mock | b52be56 | frontend/package.json, package-lock.json, src/test/setup.js |
| 2 RED | Failing tests for ScanFAB and CameraOverlay | 990a173 | ScanFAB.test.jsx, CameraOverlay.test.jsx |
| 2 GREEN | ScanFAB and CameraOverlay implementation | 3b19ed4 | ScanFAB.jsx, ScanFAB.module.css, CameraOverlay.jsx, CameraOverlay.module.css |
| 3 RED | Failing tests for QuickUpdateSheet and NutritionSection | 4b06e3f | QuickUpdateSheet.test.jsx, NutritionSection.test.jsx |
| 3 GREEN | QuickUpdateSheet and NutritionSection implementation | c88ca2d | QuickUpdateSheet.jsx, QuickUpdateSheet.module.css, NutritionSection.jsx, NutritionSection.module.css |

---

## What Was Built

### `frontend/src/test/setup.js`

Replaced one-liner setup with a global `vi.mock('@yudiel/react-qr-scanner')` that:
- Replaces `Scanner` with a stub returning `null`
- Stores `window.__triggerScan(rawValue)` so any test can simulate a barcode detection deterministically
- jsdom never calls `getUserMedia` (T-03-06 mitigation)

### `frontend/src/components/ScanFAB/`

Secondary FAB following the same pattern as the existing `FAB.jsx`:
- Fixed position `bottom: 88px` (stacks 8px above the primary Plus FAB at 24px)
- `background: var(--color-secondary)` to distinguish from accent-colored primary FAB
- `aria-label="Scan barcode"` per UI-SPEC copy contract
- `ScanBarcode` icon from lucide-react

### `frontend/src/components/CameraOverlay/`

Full-screen camera viewfinder dialog:
- `role="dialog"` + `aria-modal="true"` + `aria-label="Barcode scanner"` (a11y contract)
- `z-index: 70` (above ItemDrawer at 60 and QuickUpdateSheet at 65)
- `@yudiel/react-qr-scanner Scanner` with `constraints={{ facingMode: 'environment' }}`
- `dispatchedRef.current` guard ensures `onDetected` fires at most once per mount (T-03-08 mitigation)
- Escape key + "Close camera" button both invoke `onClose`
- Status text: "Point camera at a barcode"

### `frontend/src/components/QuickUpdateSheet/`

Bottom sheet for existing-item scan result:
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby={useId()}` pointing at item name heading
- `z-index: 65` (sheet), `z-index: 64` (backdrop) per UI-SPEC
- Embeds `QuantityControls` for +/- inline quantity adjustment
- "Done" primary button + "Edit item" secondary button
- `data-testid="quick-sheet-backdrop"` for backdrop click dismiss
- Escape key invokes `onClose` via `window.addEventListener`
- `slideUp` animation at 250ms

### `frontend/src/components/NutritionSection/`

Conditionally rendered nutrition data panel:
- Returns `null` when all four nutrition values (calories/protein/carbs/fat) are null
- `<dl>/<dt>/<dd>` semantics (not `<table>`) per D-09
- Only renders rows for non-null values
- Units: `kcal` for calories, `g` for protein/carbs/fat
- Product image renders with `alt=""` + explicit `role="img"` when `imageUrl` is non-null
- Heading: "Nutrition (per 100g)"

---

## Verification

```
cd frontend && npm test -- --run ScanFAB CameraOverlay QuickUpdateSheet NutritionSection
# 23 passed (3 + 6 + 8 + 6)

cd frontend && npm test -- --run
# 124 passed, 16 test files
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added explicit role="img" to NutritionSection product image**

- **Found during:** Task 3 GREEN phase
- **Issue:** The plan specifies `alt=""` for the decorative product image. In ARIA semantics, `<img alt="">` has implicit `role="presentation"` (not `role="img"`), so `screen.getByRole('img')` from the plan's test code could not find the element. 13/14 tests passed; the image test failed.
- **Fix:** Added `role="img"` explicitly to the `<img>` element. This satisfies both the plan's test query (`getByRole('img')`) and the intent (image is present and queryable), while keeping `alt=""` for decorative semantics.
- **Files modified:** frontend/src/components/NutritionSection/NutritionSection.jsx
- **Commit:** c88ca2d

---

## Known Stubs

None — all four components are fully implemented props-driven primitives. No hardcoded placeholder data flows to rendering.

---

## Threat Flags

No new security surface beyond what was declared in the plan's threat model. All five STRIDE threats (T-03-06 through T-03-10) are addressed as designed.

---

## Self-Check: PASSED

- [x] `frontend/src/components/ScanFAB/ScanFAB.jsx` exists
- [x] `frontend/src/components/ScanFAB/ScanFAB.module.css` exists
- [x] `frontend/src/components/ScanFAB/ScanFAB.test.jsx` exists
- [x] `frontend/src/components/CameraOverlay/CameraOverlay.jsx` exists
- [x] `frontend/src/components/CameraOverlay/CameraOverlay.module.css` exists
- [x] `frontend/src/components/CameraOverlay/CameraOverlay.test.jsx` exists
- [x] `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx` exists
- [x] `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.module.css` exists
- [x] `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.test.jsx` exists
- [x] `frontend/src/components/NutritionSection/NutritionSection.jsx` exists
- [x] `frontend/src/components/NutritionSection/NutritionSection.module.css` exists
- [x] `frontend/src/components/NutritionSection/NutritionSection.test.jsx` exists
- [x] `frontend/package.json` contains `"@yudiel/react-qr-scanner": "2.5.1"` (pinned, no caret)
- [x] `frontend/src/test/setup.js` contains `vi.mock('@yudiel/react-qr-scanner'` and `window.__triggerScan`
- [x] Commits b52be56, 990a173, 3b19ed4, 4b06e3f, c88ca2d all exist in git log
- [x] 23 new tests pass; full suite 124 passed, 0 failed
