# Phase 4: Shopping & Restock — Research

**Researched:** 2026-04-18
**Domain:** Shopping list management, drag-and-drop ordering, restock scan mode, Web Share API, in-app badge notifications
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Threshold field lives in the ItemDrawer — a new optional numeric field "Reorder at" added below the quantity field.
- **D-02:** Default threshold for all new items is 0 — items auto-appear on the shopping list only when quantity reaches 0 or status is "out". Users who want earlier alerts set a higher threshold manually.
- **D-03:** Items with no threshold set (null/blank) never auto-appear on the list. They can still be manually added.
- **D-04:** Simple flat list — no category grouping. Items ordered manually by the user.
- **D-05:** Drag-and-drop reordering — users can drag rows to set their own order. A persistent `sort_order` field per shopping list entry stores this. New auto-added items append to the bottom.
- **D-06:** Each row shows: item name + current quantity (e.g. "Milk — 0 left"). No category or location on the row.
- **D-07:** Check-off = tap checkbox → small quantity prompt — a compact bottom sheet or inline input asks "How many did you buy?" User enters quantity, taps Done. Inventory quantity is increased by that amount and the item is removed from the shopping list.
- **D-08:** If an item's threshold is set, restocking it to or above the threshold removes it from the list. If threshold is 0 (default), restocking with any quantity > 0 removes it.
- **D-09:** Manual add — a "+" button on the shopping list lets users search/pick any inventory item to add manually regardless of stock level.
- **D-10:** Empty state — when the list is empty: "Nothing to buy" with a subtle illustration or icon. No auto-redirect.
- **D-11:** Entry point: a "Start restocking" button on the shopping list page. Opens a dedicated restock scan session.
- **D-12:** Restock scan reuses `useBarcodeScanner` and `CameraOverlay` from Phase 3. A new `mode: 'restock'` parameter drives different post-scan behaviour.
- **D-13:** On successful barcode match: QuickUpdateSheet slides up showing item name + a "Quantity added" numeric input + Done button. Tapping Done adds the entered quantity to inventory and removes the item from the shopping list if stocked above threshold.
- **D-14:** On no barcode match: "Item not found" toast — brief, non-blocking. Camera re-opens automatically for next scan. No fallback to add-item flow.
- **D-15:** User exits restock mode via a visible "Done restocking" button or by tapping the back/close control on CameraOverlay.
- **D-16:** Low-stock alert surfaces as a count badge on the Shopping List nav item — shows the number of items currently at or below their threshold (or "out"). Updates reactively when inventory changes. No toasts, no notification bell, no push notifications.
- **D-17:** Share button triggers `navigator.share()` (Web Share API). On desktop or browsers without Web Share API support: falls back to copy to clipboard with a "Copied!" confirmation toast.
- **D-18:** Export format — simple checklist with header "Einkaufsliste", one bullet per item with current quantity.

### Claude's Discretion

- Drag-and-drop library choice (`@dnd-kit/core` — consistent with React ecosystem; or HTML5 drag events natively)
- Exact placement of "Start restocking" button vs FAB on the shopping list page
- Quantity prompt UI detail (inline input vs bottom sheet) for check-off, as long as it feels lightweight
- Toast library/component for "Item not found" and "Copied!" (can reuse existing pattern if one exists)

### Deferred Ideas (OUT OF SCOPE)

- Google Nest / Google Assistant voice integration — "Bitte X zur Einkaufsliste hinzufügen"
- Push notifications — alerting household members on their phones when stock drops

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | Items at or below their reorder threshold automatically appear on the shopping list | `reorder_threshold` already in `items` table and schemas; `shopping_list` table already exists in DB; auto-population logic is pure backend query + sync mechanism |
| SHOP-02 | User can manually add any item to the shopping list regardless of stock level | `added_manually` column already on `shopping_list` table; needs POST `/api/shopping-list/` endpoint and a search-and-pick UI on the frontend |
| SHOP-03 | User can check off items while shopping; checking off restocks the item to its reorder threshold | Requires new CheckOffSheet component + PATCH `/api/shopping-list/{id}/check-off` that increments item quantity and conditionally removes entry |
| SHOP-04 | User receives an alert (in-app notification) when an item drops below their reorder threshold | Implemented as a badge count on the Shopping List NavItem, derived from `items` data already fetched by `useItems`; NavItem needs an optional `badge` prop |
| SHOP-05 | User can export the shopping list as plain text to share via messaging apps | Web Share API (`navigator.share()`) with clipboard fallback; format defined in D-18 |
| RSTO-01 | App has a dedicated restock mode for scanning multiple items after a shopping trip | "Start restocking" button on ShoppingList page; reuses `useBarcodeScanner` with `mode: 'restock'` |
| RSTO-02 | In restock mode, scanning a barcode finds the existing item and prompts for quantity to add | `useBarcodeScanner` already handles local barcode matching; `mode: 'restock'` changes post-scan flow to quantity-add instead of quick-update |
| RSTO-03 | Restocked items are removed from the shopping list automatically | Remove-if-above-threshold logic on the PATCH quantity endpoint; same as SHOP-03 threshold check |

</phase_requirements>

---

## Summary

Phase 4 builds on a strong, already-deployed foundation. The database schema (`shopping_list` table, `reorder_threshold` on items, `sort_order` missing) and all Phase 3 reusable components (QuickUpdateSheet, useBarcodeScanner, CameraOverlay) are verified in the codebase. The implementation work divides into three tracks: (1) backend shopping list API (CRUD for shopping list entries, auto-population logic, check-off endpoint), (2) frontend ShoppingList page (full replacement of stub, drag-and-drop, CheckOffSheet, badge), and (3) extensions to existing components (NavItem badge, ItemDrawer threshold field already present, useBarcodeScanner restock mode).

The schema already has `shopping_list.item_id`, `added_manually`, `checked_off`, and `created_at`, but is **missing `sort_order`** — a new Alembic migration is required. The `reorder_threshold` column already exists on `items` and `ItemDrawer` already renders it, so no ItemDrawer backend change is needed. The `ShoppingList.jsx` file is a stub (5 lines) ready to be replaced.

The UI-SPEC (04-UI-SPEC.md) is fully approved and specifies `@dnd-kit/core` + `@dnd-kit/sortable` as the drag-and-drop library. Both npm packages are available at stable versions (6.3.1 and 10.0.0 respectively). All 142 frontend tests and 81 backend tests pass green at the start of this phase.

**Primary recommendation:** Implement in three backend-first waves: (W1) DB migration + shopping list API; (W2) ShoppingList page + CheckOffSheet + badge; (W3) restock scan mode + share export.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives | React-first DnD; no DOM mutation issues; pointer + touch + keyboard events; actively maintained |
| @dnd-kit/sortable | 10.0.0 | Sortable list higher-level API | Built on @dnd-kit/core; provides `useSortable`, `SortableContext`, `arrayMove` out of the box |
| Web Share API (native) | — | Share shopping list via OS share sheet | Built into modern browsers (iOS Safari, Android Chrome, desktop Chrome/Edge); no library needed |
| navigator.clipboard (native) | — | Clipboard fallback for share | Available in all modern browsers under HTTPS (guaranteed by HA ingress) |

[VERIFIED: npm registry] — @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0 confirmed via `npm view`

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.511.0 (existing) | GripVertical, Trash2, Share2, ShoppingCart icons | All new icons come from existing lucide-react installation |
| vitest | 3.2.4 (existing) | Frontend unit tests | All new component tests |
| @testing-library/react | 16.3.0 (existing) | Component rendering in tests | Same pattern as all prior phases |
| pytest | existing | Backend API tests for shopping-list router | Same pattern as items, categories, locations routers |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core + sortable | HTML5 drag events (native) | Native HTML5 drag events have no touch support on mobile without additional polyfill; @dnd-kit handles iOS/Android touch natively |
| @dnd-kit/core + sortable | react-beautiful-dnd | react-beautiful-dnd is in maintenance-only mode (no new features, many open issues); @dnd-kit is the community-recommended successor |
| navigator.share() | Third-party share library | Web Share API is now supported in 95%+ of target browsers (iOS Safari 15+, Chrome 93+); no library needed |

**Installation (new packages only):**
```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable
```

[VERIFIED: npm registry] — versions confirmed, both packages publish ESM-first builds compatible with Vite 8

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
frontend/src/
├── components/
│   ├── ShoppingListRow/
│   │   ├── ShoppingListRow.jsx          # Row with drag handle, checkbox, name+qty, remove
│   │   ├── ShoppingListRow.module.css
│   │   └── ShoppingListRow.test.jsx
│   └── CheckOffSheet/
│       ├── CheckOffSheet.jsx            # Bottom sheet: "How many did you buy?"
│       ├── CheckOffSheet.module.css
│       └── CheckOffSheet.test.jsx
├── hooks/
│   └── useShoppingList.js              # CRUD + auto-population derived from items
└── pages/
    └── ShoppingList.jsx                # Full replacement of stub

backend/
├── alembic/versions/
│   └── 0004_add_sort_order_to_shopping_list.py
├── routers/
│   └── shopping_list.py               # New router: /api/shopping-list/
├── schemas/
│   └── shopping_list.py               # Request/response schemas
└── tests/
    └── test_shopping_list.py
```

### Pattern 1: Shopping List Auto-Population Strategy

**What:** The shopping list combines two sources — auto-entries (items below threshold) and manually-added entries from the `shopping_list` DB table.

**When to use:** Always — this is the core SHOP-01 mechanic.

The simplest approach that avoids complex sync issues: the backend `GET /api/shopping-list/` endpoint returns a unified list by JOINing `shopping_list` entries with `items`, plus computing which items are below threshold and not already in the list. The frontend calls this single endpoint rather than computing auto-entries client-side.

**Threshold check logic (backend):**
```python
# Source: CONTEXT.md D-02, D-03, D-08 — [VERIFIED: codebase]
# Auto-include item if:
#   (a) threshold IS NOT NULL AND quantity_mode='exact' AND quantity <= threshold, OR
#   (b) quantity_mode='status' AND status='out'
# Items with threshold=NULL never auto-appear.
```

**Important:** Items that are already in the `shopping_list` table (manually added or previously auto-added) must not be duplicated. The GET endpoint handles deduplication server-side.

### Pattern 2: sort_order on Shopping List Entries

**What:** The `shopping_list` table needs a `sort_order` INTEGER column (nullable, default NULL → new entries get highest order + 1).

**Database:** Alembic migration 0004 adds `sort_order INTEGER` to `shopping_list`. New rows inserted at end (max sort_order + 1). PATCH updates sort_order on drag-end.

**Frontend:** `@dnd-kit/sortable` with `SortableContext` + `arrayMove`. On `onDragEnd`, compute new sort_order values (1-based) and fire `PATCH /api/shopping-list/{id}` for the moved item. Optimistic update in `useShoppingList` state.

```jsx
// Source: @dnd-kit/sortable docs — [ASSUMED: training knowledge, verify with @dnd-kit docs]
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function ShoppingListPage() {
  const [items, setItems] = useState(listEntries)

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(i => i.id === active.id)
        const newIndex = prev.findIndex(i => i.id === over.id)
        const reordered = arrayMove(prev, oldIndex, newIndex)
        // Fire PATCH for the moved item only
        patchSortOrder(active.id, newIndex + 1)
        return reordered
      })
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(entry => <ShoppingListRow key={entry.id} entry={entry} />)}
      </SortableContext>
    </DndContext>
  )
}
```

### Pattern 3: useBarcodeScanner `mode: 'restock'` Extension

**What:** The existing hook is extended with an optional `mode` parameter. When `mode === 'restock'`, the `scanState` 'matched' outcome skips the ItemDrawer/prefill paths and goes straight to a quantity-add flow.

**Key difference from normal scan:** In restock mode, no barcode match → toast ("Item not found") + camera re-opens automatically. No fallback to ItemDrawer. The hook's `fallback` and `prefill` states are unused in restock mode.

```javascript
// Source: useBarcodeScanner.js — [VERIFIED: codebase read]
// Extension: add mode param, change handleDetected for restock path
export function useBarcodeScanner({ items, mode = 'inventory' }) {
  // ... existing state ...
  const [restockMode, setRestockMode] = useState(false)

  const handleDetected = useCallback(async (rawValue) => {
    if (mode === 'restock') {
      const existing = items.find((i) => i.barcode === rawValue)
      if (existing) {
        setMatchedItem(existing)
        setScanState('matched')
        setIsOpen(false)
        return
      }
      // No match in restock mode: show toast, re-open camera
      setScanState('not_found')
      // caller handles toast + re-open
      return
    }
    // ... existing inventory mode logic unchanged ...
  }, [items, mode])
}
```

### Pattern 4: Nav Badge on NavItem

**What:** `NavItem` receives an optional `badge` prop (number). Renders a `<span>` pill absolutely positioned top-right of the icon.

**Source:** [VERIFIED: codebase] — `NavItem.jsx` currently renders icon + label only. The `AppLayout.jsx` renders NavItem for Shopping List with no badge prop. Extension:

```jsx
// NavItem.jsx extension — [VERIFIED: codebase read]
export default function NavItem({ to, end, icon: Icon, label, badge }) {
  return (
    <li className={styles.li}>
      <NavLink ...>
        <span className={styles.iconWrapper}>
          <Icon size={20} aria-hidden="true" className={styles.icon} />
          {badge > 0 && (
            <span className={styles.badge} aria-label={`${badge} items to buy`}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        <span className={styles.label}>{label}</span>
      </NavLink>
    </li>
  )
}
```

**Badge count derivation:** Computed in `AppLayout.jsx` from items already fetched by `useItems()`:
```javascript
// [VERIFIED: codebase] — useItems already called in Inventory.jsx; AppLayout needs it too
// OR: pass badge count down as a prop from the page that owns items
const lowStockCount = items.filter(item =>
  (item.quantity_mode === 'exact' &&
   item.reorder_threshold !== null &&
   item.quantity !== null &&
   item.quantity <= item.reorder_threshold) ||
  (item.quantity_mode === 'status' && item.status === 'out')
).length
```

**Architectural note:** `useItems` is currently called per-page. For the badge to work in AppLayout, either: (a) lift `useItems` up to AppLayout and pass items down via props/context, or (b) call `useItems` again in AppLayout (causes a second API fetch). Option (a) is preferred — avoids double fetch, badge stays in sync with all pages.

### Pattern 5: Check-Off → Restock Threshold Check

**What:** When user confirms "how many did you buy", the backend must:
1. PATCH item quantity: `new_quantity = item.quantity + bought_quantity`
2. Remove from shopping list if `new_quantity > item.reorder_threshold` (or threshold is 0 and any quantity > 0 was added)

**Backend endpoint:** `POST /api/shopping-list/{id}/check-off` body: `{ "quantity_added": N }`

This endpoint is atomic: increments item quantity AND removes shopping list entry in one transaction.

### Pattern 6: Web Share API with Clipboard Fallback

```javascript
// Source: MDN Web Docs — [ASSUMED: training knowledge; Web Share API is stable]
async function shareList(entries) {
  const text = formatShareText(entries) // builds "Einkaufsliste\n\n• Milk (0 left)\n..."

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Einkaufsliste', text })
    } catch (e) {
      // User cancelled share — not an error worth showing
      if (e.name !== 'AbortError') throw e
    }
  } else {
    // Fallback: clipboard
    await navigator.clipboard.writeText(text)
    showToast('Copied!')
  }
}
```

**HTTPS note:** `navigator.clipboard` requires a secure context. HA ingress guarantees HTTPS — no special handling needed. [VERIFIED: STATE.md critical constraints]

### Anti-Patterns to Avoid

- **Deriving auto-shopping-list entries client-side only:** If the frontend computes which items auto-appear without syncing to the DB, the auto-entries won't have `sort_order` or proper identity (IDs) for drag-and-drop reordering. Auto-entries must be materialized in the DB.
- **Calling useItems in both AppLayout and ShoppingList page:** Results in two parallel fetch loops and badge count out of sync with the page. Lift useItems to AppLayout.
- **Modifying QuickUpdateSheet for restock mode:** The UI-SPEC explicitly says QuickUpdateSheet is reused unchanged. The `mode` flag lives in `useBarcodeScanner`, not in the component itself.
- **Using `sort_order` as a floating point "between" scheme:** Use integer positions; on re-order, recompute all sort_order values from 1..N. Avoids floating point drift (the "1.5, 1.75, 1.875…" trap).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop sortable list | Custom mousedown/touchstart handlers with coordinates | @dnd-kit/core + @dnd-kit/sortable | Touch events on iOS require passive listeners, drag image rendering, pointer capture, keyboard accessibility — hundreds of edge cases already solved |
| OS-level share sheet | iframe share widget, email links | `navigator.share()` | Native OS share sheet includes all messaging apps; zero maintenance |
| Clipboard copy | `document.execCommand('copy')` | `navigator.clipboard.writeText()` | `execCommand` is deprecated; `navigator.clipboard` is the standard |
| Sort order "gap" approach | floating-point midpoints | integer recompute on all N items | Household list is ≤100 items; recomputing all N sort_order values in one PATCH batch is fine |

**Key insight:** The shopping list domain is where "simple" custom implementations accumulate invisible complexity: touch drag, sort persistence, share sheet differences between iOS/Android/desktop. Use platform APIs and established libraries.

---

## Common Pitfalls

### Pitfall 1: shopping_list Table Missing sort_order

**What goes wrong:** The existing `shopping_list` table (from migration 0001) has no `sort_order` column. Any plan that skips this migration will fail when drag-and-drop tries to PATCH sort_order.

**Why it happens:** The v1 schema was created in Phase 1 without sort_order because drag-and-drop was not scoped until Phase 4.

**How to avoid:** Migration 0004 must be the first task in Wave 1 of any plan. Add `sort_order INTEGER` nullable column, default NULL. On first fetch, backend assigns sort_order values 1..N to existing rows.

**Warning signs:** Frontend drag-and-drop sends `sort_order` in PATCH body → backend returns 422 because column doesn't exist.

### Pitfall 2: Duplicate Shopping List Entries

**What goes wrong:** An item at threshold=0 with quantity=0 auto-appears on the list. User also manually adds the same item. Now it appears twice.

**Why it happens:** Auto-population and manual-add are independent insertion paths without deduplication.

**How to avoid:** The `shopping_list` table should have a UNIQUE constraint on `item_id` (only one entry per item at any time). Backend POST `/api/shopping-list/` checks for existing entry before inserting. Auto-population sync also checks for duplicates.

**Warning signs:** User sees the same item twice; check-off only removes one copy.

### Pitfall 3: useItems Called in AppLayout Causes Double Fetch

**What goes wrong:** AppLayout calls `useItems()` for badge count. ShoppingList page also calls `useItems()`. Two parallel polling loops; badge count can briefly differ from page count.

**Why it happens:** `useItems` is a hook that makes its own fetch; calling it in two components means two fetches.

**How to avoid:** Lift `useItems` to `AppLayout` and pass `items` as a prop to both Inventory page and ShoppingList page, OR create a React context for items. The simplest approach: pass `lowStockCount` and `items`/`refetch` as props from AppLayout into `<main>` children via `React.cloneElement` or a context provider.

**Warning signs:** Network tab shows two simultaneous `GET /api/items/` calls on every render.

### Pitfall 4: useBarcodeScanner State Machine Breaks With mode='restock'

**What goes wrong:** In restock mode, `scanState='not_found'` is a new state that doesn't exist in the current hook. Callers that handle `scanState` exhaustively (switch/if-else) break or produce unexpected UI.

**Why it happens:** The original hook has states: `idle | looking_up | matched | prefill | fallback`. Adding `not_found` without updating all callers causes stale branches.

**How to avoid:** The hook already has a `reset()` function. In restock mode on no-match, set `scanState='idle'` and set a separate `restockNoMatch: boolean` flag that the ShoppingList page reads for the toast. This avoids adding a new state value to the public contract.

### Pitfall 5: Auto-Population Timing Race — Items Update, Badge Stale

**What goes wrong:** User decrements item to 0 on Inventory page. Badge on nav should increment. But if badge derives from a stale `items` list in AppLayout, it won't update until next re-render.

**Why it happens:** `useItems` fetches on mount; mutations in child components call `update()` which updates local state in the hook, but AppLayout's copy is separate if useItems is called in multiple places.

**How to avoid:** Single `useItems` instance lifted to AppLayout, passed down. All mutations go through the shared hook; badge count re-derives reactively.

### Pitfall 6: Check-Off Removes Item When Threshold Not Met

**What goes wrong:** User bought 1 unit of milk (threshold=5). Post check-off, milk has quantity=1 but threshold=5 → should stay on list. If backend removes unconditionally after any check-off, the item disappears.

**Why it happens:** D-08 logic is subtle: "if threshold is set, restocking to or above threshold removes it from the list."

**How to avoid:** Backend check-off logic must be: `remove_if = (new_quantity >= threshold) OR (threshold == 0 AND bought_quantity > 0)`. Only remove from list when truly restocked above threshold. Otherwise update item quantity and leave entry on list.

---

## Code Examples

Verified patterns from codebase inspection:

### Backend Shopping List Router Structure

```python
# Source: backend/routers/items.py pattern — [VERIFIED: codebase read]
# New file: backend/routers/shopping_list.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from db.database import get_db
from models import ShoppingListEntry, Item

router = APIRouter(prefix="/api/shopping-list", tags=["shopping-list"])

@router.get("/")
def get_shopping_list(db: Session = Depends(get_db)):
    # Returns entries + auto-computed items below threshold
    # Deduplicates: if item already in shopping_list, use that entry
    ...

@router.post("/")
def add_to_list(body: ShoppingListCreate, db: Session = Depends(get_db)):
    # Check for existing entry (prevent duplicates)
    existing = db.query(ShoppingListEntry).filter(
        ShoppingListEntry.item_id == body.item_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Item already on shopping list")
    ...

@router.delete("/{entry_id}")
def remove_from_list(entry_id: int, db: Session = Depends(get_db)):
    ...

@router.patch("/{entry_id}")
def update_entry(entry_id: int, body: ShoppingListUpdate, db: Session = Depends(get_db)):
    # Used for sort_order update on drag-end
    ...

@router.post("/{entry_id}/check-off")
def check_off_item(entry_id: int, body: CheckOffBody, request: Request, db: Session = Depends(get_db)):
    # Atomic: increment item.quantity + conditionally remove entry
    ...
```

### Alembic Migration 0004 Pattern

```python
# Source: backend/alembic/versions/0001_initial_v1_schema.py pattern — [VERIFIED: codebase read]
def upgrade() -> None:
    with op.batch_alter_table('shopping_list', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('sort_order', sa.Integer(), nullable=True)
        )
    # Assign initial sort_order values to existing rows
    op.execute(
        """
        UPDATE shopping_list
        SET sort_order = id  -- uses insertion order as initial sort
        WHERE sort_order IS NULL
        """
    )

def downgrade() -> None:
    with op.batch_alter_table('shopping_list', schema=None) as batch_op:
        batch_op.drop_column('sort_order')
```

Note: SQLite requires `batch_alter_table` for all column additions — [VERIFIED: codebase, all prior migrations use this pattern].

### Existing ShoppingListEntry ORM (already deployed)

```python
# Source: backend/models/__init__.py — [VERIFIED: codebase read]
class ShoppingListEntry(Base):
    __tablename__ = "shopping_list"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    added_manually = Column(Boolean, nullable=False, default=False)
    checked_off = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    # MISSING: sort_order — added by migration 0004
```

### useBarcodeScanner Current Signature

```javascript
// Source: frontend/src/hooks/useBarcodeScanner.js — [VERIFIED: codebase read]
export function useBarcodeScanner({ items }) {
  // Returns: { isOpen, openScanner, closeScanner, handleDetected,
  //            scanState, matchedItem, prefillProduct, fallbackBarcode, reset }
  // scanState values: 'idle' | 'looking_up' | 'matched' | 'prefill' | 'fallback'
}
// Phase 4 extension: add mode param ('inventory' | 'restock')
// In restock mode: no looking_up/prefill/fallback paths; on no-match set restockNoMatch flag
```

### QuickUpdateSheet Current Props

```javascript
// Source: frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx — [VERIFIED: codebase read]
// Props: { item, locationName, onIncrement, onDecrement, onDone, onEditItem, onClose }
// Reused UNCHANGED in restock mode (D-13).
// The "Quantity added" label change mentioned in CONTEXT.md D-13 is a UX description,
// not a prop change — the component shows the item name and existing QuantityControls.
// The restock flow uses onIncrement/onDecrement/onDone identically to normal scan flow,
// but onDone triggers "add quantity to inventory AND remove from shopping list" instead
// of just saving quantity.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core + sortable | 2021–2022 | react-beautiful-dnd is maintenance-only; @dnd-kit has no peer dependency on React version and works with React 19 |
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | ~2018 | execCommand deprecated; clipboard API requires HTTPS (provided by HA ingress) |
| Web Share API level 1 (no files) | Web Share API level 2 (files supported) | ~2020 | Phase 4 only needs text share; level 1 is sufficient and universally supported |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Maintenance-only, does not support React 19 concurrent features. Use @dnd-kit instead.
- `document.execCommand('copy')`: Deprecated in all major browsers. Use `navigator.clipboard`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/sortable` useSortable + SortableContext API works as shown in Pattern 2 | Architecture Patterns | Code example may need adjustment; low risk — the pattern is the canonical @dnd-kit usage |
| A2 | Web Share API `navigator.share()` is available on iOS Safari 15+ and Android Chrome 93+ | Pattern 6 | If iOS < 15 is in scope, clipboard fallback must be the primary path; the fallback is already planned so risk is low |
| A3 | `navigator.clipboard.writeText()` works under HA ingress HTTPS without additional permissions | Pattern 6 | HA ingress provides HTTPS; clipboard API requires secure context only, not additional permissions |

**Low-risk assumptions:** All three are either covered by the planned fallback (A2, A3) or low-impact API shape (A1).

---

## Open Questions

1. **Auto-population: push-based vs pull-based**
   - What we know: Backend can compute auto-entries at query time (items below threshold not already in shopping_list table)
   - What's unclear: Should auto-entries be materialized into the shopping_list table on item update (push), or computed on every GET (pull)?
   - Recommendation: Pull-based (compute on GET). Simpler — no need for a trigger or background job. At household scale, joining items + shopping_list on every GET is trivially fast. Avoids stale auto-entries after threshold changes.

2. **useItems lifting: AppLayout vs Context**
   - What we know: Badge count needs items data. Currently `useItems` is per-page.
   - What's unclear: Whether lifting to AppLayout breaks the existing Inventory page test setup (which renders `<App>` directly).
   - Recommendation: Lift `useItems` to AppLayout and pass `items`, `loading`, `refetch` via props. Inventory page and ShoppingList page both receive them. AppLayout tests mock `useItems`. Existing Inventory tests may need minor updates.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Frontend build + @dnd-kit install | ✓ | (npm 10+ confirmed — package.json present) | — |
| Python 3.13 | Backend Alembic migration + new router | ✓ | 3.13.13 | — |
| @dnd-kit/core | Drag-and-drop | Not yet installed (not in package.json) | 6.3.1 available | — |
| @dnd-kit/sortable | Drag-and-drop list | Not yet installed | 10.0.0 available | — |
| Web Share API | SHOP-05 share | Available (browser API, HTTPS guaranteed) | Native | clipboard fallback |
| Vitest 3.2.4 | Frontend tests | ✓ | 3.2.4 | — |
| pytest | Backend tests | ✓ | present (81 tests passing) | — |

**Missing dependencies with no fallback:**
- `@dnd-kit/core` + `@dnd-kit/sortable` must be installed before Wave 2 drag-and-drop implementation. Install command: `cd frontend && npm install @dnd-kit/core @dnd-kit/sortable`

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Frontend Framework | Vitest 3.2.4 + @testing-library/react 16.3.0 |
| Frontend Config | `frontend/vitest.config.js` |
| Frontend Quick run | `cd frontend && npm test` |
| Frontend Full suite | `cd frontend && npm test` (runs all 142 tests) |
| Backend Framework | pytest (81 tests) |
| Backend Config | `backend/pytest.ini` |
| Backend Quick run | `cd backend && python -m pytest tests/test_shopping_list.py -x` |
| Backend Full suite | `cd backend && python -m pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-01 | Items below threshold appear in GET /api/shopping-list/ | unit | `pytest tests/test_shopping_list.py::test_auto_populated_items -x` | ❌ Wave 0 |
| SHOP-01 | Items with null threshold do NOT auto-appear | unit | `pytest tests/test_shopping_list.py::test_null_threshold_not_auto_populated -x` | ❌ Wave 0 |
| SHOP-02 | POST /api/shopping-list/ adds item manually | unit | `pytest tests/test_shopping_list.py::test_manual_add -x` | ❌ Wave 0 |
| SHOP-02 | Duplicate manual add returns 409 | unit | `pytest tests/test_shopping_list.py::test_duplicate_add_returns_409 -x` | ❌ Wave 0 |
| SHOP-03 | Check-off increments quantity and removes entry when above threshold | unit | `pytest tests/test_shopping_list.py::test_check_off_removes_when_above_threshold -x` | ❌ Wave 0 |
| SHOP-03 | Check-off leaves entry when below threshold after restock | unit | `pytest tests/test_shopping_list.py::test_check_off_keeps_when_below_threshold -x` | ❌ Wave 0 |
| SHOP-04 | Badge count derived from items in useItems / AppLayout | unit (frontend) | `cd frontend && npm test src/layout/AppLayout.test.jsx` | ❌ Wave 0 |
| SHOP-05 | Share text format matches D-18 spec | unit (frontend) | `cd frontend && npm test src/pages/ShoppingList.test.jsx` | ❌ Wave 0 |
| RSTO-01 | "Start restocking" renders and opens restock scan mode | unit (frontend) | `cd frontend && npm test src/pages/ShoppingList.test.jsx` | ❌ Wave 0 |
| RSTO-02 | useBarcodeScanner mode=restock: match → QuickUpdateSheet | unit (frontend) | `cd frontend && npm test src/hooks/useBarcodeScanner.test.js` | ❌ Wave 0 (extend existing) |
| RSTO-03 | Restocked item removed from list when above threshold | unit (backend) | `pytest tests/test_shopping_list.py::test_restock_removes_from_list -x` | ❌ Wave 0 |
| SHOP-05 | sort_order column exists after migration 0004 | migration test | `pytest tests/test_shopping_list_migration.py -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/test_shopping_list.py` AND `cd frontend && npm test src/hooks/useBarcodeScanner.test.js src/pages/ShoppingList.test.jsx`
- **Per wave merge:** Full suite both backend and frontend
- **Phase gate:** All 81 backend tests + all 142+ frontend tests green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_shopping_list.py` — covers all SHOP-01 through RSTO-03 backend tests
- [ ] `frontend/src/components/ShoppingListRow/ShoppingListRow.test.jsx` — row rendering, drag handle, checkbox, remove
- [ ] `frontend/src/components/CheckOffSheet/CheckOffSheet.test.jsx` — sheet rendering, stepper, save/dismiss
- [ ] `frontend/src/pages/ShoppingList.test.jsx` — page rendering, share format, restock entry point, empty state

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | HA ingress handles auth (established Phase 1) |
| V3 Session Management | no | Stateless HA ingress session (established Phase 1) |
| V4 Access Control | no | Single household, HA identity used (established Phase 2) |
| V5 Input Validation | yes | Pydantic v2 schemas with `extra='forbid'`; numeric fields validated server-side |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass assignment via unknown fields in shopping list PATCH | Tampering | `extra='forbid'` on all Pydantic schemas (established pattern) |
| Negative quantity injection in check-off body | Tampering | Pydantic `Field(gt=0)` on `quantity_added` in CheckOffBody schema |
| Integer overflow on sort_order PATCH | Tampering | Pydantic `Field(ge=1, le=10000)` on sort_order updates |
| SQLi via ORM attribute assignment | Tampering | ORM attribute assignment only — never raw SQL (established constraint from items router) |

---

## Sources

### Primary (HIGH confidence)

- Codebase read: `backend/models/__init__.py` — confirmed ShoppingListEntry schema, reorder_threshold on Item
- Codebase read: `backend/alembic/versions/0001_initial_v1_schema.py` — confirmed shopping_list table columns, missing sort_order
- Codebase read: `backend/routers/items.py` — confirmed router pattern for new shopping_list router
- Codebase read: `frontend/src/hooks/useBarcodeScanner.js` — confirmed current hook signature and state machine
- Codebase read: `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.jsx` — confirmed props, z-index, reuse strategy
- Codebase read: `frontend/src/layout/AppLayout.jsx` + `NavItem.jsx` — confirmed badge extension point
- Codebase read: `frontend/src/components/ItemDrawer/ItemDrawer.jsx` — confirmed reorderThreshold already in form, buildCreatePayload, buildUpdatePatch
- Codebase read: `frontend/package.json` — confirmed exact dependency versions
- npm registry: @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0 — confirmed via `npm view`
- Test run: `cd backend && python -m pytest` → 81 passed; `cd frontend && npm test` → 142 passed

### Secondary (MEDIUM confidence)

- UI-SPEC `.planning/phases/04-shopping-restock/04-UI-SPEC.md` — confirmed @dnd-kit selection, component list, z-index map, all interaction states

### Tertiary (LOW confidence)

- @dnd-kit/sortable code example in Pattern 2 — shape of `useSortable` + `SortableContext` API is from training knowledge; verify against official @dnd-kit docs when implementing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirmed versions, existing codebase dependencies verified
- Architecture patterns: HIGH — all patterns derived from reading actual source files; useBarcodeScanner, QuickUpdateSheet, ItemDrawer, models all verified
- Pitfalls: HIGH — Pitfalls 1–3 directly verified by reading code; Pitfalls 4–6 derived from code logic
- DB schema: HIGH — migration 0001 read directly; sort_order gap confirmed

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (stable stack, no fast-moving dependencies)
