---
phase: 02-core-inventory
plan: "05"
subsystem: frontend/item-drawer
tags: [react, drawer, crud, accessibility, focus-trap, css-modules, animation, tdd]
dependency_graph:
  requires: ["02-04"]
  provides: ["item-drawer", "add-item-flow", "edit-item-flow", "delete-item-flow"]
  affects: []
tech_stack:
  added: []
  patterns:
    - Slide-in drawer with requestAnimationFrame-triggered CSS transform animation
    - Dirty detection via useRef initial snapshot + useMemo shallow compare
    - Focus trap via keydown handler querying focusable elements within drawer root
    - Patch-only-changed diff (buildUpdatePatch) for PATCH requests
    - Inline delete confirmation state (no modal) via deleteConfirming boolean
    - CSS Modules token-only colors; no hardcoded hex
key_files:
  created:
    - frontend/src/components/ItemDrawer/ItemDrawer.jsx
    - frontend/src/components/ItemDrawer/ItemDrawer.module.css
    - frontend/src/components/ItemDrawer/ItemDrawer.test.jsx
  modified:
    - frontend/src/pages/Inventory.jsx
    - frontend/src/pages/Inventory.test.jsx
decisions:
  - "requestClose() guards all close intents (X, Escape, backdrop) through a single dirty-check function"
  - "buildUpdatePatch computes only changed fields to minimise transaction stream noise on backend"
  - "Manage categories/locations select option navigates to /settings after dirty-check gate"
  - "drawerState.open conditional mount (not visibility toggle) so component fully unmounts on close"
metrics:
  duration: "~20min"
  completed: "2026-04-16"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  tests_added: 12
  tests_total: 81
---

# Phase 02 Plan 05: ItemDrawer Summary

**One-liner:** Slide-in ItemDrawer (D-02) with add/edit/delete flows, focus trap, dirty-check close guard, quantity mode switch, inline error states, and absolute-time attribution — wired to Inventory page replacing Plan 02-04 window stubs.

---

## What Was Built

Replaced the `window.__inventarAddClicked` and `window.__inventarRowClicked` stub handlers from Plan 02-04 with a complete slide-in drawer for inventory item management.

### ItemDrawer Component

**`ItemDrawer.jsx`** — full add/edit/delete form:
- **Add mode**: empty form, name input auto-focused, Save calls `onCreate(payload)` built by `buildCreatePayload`
- **Edit mode**: pre-fills all fields from item prop; Save calls `onUpdate(id, patch)` built by `buildUpdatePatch` (patch-only-changed)
- **Delete flow**: footer transitions inline — Save+Delete → "Delete [name]? Yes, delete / Cancel" — no modal. Yes,delete calls `onDelete(id)`.
- **Dirty detection**: `useRef` captures initial form snapshot; `useMemo` shallow-compares current form state to detect dirtiness
- **Close guard**: `requestClose()` — single function handling X button, Escape key, backdrop click — calls `window.confirm('Discard changes?')` only when dirty
- **Focus trap**: `handleKeyDown` queries `button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])` within drawer root; Tab/Shift+Tab cycle wraps at boundaries
- **Quantity mode switch**: segmented control toggles between "Exact count" (quantity + reorder_threshold fields) and "Status" (Have/Low/Out segmented control, reorder_threshold hidden)
- **Inline validation**: Name required check prevents submit; "Name is required" shown below field
- **Save failure**: `saveError` state shows "Could not save. Check your connection and try again." — drawer stays open, save button re-enables
- **Attribution**: edit mode only — "Last modified by [name] on [absoluteTime(updated_at)]" — rendered when `last_updated_by_name` is set
- **Manage links**: Category/Location selects include "Manage categories →" / "Manage locations →" as last option; selecting navigates to /settings after dirty-check
- **ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="drawer-title"`
- **Animation**: `requestAnimationFrame` flips `mounted` state true after first paint → applies `.open` class → `transform: translateX(0)` via 200ms ease-out CSS transition

**`ItemDrawer.module.css`** — CSS Modules:
- `transform: translateX(100%)` (closed) → `transform: translateX(0)` (open)
- `transition: transform 200ms ease-out`
- Mobile (< 768px): `width: 100vw`, backdrop `display: none`
- Desktop (≥ 768px): `width: 480px`, backdrop `rgba(0,0,0,0.5)` (only allowed hardcoded value)
- Zero hardcoded hex colors — all via design tokens

**`ItemDrawer.test.jsx`** — 10 unit tests:
1. Add mode renders with empty name field
2. Add mode Save calls onCreate with correct payload
3. Add mode Save with empty name shows "Name is required", does not call onCreate
4. Edit mode pre-fills form with item values
5. Edit mode changing only notes calls onUpdate with patch `{ notes: '...' }` only
6. Delete transitions to confirmation; Yes,delete calls onDelete + onClose
7. Delete then Cancel returns to Save+Delete footer without calling onDelete
8. Escape while dirty triggers confirm; onClose called on confirm=true
9. Save failure shows inline error; drawer stays open; onClose not called
10. Mode switch exact→status hides reorder_threshold input

### Inventory Page Changes

**`Inventory.jsx`**:
- Added `create`, `update`, `remove` to `useItems()` destructure
- Added `drawerState` state: `{ open: boolean, mode: 'add'|'edit', item: Item|null }`
- `openAdd()`: sets `drawerState` to add mode open
- `openEdit(item)`: sets `drawerState` to edit mode open with item
- FAB `onClick`, EmptyState `onCtaClick` → `openAdd`
- ItemRow/ItemCard `onOpen` → `openEdit(item)`
- Conditionally renders `<ItemDrawer>` when `drawerState.open`; passes `create`/`update`/`remove` from hook
- Removed all `window.__inventarAddClicked` and `window.__inventarRowClicked` references

**`Inventory.test.jsx`**:
- Added `renderInventory()` helper wrapping in `<MemoryRouter>` (required because ItemDrawer uses `useNavigate`)
- All render calls updated to use `renderInventory()`
- Removed `window.__inventarAddClicked` / `window.__inventarRowClicked` cleanup from afterEach
- Test 3 rewritten: asserts `role="dialog"` appears after CTA click (not window stub)
- New Test 7: clicking ItemRow opens drawer with Name input pre-filled to item name
- New Test 8: clicking X on clean form closes drawer without calling `window.confirm`

### Test Summary

| File | Tests | Status |
|------|-------|--------|
| ItemDrawer.test.jsx | 10 | All passing |
| Inventory.test.jsx | 8 | All passing |
| Full suite | 81 | 0 failed |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. The Plan 02-04 window stubs have been fully replaced. All ItemDrawer flows are wired to real `useItems` hook methods which hit live API endpoints.

---

## Threat Surface Review

Threat mitigations from plan threat model confirmed implemented:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-02-26: __manage value tampering | Explicit `=== '__manage'` string check in handleCategoryChange / handleLocationChange — no eval |
| T-02-27: XSS via item.name in delete confirm | JSX interpolation: `Delete {item.name}?` auto-escapes; no innerHTML |
| T-02-28: XSS via absoluteTime / last_updated_by_name | JSX expression children only; absoluteTime uses Intl/toLocale* |
| T-02-29: Focus trap preventing escape | Escape key always calls requestClose() — bypasses Tab trap |
| T-02-30: Extra fields sent to backend | buildCreatePayload / buildUpdatePatch construct whitelisted field sets only |
| T-02-31: Edit without audit trail | Drawer calls useItems.update → PATCH → backend Transaction insert (Plan 02-02) |

No new trust boundary surfaces beyond plan threat model.

---

## Self-Check

### Files exist:
- `frontend/src/components/ItemDrawer/ItemDrawer.jsx` — FOUND
- `frontend/src/components/ItemDrawer/ItemDrawer.module.css` — FOUND
- `frontend/src/components/ItemDrawer/ItemDrawer.test.jsx` — FOUND
- `frontend/src/pages/Inventory.jsx` — FOUND (modified)
- `frontend/src/pages/Inventory.test.jsx` — FOUND (modified)

### Commits:
- 78c4c87: feat(02-05): build ItemDrawer component with add/edit/delete flow
- d9f0ef5: feat(02-05): wire Inventory page to mount ItemDrawer, remove stub handlers

## Self-Check: PASSED
