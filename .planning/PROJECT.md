# Inventar

## What This Is

A home inventory webapp for 2-3 person households to track what they have at home — food, cleaning supplies, personal care items — including where each item is stored. Scan barcodes with your phone camera to add or remove stock. Runs as a Home Assistant add-on on a local NUC, accessible from the HA sidebar.

## Core Value

At a glance, know what you have, where it is, and what you need to buy — without having to walk through every cupboard.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can add items by scanning a barcode with the phone camera
- [ ] User can add items manually (name, quantity, category, location)
- [ ] User can track quantity as an exact count or a status (have / running low / out)
- [ ] User can assign a storage location to each item (e.g. "kitchen cabinet top shelf", "bathroom under sink")
- [ ] Items are organized by category: Food & pantry, Fridge & freezer, Cleaning & household, Personal care — plus custom categories
- [ ] User can set a reorder threshold per item; items below threshold are flagged
- [ ] App generates a shopping list of flagged/out-of-stock items
- [ ] User receives alerts when items fall below their reorder threshold
- [ ] Multiple household members (2-3) can share and update the inventory
- [ ] Home Assistant can display current inventory data (read-only, v1)
- [ ] App is packaged as a Home Assistant add-on and runs on HAOS

### Out of Scope

- Native iOS/Android app — phone camera via webapp is sufficient for v1
- HA automations triggering stock changes — display-only integration for v1
- Expiry date tracking — not mentioned, adds complexity
- Recipe suggestions / meal planning — different problem space
- Cloud hosting / external access — local network only, HA handles remote access if needed

## Context

- Hardware: Intel NUC running Home Assistant OS (HAOS)
- Deployment: HA add-on (Docker container managed by HA Supervisor), accessible from HA sidebar
- Users scan barcodes in-browser on their phones; barcode lookup can use open databases (e.g. Open Food Facts)
- HA integration v1 is display-only — inventory data shown on HA dashboards via iframe or sensor entities
- Storage location feature was explicitly requested for v1 to help household members find items without searching

## Constraints

- **Platform**: Must run as a Home Assistant add-on — no raw Linux/Docker access on HAOS
- **Network**: Local network only — no external hosting requirement
- **Users**: Small household scale (2-3 people), no need for full multi-tenant auth complexity
- **Barcode scanning**: Must work via phone browser camera — no dedicated hardware scanner

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| HA add-on deployment | HAOS doesn't allow arbitrary processes; add-on is the intended extension mechanism | — Pending |
| Barcode scanning via phone camera in webapp | No native app needed; browser camera API (e.g. ZXing/QuaggaJS) handles this well | — Pending |
| Display-only HA integration in v1 | Keeps v1 scope tight; bidirectional HA integration adds significant complexity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after initialization*
