---
phase: 02-core-inventory
verified: 2026-04-16T23:30:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visiting / in a running add-on shows the Inventory page with items listed, grouped by category, with quantity controls that work"
    expected: "Page loads, items render, +/- buttons adjust quantity optimistically, status pill cycles, attribution line shows 'Updated by X'"
    why_human: "Requires a live HA add-on instance with ingress headers; end-to-end browser test not automated"
  - test: "Tapping the FAB opens the ItemDrawer in add mode; filling in Name and saving creates a new item that appears in the list"
    expected: "Drawer slides in from the right, Name input focused, Save calls POST /api/items/, item appears in list without full refresh"
    why_human: "Requires live backend + frontend integration; automated tests mock fetch"
  - test: "Tapping an item row opens the ItemDrawer in edit mode pre-filled with the item's values; editing and saving updates the item inline"
    expected: "Drawer opens with correct field values; Save sends PATCH with only changed fields; list updates"
    why_human: "Integration test with live backend; drawer wiring verified in unit tests but not against real API"
  - test: "Tapping Delete in the edit drawer shows inline confirmation; confirming removes the item from the list"
    expected: "Footer transitions to 'Delete [name]? Yes, delete / Cancel'; Yes, delete sends DELETE /api/items/{id}; item disappears"
    why_human: "Integration requires live backend"
  - test: "Visiting /settings shows the Settings page; all 4 default categories list with Pencil and Trash2 icons; renaming and deleting them works"
    expected: "Default categories editable; rename calls PATCH /api/categories/{id}; delete shows confirmation then calls DELETE; row disappears"
    why_human: "Integration requires live backend; Plan 09 removed default-lock at both backend and frontend layers"
  - test: "Access banner appears when opening the add-on via direct port (not HA ingress); dismissing it hides it for the session"
    expected: "Amber banner visible; 'Open Inventar from Home Assistant...' text shown; X dismisses and banner stays gone until new tab"
    why_human: "Requires two distinct network paths (ingress vs direct port) to test both states"
---

# Phase 02: Core Inventory — Verification Report

**Phase Goal:** Household members can fully manage their inventory through the UI — adding, editing, and deleting items with categories, storage locations, and quantity tracking — and every change is attributed to the user who made it.
**Verified:** 2026-04-16T23:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/items creates item and returns 201 + ItemResponse | ✓ VERIFIED | `backend/routers/items.py` implements POST with Transaction insert; 28 passing backend tests in test_items.py |
| 2 | PATCH /api/items/{id} updates only supplied fields | ✓ VERIFIED | `model_dump(exclude_unset=True)` + `setattr` pattern; `test_update_item` green |
| 3 | DELETE /api/items/{id} removes item and returns 200 | ✓ VERIFIED | DELETE endpoint inserts Transaction(action="delete") before row removal; `test_delete_item` green |
| 4 | D-03 auto-flip: status=out + quantity=null on qty<=0 and delta<0 | ✓ VERIFIED | `useItems.js` line 84 sends `{quantity_mode:'status', status:'out', quantity:null}`; backend handles explicit null via `exclude_unset` |
| 5 | POST /api/categories creates custom category with is_default=False | ✓ VERIFIED | `categories.py` line 63 hardcodes `is_default=False`; T-02-15 preserved after plan 09 |
| 6 | DELETE /api/categories/{id} nullifies item.category_id before deleting | ✓ VERIFIED | `categories.py` line 114: `db.query(Item).filter(Item.category_id == category_id).update({"category_id": None})` |
| 7 | Default categories are now renameable and deletable (Plan 09 change) | ✓ VERIFIED | `categories.py` has no 403 checks; `Settings.jsx` passes `locked={false}` for all categories |
| 8 | POST/PATCH/DELETE /api/locations mirror category semantics; DELETE nullifies item.location_id | ✓ VERIFIED | `locations.py` line 103 nullifies location_id; 6 passing tests in test_locations.py |
| 9 | Every item mutation inserts one Transaction row with action add/update/quantity_change/delete | ✓ VERIFIED | `items.py` lines 152, 203, 206, 242; all 4 action strings confirmed |
| 10 | Transactions capture ha_user_name from IngressUserMiddleware | ✓ VERIFIED | `items.py` lines 51-52: `ha_user_name=user.name if user else None`; test_transaction_attribution green |
| 11 | GET /api/items returns last_updated_by_name from most recent transaction | ✓ VERIFIED | `_to_response()` helper at line 91; two-query N+1 avoidance; `test_last_updated_by_name_populated` green |
| 12 | Inventory page renders at / (not StubPage) with items, search, filter chips, FAB | ✓ VERIFIED | `Inventory.jsx` imports useItems/useCategories/useLocations; `grep "StubPage"` returns no matches; 8 page tests pass |
| 13 | Quantity controls work for exact (+/-) and status (cycle) modes | ✓ VERIFIED | QuantityControls.jsx implements both variants; 8+3 unit tests green; wired in Inventory.jsx lines 164-166 |
| 14 | Attribution line "Updated by X · Yh ago" visible per row | ✓ VERIFIED | ItemRow.jsx lines 18-20; uses `last_updated_by_name` + `relativeTime(updated_at)` |
| 15 | ItemDrawer supports add/edit/delete with focus trap, dirty guard, validation | ✓ VERIFIED | ItemDrawer.jsx has `role="dialog"`, `aria-modal="true"`, focus trap, requestClose(); 16 ItemDrawer tests pass |
| 16 | Settings page at /settings (not StubPage) manages categories and locations | ✓ VERIFIED | Settings.jsx imports useCategories/useLocations; `grep "StubPage"` returns no matches; 13 Settings tests pass |
| 17 | quantity stored/returned as integer; editing shows "2" not "2.0" | ✓ VERIFIED | schemas/item.py uses `Optional[int]`; ItemDrawer uses `step="1"` + `parseInt`; migration 0003 converts columns to INTEGER |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/alembic/versions/0002_seed_default_categories.py` | ORG-01 seed + is_default column | ✓ VERIFIED | Seeds 4 defaults; batch_alter_table; revision="0002" |
| `backend/alembic/versions/0003_quantity_to_integer.py` | Float→Integer migration | ✓ VERIFIED | batch_alter_table; revision="0003" |
| `backend/schemas/item.py` | ItemCreate/Update/Response with Optional[int] quantity | ✓ VERIFIED | use_enum_values=True; from_attributes=True; last_updated_by_name |
| `backend/schemas/category.py` | CategoryCreate/Update/Response | ✓ VERIFIED | CategoryCreate excludes is_default |
| `backend/schemas/location.py` | LocationCreate/Update/Response | ✓ VERIFIED | Present and exportable |
| `backend/routers/items.py` | Full CRUD + transaction audit | ✓ VERIFIED | 5 endpoints; 4 transaction actions; request.state.user |
| `backend/routers/categories.py` | Category CRUD; no default-lock; FK null-out | ✓ VERIFIED | Default-lock removed (Plan 09); is_default used only for ordering |
| `backend/routers/locations.py` | Location CRUD; FK null-out | ✓ VERIFIED | Nullifies item.location_id on delete |
| `backend/routers/access_info.py` | GET /api/access-info | ✓ VERIFIED | Returns via_ingress + user_name; 4 tests pass |
| `backend/main.py` | All routers registered before SPA | ✓ VERIFIED | Lines 25-29 all before `if not _SKIP_SPA:` (line 53) |
| `frontend/src/hooks/useItems.js` | Data hook with optimistic updates | ✓ VERIFIED | updateQuantity with D-03 auto-flip; cycleStatus; apiFetch only |
| `frontend/src/hooks/useCategories.js` | Categories CRUD hook | ✓ VERIFIED | Calls api/categories/ via apiFetch |
| `frontend/src/hooks/useLocations.js` | Locations CRUD hook | ✓ VERIFIED | Calls api/locations/ via apiFetch |
| `frontend/src/hooks/useAccessInfo.js` | Access probe hook | ✓ VERIFIED | Fetches api/access-info; fail-open on error |
| `frontend/src/pages/Inventory.jsx` | Full Inventory page | ✓ VERIFIED | Not StubPage; uses all 3 hooks; drawer wired; 8 tests pass |
| `frontend/src/pages/Settings.jsx` | Full Settings page | ✓ VERIFIED | Not StubPage; locked={false} for all categories; 13 tests pass |
| `frontend/src/components/ItemDrawer/ItemDrawer.jsx` | Slide-in drawer | ✓ VERIFIED | role=dialog; aria-modal; transform animation; 16 tests pass |
| `frontend/src/components/QuantityControls/QuantityControls.jsx` | Dual variant QC | ✓ VERIFIED | exact and status variants; errored class; 11 tests pass |
| `frontend/src/components/AccessBanner/AccessBanner.jsx` | Dismissible access banner | ✓ VERIFIED | role=status; sessionStorage dismiss; 5 tests pass |
| `frontend/src/components/SettingsListItem/SettingsListItem.jsx` | Settings list item | ✓ VERIFIED | view/rename/confirmDelete states; locked prop; 11 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/routers/items.py` | `backend/schemas/item.py` | `from schemas.item import ItemCreate, ItemUpdate, ItemResponse` | ✓ WIRED | Import present; use_enum_values serialization works |
| `backend/routers/items.py` | `Transaction model` | `db.add(Transaction(item_id=..., action=..., ha_user_name=...))` | ✓ WIRED | 4 action paths confirmed; ha_user_name from request.state.user |
| `backend/routers/items.py` | `request.state.user` | IngressUserMiddleware | ✓ WIRED | `user = request.state.user` at lines 151, 213, 239 |
| `backend/main.py` | `items/categories/locations/access_info routers` | `include_router` before SPA mount | ✓ WIRED | Lines 25-29; SPA mount at line 53 |
| `frontend/src/pages/Inventory.jsx` | `useItems.js` | `const { items, ..., updateQuantity, cycleStatus } = useItems()` | ✓ WIRED | Line 19; wired to ItemRow/ItemCard callbacks |
| `frontend/src/pages/Inventory.jsx` | `ItemDrawer.jsx` | `drawerState.open && <ItemDrawer ... onCreate={create} onUpdate={update} onDelete={remove}>` | ✓ WIRED | Line 251-260; window stubs fully removed |
| `frontend/src/hooks/useItems.js` | `frontend/src/lib/api.js` | `apiFetch('api/items/')` — no leading slash | ✓ WIRED | Line 2 import; request helper calls apiFetch |
| `frontend/src/hooks/useAccessInfo.js` | `backend/routers/access_info.py` | `apiFetch('api/access-info')` | ✓ WIRED | Line 18 |
| `frontend/src/layout/AppLayout.jsx` | `AccessBanner.jsx` | `<AccessBanner />` above `<main>` | ✓ WIRED | Line 26 of AppLayout.jsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Inventory.jsx` | `items` (state) | `useItems` → `apiFetch('api/items/')` → `GET /api/items/` → `db.query(Item)` | Yes — real DB query | ✓ FLOWING |
| `Inventory.jsx` | `categories` | `useCategories` → `apiFetch('api/categories/')` → `db.query(Category)` | Yes | ✓ FLOWING |
| `ItemRow.jsx` | `item.last_updated_by_name` | Transaction subquery in items router → model_copy() | Yes | ✓ FLOWING |
| `Settings.jsx` | `categories` | `useCategories` → live API | Yes | ✓ FLOWING |
| `AccessBanner.jsx` | `viaIngress` | `useAccessInfo` → `GET /api/access-info` → `request.state.user.ingress_path` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend test suite | `cd backend && python -m pytest tests/ -v --tb=no` | 73 passed, 84 warnings | ✓ PASS |
| Frontend test suite | `cd frontend && npx vitest run` | 101 passed (12 test files) | ✓ PASS |
| Routers before SPA | Line numbers in main.py | include_router lines 25-29 < SPA line 53 | ✓ PASS |
| Quantity as integer | `grep "Optional\[int\]" schemas/item.py` | quantity and reorder_threshold both `Optional[int]` | ✓ PASS |
| No stubs in Inventory.jsx | `grep "window.__inventar"` | Zero matches | ✓ PASS |
| No StubPage in Inventory/Settings | `grep "StubPage"` | Zero matches in both files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ITEM-03 | 02-02, 02-04, 02-05 | User can add item manually (name, category, location, quantity, threshold, notes) | ✓ SATISFIED | POST /api/items/ + ItemDrawer add mode; all fields in schema and form |
| ITEM-04 | 02-02, 02-04, 02-05 | User can edit any field | ✓ SATISFIED | PATCH /api/items/{id} + ItemDrawer edit mode; buildUpdatePatch sends only changed fields |
| ITEM-05 | 02-02, 02-05 | User can delete or archive an item | ✓ SATISFIED | DELETE endpoint in items router; drawer delete confirmation flow |
| ITEM-06 | 02-02, 02-05 | Free-text notes field | ✓ SATISFIED | `notes` column in Item model; notes textarea in ItemDrawer; included in payload |
| QTY-01 | 02-01, 02-02, 02-04 | Exact count tracking | ✓ SATISFIED | quantity_mode='exact'; QuantityControls Variant A; integer schema |
| QTY-02 | 02-01, 02-02, 02-04 | Status mode (Have/Low/Out) | ✓ SATISFIED | quantity_mode='status'; QuantityControls Variant B; cycleStatus |
| QTY-03 | 02-02, 02-05 | Reorder threshold per item | ✓ SATISFIED | reorder_threshold in schema/model; shown in ItemDrawer exact mode; Optional[int] |
| QTY-04 | 02-04, 02-05 | +1/-1 quick buttons | ✓ SATISFIED | QuantityControls +/- buttons call updateQuantity; wired in Inventory.jsx |
| ORG-01 | 02-01, 02-09 | Default categories pre-loaded | ✓ SATISFIED | Migration 0002 seeds 4 defaults; Plan 09 makes them editable (user request) |
| ORG-02 | 02-02, 02-06 | Custom categories beyond defaults | ✓ SATISFIED | POST /api/categories/ always sets is_default=False; AddRow in Settings |
| ORG-03 | 02-02, 02-03 | Storage locations per item | ✓ SATISFIED | location_id FK on items; Location model; ItemDrawer location select |
| ORG-04 | 02-02, 02-06 | Create/rename/delete locations | ✓ SATISFIED | Full CRUD in /api/locations/; Settings page locations section |
| ORG-05 | 02-03, 02-04 | Filter by storage location | ✓ SATISFIED | activeLocationIds state; FilterChip + FilterPicker; client-side filter applied |
| ORG-06 | 02-03, 02-04 | Filter by category | ✓ SATISFIED | activeCategoryIds state; FilterChip + FilterPicker; client-side filter applied |
| USER-01 | 02-02 | Shared inventory, no separate accounts | ✓ SATISFIED | HA identity via IngressUserMiddleware; no auth layer added |
| USER-02 | 02-01, 02-02, 02-07 | Changes attributed to HA user | ✓ SATISFIED | Transaction.ha_user_name from request.state.user; last_updated_by_name in ItemResponse; attribution line in ItemRow/ItemCard |
| USER-03 | 02-02, 02-03 | Near-real-time updates on refresh | ✓ SATISFIED | No Cache-Control headers set; hooks refetch on mount; no stale caching observed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/AccessBanner/AccessBanner.module.css` | 5-6, 13, 24, 31 | Hardcoded hex colors (`#fef3c7`, `#f59e0b`, `#92400e`, `#fde68a`) | ⚠️ Warning | Plan 08 explicitly designed these amber colors since no amber tokens exist in the design system; functionally complete but inconsistent with the zero-hardcoded-hex convention used in all other components |

No blockers found. The AccessBanner hex colors are a deliberate design decision (amber warning color not in the token system) and do not prevent the phase goal from being achieved.

### Human Verification Required

#### 1. Full Inventory Page End-to-End Flow

**Test:** Run the add-on, visit /, confirm items display grouped by category with quantity controls. Tap + on an exact-mode item and verify quantity increments optimistically. Tap the status pill and verify it cycles Have → Low → Out → Have.
**Expected:** Page loads with items listed. Quantity changes happen immediately (optimistic) and persist after refresh. Attribution row "Updated by [username] · Xh ago" visible under each item.
**Why human:** Requires a live HA instance with ingress headers to test attribution; automated tests mock fetch.

#### 2. Add Item via FAB

**Test:** Visit /, click the FAB (bottom-right blue button), fill in Name "Test Item", pick a category, click Save Item.
**Expected:** Drawer slides in from the right; Name input is focused; after Save, the drawer closes, the item appears in the inventory list immediately.
**Why human:** Integration test requiring live backend; automated tests use mocked fetch.

#### 3. Edit Item via Row Tap

**Test:** Tap an existing inventory item row (not the +/- buttons). Verify the drawer opens in edit mode pre-filled with the item's data. Change the notes field and save.
**Expected:** Drawer opens with item values; notes change reflected in list on close; attribution updates to current user.
**Why human:** Requires live backend + attribution header from HA ingress.

#### 4. Delete Item

**Test:** Open an item for editing, click Delete button. Verify the footer transitions to "Delete [name]? Yes, delete / Cancel". Confirm deletion.
**Expected:** Item disappears from the inventory list; no orphaned Transaction rows.
**Why human:** Integration test with live backend.

#### 5. Settings Page — Default Category Editability (Plan 09 user request)

**Test:** Visit /settings, verify all 4 default categories (Food & pantry, Fridge & freezer, Cleaning & household, Personal care) show Pencil and Trash2 icons. Rename "Food & pantry" to "Pantry" and restart the add-on.
**Expected:** Rename succeeds immediately. After add-on restart, "Pantry" persists (migration 0002 does not re-seed deleted/renamed rows).
**Why human:** Requires container restart to verify non-resurrection of deleted defaults.

#### 6. Access Banner (Direct Port vs Ingress)

**Test:** Open the add-on directly via `http://homeassistant.local:<port>/` (bypassing HA sidebar). Then open via the HA sidebar entry point.
**Expected:** Direct port shows amber banner "Open Inventar from Home Assistant (Sidebar → Inventar) to enable user attribution." Dismissing hides it. HA sidebar entry shows no banner.
**Why human:** Requires two network paths; impossible to test programmatically without running servers.

---

## Gaps Summary

No automated-check gaps found. All 17 observable truths are verified with passing tests (73 backend + 101 frontend).

The only notable deviation from stated standards is the hardcoded hex colors in `AccessBanner.module.css` — this is a warning, not a blocker, as there are no amber tokens in the design system and the plan explicitly documented these values.

The 6 human verification items represent integration and environment-dependent scenarios that cannot be verified without a running HA add-on instance.

---

*Verified: 2026-04-16T23:30:00Z*
*Verifier: Claude (gsd-verifier)*
