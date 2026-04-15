---
phase: 01-add-on-scaffolding
plan: "03"
subsystem: frontend
tags: [react, vite, react-router, vitest, home-assistant, ingress, ui, design-tokens]

requires:
  - phase: 01-01
    provides: "config.yaml panel_icon value informs favicon theme; Dockerfile COPYs frontend/dist/"
  - phase: 01-02
    provides: "backend/main.py SPA mount stub ready; apiFetch targets /healthz endpoint"

provides:
  - Vite + React 19 SPA package with exact pinned dependencies (no caret ranges)
  - vite.config.js with base: './' (critical for HA ingress asset resolution)
  - All 01-UI-SPEC design tokens as CSS custom properties on :root in index.css
  - apiFetch(path, init) helper that prepends './' and rejects absolute paths with TypeError
  - AppLayout: fixed sidebar (220px) + main content shell matching UI-SPEC Component Inventory
  - Three stub routes: Inventory (/), Shopping List (/shopping), Settings (/settings)
  - Wildcard route (* -> Navigate to /) per UI-SPEC Interaction Contract
  - vitest suite: 10 tests (4 apiFetch + 6 AppLayout) all passing
  - npm run build produces frontend/dist/index.html + assets with all-relative ./assets/ paths

affects:
  - 01-04 (integration wiring — frontend/dist/ exists and is buildable; Plan 04 wires FastAPI StaticFiles)
  - Phase 2+ (apiFetch is the contract for all API calls from the SPA; AppLayout is the real nav shell)

tech-stack:
  added:
    - react 19.2.5 (pinned, no caret)
    - react-dom 19.2.5
    - react-router-dom 7.14.1
    - lucide-react 0.511.0 (House, ShoppingCart, Settings icons)
    - vite 8.0.8
    - "@vitejs/plugin-react 6.0.1 (Oxc-based, no Babel)"
    - vitest 3.2.4
    - "@testing-library/react 16.3.0"
    - "@testing-library/jest-dom 6.6.4"
    - jsdom 26.1.0
  patterns:
    - apiFetch prepends './' to all paths — never pass absolute paths from Phase 2+ code
    - CSS Module files reference only CSS custom properties (no hardcoded hex/px except 3px border)
    - BrowserRouter in App.jsx (not MemoryRouter) — vitest tests render App directly, not wrapped
    - vitest.config.js sets esbuild.jsx='automatic' to work around vitest internal vite 7 vs plugin-react 6

key-files:
  created:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/vite.config.js
    - frontend/vitest.config.js
    - frontend/index.html
    - frontend/.gitignore
    - frontend/public/favicon.svg
    - frontend/src/main.jsx
    - frontend/src/index.css
    - frontend/src/App.jsx
    - frontend/src/lib/api.js
    - frontend/src/lib/api.test.js
    - frontend/src/test/setup.js
    - frontend/src/layout/AppLayout.jsx
    - frontend/src/layout/AppLayout.module.css
    - frontend/src/layout/NavItem.jsx
    - frontend/src/layout/NavItem.module.css
    - frontend/src/layout/AppLayout.test.jsx
    - frontend/src/pages/StubPage.jsx
    - frontend/src/pages/StubPage.module.css
    - frontend/src/pages/Inventory.jsx
    - frontend/src/pages/ShoppingList.jsx
    - frontend/src/pages/Settings.jsx
  modified: []

key-decisions:
  - "vitest.config.js esbuild.jsx='automatic' added — vitest 3.2.4 bundles vite 7.3.2 internally which conflicts with @vitejs/plugin-react 6 (requires vite 8); esbuild option bypasses the plugin version gap"
  - "AppLayout.test.jsx renders App directly (no MemoryRouter wrapper) — react-router 7 throws on nested routers; jsdom default URL is '/' so BrowserRouter matches Inventory route without wrapping"
  - "dist/ stays in .gitignore — built at container time per Dockerfile COPY frontend/dist/ pattern from Plan 01-01"

patterns-established:
  - "Pattern: apiFetch contract — all Phase 2+ API calls use apiFetch(path) never fetch('/path')"
  - "Pattern: CSS vars only in component CSS Modules — no hardcoded hex or px values (except 3px active border per UI-SPEC)"
  - "Pattern: TDD for frontend — write test (RED), implement (GREEN), verify build"

requirements-completed: [INFRA-02, INFRA-04]

duration: 6min
completed: 2026-04-15
---

# Phase 01 Plan 03: React/Vite Frontend SPA Summary

**React 19 + Vite 8 SPA with BrowserRouter nav shell (Inventory/Shopping List/Settings), all-relative ./assets/ build output for HA ingress, apiFetch helper rejecting absolute paths, and 10-test vitest suite — all passing.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-15T11:32:16Z
- **Completed:** 2026-04-15T11:38:19Z
- **Tasks:** 2 completed
- **Files modified:** 23 created

## Accomplishments

- Created complete Vite + React 19 frontend package with all dependencies pinned at exact versions (no `^` ranges)
- Established `vite.config.js` with `base: './'` — all build outputs use `./assets/...` relative paths (verified by automated grep on dist/index.html)
- Defined all 01-UI-SPEC design tokens as CSS custom properties in `index.css` — 7 colors, 7 spacing, 9 typography, 2 layout tokens
- Implemented `apiFetch` helper that prepends `./` to all paths and throws `TypeError` for absolute paths — T-01-14 mitigation
- Built production-quality AppLayout with fixed 220px sidebar, brand name, nav with `aria-label="Main navigation"`, three NavLink items, and responsive mobile collapse (labels hidden via CSS, remain in DOM)
- Created three stub routes with exact UI-SPEC Copywriting Contract text
- `npm run build` produces `frontend/dist/index.html` + `frontend/dist/assets/` with no absolute path references

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Vite+React package, design tokens, vite.config with base='./', and apiFetch helper** - `4e0f75c` (feat)
2. **Task 2: Implement AppLayout nav shell, three stub routes, wire BrowserRouter, and build to dist** - `7208b10` (feat)

## Files Created/Modified

- `frontend/package.json` - Pinned deps: react 19.2.5, vite 8.0.8, react-router-dom 7.14.1, lucide-react 0.511.0
- `frontend/vite.config.js` - `base: './'`, sourcemap: false (T-01-16), outDir: dist
- `frontend/vitest.config.js` - jsdom environment, globals, esbuild.jsx='automatic' (deviation fix)
- `frontend/index.html` - relative href/src references only (./favicon.svg, ./src/main.jsx)
- `frontend/src/index.css` - All UI-SPEC tokens as :root CSS custom properties
- `frontend/src/lib/api.js` - apiFetch: prepends './', rejects '/' paths with TypeError
- `frontend/src/lib/api.test.js` - 4 tests: prepend, init forward, absolute rejection, type guard
- `frontend/src/App.jsx` - BrowserRouter + AppLayout + 4 Routes (/, /shopping, /settings, *)
- `frontend/src/layout/AppLayout.jsx` - Sidebar with brand + nav, main content area
- `frontend/src/layout/NavItem.jsx` - NavLink with isActive CSS toggle and aria-hidden icon
- `frontend/src/layout/AppLayout.test.jsx` - 6 tests: brand, nav role, 3 links, children, aria-current, stub copy
- `frontend/src/pages/StubPage.jsx` - Heading + body with exact UI-SPEC copy
- `frontend/src/pages/Inventory/ShoppingList/Settings.jsx` - Stub route components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest JSX transform fails with @vitejs/plugin-react 6 due to internal vite version mismatch**
- **Found during:** Task 2 (running vitest)
- **Issue:** vitest 3.2.4 ships its own internal vite 7.3.2; `@vitejs/plugin-react` v6 requires vite 8. The plugin's JSX auto-transform did not apply through vitest's vite 7 bundler, causing "React is not defined" errors in all JSX test files
- **Fix:** Added `esbuild: { jsx: 'automatic' }` to `vitest.config.js` — this uses esbuild's own JSX transform (independent of the plugin version) for test file processing
- **Files modified:** `frontend/vitest.config.js`
- **Verification:** All 10 tests pass: `vitest run` exits 0
- **Committed in:** 7208b10

**2. [Rule 1 - Bug] Nested Router error in AppLayout.test.jsx `at / the Inventory nav link has aria-current="page"` test**
- **Found during:** Task 2 (running vitest after implementing App.jsx)
- **Issue:** The plan's test file wraps `<App />` (which contains `BrowserRouter`) in `<MemoryRouter initialEntries={['/']}>`; react-router 7 throws "You cannot render a Router inside another Router"
- **Fix:** Changed test to render `<App />` directly — jsdom's default URL is `/` so `BrowserRouter` matches the Inventory route, satisfying the `aria-current="page"` assertion without a wrapper
- **Files modified:** `frontend/src/layout/AppLayout.test.jsx`
- **Verification:** All 6 AppLayout tests pass
- **Committed in:** 7208b10

---

**Total deviations:** 2 (both are behavioral bugs — the plan's specified test/config patterns didn't work with the specified pinned versions due to the vitest internal vite version mismatch)
**Impact on plan:** Negligible. All acceptance criteria met. 10/10 tests pass. Build output is identical to spec.

## Known Stubs

The three page components (Inventory, ShoppingList, Settings) are intentional stubs — they render a heading and placeholder copy only. This is exactly per the plan's design: they are the real Phase 1 navigation shell that Phase 2 adds feature content to. The placeholder text follows the UI-SPEC Copywriting Contract exactly.

No data-wiring stubs exist (no empty arrays flowing to UI, no placeholder data). The SPA makes no API calls in Phase 1.

## Threat Flags

None. All mitigations from the plan's threat model were addressed:
- T-01-14: apiFetch rejects paths starting with '/' with TypeError; test `throws a TypeError if path starts with '/'` is the regression guard
- T-01-15: Automated grep in verify step asserts dist/index.html has no absolute `/assets` paths — passed
- T-01-16: `build.sourcemap: false` in vite.config.js — no sourcemaps in production bundle
- T-01-17: All deps in package.json use exact pins (no `^` / `~`)
- T-01-18: index.html references only local relative paths (./favicon.svg, ./src/main.jsx) — no external CDNs
- T-01-19: Accepted — StubPage body is React string child, auto-escaped; no user input in Phase 1
- T-01-20: Accepted — favicon SVG is static, no data embedded

## Self-Check: PASSED

- frontend/package.json: FOUND
- frontend/vite.config.js: FOUND (contains `base: './'`)
- frontend/vitest.config.js: FOUND
- frontend/index.html: FOUND (contains `./favicon.svg`, `./src/main.jsx`)
- frontend/public/favicon.svg: FOUND (contains `#3B82F6`)
- frontend/src/index.css: FOUND (contains all 7 color tokens)
- frontend/src/lib/api.js: FOUND (exports apiFetch, contains `./\${path}`)
- frontend/src/lib/api.test.js: FOUND
- frontend/src/App.jsx: FOUND (contains BrowserRouter)
- frontend/src/layout/AppLayout.jsx: FOUND (contains `aria-label="Main navigation"`)
- frontend/src/layout/NavItem.jsx: FOUND (contains NavLink)
- frontend/src/layout/AppLayout.test.jsx: FOUND
- frontend/src/pages/Inventory.jsx: FOUND
- frontend/src/pages/ShoppingList.jsx: FOUND
- frontend/src/pages/Settings.jsx: FOUND
- frontend/dist/index.html: FOUND (built, not committed — in .gitignore per standard practice)
- frontend/dist/assets/: FOUND (non-empty, 2 files)
- Commit 4e0f75c: FOUND
- Commit 7208b10: FOUND
- vitest: 10 passed

---
*Phase: 01-add-on-scaffolding*
*Completed: 2026-04-15*
