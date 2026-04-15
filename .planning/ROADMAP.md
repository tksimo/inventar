# Roadmap: Inventar

**Created:** 2026-04-14
**Milestone:** 1 — Home inventory webapp as HA add-on
**Granularity:** Standard (6 phases)
**Coverage:** 38/38 v1 requirements mapped

---

## Phases

- [x] **Phase 1: Add-on Scaffolding** — Docker container boots, serves through HA ingress, persists data in /data (completed 2026-04-15)
- [ ] **Phase 2: Core Inventory** — Full item CRUD, categories, locations, quantity modes, multi-user attribution
- [ ] **Phase 3: Barcode Scanning** — Camera scan, Open Food Facts lookup, scan-to-form prefill, one-tap update
- [ ] **Phase 4: Shopping & Restock** — Reorder thresholds, auto shopping list, alerts, restock mode, share list
- [ ] **Phase 5: Recipes** — Manual recipe creation, URL import, ingredient check, cook-and-deduct
- [ ] **Phase 6: HA Display Integration** — REST sensor endpoint, iframe dashboard embedding

---

## Phase Details

### Phase 1: Add-on Scaffolding
**Goal**: The add-on boots on HAOS, appears in the HA sidebar, serves a working page through ingress with relative asset paths, and persists all data in /data — with zero placeholder behavior that would require rework in later phases.
**Depends on**: Nothing
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. User installs the add-on and sees "Inventar" appear in the HA sidebar with the correct icon and title
  2. Clicking the sidebar entry opens the app UI through HA ingress (HTTPS) with no broken assets or blank page
  3. The app is also reachable at a direct local IP:port (for HA REST sensors and direct access)
  4. After an add-on update and reinstall, all previously created data survives intact (database at /data/inventar.db)
  5. No separate login prompt appears — HA session authentication passes through seamlessly
**Plans**: TBD
**UI hint**: yes

### Phase 2: Core Inventory
**Goal**: Household members can fully manage their inventory through the UI — adding, editing, and deleting items with categories, storage locations, and quantity tracking — and every change is attributed to the user who made it.
**Depends on**: Phase 1
**Requirements**: ITEM-03, ITEM-04, ITEM-05, ITEM-06, QTY-01, QTY-02, QTY-03, QTY-04, ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, ORG-06, USER-01, USER-02, USER-03
**Success Criteria** (what must be TRUE):
  1. User can create an item with name, category, storage location, quantity (exact count or have/low/out status), reorder threshold, and notes — and see it in the inventory list
  2. User can edit any field of an existing item and delete or archive it
  3. User can increment or decrement quantity from the inventory list with a single tap, without opening the edit form
  4. Inventory list can be filtered by category, by storage location, and searched by name — and the filtered views show the correct items
  5. Any household member's change shows which HA user made it and when; all members see the updated inventory on next page load
**Plans**: TBD
**UI hint**: yes

### Phase 3: Barcode Scanning
**Goal**: Users can scan a product barcode with their phone camera and either update the quantity of an existing item in one tap, or get a pre-filled form for a new item sourced from Open Food Facts — with product image and nutritional data stored on the item.
**Depends on**: Phase 2
**Requirements**: ITEM-01, ITEM-02, ITEM-07, ITEM-08
**Success Criteria** (what must be TRUE):
  1. User taps the scan button on their phone, the camera activates (iOS and Android), and a recognized barcode is decoded within a few seconds
  2. Scanning a barcode for an item already in inventory shows a one-tap quantity update UI without opening the full edit form
  3. Scanning a new barcode pre-fills the add-item form with name, category suggestion, product image, and nutritional data (calories, protein, carbs, fat) from Open Food Facts
  4. Scanning a barcode not found in Open Food Facts falls back to a manual entry form with the barcode pre-filled and no error state blocking the user
  5. Scanning works correctly through the HA ingress HTTPS connection on a real mobile device
**Plans**: TBD
**UI hint**: yes

### Phase 4: Shopping & Restock
**Goal**: The app automatically surfaces what needs buying, lets users manage a shopping list, notifies them when stock is low, and supports scanning items back into inventory after a shopping trip.
**Depends on**: Phase 2
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, RSTO-01, RSTO-02, RSTO-03
**Success Criteria** (what must be TRUE):
  1. Items at or below their reorder threshold (or with status "out") automatically appear on the shopping list without any manual action
  2. User can manually add any item to the shopping list regardless of current stock level
  3. User can check off a shopping list item while in the store; the item is restocked to its threshold and removed from the list
  4. User sees an in-app alert when an item drops below its reorder threshold
  5. User can export the shopping list as plain text and share it via a messaging app
  6. In restock mode, scanning a barcode finds the matching item and prompts for quantity to add; restocked items disappear from the shopping list
**Plans**: TBD
**UI hint**: yes

### Phase 5: Recipes
**Goal**: Users can store recipes, check whether they have the ingredients on hand, and cook a recipe that automatically deducts used ingredients from inventory.
**Depends on**: Phase 2
**Requirements**: RECP-01, RECP-02, RECP-03, RECP-04, RECP-05
**Success Criteria** (what must be TRUE):
  1. User can create a recipe with a name, ingredient list mapped to inventory items, and optional instructions
  2. User can import a recipe by pasting a URL; the app parses and extracts an ingredient list ready for review
  3. User can open a recipe and see which ingredients are missing or running low based on current inventory
  4. User can add all missing recipe ingredients to the shopping list with one tap
  5. User can mark a recipe as cooked and all ingredient quantities are automatically deducted from inventory
**Plans**: TBD
**UI hint**: yes

### Phase 6: HA Display Integration
**Goal**: Home Assistant can display live inventory data — low-stock counts and item lists — as sensor entities on any HA dashboard, and the full app UI is embeddable as an iframe card.
**Depends on**: Phase 2
**Requirements**: HA-01, HA-02
**Success Criteria** (what must be TRUE):
  1. A HA REST sensor configured with the add-on's summary endpoint shows current low-stock and out-of-stock counts as sensor state values
  2. The app UI renders correctly when embedded as an iframe card in a HA Lovelace dashboard
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Add-on Scaffolding | 4/4 | Complete   | 2026-04-15 |
| 2. Core Inventory | 2/3 | In Progress|  |
| 3. Barcode Scanning | 0/? | Not started | - |
| 4. Shopping & Restock | 0/? | Not started | - |
| 5. Recipes | 0/? | Not started | - |
| 6. HA Display Integration | 0/? | Not started | - |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
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
| ORG-01 | Phase 2 | Pending |
| ORG-02 | Phase 2 | Pending |
| ORG-03 | Phase 2 | Pending |
| ORG-04 | Phase 2 | Pending |
| ORG-05 | Phase 2 | Pending |
| ORG-06 | Phase 2 | Pending |
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
| USER-02 | Phase 2 | Pending |
| USER-03 | Phase 2 | Pending |
| HA-01 | Phase 6 | Pending |
| HA-02 | Phase 6 | Pending |

**v1 requirements mapped: 38/38** (no orphans)

---

## Phase Order Rationale

- **Phase 1 before everything**: ingress path handling and /data persistence must be correct from the first line of feature code. Retrofitting these is a rewrite.
- **Phase 2 before Phase 3**: the barcode scan flow targets the item creation and update forms. Those forms must exist before the scan-to-prefill UX can be built.
- **Phase 3 after Phase 2**: barcode scanning is the primary input method but depends on the stable data model and item forms from Phase 2.
- **Phase 4 after Phase 2**: reorder thresholds and shopping list logic depend on the quantity/status model being stable and correct.
- **Phase 5 after Phase 2**: recipes reference inventory items; the item catalog must exist first. Phase 3 (barcode) is not a hard dependency but scanning items into recipes is a natural enhancement.
- **Phase 6 after Phase 2**: the REST sensor endpoint needs a stable data model. Phase 6 has no frontend deliverables and can be built in parallel with Phases 3–5 if needed, but is lowest priority.

---
*Last updated: 2026-04-14 after roadmap creation*
