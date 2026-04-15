# Phase 2 Context: Core Inventory

**Phase:** 02 — Core Inventory
**Discussed:** 2026-04-15
**Status:** Complete — ready for research and planning

---

## Domain Boundary

Full item CRUD with categories, locations, quantity tracking, and HA user attribution. Every household member can add, edit, delete, and quick-update items from the inventory list. No barcode scanning (Phase 3), no shopping list management (Phase 4).

---

## Decisions

### D-01: Inventory List Layout — Responsive grouped list / card grid

- **Mobile (< 768px):** Items grouped by category with a section header per group. Dense list rows showing name + location + quantity status. Optimized for "standing in a room, scanning what's there."
- **Desktop (≥ 768px):** Automatic switch to a card grid (2–3 columns), still grouped by category. No user toggle — purely responsive.
- **Breakpoint:** ~768px (standard md breakpoint).

### D-02: Add/Edit Flow — Slide-in drawer

- Adding a new item and editing an existing item both open a **slide-in drawer from the right**.
- The inventory list remains visible behind the drawer.
- Single drawer component handles both add and edit (controlled by whether an item ID is passed).
- No full-page form routes, no modal dialogs.

### D-03: Quick Quantity Controls — Always visible, auto-flip, 3-state toggle

- **Exact-count items:** +/− buttons always visible on the row/card. No tap-to-reveal.
- **At zero:** Hitting − at 0 automatically flips the item to "Out" status (bridges QTY-01 and QTY-02 naturally). No confirmation prompt. − button is not disabled at 0.
- **Status-mode items (have/low/out):** Replace +/− with a **3-state tap-cycle toggle** (Have → Low → Out → Have). One tap cycles to next state. Consistent with QTY-04 "single tap without opening the form" requirement.

### D-04: Categories and Locations Management — Settings screen only

- Custom category create/rename/delete lives in `/settings` only (ORG-02, ORG-04).
- Custom location create/rename/delete lives in `/settings` only.
- No inline "create new" in the item drawer — user goes to Settings first, then returns to add the item.
- Default categories ship pre-loaded: Food & pantry, Fridge & freezer, Cleaning & household, Personal care (ORG-01).

### D-05: Filtering and Search — Search header + filter chips

- **Search input** always visible in the inventory page header. Filters items by name in real time.
- **Active filters** display as dismissible chips below the search input (e.g. `× Food & pantry`, `× Kitchen top shelf`).
- Category and location filters are applied by tapping chips from a dropdown/picker, not inline dropdowns in a filter bar.
- No collapsed/expandable filter bar — zero interaction to access search, chips show active state clearly.
- Chips are independent — category and location filters can be combined.

### D-06: User Attribution — Subtle row text + drawer detail

- **Inventory list row/card:** Small secondary text below the item name: "Updated by [HA username] · [relative time]" (e.g. "Updated by Tobias · 2h ago"). Uses `--color-text-secondary` and `--font-size-label`.
- **Edit drawer:** Full attribution at the bottom: "Last modified by [HA username] on [absolute date/time]".
- Source: `X-Ingress-Remote-User-Name` header (already read by `IngressUserMiddleware` from Phase 1).
- No dedicated activity log in Phase 2.

---

## Carried-Forward Constraints (from Phase 1)

- `apiFetch(path)` is the **only** correct way to call the backend — never `fetch('/path')`. Paths must be relative (no leading `/`).
- CSS Modules for all component styles — no inline styles, no Tailwind.
- Design tokens from `frontend/src/index.css` — use `--color-*`, `--space-*`, `--font-*` custom properties. Do not hardcode colors or spacing.
- All 5 DB tables already exist (`items`, `categories`, `locations`, `transactions`, `shopping_list`) — Phase 2 adds rows, not schema changes (Alembic migration only if column additions are needed).
- `INVENTAR_DB_URL` env var controls DB path in tests — conftest.py sets it before any import.
- `INVENTAR_SKIP_SPA=1` in unit tests — never remove this from conftest.

---

## Canonical Refs

- `.planning/REQUIREMENTS.md` — ITEM-03, ITEM-04, ITEM-05, ITEM-06, QTY-01, QTY-02, QTY-03, QTY-04, ORG-01–06, USER-01–03
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 items)
- `.planning/phases/01-add-on-scaffolding/01-01-SUMMARY.md` — add-on packaging decisions
- `.planning/phases/01-add-on-scaffolding/01-02-SUMMARY.md` — backend schema, middleware, test patterns
- `.planning/phases/01-add-on-scaffolding/01-03-SUMMARY.md` — frontend stack, design tokens, apiFetch contract
- `.planning/phases/01-add-on-scaffolding/01-04-SUMMARY.md` — SPA wiring, INVENTAR_SKIP_SPA pattern
- `frontend/src/index.css` — design tokens (extend, do not override)
- `frontend/src/lib/api.js` — apiFetch implementation (all API calls go through this)
- `backend/models/__init__.py` — ORM schema (all 5 tables with their columns and enums)
- `backend/middleware/ingress.py` — IngressUserMiddleware, how user identity is read

---

## Deferred Ideas

_(None raised during this discussion)_
