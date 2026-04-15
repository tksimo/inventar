# Phase 2: Core Inventory — Research

**Researched:** 2026-04-15
**Domain:** FastAPI REST API (CRUD), React state management, CSS Modules, optimistic UI
**Confidence:** HIGH — all material verified against existing codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Inventory List Layout — Responsive grouped list / card grid**
- Mobile (< 768px): Items grouped by category with a section header per group. Dense list rows showing name + location + quantity status. Optimized for "standing in a room, scanning what's there."
- Desktop (≥ 768px): Automatic switch to a card grid (2–3 columns), still grouped by category. No user toggle — purely responsive.
- Breakpoint: ~768px (standard md breakpoint).

**D-02: Add/Edit Flow — Slide-in drawer**
- Adding a new item and editing an existing item both open a slide-in drawer from the right.
- The inventory list remains visible behind the drawer.
- Single drawer component handles both add and edit (controlled by whether an item ID is passed).
- No full-page form routes, no modal dialogs.

**D-03: Quick Quantity Controls — Always visible, auto-flip, 3-state toggle**
- Exact-count items: +/− buttons always visible on the row/card. No tap-to-reveal.
- At zero: Hitting − at 0 automatically flips the item to "Out" status (bridges QTY-01 and QTY-02 naturally). No confirmation prompt. − button is not disabled at 0.
- Status-mode items (have/low/out): Replace +/− with a 3-state tap-cycle toggle (Have → Low → Out → Have). One tap cycles to next state. Consistent with QTY-04 "single tap without opening the form" requirement.

**D-04: Categories and Locations Management — Settings screen only**
- Custom category create/rename/delete lives in `/settings` only (ORG-02, ORG-04).
- Custom location create/rename/delete lives in `/settings` only.
- No inline "create new" in the item drawer — user goes to Settings first, then returns to add the item.
- Default categories ship pre-loaded: Food & pantry, Fridge & freezer, Cleaning & household, Personal care (ORG-01).

**D-05: Filtering and Search — Search header + filter chips**
- Search input always visible in the inventory page header. Filters items by name in real time.
- Active filters display as dismissible chips below the search input.
- Category and location filters are applied by tapping chips from a dropdown/picker, not inline dropdowns.
- No collapsed/expandable filter bar — zero interaction to access search.
- Chips are independent — category and location filters can be combined.

**D-06: User Attribution — Subtle row text + drawer detail**
- Inventory list row/card: Small secondary text "Updated by [HA username] · [relative time]".
- Edit drawer: Full attribution at the bottom "Last modified by [HA username] on [absolute date/time]".
- Source: `X-Ingress-Remote-User-Name` header (already read by `IngressUserMiddleware`).
- No dedicated activity log in Phase 2.

### Carried-Forward Constraints (from Phase 1)
- `apiFetch(path)` is the **only** correct way to call the backend — never `fetch('/path')`. Paths must be relative (no leading `/`).
- CSS Modules for all component styles — no inline styles, no Tailwind.
- Design tokens from `frontend/src/index.css` — use `--color-*`, `--space-*`, `--font-*` custom properties. Do not hardcode colors or spacing.
- All 5 DB tables already exist (`items`, `categories`, `locations`, `transactions`, `shopping_list`) — Phase 2 adds rows, not schema changes (Alembic migration only if column additions are needed).
- `INVENTAR_DB_URL` env var controls DB path in tests — conftest.py sets it before any import.
- `INVENTAR_SKIP_SPA=1` in unit tests — never remove this from conftest.

### Deferred Ideas (OUT OF SCOPE)

_(None raised during discussion — no deferred items.)_
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITEM-03 | User can add an item manually (name, category, location, quantity, threshold, notes) | POST /api/items endpoint; ItemDrawer add-mode form; categories/locations populated from GET /api/categories, /api/locations |
| ITEM-04 | User can edit any field of an existing item | PATCH /api/items/{id} endpoint; ItemDrawer edit-mode form pre-filled from item data |
| ITEM-05 | User can delete or archive an item | DELETE /api/items/{id} endpoint; inline confirmation in drawer footer; `archived` column already in Item model |
| ITEM-06 | Each item has an optional free-text notes field | `notes` column already in Item model; textarea in ItemDrawer form |
| QTY-01 | Each item can track an exact count | `quantity_mode=EXACT` + `quantity` Float column exist; Exact variant of QuantityControls component |
| QTY-02 | Each item can use a status mode: Have / Running low / Out | `quantity_mode=STATUS` + `status` StockStatus enum exist; Status variant of QuantityControls component |
| QTY-03 | User can set a reorder threshold per item | `reorder_threshold` Float column exists; shown in drawer form (exact mode only per D-03) |
| QTY-04 | User can increment or decrement quantity with quick +1/-1 buttons without opening edit form | PATCH /api/items/{id} for optimistic quantity update; D-03 specifies always-visible controls and auto-flip |
| ORG-01 | Items organised into default categories | Seed data: 4 default categories in DB migration or startup seed; `is_default` flag needed (or hardcoded check) |
| ORG-02 | User can create custom categories | POST /api/categories endpoint; Settings page add-category form |
| ORG-03 | Each item has an assigned storage location | `location_id` FK in Item model exists; Location select in ItemDrawer form |
| ORG-04 | User can create, rename, and delete storage locations | POST/PATCH/DELETE /api/locations endpoints; Settings page location management |
| ORG-05 | User can filter and search inventory by storage location | Client-side filter by location_id; active filter chip with dismissible × |
| ORG-06 | User can filter and search inventory by category | Client-side filter by category_id; active filter chip with dismissible × |
| USER-01 | 2–3 household members share one inventory with no separate accounts | HA ingress auth already in place; no per-user data partitioning needed |
| USER-02 | Each inventory change records which HA user made it and when | Transaction INSERT on every item change; `ha_user_name` and `ha_user_id` from `request.state.user`; `updated_at` on Item updated by ORM |
| USER-03 | All household members see inventory updates on next page load | No WebSocket needed — full refetch on mount satisfies "near real time on refresh" |
</phase_requirements>

---

## Summary

Phase 2 is a well-defined CRUD build on top of a complete foundation. Phase 1 delivered all 5 DB tables, the ORM schema, QuantityMode/StockStatus enums, IngressUserMiddleware, and the React SPA shell. Phase 2 adds no new infrastructure — it wires existing schema to REST endpoints and replaces stub page components with real UI.

The backend work is a standard FastAPI pattern: add `backend/routers/items.py`, `categories.py`, and `locations.py` with Pydantic schemas and `get_db` dependency injection. The only non-obvious backend concern is the Transaction append-only constraint: every item mutation (create, update, delete, quantity change) must INSERT a transaction row — never UPDATE or DELETE transactions.

The frontend work is the larger surface: the Inventory page, ItemDrawer, QuantityControls, FilterChip, Settings page, and several supporting components (CategorySectionHeader, EmptyState, LoadingState, ErrorState). The UI-SPEC fully specifies all visual and interaction details. The most complex frontend pattern is optimistic UI for quantity controls — update local state immediately, revert on API error. Client-side filtering and search (no API call on filter/search, full list loaded on mount) simplifies the data-fetching model.

The default category seeding (ORG-01) requires one decision: seed via Alembic data migration or via startup code. A data migration is more reliable for production (runs once at upgrade time) and is the recommended approach.

**Primary recommendation:** Build backend routers first (API contract established), then implement frontend components top-down: data-fetching hooks → InventoryPage → ItemDrawer → QuantityControls → FilterChip → Settings page.

---

## Standard Stack

### Core (already installed — no new packages required)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| fastapi | 0.135.3 | REST API routing and request handling | Already installed [VERIFIED: backend/requirements.txt] |
| pydantic | 2.11.9 | Request/response schema validation | Already installed [VERIFIED: backend/requirements.txt] |
| sqlalchemy | 2.0.49 | ORM, session management, query builder | Already installed [VERIFIED: backend/requirements.txt] |
| alembic | 1.18.4 | DB migrations (used for default category seed migration) | Already installed [VERIFIED: backend/requirements.txt] |
| react | 19.2.5 | Component-based UI | Already installed [VERIFIED: frontend/package.json] |
| lucide-react | 0.511.0 | Icons (Plus, X, Package, AlertCircle, SlidersHorizontal, Pencil, Trash2, Check) | Already installed [VERIFIED: frontend/package.json] |

### No New npm or pip Packages Required

The UI-SPEC Registry Safety section explicitly confirms: "No new npm packages required for Phase 2 UI. All UI built from React + CSS Modules + existing lucide-react." [VERIFIED: 02-UI-SPEC.md §Registry Safety]

The backend requires no new packages: all necessary libraries (FastAPI, Pydantic, SQLAlchemy) are already installed. [VERIFIED: backend/requirements.txt]

**Installation:** None — all packages already present.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
backend/
├── routers/
│   ├── health.py          (exists — Phase 1)
│   ├── items.py           (NEW — ITEM-03/04/05/06, QTY-01/02/03/04, USER-02)
│   ├── categories.py      (NEW — ORG-01/02/06)
│   └── locations.py       (NEW — ORG-03/04/05)
├── schemas/
│   ├── __init__.py        (NEW)
│   ├── item.py            (NEW — Pydantic schemas for Item)
│   ├── category.py        (NEW — Pydantic schemas for Category)
│   └── location.py        (NEW — Pydantic schemas for Location)
├── alembic/versions/
│   └── 0002_seed_default_categories.py  (NEW — ORG-01 default categories)

frontend/src/
├── pages/
│   ├── Inventory.jsx          (REPLACE stub — main inventory page)
│   ├── Inventory.module.css   (NEW)
│   ├── Settings.jsx           (REPLACE stub — categories + locations management)
│   └── Settings.module.css    (NEW)
├── components/
│   ├── ItemRow/
│   │   ├── ItemRow.jsx
│   │   └── ItemRow.module.css
│   ├── ItemCard/
│   │   ├── ItemCard.jsx
│   │   └── ItemCard.module.css
│   ├── ItemDrawer/
│   │   ├── ItemDrawer.jsx
│   │   └── ItemDrawer.module.css
│   ├── QuantityControls/
│   │   ├── QuantityControls.jsx
│   │   └── QuantityControls.module.css
│   ├── FilterChip/
│   │   ├── FilterChip.jsx
│   │   └── FilterChip.module.css
│   ├── CategorySectionHeader/
│   │   ├── CategorySectionHeader.jsx
│   │   └── CategorySectionHeader.module.css
│   ├── EmptyState/
│   │   ├── EmptyState.jsx
│   │   └── EmptyState.module.css
│   ├── LoadingState/
│   │   ├── LoadingState.jsx
│   │   └── LoadingState.module.css
│   └── ErrorState/
│       ├── ErrorState.jsx
│       └── ErrorState.module.css
├── hooks/
│   ├── useItems.js          (NEW — fetch, create, update, delete items)
│   ├── useCategories.js     (NEW — fetch, create, rename, delete categories)
│   └── useLocations.js      (NEW — fetch, create, rename, delete locations)
└── lib/
    └── time.js              (NEW — relative time formatting)
```

### Pattern 1: FastAPI Router with Pydantic Schemas and get_db Injection

**What:** Each resource gets its own router file with Pydantic request/response schemas and the `get_db` dependency from `db.database`.

**When to use:** All three new routers (items, categories, locations).

**Example:**
```python
# backend/routers/items.py
# Source: fastapi.tiangolo.com/tutorial/sql-databases/ + existing backend/routers/health.py pattern
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from db.database import get_db
from models import Item, Transaction, QuantityMode, StockStatus
from schemas.item import ItemCreate, ItemUpdate, ItemResponse

router = APIRouter(prefix="/api/items", tags=["items"])

@router.get("/", response_model=list[ItemResponse])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).filter(Item.archived == False).all()

@router.post("/", response_model=ItemResponse, status_code=201)
def create_item(body: ItemCreate, request: Request, db: Session = Depends(get_db)):
    item = Item(**body.model_dump())
    db.add(item)
    db.flush()  # get item.id before transaction insert
    txn = Transaction(
        item_id=item.id,
        action="add",
        ha_user_id=request.state.user.id,
        ha_user_name=request.state.user.name,
    )
    db.add(txn)
    db.commit()
    db.refresh(item)
    return item
```

### Pattern 2: Transaction Append-Only Audit Log

**What:** Every item mutation (create, update, delete, quantity_change) writes one Transaction row. Transactions are never modified.

**When to use:** In ALL item-mutating endpoints. The `transactions` table and append-only constraint were locked in Phase 1. [VERIFIED: backend/models/__init__.py docstring, STATE.md "Transactions table must be append-only from Phase 2 day one"]

**Actions to use (convention):**
- `"add"` — item created
- `"update"` — item fields edited
- `"quantity_change"` — +1 / -1 from quick controls, includes `delta` value (+1.0 or -1.0)
- `"delete"` — item deleted (soft or hard)
- `"archive"` — item archived

```python
# Always INSERT, never UPDATE/DELETE
txn = Transaction(
    item_id=item.id,
    action="quantity_change",
    delta=delta,
    ha_user_id=request.state.user.id,
    ha_user_name=request.state.user.name,
)
db.add(txn)
db.commit()
```

### Pattern 3: Pydantic v2 Model Schemas

**What:** Pydantic v2 (installed: 2.11.9) uses `model_dump()` not `.dict()`, and `model_config = ConfigDict(from_attributes=True)` to serialize SQLAlchemy ORM objects.

**When to use:** All `*Response` schemas that wrap ORM models.

```python
# backend/schemas/item.py
# Source: pydantic.dev/2.x/concepts/dataclasses + existing project pattern
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from models import QuantityMode, StockStatus

class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category_id: Optional[int]
    location_id: Optional[int]
    quantity_mode: QuantityMode
    quantity: Optional[float]
    status: Optional[StockStatus]
    reorder_threshold: Optional[float]
    notes: Optional[str]
    archived: bool
    updated_at: datetime
    # last_updated_by: populated from most recent transaction
    last_updated_by_name: Optional[str] = None
```

**Note on `last_updated_by_name`:** The Item ORM model has `updated_at` but does NOT store the last editor's name directly — that lives in the `transactions` table. The API response must include the attribution name for the UI. Two approaches:
1. JOIN to most recent transaction in the list query (efficient, single query)
2. Include the `transactions` relationship on ItemResponse and let the frontend pick the latest

Approach 1 is recommended: in the list endpoint, use a subquery to get the latest `ha_user_name` per item and include it in the response schema as `last_updated_by_name`. [ASSUMED — specific SQLAlchemy subquery pattern; verify at implementation]

### Pattern 4: Optimistic UI for Quantity Controls (Frontend)

**What:** Quantity control taps update local React state immediately (before the PATCH response). On API error, state reverts and a brief visual indicator fires.

**When to use:** ± buttons and status cycle toggle only. Form saves (drawer) are not optimistic.

```javascript
// frontend/src/hooks/useItems.js
// Source: React 19 pattern — useState + apiFetch
async function updateQuantity(itemId, delta) {
  // 1. Optimistic update
  setItems(prev => prev.map(item =>
    item.id === itemId
      ? { ...item, quantity: (item.quantity ?? 0) + delta }
      : item
  ))
  try {
    const res = await apiFetch(`api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: items.find(i => i.id === itemId).quantity + delta })
    })
    if (!res.ok) throw new Error('API error')
    const updated = await res.json()
    setItems(prev => prev.map(item => item.id === itemId ? updated : item))
  } catch {
    // 2. Revert on error
    setItems(prev => prev.map(item =>
      item.id === itemId ? originalItem : item
    ))
    // 3. Brief error indicator — flash handled in QuantityControls component
    setErrorItemId(itemId)
    setTimeout(() => setErrorItemId(null), 300)
  }
}
```

### Pattern 5: Auto-Flip (Exact 0 → Status "Out")

**What:** When decrementing an exact-count item at quantity 0, the PATCH sends `quantity_mode: "status", status: "out"` — a mode change, not a quantity change.

**When to use:** In the `−` button handler when `item.quantity === 0 && item.quantity_mode === "exact"`.

```javascript
// frontend — QuantityControls.jsx
function handleMinus() {
  if (item.quantity_mode === 'exact' && (item.quantity ?? 0) <= 0) {
    // Auto-flip: convert to status "out"
    onUpdate(item.id, { quantity_mode: 'status', status: 'out', quantity: null })
  } else {
    onUpdate(item.id, { quantity: (item.quantity ?? 0) - 1 })
  }
}
```

The backend PATCH handler must accept partial updates (not require all fields) so a mode-change PATCH works cleanly alongside a simple quantity PATCH.

### Pattern 6: Client-Side Filter and Search

**What:** Full item list loaded on page mount. Search and filter are purely client-side — no additional API calls on filter change.

**When to use:** Search by name, filter by category_id, filter by location_id (D-05, ORG-05, ORG-06).

```javascript
// frontend — Inventory.jsx
const filtered = useMemo(() => {
  return items
    .filter(item => !activeCategoryId || item.category_id === activeCategoryId)
    .filter(item => !activeLocationId || item.location_id === activeLocationId)
    .filter(item =>
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
}, [items, activeCategoryId, activeLocationId, searchTerm])
```

Search debounce (200ms) applied to the input event, not to the filter computation. [VERIFIED: 02-UI-SPEC.md §Interaction Contract]

### Pattern 7: Focus Trap in Drawer

**What:** When the ItemDrawer opens, focus moves to the first form field. Tab cycles only within the drawer. Escape closes the drawer. When closed, focus returns to the triggering element.

**When to use:** ItemDrawer component. This is a WCAG requirement per the UI-SPEC accessibility contract.

```javascript
// Minimal focus trap implementation — no external library needed for a single drawer
// Source: 02-UI-SPEC.md §Drawer accessibility
useEffect(() => {
  if (!isOpen) return
  const focusable = drawerRef.current.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  first?.focus()
  function trap(e) {
    if (e.key !== 'Tab') return
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    }
  }
  document.addEventListener('keydown', trap)
  return () => document.removeEventListener('keydown', trap)
}, [isOpen])
```

### Pattern 8: Default Category Seeding via Alembic Data Migration

**What:** The 4 default categories (Food & pantry, Fridge & freezer, Cleaning & household, Personal care) are inserted via a new Alembic migration (0002), not at runtime startup.

**Why Alembic not startup code:** Runtime seeding requires "check if exists, then insert" logic on every startup, which is fragile. A migration runs exactly once. [ASSUMED — project choice; either approach works; Alembic is recommended]

**Category locking for defaults:** The UI-SPEC specifies default categories render without Pencil and Trash icons. The Category model has no `is_default` flag. Two options:
1. Add `is_default` Boolean column to Category via migration 0002 (schema + seed in one migration)
2. Hardcode the 4 default names as a constant checked in the API and frontend

Option 1 is recommended — cleaner API responses and avoids string-matching. The migration adds the column and seeds the rows.

```python
# backend/alembic/versions/0002_seed_default_categories.py
def upgrade():
    # Add is_default column
    with op.batch_alter_table('categories') as batch_op:
        batch_op.add_column(sa.Column('is_default', sa.Boolean(), nullable=False, server_default='0'))
    # Seed default categories
    op.execute("""
        INSERT OR IGNORE INTO categories (name, is_default) VALUES
        ('Food & pantry', 1),
        ('Fridge & freezer', 1),
        ('Cleaning & household', 1),
        ('Personal care', 1)
    """)
```

The `Category` ORM model must be updated to include `is_default`. [VERIFIED: Category model in backend/models/__init__.py — no is_default column currently]

### Pattern 9: PATCH with Partial Updates

**What:** The item PATCH endpoint accepts only changed fields (not the full item). Use Pydantic's `Optional` fields with a sentinel/`exclude_unset` pattern.

```python
# backend/schemas/item.py
class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    quantity_mode: Optional[QuantityMode] = None
    quantity: Optional[float] = None
    status: Optional[StockStatus] = None
    reorder_threshold: Optional[float] = None
    notes: Optional[str] = None
    archived: Optional[bool] = None

# backend/routers/items.py — PATCH handler
@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, body: ItemUpdate, request: Request, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404)
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    # ... insert Transaction, commit
```

### Anti-Patterns to Avoid

- **Using `fetch('/path')` directly:** All API calls must use `apiFetch('api/...')` — no leading slash. [VERIFIED: CONTEXT.md carried-forward constraint, 01-03-SUMMARY.md]
- **Hardcoding colors or spacing:** All CSS must use design tokens from `frontend/src/index.css`. No `#hex` or `px` values in component CSS Modules.
- **Modifying or deleting Transaction rows:** The Transaction table is append-only. [VERIFIED: backend/models/__init__.py docstring]
- **Storing last_updated_by on the Item row:** Attribution comes from the transactions table, not a column on items.
- **Full list re-fetch after every mutation:** After a PATCH or POST, update local state with the returned item. Only fetch on mount and after delete.
- **Modal dialogs for add/edit:** Use the slide-in drawer pattern (D-02). No `<dialog>` or modal.
- **Disabling the − button at 0:** The auto-flip behavior means − at 0 is valid. Button must never be disabled. (D-03)
- **Polling for real-time updates:** USER-03 is satisfied by page refresh. No WebSocket, no polling interval. [VERIFIED: 02-UI-SPEC.md §Interaction Contract]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Custom validation logic | Pydantic v2 `BaseModel` with type annotations | Handles coercion, error messages, required/optional automatically [VERIFIED: pydantic already installed] |
| ORM query building | Raw SQL strings | SQLAlchemy 2.0 ORM — `db.query()` or `db.get()` | Type-safe, handles FK loading, prevents injection [VERIFIED: already in use] |
| Relative time formatting | Custom date math | Small inline utility function (< 30 lines) — no library | Simple rules, no external dep needed per UI-SPEC spec |
| Focus trap | Custom keyboard event handling | Inline `querySelectorAll` + keydown listener (Pattern 7 above) | Drawer is a single, controlled case — no need for a library |
| CSS animations | JavaScript animation | CSS `transition: transform 200ms ease-out` | Pure CSS per UI-SPEC; no JS animation lib needed |
| Form state | Redux/Zustand | `useState` per form field | Single drawer form, no cross-component state needed |

**Key insight:** This phase builds on a complete foundation. Every hard infrastructure problem (auth, DB, ingress, SPA serving) was solved in Phase 1. Phase 2 is pure feature code — standard REST + standard React patterns.

---

## Runtime State Inventory

Phase 2 is greenfield feature code added to a Phase 1 scaffold. This is NOT a rename/refactor/migration phase.

**None** — no existing runtime state is renamed, moved, or migrated. All 5 DB tables are empty in a fresh install. The 4 default categories will be inserted by a new Alembic migration (0002), which is additive, not a rename of any existing data.

---

## Common Pitfalls

### Pitfall 1: Route Registration Order (API before SPA catch-all)

**What goes wrong:** If `app.include_router(items.router)` is registered AFTER the SPA catch-all `/{full_path:path}` route, all `/api/items` requests return `index.html` instead of JSON.

**Why it happens:** FastAPI matches routes in registration order. The SPA catch-all is a wildcard that matches everything.

**How to avoid:** Register all API routers in `main.py` BEFORE the `if not _SKIP_SPA:` block. The existing pattern in `main.py` already does this correctly — maintain the same order. [VERIFIED: backend/main.py — health router is registered before SPA mount]

**Warning signs:** API returns HTML (`<!doctype html>`) instead of JSON; status 200 but body is the SPA index page.

### Pitfall 2: `updated_at` Not Auto-Updating on PATCH

**What goes wrong:** SQLAlchemy's `onupdate=datetime.utcnow` on the `updated_at` column only fires when the ORM detects a dirty object and flushes. If you use `db.execute(update(...))` (Core-style), `onupdate` does NOT fire.

**Why it happens:** `onupdate` is an ORM-level hook, not a database trigger.

**How to avoid:** Always mutate items via ORM attribute assignment (`setattr(item, key, value)`) followed by `db.commit()`, never via raw `UPDATE` SQL. [VERIFIED: backend/models/__init__.py — `updated_at` uses `onupdate=datetime.utcnow`]

**Warning signs:** `updated_at` never changes after creation; attribution timestamps stale.

### Pitfall 3: SQLite Enum Stored as String — Serialization Mismatch

**What goes wrong:** SQLAlchemy stores `QuantityMode.EXACT` as the string `"EXACT"` (the enum name) in SQLite, but the frontend expects `"exact"` (the enum value) per the ORM definition.

**Why it happens:** SQLAlchemy's `SAEnum` by default uses the `.name` attribute (uppercase) for SQLite storage, not `.value`. Check the migration — it creates `Enum('EXACT', 'STATUS', name='quantitymode')`, confirming name-based storage.

**How to avoid:** In Pydantic response schemas, use `use_enum_values=True` in `model_config` or serialize explicitly:
```python
class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)
```
This ensures the API returns `"exact"` / `"status"` / `"have"` / `"low"` / `"out"` as strings, matching the UI-SPEC and frontend expectations. [VERIFIED: backend/alembic/versions/0001_initial_v1_schema.py — enum stored as uppercase names]

**Warning signs:** Frontend receives `"EXACT"` instead of `"exact"`; conditional rendering on `quantity_mode === 'exact'` never matches.

### Pitfall 4: Optimistic UI State Divergence

**What goes wrong:** After an optimistic update followed by an API error, the revert reads from a stale closure, resetting to an already-stale value rather than the pre-optimistic value.

**Why it happens:** The `items` state captured in the closure at the time of the tap may already be stale if two rapid taps occur.

**How to avoid:** Capture `originalItem` by value (clone) before the optimistic update, not by reference:
```javascript
const originalItem = { ...items.find(i => i.id === itemId) }
// then do optimistic update
// in catch: restore originalItem
```

**Warning signs:** After an API error on a rapid double-tap, the count shows an incorrect value.

### Pitfall 5: Category `is_default` Flag Missing from ORM Model

**What goes wrong:** Alembic migration 0002 adds `is_default` column to the DB, but if `backend/models/__init__.py` is not updated, SQLAlchemy queries won't include the column and ORM objects won't have the attribute.

**Why it happens:** Schema and ORM model must stay in sync manually — Alembic doesn't update the model file.

**How to avoid:** Update `Category` in `backend/models/__init__.py` to add `is_default = Column(Boolean, nullable=False, default=False)` in the same task that writes migration 0002.

**Warning signs:** `AttributeError: 'Category' object has no attribute 'is_default'` at runtime.

### Pitfall 6: Drawer Dirty-Check Uses Stale Initial Values

**What goes wrong:** The UI-SPEC requires a `confirm("Discard changes?")` when closing a dirty drawer. If the "initial values" are captured from props at render time rather than at open time, editing and saving one item then opening another item may trigger a false dirty warning.

**How to avoid:** Capture `initialValues` in a `useRef` set when `isOpen` transitions from false to true (on open), not from the current item prop.

### Pitfall 7: Settings Delete With Items Assigned

**What goes wrong:** Deleting a category or location that has items assigned — the UI-SPEC specifies items become uncategorised/unlocated, not cascade-deleted. If the API simply deletes the category row, SQLAlchemy will raise a foreign key constraint error (or silently set `category_id` to NULL depending on SQLite FK enforcement).

**Why it happens:** SQLite foreign key enforcement is OFF by default. The ORM FK constraint won't raise at the DB level, but the API should explicitly NULL out the items' `category_id` before deleting the category.

**How to avoid:** In the DELETE `/api/categories/{id}` handler:
```python
db.query(Item).filter(Item.category_id == category_id).update({"category_id": None})
db.delete(category)
db.commit()
```
Same pattern for location deletion. [VERIFIED: 02-UI-SPEC.md §Interaction Contract — "Items in this category will become uncategorised"]

---

## Code Examples

Verified patterns from project codebase and spec:

### Accessing the HA User in a Route

```python
# Source: backend/middleware/ingress.py (IngressUser dataclass) + existing pattern
@router.post("/api/items/")
def create_item(body: ItemCreate, request: Request, db: Session = Depends(get_db)):
    user = request.state.user  # IngressUser(id, name, display_name, ingress_path)
    # user.name is the HA username for attribution
```

### apiFetch Usage (Frontend)

```javascript
// Source: frontend/src/lib/api.js
// Correct — no leading slash
const res = await apiFetch('api/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
// Wrong — will throw TypeError
// const res = await apiFetch('/api/items')  // NEVER
```

### CSS Module Token Usage

```css
/* Source: frontend/src/index.css — all tokens defined here */
/* Correct */
.itemRow {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
}
/* Wrong */
.itemRow {
  padding: 8px 16px;      /* NEVER hardcode */
  border-bottom: 1px solid #3A3A3C;  /* NEVER hardcode */
}
```

### New Design Tokens to Add in Wave 0

```css
/* Add to frontend/src/index.css :root block — per 02-UI-SPEC.md §Color and §Typography */
--font-size-display: 28px;
--color-status-have: #34D399;
--color-status-low: #FBBF24;
--color-status-out: #EF4444;
```

### Relative Time Formatting

```javascript
// Source: 02-UI-SPEC.md §Copywriting Contract
// No external library needed
export function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
```

### Drawer Animation

```css
/* Source: 02-UI-SPEC.md §ItemDrawer */
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 480px;  /* desktop */
  transform: translateX(100%);
  transition: transform 200ms ease-out;
  background: var(--color-secondary);
  border-left: 1px solid var(--color-border);
}
.drawer.open {
  transform: translateX(0);
}
@media (max-width: 767px) {
  .drawer { width: 100vw; border-left: none; }
}
```

---

## State of the Art

| Old Approach | Current Approach | Source | Impact |
|--------------|------------------|--------|--------|
| Pydantic v1 `.dict()` | Pydantic v2 `.model_dump()` | Already on v2 (2.11.9) | Use `model_dump()`, not `.dict()` |
| Pydantic v1 `orm_mode = True` | Pydantic v2 `ConfigDict(from_attributes=True)` | Already on v2 | Use `ConfigDict`, not `class Config` |
| SQLAlchemy 1.x `Session.query()` | SQLAlchemy 2.x `db.get()` / `db.execute(select(...))` | Already on v2 (2.0.49) | Both styles work; `query()` is still supported |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Attribution name should be JOIN'd from most recent transaction row into the list query response | Architecture Patterns §Pattern 3 | If wrong: item response lacks `last_updated_by_name`; alternative is to add a column to Item directly or use a relationship |
| A2 | `is_default` Boolean column on Category is the right approach for locking default categories | Architecture Patterns §Pattern 8 | If wrong: alternative is to hardcode names in a constant; either works, but inconsistency between API and frontend handling |
| A3 | Alembic data migration (0002) is preferred over startup-time seeding for default categories | Architecture Patterns §Pattern 8 | If wrong: startup seeding also works; risk is idempotency — "insert if not exists" logic required |
| A4 | SQLite FK enforcement is OFF by default — category/location DELETE requires explicit NULL-out of item references | Common Pitfalls §Pitfall 7 | If wrong and FK enforcement is ON: DELETE raises DB error instead of silently NULLing — safer to NULL-out explicitly regardless |

**All other claims in this document are VERIFIED against the existing codebase or the approved UI-SPEC/CONTEXT.md documents.**

---

## Open Questions

1. **Attribution name on list items — WHERE to JOIN from**
   - What we know: Item.updated_at is maintained by ORM. Transaction rows have ha_user_name. The list API must return attribution data for every item.
   - What's unclear: The most recent Transaction per item must be JOIN'd in the list query. This requires a subquery (most recent transaction per item_id). No existing pattern in the codebase.
   - Recommendation: Use a SQLAlchemy subquery at the list endpoint. If performance is a concern (many items), consider adding `last_updated_by_name` directly to the Item table as a denormalized column — but keep the transactions table for the full audit log.

2. **`is_default` column: add via migration or hardcode as constant**
   - What we know: UI-SPEC requires default categories to render without edit/delete controls. The 4 names are fixed.
   - What's unclear: Whether to add a DB column or check names against a hardcoded list in the API.
   - Recommendation: Add `is_default` Boolean column via migration 0002 alongside the seed data. Cleaner API response, avoids name-string fragility.

---

## Environment Availability

All dependencies are already installed. No new tools, runtimes, or services are required for Phase 2.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.x | Backend | Assumed available | — | — |
| FastAPI | REST API | Already in requirements.txt | 0.135.3 | — |
| SQLAlchemy | ORM | Already in requirements.txt | 2.0.49 | — |
| Alembic | Migration 0002 | Already in requirements.txt | 1.18.4 | — |
| Pydantic | Schemas | Already in requirements.txt | 2.11.9 | — |
| Node.js / npm | Frontend build | Assumed available | — | — |
| React | Frontend | Already in package.json | 19.2.5 | — |
| lucide-react | Icons | Already in package.json | 0.511.0 | — |

[VERIFIED: backend/requirements.txt, frontend/package.json]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 8.4.2 |
| Backend config file | `backend/pytest.ini` |
| Backend quick run | `cd backend && pytest -q` |
| Backend full suite | `cd backend && pytest` |
| Frontend framework | vitest 3.2.4 |
| Frontend config file | `frontend/vitest.config.js` |
| Frontend quick run | `cd frontend && npm test` |
| Frontend full suite | `cd frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITEM-03 | POST /api/items creates item with all fields | unit | `pytest tests/test_items.py::test_create_item -x` | Wave 0 |
| ITEM-04 | PATCH /api/items/{id} updates item fields | unit | `pytest tests/test_items.py::test_update_item -x` | Wave 0 |
| ITEM-05 | DELETE /api/items/{id} removes/archives item | unit | `pytest tests/test_items.py::test_delete_item -x` | Wave 0 |
| ITEM-06 | Notes field stored and returned on item | unit | `pytest tests/test_items.py::test_item_notes -x` | Wave 0 |
| QTY-01 | Exact-count item created and quantity returned | unit | `pytest tests/test_items.py::test_exact_quantity -x` | Wave 0 |
| QTY-02 | Status-mode item created with have/low/out | unit | `pytest tests/test_items.py::test_status_mode -x` | Wave 0 |
| QTY-03 | Reorder threshold stored and returned | unit | `pytest tests/test_items.py::test_reorder_threshold -x` | Wave 0 |
| QTY-04 | PATCH quantity ±1 updates item | unit | `pytest tests/test_items.py::test_quantity_quick_update -x` | Wave 0 |
| QTY-04 (auto-flip) | PATCH at 0 flips to status "out" | unit | `pytest tests/test_items.py::test_auto_flip_to_out -x` | Wave 0 |
| ORG-01 | Default categories present after migration | unit | `pytest tests/test_categories.py::test_default_categories -x` | Wave 0 |
| ORG-02 | POST /api/categories creates custom category | unit | `pytest tests/test_categories.py::test_create_category -x` | Wave 0 |
| ORG-03 | Item location_id FK stored correctly | unit | `pytest tests/test_items.py::test_item_location -x` | Wave 0 |
| ORG-04 | POST/PATCH/DELETE /api/locations work | unit | `pytest tests/test_locations.py -x` | Wave 0 |
| ORG-05 | GET /api/items returns location data for filtering | unit | `pytest tests/test_items.py::test_items_include_location -x` | Wave 0 |
| ORG-06 | GET /api/items returns category data for filtering | unit | `pytest tests/test_items.py::test_items_include_category -x` | Wave 0 |
| USER-02 | Transaction inserted on item create | unit | `pytest tests/test_items.py::test_transaction_on_create -x` | Wave 0 |
| USER-02 | Transaction inserted on item update | unit | `pytest tests/test_items.py::test_transaction_on_update -x` | Wave 0 |
| USER-02 | Transaction ha_user_name from request.state.user | unit | `pytest tests/test_items.py::test_transaction_attribution -x` | Wave 0 |
| USER-03 | GET /api/items returns fresh data (no caching) | smoke | `pytest tests/test_items.py::test_items_no_cache -x` | Wave 0 |
| Drawer renders | ItemDrawer renders add and edit modes | unit (frontend) | `npm test -- ItemDrawer` | Wave 0 |
| QuantityControls | ± buttons and cycle toggle render correctly | unit (frontend) | `npm test -- QuantityControls` | Wave 0 |
| FilterChip | Active/inactive chip states render correctly | unit (frontend) | `npm test -- FilterChip` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && pytest -q` (backend tasks) or `cd frontend && npm test` (frontend tasks)
- **Per wave merge:** Both backend `pytest` and frontend `npm test` full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_items.py` — covers ITEM-03/04/05/06, QTY-01/02/03/04, ORG-03/05/06, USER-02/03
- [ ] `backend/tests/test_categories.py` — covers ORG-01/02
- [ ] `backend/tests/test_locations.py` — covers ORG-04
- [ ] `backend/routers/__init__.py` additions — items, categories, locations routers registered
- [ ] `frontend/src/components/ItemDrawer/ItemDrawer.test.jsx`
- [ ] `frontend/src/components/QuantityControls/QuantityControls.test.jsx`
- [ ] `frontend/src/components/FilterChip/FilterChip.test.jsx`

*(Existing test infrastructure — conftest.py, pytest.ini, vitest.config.js, setup.js — covers all Phase 2 tests without changes.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | HA ingress handles auth — established in Phase 1 |
| V3 Session Management | No | HA session — established in Phase 1 |
| V4 Access Control | No | Single-household shared inventory — all users have equal access |
| V5 Input Validation | Yes | Pydantic v2 schemas on all POST/PATCH bodies |
| V6 Cryptography | No | No encryption needed — local-only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via item name/notes | Tampering | SQLAlchemy ORM — parameterized queries; no raw `text()` SQL [VERIFIED: existing pattern] |
| Path traversal via item_id | Tampering | Integer `item_id` in path — FastAPI validates as int automatically |
| XSS via item name in React | Tampering | React's JSX auto-escapes string interpolation — no `dangerouslySetInnerHTML` |
| Unbounded list response | DoS | Phase 2 scope is household scale (< 1000 items) — no pagination required, but query should filter `archived=False` to bound results |
| Category/location name uniqueness | Tampering | `UniqueConstraint` already on `categories.name` and `locations.name` [VERIFIED: backend/models/__init__.py] |

---

## Sources

### Primary (HIGH confidence — verified against codebase)

- `backend/models/__init__.py` — ORM schema, QuantityMode/StockStatus enums, Transaction append-only constraint
- `backend/middleware/ingress.py` — IngressUser dataclass, header names
- `backend/db/database.py` — get_db dependency, DATABASE_URL pattern
- `backend/main.py` — route registration order, SPA mount pattern, INVENTAR_SKIP_SPA
- `backend/tests/conftest.py` — test fixture pattern, INVENTAR_DB_URL override
- `backend/requirements.txt` — exact package versions
- `frontend/package.json` — exact frontend package versions
- `frontend/src/lib/api.js` — apiFetch contract
- `frontend/src/index.css` — all existing design tokens
- `backend/alembic/versions/0001_initial_v1_schema.py` — SQLite enum storage format (uppercase names)
- `.planning/phases/02-core-inventory/02-CONTEXT.md` — all 6 locked decisions + carried-forward constraints
- `.planning/phases/02-core-inventory/02-UI-SPEC.md` — component specs, interaction contract, accessibility contract, copywriting

### Secondary (MEDIUM confidence — from Phase 1 summaries)

- `01-02-SUMMARY.md` — backend patterns, ingress header verification
- `01-03-SUMMARY.md` — frontend patterns, vitest esbuild quirk, BrowserRouter pattern

### Tertiary (LOW confidence — ASSUMED)

- See Assumptions Log above (A1–A4)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from existing project files
- Architecture: HIGH — patterns derived directly from Phase 1 codebase, standard FastAPI/React conventions
- Pitfalls: HIGH — all derived from verifiable code artifacts (models, migration, middleware)
- Assumptions: MEDIUM — 4 design choices where either approach works; flagged for planner awareness

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable tech stack; no fast-moving dependencies)
