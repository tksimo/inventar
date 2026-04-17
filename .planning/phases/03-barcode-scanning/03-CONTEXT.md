# Phase 3: Barcode Scanning - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Camera-based barcode scanning on mobile phones. User taps a scan FAB → camera activates → barcode decoded → one of three outcomes:

1. **Existing item match:** lightweight bottom sheet for one-tap quantity update (no full drawer)
2. **New item, OFF found:** ItemDrawer opens in add mode, pre-filled with name, category suggestion, product image, and nutritional data from Open Food Facts
3. **New item, OFF not found:** ItemDrawer opens in add mode with barcode pre-filled, all other fields empty — no error state blocking the user

Out of scope for this phase: shopping list, restock mode, recipe deduction, multi-barcode batch scanning.

</domain>

<decisions>
## Implementation Decisions

### Scanner Entry Point
- **D-01:** A second FAB is added to the inventory view alongside the existing Plus FAB. The new FAB shows a camera/barcode icon and label "Scan". Both FABs sit at bottom-right, stacked or side-by-side. Scan is one thumb-tap from anywhere in the inventory list.
- **D-02:** Tapping the scan FAB opens the camera view inline (overlay or modal on the current page) — not a separate route. Camera activates immediately on open.

### Existing Item Scan Result
- **D-03:** When a scanned barcode matches an existing item, a **bottom sheet** slides up from the bottom of the screen. It shows: item name, current quantity, storage location, and −/+ controls.
- **D-04:** Bottom sheet has two actions: "Done" (saves quantity, dismisses sheet, returns to inventory) and "Edit item" (closes sheet, opens full ItemDrawer for that item).
- **D-05:** If the scanned barcode matches no existing item, proceed to OFF lookup (backend proxy) and then open ItemDrawer in add mode.

### New Item Flow (scan → add)
- **D-06:** ItemDrawer is reused for both the "new item from barcode" and "new item, barcode not found" flows. No new form component.
- **D-07:** For a recognized barcode: ItemDrawer opens with name, category (OFF suggestion), image_url, and nutritional fields pre-filled. User can edit any field before saving.
- **D-08:** For an unrecognized barcode (OFF returns nothing): ItemDrawer opens with the barcode pre-filled in the barcode field, all other fields blank. No error state — user fills manually and saves.

### Nutrition Data Display
- **D-09:** "Item detail" = the ItemDrawer in view/edit mode. No new full-screen route. The drawer gains a new collapsible or always-visible section at the bottom showing:
  - Product image (if image_url set)
  - Nutrition table per 100g: Calories, Protein, Carbs, Fat
- **D-10:** Nutrition section is only rendered if at least one nutrition value is set. If no OFF data exists for an item, the section is hidden entirely (not shown as zeroes or dashes).

### Open Food Facts Integration
- **D-11:** The backend (FastAPI) proxies all OFF API calls. Frontend never calls OFF directly.
- **D-12:** Backend endpoint: `GET /api/barcode/{code}` → returns normalized product data or a 404-equivalent response if not found.
- **D-13:** OFF result is not cached in the DB separately — the data is stored on the item itself when the user saves. Re-scanning an existing item (already in DB) skips OFF lookup and goes straight to the bottom sheet.
- **D-14:** Backend stores nutritional data as four nullable columns on the items table: `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`. A new Alembic migration adds these columns. (image_url and barcode columns already exist.)

### Carried-Forward Constraints (from Phase 1 & 2)
- `apiFetch(path)` for all API calls — no bare `fetch('/path')`
- CSS Modules for all component styles — no inline styles, no Tailwind
- Design tokens from `frontend/src/index.css` — use `--color-*`, `--space-*`, `--font-*`
- TDD red-green for all new behavior (established Phase 2 pattern)

### Claude's Discretion
- Camera/barcode library choice (ZXing-js, html5-qrcode, Quagga2, or similar) — pick the best-maintained option for 2026 mobile browsers with iOS+Android support
- FAB layout (stacked vertically vs. side-by-side) — whichever fits the existing FAB CSS module better
- Bottom sheet animation and dismiss behavior (swipe-down, tap-outside, etc.)
- Exact OFF API endpoint and response normalization logic
- Camera permission error state handling (user denied camera access)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 3: Barcode Scanning" — Goal, success criteria, dependencies
- `.planning/REQUIREMENTS.md` §"Items" — ITEM-01, ITEM-02, ITEM-07, ITEM-08

### Prior phase decisions and constraints
- `.planning/phases/02-core-inventory/02-CONTEXT.md` — Phase 2 carried-forward constraints (apiFetch, CSS Modules, tokens, TDD, drawer patterns)
- `.planning/phases/01-add-on-scaffolding/01-CONTEXT.md` — D-06 (Vite base `./`), D-14 (database path `/data/inventar.db`)

### Existing code to extend (not replace)
- `frontend/src/components/FAB/FAB.jsx` — existing Plus FAB; second scan FAB follows same pattern
- `frontend/src/components/ItemDrawer/ItemDrawer.jsx` — reused for new-item-from-barcode and fallback flows
- `frontend/src/lib/api.js` — apiFetch implementation
- `backend/models/__init__.py` — items table schema (barcode, image_url already exist; add nutrition columns via Alembic)
- `frontend/src/index.css` — design tokens (extend, do not override)

### Project context
- `.planning/PROJECT.md` — "Barcode scanning via phone browser camera" constraint, out-of-scope items

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FAB` component — existing Plus FAB; scan FAB follows the same pattern (icon + label + onClick)
- `ItemDrawer` — handles add/edit modes; pre-filling props for barcode flow requires extending its interface
- `useItems` hook — existing CRUD; barcode lookup is a new separate hook (`useBarcodeScanner` or similar)
- `QuantityControls` — existing +/− component; bottom sheet reuses this for the existing-item quick update

### Established Patterns
- CSS Modules per component — every new component gets its own `.module.css`
- Design tokens from `index.css` — `--color-surface`, `--color-primary`, `--space-*`, `--font-*`
- TDD: write failing tests first, then implementation
- `apiFetch('api/...')` — relative paths, no leading slash

### Integration Points
- New FAB stacks alongside existing FAB in `Inventory.jsx`
- New backend router `/api/barcode/` in `backend/routers/` (new file, registered in `main.py`)
- Alembic migration: add `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` nullable float columns to items table

</code_context>

<specifics>
## Specific Ideas

- Bottom sheet UX: item name prominent, current quantity centered, −/+ controls large for thumb tap, "Done" primary action, "Edit item" secondary/text link
- Camera view: full-width viewfinder overlay on the inventory page; no navigation away; closes on barcode detected or on user dismiss (X button)
- ROADMAP success criterion 5: scanning must work through HA ingress HTTPS on a real mobile device — researcher should verify that the chosen camera library doesn't have issues with cross-origin or HTTPS restrictions specific to the ingress proxy setup

</specifics>

<deferred>
## Deferred Ideas

- Batch scan mode (scan multiple items in sequence without closing camera) — Phase 4 restock mode is the right home for this
- Offline barcode lookup / local product cache — adds complexity; skip for v1
- Custom barcode for homemade items (CONV-04 in v2) — deferred to v2

</deferred>

---

*Phase: 03-barcode-scanning*
*Context gathered: 2026-04-17*
