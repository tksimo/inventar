---
phase: 02-core-inventory
plan: "08"
subsystem: frontend
tags: [uat-gap-fix, integer-quantity, access-banner, ui, tdd]
dependency_graph:
  requires: [02-07]
  provides: [integer-quantity-ui, access-banner]
  affects: [frontend/src/components/ItemDrawer/ItemDrawer.jsx, frontend/src/layout/AppLayout.jsx]
tech_stack:
  added: []
  patterns:
    - TDD red-green for all new behaviour
    - sessionStorage for tab-scoped dismiss (not localStorage — intentionally resets each session)
    - Fail-open error handling in hooks (viaIngress=true on error suppresses banner)
key_files:
  created:
    - frontend/src/hooks/useAccessInfo.js
    - frontend/src/hooks/useAccessInfo.test.js
    - frontend/src/components/AccessBanner/AccessBanner.jsx
    - frontend/src/components/AccessBanner/AccessBanner.module.css
    - frontend/src/components/AccessBanner/AccessBanner.test.jsx
  modified:
    - frontend/src/components/ItemDrawer/ItemDrawer.jsx
    - frontend/src/components/ItemDrawer/ItemDrawer.test.jsx
    - frontend/src/components/QuantityControls/QuantityControls.test.jsx
    - frontend/src/layout/AppLayout.jsx
    - frontend/src/layout/AppLayout.test.jsx
decisions:
  - "parseInt(,10) + Number.isFinite guard replaces Number() in onChange — truncates toward zero, consistent with Pydantic Optional[int] server contract"
  - "AccessBanner uses sessionStorage (not localStorage) so misconfiguration warning reappears each browser session until the user fixes their entry point"
  - "Fail-open on useAccessInfo error: viaIngress defaults to true so a transient API failure never spuriously shows the warning"
  - "AccessBanner renders above <main> but outside <aside> in AppLayout — purely additive, does not affect sidebar or main content scroll"
  - "AppLayout tests mock useAccessInfo via vi.mock to keep existing tests deterministic; T10 uses vi.mocked().mockReturnValue to override for the banner-visible case"
metrics:
  duration: ~4min
  completed: "2026-04-16"
  tasks_completed: 2
  files_changed: 10
---

# Phase 02 Plan 08: UAT Gap UI Fixes — Integer Inputs & Access Banner Summary

**One-liner:** Integer-only quantity inputs (step=1, parseInt) in ItemDrawer closing UAT Gap 1 at the UI layer, plus a dismissible amber access banner (useAccessInfo + AccessBanner + AppLayout) closing UAT Gap 2's knowledge gap.

---

## What Was Built

### Task 1: Integer-only Quantity Inputs in ItemDrawer

Closed UAT Gap 1 at the UI layer (the "2.0" visible in the edit drawer):

**Before:**
```jsx
<input type="number" step="0.1" min="0"
  onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value === '' ? null : Number(e.target.value) }))}
/>
```

**After:**
```jsx
<input type="number" step="1" min="0" inputMode="numeric" pattern="[0-9]*"
  onChange={(e) => {
    if (e.target.value === '') { setForm(f => ({ ...f, quantity: null })) }
    else { const v = parseInt(e.target.value, 10); setForm(f => ({ ...f, quantity: Number.isFinite(v) ? v : null })) }
  }}
/>
```

Both the **quantity** and **reorder threshold** inputs received the same change. Key differences:
- `step="1"` — browser renders integer spinner, no decimal point shown for whole-number values
- `parseInt(,10)` — truncates toward zero (not `Number()` which passes floats through)
- `Number.isFinite(v)` guard — handles paste of non-numeric text gracefully (coerces to null rather than NaN)
- `inputMode="numeric"` + `pattern="[0-9]*"` — integer keypad on mobile (no functional gating; server is authoritative)

`QuantityControls.formatCount` is **unchanged** — it remains defensive for any pre-migration cached state.

### Task 2: useAccessInfo Hook + AccessBanner Component + AppLayout Integration

Closed UAT Gap 2 by explaining to users why attribution is missing when they bypass HA ingress.

**`frontend/src/hooks/useAccessInfo.js`** — new hook:
- Calls `GET api/access-info` once on mount via `apiFetch`
- Returns `{ viaIngress: boolean|null, userName: string|null, loading: boolean, error: string|null }`
- Fail-open: on any network/HTTP error, sets `viaIngress: true` and records `error` message — banner is suppressed so a transient failure never nags the user

**`frontend/src/components/AccessBanner/AccessBanner.jsx`** — new component:
- Renders `null` when: `loading=true` (prevents flash), `viaIngress=true`, or `sessionStorage.getItem('inventar_access_banner_dismissed') === '1'`
- When visible: amber `<div role="status">` with message "Open Inventar from Home Assistant (Sidebar → Inventar) to enable user attribution." and an X button (aria-label="Dismiss banner")
- Dismiss writes `sessionStorage.setItem('inventar_access_banner_dismissed', '1')` and sets local dismissed state — banner hides immediately and stays hidden for the rest of the tab session
- sessionStorage (not localStorage) — reappears on new browser session so misconfiguration is surfaced again if still unresolved

**AppLayout DOM change:**
```jsx
// Before
<aside>...</aside>
<main>{children}</main>

// After
<aside>...</aside>
<AccessBanner />           {/* renders above main, below sidebar */}
<main>{children}</main>
```

`AccessBanner` renders between `<aside>` and `<main>` in the shell flex container. It is purely additive — when `viaIngress=true` (the normal ingress path) it returns `null` and the layout is unchanged.

---

## Test Coverage

| File | Tests Added | Coverage |
|------|-------------|----------|
| `ItemDrawer.test.jsx` | T1-T6 (integer input behaviour) | step attr, parseInt, null on clear, integer type on save |
| `QuantityControls.test.jsx` | T7-T9 (formatCount regression) | formatCount(2), formatCount(0), formatCount(null) |
| `useAccessInfo.test.js` | T1-T4 (all hook states) | loading, success true/false, error fail-open |
| `AccessBanner.test.jsx` | T5-T9 (all render conditions) | suppress conditions, render, dismiss |
| `AppLayout.test.jsx` | T10 (banner above main), mock wiring | DOM order, existing tests unaffected |

**Full frontend suite: 101 tests, 0 failures.**

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all data flows are wired end-to-end:
- `useAccessInfo` calls the live `GET /api/access-info` endpoint (implemented in Plan 07)
- `AccessBanner` uses `useAccessInfo` directly (no prop-drilling stub)
- `AppLayout` imports `AccessBanner` directly

---

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-02G-05 through T-02G-07). The `AccessBanner` text reveals architectural detail (ingress vs direct port) which is accepted per T-02G-06.

---

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 5072d4b | feat(02-08): integer-only quantity and reorder-threshold inputs in ItemDrawer |
| Task 2 | b4dc2a2 | feat(02-08): useAccessInfo hook + AccessBanner component + AppLayout integration |

---

## Self-Check: PASSED

All created files confirmed present:
- frontend/src/hooks/useAccessInfo.js — FOUND
- frontend/src/hooks/useAccessInfo.test.js — FOUND
- frontend/src/components/AccessBanner/AccessBanner.jsx — FOUND
- frontend/src/components/AccessBanner/AccessBanner.module.css — FOUND
- frontend/src/components/AccessBanner/AccessBanner.test.jsx — FOUND

Both commits verified in git history (5072d4b, b4dc2a2).
Full test suite: 101 passed, 0 failed.
Build: succeeded with no warnings.
