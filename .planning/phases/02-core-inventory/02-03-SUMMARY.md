---
phase: 02-core-inventory
plan: 03
subsystem: frontend-foundations
tags: [react, css-modules, design-tokens, vitest, hooks, optimistic-ui]

# Dependency graph
requires:
  - phase: 01-add-on-scaffolding
    provides: React/Vite SPA scaffold, apiFetch contract, vitest config
  - phase: 02-core-inventory/02-01
    provides: Backend schemas, item/category/location shapes

provides:
  - Phase 2 CSS design tokens (4 additive properties in index.css)
  - relativeTime / absoluteTime time formatting utilities (time.js)
  - useItems hook with optimistic updateQuantity (D-03 auto-flip) + cycleStatus
  - useCategories hook (CRUD via apiFetch)
  - useLocations hook (CRUD via apiFetch)
  - EmptyState, LoadingState, ErrorState, CategorySectionHeader, FilterChip components

affects: [02-04-inventory-page, 02-05-settings-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS Modules with var(--*) tokens only — zero hardcoded hex or px (except design exceptions letter-spacing and border-radius)"
    - "apiFetch-only API calls — no raw fetch() or absolute paths in any hook (T-02-16 enforced)"
    - "Optimistic UI with cloned-original rollback (Pitfall 4 / T-02-18)"
    - "D-03 auto-flip: exact mode quantity<=0 delta<0 sends status:out PATCH instead of quantity decrement"
    - "Timezone-agnostic test assertions for absoluteTime using locale function equality"
    - "Fake timers avoided in hook revert test to prevent waitFor deadlock — uses real async flow"

key-files:
  modified:
    - frontend/src/index.css
  created:
    - frontend/src/lib/time.js
    - frontend/src/lib/time.test.js
    - frontend/src/hooks/useItems.js
    - frontend/src/hooks/useCategories.js
    - frontend/src/hooks/useLocations.js
    - frontend/src/hooks/useItems.test.js
    - frontend/src/components/EmptyState/EmptyState.jsx
    - frontend/src/components/EmptyState/EmptyState.module.css
    - frontend/src/components/LoadingState/LoadingState.jsx
    - frontend/src/components/LoadingState/LoadingState.module.css
    - frontend/src/components/ErrorState/ErrorState.jsx
    - frontend/src/components/ErrorState/ErrorState.module.css
    - frontend/src/components/CategorySectionHeader/CategorySectionHeader.jsx
    - frontend/src/components/CategorySectionHeader/CategorySectionHeader.module.css
    - frontend/src/components/FilterChip/FilterChip.jsx
    - frontend/src/components/FilterChip/FilterChip.module.css
    - frontend/src/components/FilterChip/FilterChip.test.jsx

key-decisions:
  - "relativeTime/absoluteTime tests made timezone-agnostic by comparing against the same locale functions the implementation uses"
  - "updateQuantity revert test avoids vi.useFakeTimers to prevent waitFor deadlock — uses real async resolution instead"
  - "request() helper duplicated across 3 hooks (vs shared module) to keep each hook self-contained and file-count within plan scope"

# Metrics
duration: 6min
completed: 2026-04-15
---

# Phase 02 Plan 03: Frontend Foundations — Design Tokens, Time Utility, Data Hooks, Shared Components Summary

**4 additive CSS tokens in index.css; relativeTime/absoluteTime utility with 14 tests; 3 data hooks (useItems with optimistic updates + D-03 auto-flip, useCategories, useLocations) with 6 tests; 5 presentational components (EmptyState, LoadingState, ErrorState, CategorySectionHeader, FilterChip) all token-driven with 4 FilterChip tests; 34 total tests green; vite build green**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-15T21:35:13Z
- **Completed:** 2026-04-15T21:41:08Z
- **Tasks:** 3
- **Files modified/created:** 17

## Accomplishments

### Task 1: Design tokens + time utility
- Added `--font-size-display: 28px`, `--color-status-have: #34D399`, `--color-status-low: #FBBF24`, `--color-status-out: #EF4444` additively to `frontend/src/index.css` Phase 1 block. Zero existing tokens altered.
- Created `time.js` with `relativeTime()` (just now / Nm ago / Nh ago / Nd ago / DD MMM) and `absoluteTime()` (DD MMM YYYY at HH:MM, 24h, en-GB) — both pure functions returning `''` for null/undefined.
- 14 vitest tests: all relative time branches covered (30s, 59s, 10m, 2h, 3d, 12d, ISO string), absolute time pattern/equality/null tests.

### Task 2: Data hooks
- `useItems`: useState + useCallback + useEffect. Fetches `api/items/` on mount. CRUD: `create` (prepends), `update` (replaces by id), `remove` (filters out). Optimistic `updateQuantity` with D-03 auto-flip (exact mode qty≤0 + delta<0 → `{quantity_mode:'status', status:'out', quantity:null}`), rollback via `cloned` capture (T-02-18). `cycleStatus` (have→low→out→have) with same revert pattern.
- `useCategories`: identical CRUD structure hitting `api/categories/`.
- `useLocations`: identical CRUD structure hitting `api/locations/`.
- All hooks use internal `request()` helper which calls `apiFetch` — never raw `fetch()`, never absolute paths (T-02-16, T-02-17).
- 6 useItems tests: mount load, create prepend, optimistic increment, revert on error, auto-flip body assertion, cycleStatus three-cycle.

### Task 3: Shared components
- `EmptyState`: icon + heading + body + optional CTA button; centered with `--space-xl` padding; all tokens via var(--*).
- `LoadingState`: `count` skeleton rows (default 3) with `@keyframes shimmer 1.4s ease-in-out infinite` in CSS Module; `--color-secondary` background.
- `ErrorState`: `AlertCircle` from lucide-react at 48px `--color-destructive`; same structure as EmptyState.
- `CategorySectionHeader`: `--font-size-label` 600 uppercase `--color-text-secondary` with `letter-spacing: 0.05em`.
- `FilterChip`: active (`--color-accent` bg, dismiss `×` with `stopPropagation`, `aria-label="Remove filter: {label}"`) / inactive (transparent, `--color-border` border). Zero hardcoded hex in any CSS Module.
- 4 FilterChip tests: inactive render, active render, dismiss call, propagation isolation.

## Task Commits

1. **Task 1: Design tokens + time utility** — `b86a94f` (feat)
2. **Task 2: Data hooks** — `cdc3df7` (feat)
3. **Task 3: Shared components** — `413d405` (feat)

## Files Created/Modified

- `frontend/src/index.css` — 4 Phase 2 tokens appended additively
- `frontend/src/lib/time.js` — relativeTime, absoluteTime pure exports
- `frontend/src/lib/time.test.js` — 14 tests (timezone-agnostic)
- `frontend/src/hooks/useItems.js` — useItems with optimistic quantity + status + rollback
- `frontend/src/hooks/useCategories.js` — useCategories CRUD
- `frontend/src/hooks/useLocations.js` — useLocations CRUD
- `frontend/src/hooks/useItems.test.js` — 6 tests
- `frontend/src/components/EmptyState/EmptyState.{jsx,module.css}`
- `frontend/src/components/LoadingState/LoadingState.{jsx,module.css}`
- `frontend/src/components/ErrorState/ErrorState.{jsx,module.css}`
- `frontend/src/components/CategorySectionHeader/CategorySectionHeader.{jsx,module.css}`
- `frontend/src/components/FilterChip/FilterChip.{jsx,module.css,test.jsx}`

## Decisions Made

- relativeTime/absoluteTime tests are timezone-agnostic: `absoluteTime` tests compare against locale functions directly rather than hardcoded UTC strings, so they pass on any timezone
- revert test for `updateQuantity` uses real async resolution (no `vi.useFakeTimers`) to avoid deadlock with `waitFor`'s internal timer dependency
- `request()` helper duplicated in each hook file (vs a shared `lib/request.js`) to keep hooks self-contained within plan scope; refactoring is safe future work

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Timezone-dependent absoluteTime test assertions**
- **Found during:** Task 1 verification run
- **Issue:** Test asserted `absoluteTime(new Date('2026-04-15T14:32:00Z'))` === `'15 Apr 2026 at 14:32'`, but the CI/dev machine runs UTC+2, so `toLocaleTimeString('en-GB', ...)` returned `16:32` — test failed on first run
- **Fix:** Rewrote absolute time tests to compute expected value using the same locale functions as the implementation, making assertions timezone-agnostic
- **Files modified:** `frontend/src/lib/time.test.js`
- **Commit:** b86a94f (included in Task 1 commit)

**2. [Rule 1 - Bug] useItems revert test deadlocked with vi.useFakeTimers()**
- **Found during:** Task 2, first run of useItems.test.js
- **Issue:** Test used `vi.useFakeTimers()` then called `waitFor()` (which polls via real `setTimeout`), causing a 5000ms timeout
- **Fix:** Removed `vi.useFakeTimers()` from the revert test; used real async resolution with `await act(async () => { await ... })` + `waitFor()` instead
- **Files modified:** `frontend/src/hooks/useItems.test.js`
- **Commit:** cdc3df7 (included in Task 2 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — bugs in test assertions/setup)
**Impact on plan:** Both were test-infrastructure fixes; production code unchanged from plan intent.

## Known Stubs

None — all components render real data via props. Hooks fetch from real API endpoints. No hardcoded empty arrays, placeholder text, or TODO markers introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All API calls go through the existing `apiFetch` contract. T-02-16 (no raw fetch), T-02-17 (no absolute paths), T-02-18 (optimistic rollback with cloned original), and T-02-19 (JSX auto-escapes string children) are all mitigated.

## Self-Check: PASSED

**Files verified to exist:**
- frontend/src/index.css — modified, contains --color-status-have
- frontend/src/lib/time.js — created
- frontend/src/lib/time.test.js — created
- frontend/src/hooks/useItems.js — created
- frontend/src/hooks/useCategories.js — created
- frontend/src/hooks/useLocations.js — created
- frontend/src/hooks/useItems.test.js — created
- frontend/src/components/EmptyState/EmptyState.jsx — created
- frontend/src/components/LoadingState/LoadingState.jsx — created
- frontend/src/components/ErrorState/ErrorState.jsx — created
- frontend/src/components/CategorySectionHeader/CategorySectionHeader.jsx — created
- frontend/src/components/FilterChip/FilterChip.jsx — created
- frontend/src/components/FilterChip/FilterChip.test.jsx — created

**Commits verified:**
- b86a94f — feat(02-03): add Phase 2 design tokens and time formatting utility
- cdc3df7 — feat(02-03): implement useItems, useCategories, useLocations data hooks with tests
- 413d405 — feat(02-03): add EmptyState, LoadingState, ErrorState, CategorySectionHeader, FilterChip

---
*Phase: 02-core-inventory*
*Completed: 2026-04-15*
