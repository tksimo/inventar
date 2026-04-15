# Requirements: Inventar

**Defined:** 2026-04-14
**Core Value:** At a glance, know what you have, where it is, and what you need to buy — without having to walk through every cupboard.

## v1 Requirements

### Add-on Infrastructure

- [x] **INFRA-01**: App runs as a Home Assistant add-on (Docker container managed by HA Supervisor)
- [x] **INFRA-02**: App is accessible as a panel in the HA sidebar
- [x] **INFRA-03**: All data is persisted in `/data` so it survives add-on updates
- [x] **INFRA-04**: HA ingress handles authentication — no separate login required
- [x] **INFRA-05**: App is accessible from a local IP:port directly (in addition to HA sidebar)

### Items

- [ ] **ITEM-01**: User can add an item by scanning a barcode with the phone camera
- [ ] **ITEM-02**: Barcode scan looks up Open Food Facts and pre-fills name, image, and nutritional data
- [ ] **ITEM-03**: User can add an item manually (name, category, location, quantity, threshold, notes)
- [ ] **ITEM-04**: User can edit any field of an existing item
- [ ] **ITEM-05**: User can delete or archive an item
- [ ] **ITEM-06**: Each item has an optional free-text notes field (e.g. "buy organic", "only from Aldi")
- [ ] **ITEM-07**: Item detail page shows product image and nutritional values (calories, protein, carbs, fat) sourced from Open Food Facts
- [ ] **ITEM-08**: Items scanned from barcodes not found in Open Food Facts fall back to a manual entry form

### Quantity & Status

- [ ] **QTY-01**: Each item can track an exact count (e.g. 3 cans, 500g)
- [ ] **QTY-02**: Each item can use a status mode: Have / Running low / Out
- [ ] **QTY-03**: User can set a reorder threshold per item; items at or below threshold are flagged
- [ ] **QTY-04**: User can increment or decrement quantity with quick +1 / -1 buttons without opening the edit form

### Organisation

- [x] **ORG-01**: Items are organised into categories: Food & pantry, Fridge & freezer, Cleaning & household, Personal care
- [ ] **ORG-02**: User can create custom categories beyond the defaults
- [ ] **ORG-03**: Each item has an assigned storage location (e.g. "kitchen top shelf", "bathroom under sink")
- [ ] **ORG-04**: User can create, rename, and delete storage locations
- [x] **ORG-05**: User can filter and search inventory by storage location
- [x] **ORG-06**: User can filter and search inventory by category

### Shopping List

- [ ] **SHOP-01**: Items at or below their reorder threshold automatically appear on the shopping list
- [ ] **SHOP-02**: User can manually add any item to the shopping list regardless of stock level
- [ ] **SHOP-03**: User can check off items while shopping; checking off restocks the item to its reorder threshold
- [ ] **SHOP-04**: User receives an alert (in-app notification) when an item drops below its reorder threshold
- [ ] **SHOP-05**: User can export the shopping list as plain text to share via messaging apps

### Restock Mode

- [ ] **RSTO-01**: App has a dedicated restock mode for scanning multiple items after a shopping trip
- [ ] **RSTO-02**: In restock mode, scanning a barcode finds the existing item and prompts for quantity to add
- [ ] **RSTO-03**: Restocked items are removed from the shopping list automatically

### Recipes

- [ ] **RECP-01**: User can create a recipe manually with a name, ingredient list, and optional instructions
- [ ] **RECP-02**: User can import a recipe by pasting a URL; app parses and extracts ingredients
- [ ] **RECP-03**: User can check a recipe against current inventory to see which ingredients are missing or low
- [ ] **RECP-04**: User can add all missing recipe ingredients to the shopping list with one tap
- [ ] **RECP-05**: User can mark a recipe as cooked; app deducts ingredient quantities from inventory automatically

### Multi-User

- [ ] **USER-01**: 2–3 household members share one inventory with no separate accounts (HA identity used)
- [x] **USER-02**: Each inventory change records which HA user made it and when
- [ ] **USER-03**: All household members see inventory updates in real time (or near real time on refresh)

### HA Display Integration

- [ ] **HA-01**: App exposes a REST endpoint that HA can poll for current stock levels as sensor entities
- [ ] **HA-02**: App can be embedded as an iframe in HA Lovelace dashboards

---

## v2 Requirements

### Nutrition Tracking

- **NUTR-01**: User can log a meal by selecting items and portion sizes
- **NUTR-02**: App calculates daily macro totals (calories, protein, carbs, fat) from meal logs
- **NUTR-03**: User can set daily nutrition goals and see progress toward them
- **NUTR-04**: User can view nutrition history by day/week

### Recipe Enhancements

- **RECP-06**: User can import a recipe by photographing a recipe card or book page (AI/OCR parsing)
- **RECP-07**: Recipes can be filtered by dietary tags (vegan, gluten-free, etc.)

### Smart Features

- **SMRT-01**: App learns consumption patterns and warns when an item is likely to run out soon
- **SMRT-02**: Shopping list shows estimated total cost based on tracked item prices

### Extended HA Integration

- **HA-03**: Physical HA buttons or NFC tags on shelves can trigger stock updates (bidirectional)
- **HA-04**: HA voice assistant commands can update stock ("we're out of milk")
- **HA-05**: Rich Lovelace cards showing stock levels and shopping list count

### Household Insights

- **STAT-01**: Weekly report showing most consumed items, restock frequency, and waste
- **STAT-02**: Waste log — user can mark items as thrown away; tracked separately from consumption
- **STAT-03**: Price tracking per item with history over time

### Convenience

- **CONV-01**: Shopping list organised by store aisle / section for efficient in-store routing
- **CONV-02**: Direct integration with grocery delivery services (send shopping list to online supermarket)
- **CONV-03**: Support for tracking multiple household locations (e.g. main home + holiday home)
- **CONV-04**: Print barcode labels for homemade items without existing barcodes

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | Phone camera via webapp is sufficient; avoids app store maintenance overhead |
| Expiry date tracking | Creates guilt-list overhead for casual households; not requested |
| Cloud hosting | Local-only by design; HA handles remote access if needed |
| Multi-tenant auth | 2–3 person household; HA identity is sufficient |
| Gamification | Not requested; risks patronising casual users |
| Nutritional tracking (active) | Deferred to milestone 2 — inventory foundation ships first |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| ITEM-01 | Phase 3 | Pending |
| ITEM-02 | Phase 3 | Pending |
| ITEM-03 | Phase 2 | Pending |
| ITEM-04 | Phase 2 | Pending |
| ITEM-05 | Phase 2 | Pending |
| ITEM-06 | Phase 2 | Pending |
| ITEM-07 | Phase 3 | Pending |
| ITEM-08 | Phase 3 | Pending |
| QTY-01 | Phase 2 | Pending |
| QTY-02 | Phase 2 | Pending |
| QTY-03 | Phase 2 | Pending |
| QTY-04 | Phase 2 | Pending |
| ORG-01 | Phase 2 | Complete |
| ORG-02 | Phase 2 | Pending |
| ORG-03 | Phase 2 | Pending |
| ORG-04 | Phase 2 | Pending |
| ORG-05 | Phase 2 | Complete |
| ORG-06 | Phase 2 | Complete |
| SHOP-01 | Phase 4 | Pending |
| SHOP-02 | Phase 4 | Pending |
| SHOP-03 | Phase 4 | Pending |
| SHOP-04 | Phase 4 | Pending |
| SHOP-05 | Phase 4 | Pending |
| RSTO-01 | Phase 4 | Pending |
| RSTO-02 | Phase 4 | Pending |
| RSTO-03 | Phase 4 | Pending |
| RECP-01 | Phase 5 | Pending |
| RECP-02 | Phase 5 | Pending |
| RECP-03 | Phase 5 | Pending |
| RECP-04 | Phase 5 | Pending |
| RECP-05 | Phase 5 | Pending |
| USER-01 | Phase 2 | Pending |
| USER-02 | Phase 2 | Complete |
| USER-03 | Phase 2 | Pending |
| HA-01 | Phase 6 | Pending |
| HA-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after roadmap creation*
