---
phase: 02-core-inventory
plan: "04"
subsystem: frontend/inventory-ui
tags: [react, inventory, ui, components, css-modules, responsive, search, filters, quantity-controls]
dependency_graph:
  requires: ["02-02", "02-03"]
  provides: ["inventory-page", "quantity-controls", "item-row", "item-card", "filter-picker", "fab"]
  affects: ["02-05"]
tech_stack:
  added: []
  patterns:
    - CSS Modules with design token variables only (no hardcoded hex)
    - Dual-list CSS-only responsive switch (listView/gridView display:none at 768px breakpoint)
    - Optimistic UI via useItems hook (updateQuantity, cycleStatus)
    - 200ms debounce via useEffect + setTimeout pattern
    - Stub handlers (window.__inventarAddClicked) for Plan 02-05 drawer wiring
key_files:
  created:
    - frontend/src/pages/Inventory.jsx
    - frontend/src/pages/Inventory.module.css
    - frontend/src/pages/Inventory.test.jsx
    - frontend/src/components/QuantityControls/QuantityControls.jsx
    - frontend/src/components/QuantityControls/QuantityControls.module.css
    - frontend/src/components/QuantityControls/QuantityControls.test.jsx
    - frontend/src/components/FAB/FAB.jsx
    - frontend/src/components/FAB/FAB.module.css
    - frontend/src/components/ItemRow/ItemRow.jsx
    - frontend/src/components/ItemRow/ItemRow.module.css
    - frontend/src/components/ItemCard/ItemCard.jsx
    - frontend/src/components/ItemCard/ItemCard.module.css
    - frontend/src/components/FilterPicker/FilterPicker.jsx
    - frontend/src/components/FilterPicker/FilterPicker.module.css
  modified:
    - frontend/src/components/EmptyState/EmptyState.jsx
    - frontend/src/layout/AppLayout.test.jsx
decisions:
  - "CSS-only responsive switch: listView visible on mobile, gridView visible on desktop — no JS resize hook"
  - "FAB and row tap wired to window stub handlers (window.__inventarAddClicked, window.__inventarRowClicked) for Plan 02-05 replacement"
  - "Inventory loading condition: isLoading = any hook loading AND items.length === 0 — prevents flicker on refetch"
  - "Fake timers applied after real fetch resolves in Test 5 to avoid timeout issues with async hook setup"
metrics:
  duration: "~25min"
  completed: "2026-04-16"
  tasks_completed: 3
  files_created: 14
  files_modified: 2
  tests_added: 14
  tests_total: 48
---

# Phase 02 Plan 04: Inventory Page UI Summary

**One-liner:** Full Inventory page with responsive list/grid, QuantityControls (exact +/- and status pill), search/filter chips/picker, FAB, and grouped category sections — all driven by useItems/useCategories/useLocations hooks.

---

## What Was Built

Replaced the StubPage placeholder at `/` with a complete Inventory page that satisfies UAT tests 3, 6, 7, and 8.

### Components Created

**QuantityControls** — dual-variant quantity control component:
- Variant A (exact mode): `−` glyph button · count span (min-width 32px) · `+` button, 36×36px, aria-labeled per item name
- Variant B (status mode): single pill button cycling Have→Low→Out→Have, 72px min-width, status-color backgrounds at 20% opacity via `color-mix()`
- Error shake: `.errored` class applies `@keyframes shake` (300ms translateX pulse) for optimistic rollback feedback
- 8 unit tests, all passing

**FAB** — fixed 56×56px round button, `--color-accent` background, lucide `Plus` icon, `aria-label` prop

**EmptyState (enhanced)** — added optional `onCtaClick` prop wired to CTA button `onClick`; all existing callers unaffected

**ItemRow** — mobile list `<li>` with name/location/attribution on left, QuantityControls on right; `stopPropagation` guard prevents quantity taps from triggering row open

**ItemCard** — desktop grid `<li>` with card layout (name/meta/attribution/controls); same stopPropagation semantics

**FilterPicker** — popover panel (`role="dialog"`) with Categories and Locations sections as FilterChip lists, close button, absolute positioning relative to parent

### Inventory Page Composition

- Fetches items, categories, locations in parallel on mount via three hooks
- Sticky header: page heading, search input (200ms debounce, Escape clears), active filter chips row, Filter chip toggle for FilterPicker
- Client-side filtering: archived exclusion → search substring → category filter → location filter
- Category grouping via `useMemo` — ordered by useCategories list, null category → "Uncategorised" at end
- Responsive rendering: each category section has both `<ul className={listView}>` (flex column, visible mobile) and `<ul className={gridView}>` (CSS grid, visible ≥768px) — CSS `display: none` controls which is shown
- Empty states: no items → EmptyState with CTA; search no-match → `No items match "..."` state; filter no-match → `No items in this view` state; load error → ErrorState
- FAB always rendered, `onClick` calls `handleAddClick` stub; row clicks call `handleRowClick` stub — both replaced in Plan 02-05

### Tests

| File | Tests | Coverage |
|------|-------|----------|
| QuantityControls.test.jsx | 8 | exact mode +/- aria, count display, status pill label/click, null status, errored class |
| Inventory.test.jsx | 6 | loading state, error state, empty CTA click, attribution render, search debounce filter, filter chip dismiss |

Full suite: 48 tests, 0 failed. Vite build: clean.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale AppLayout.test.jsx stub assertion**
- **Found during:** Task 3 full suite run
- **Issue:** `AppLayout.test.jsx` test `'renders the Inventory stub copy at /'` asserted `'Your inventory items will appear here.'` — the StubPage body text that no longer exists after replacing Inventory with the real page
- **Fix:** Updated test to assert on real Inventory page content: `h1` heading "Inventory" and the `Search items` input
- **Files modified:** `frontend/src/layout/AppLayout.test.jsx`
- **Commit:** c0cd877

**2. [Rule 1 - Bug] Fixed Test 5 timeout with fake timers**
- **Found during:** Task 3 test run
- **Issue:** `vi.useFakeTimers()` called before items loaded caused `waitFor` to time out (5s) because React's internal scheduling depends on real timers
- **Fix:** Let real fetch resolve first (waitFor items visible), then switch to fake timers only for the 200ms debounce advance, then restore real timers
- **Files modified:** `frontend/src/pages/Inventory.test.jsx`
- **Commit:** c0cd877

---

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `window.__inventarAddClicked = true` | Inventory.jsx:38 | FAB click handler — Plan 02-05 replaces with drawer open state |
| `window.__inventarRowClicked = item.id` | Inventory.jsx:43 | Row/card tap handler — Plan 02-05 replaces with drawer-open-with-item state |

Both stubs are intentional per plan spec. Plan 02-05 will remove them.

---

## Threat Surface Review

No new trust boundary surfaces beyond what the plan's threat model covers:
- T-02-21: All item/category/location names rendered as JSX string children (auto-escaped). No `dangerouslySetInnerHTML` anywhere (verified: 0 grep matches).
- T-02-22: `stopPropagation` wrappers in place on both ItemRow and ItemCard around QuantityControls.
- T-02-24: `debouncedSearch` interpolated into EmptyState heading via JSX expression (auto-escaped).
- No raw `fetch('/...')` calls in any new component (verified: 0 grep matches).
- No hardcoded hex colors in any new CSS Module (verified: 0 grep matches).

---

## Self-Check

### Files exist:
- `frontend/src/pages/Inventory.jsx` — FOUND
- `frontend/src/pages/Inventory.module.css` — FOUND
- `frontend/src/pages/Inventory.test.jsx` — FOUND
- `frontend/src/components/QuantityControls/QuantityControls.jsx` — FOUND
- `frontend/src/components/FAB/FAB.jsx` — FOUND
- `frontend/src/components/ItemRow/ItemRow.jsx` — FOUND
- `frontend/src/components/ItemCard/ItemCard.jsx` — FOUND
- `frontend/src/components/FilterPicker/FilterPicker.jsx` — FOUND

### Commits:
- b6f07c2: feat(02-04): add QuantityControls, FAB components + enhance EmptyState
- 39f04bf: feat(02-04): add ItemRow, ItemCard, FilterPicker presentational components
- c0cd877: feat(02-04): build Inventory page composition with search, filters, grouped list/grid

## Self-Check: PASSED
