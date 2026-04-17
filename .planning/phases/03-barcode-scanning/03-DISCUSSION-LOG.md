# Phase 3: Barcode Scanning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 03-barcode-scanning
**Areas discussed:** Scanner entry point, Existing item scan result, Nutrition display location, Open Food Facts lookup location

---

## Scanner Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Second FAB (scan icon) | Camera/barcode icon FAB next to existing Plus FAB. Both always visible at bottom-right. Scan is one tap from anywhere in the inventory list. | ✓ |
| Icon in inventory header | Small camera icon in top toolbar next to search input. Less prominent, further from thumb reach on mobile. | |
| Scan opens as separate route | Dedicated /scan page with full-screen camera. Requires navigation — adds friction. | |

**User's choice:** Second FAB (scan icon)
**Notes:** Keeps scan thumb-reachable and always visible from the inventory view.

---

## Existing Item Scan Result

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom sheet with +/− controls | Slide-up sheet showing item name, current quantity, and −/+ buttons. "Done" and "Edit item" actions. Lightweight and dismissible. | ✓ |
| Toast + inline edit on list row | Toast confirms match; matching row expands with +/− inline. | |
| Full ItemDrawer, pre-scrolled to quantity | Existing drawer opens with item loaded. Consistent but heavier than needed. | |

**User's choice:** Bottom sheet with +/− controls
**Notes:** One-tap quantity update without triggering full edit flow. Escape hatch to full drawer via "Edit item".

---

## Nutrition Display Location

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the drawer | ItemDrawer gains image + nutrition section at the bottom. No new route. "Item detail" = the drawer in view mode. | ✓ |
| New full-screen /items/:id route | Each item gets its own page. Enables richer layout, but more work and more navigation. | |

**User's choice:** Extend the drawer (Recommended)
**Notes:** Stays consistent with Phase 2 patterns. No new route to maintain.

---

## Open Food Facts Lookup Location

| Option | Description | Selected |
|--------|-------------|----------|
| Backend proxy | FastAPI fetches OFF, normalizes response, returns structured data. No CORS issues, cacheable. Phone uses local network only. | ✓ |
| Frontend fetches OFF directly | Browser fetches OFF directly. Simpler backend but requires mobile internet access and CORS. | |

**User's choice:** Backend proxy (Recommended)
**Notes:** Avoids CORS, keeps mobile data burden on the NUC, and the barcode column is already indexed for future caching.

---

## Claude's Discretion

- Camera/barcode library selection (ZXing-js, html5-qrcode, Quagga2, etc.)
- FAB layout (stacked vs. side-by-side)
- Bottom sheet animation and dismiss behavior
- Camera permission error state handling
- Exact OFF API endpoint and normalization

## Deferred Ideas

- Batch scan / restock mode — belongs in Phase 4
- Offline barcode cache — v1 skip
- Custom barcode labels for homemade items — v2 (CONV-04)
