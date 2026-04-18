"""Shopping list API router (Phase 4).

Plan 01 shipped GET /api/shopping-list/ (auto-population + deduplication).
Plan 02 adds write endpoints: POST, DELETE, PATCH, POST /{id}/check-off.

Auto-population rules (CONTEXT.md D-02, D-03; RESEARCH.md Pattern 1):
  Include an item as an auto-entry if AND only if:
    (a) quantity_mode='exact' AND reorder_threshold IS NOT NULL
        AND (quantity or 0) <= reorder_threshold, OR
    (b) quantity_mode='status' AND status='out'
  Items with threshold=NULL never auto-appear (D-03). They may still be
  manually added via POST (Plan 02).

Deduplication (RESEARCH.md Pitfall 2):
  If an item already has a row in shopping_list, the persisted row takes
  precedence — no separate auto entry is emitted for that item.

Threat mitigations:
  - T-04-05 (SQLi via ORM): ORM attribute access and filter(...) only. No raw SQL.
  - Response schema ShoppingListEntryResponse has extra='forbid' so no
    internal column (e.g. checked_off) leaks through the envelope.
  - T-04-08/09/10: Input validation via Pydantic schemas with Field bounds.
  - T-04-11: Audit trail via Transaction row on every check-off.
  - T-04-12: Application-level duplicate check before INSERT.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, ShoppingListEntry, QuantityMode, StockStatus, Transaction
from schemas.shopping_list import (
    ShoppingListCreate,
    ShoppingListEntryResponse,
    ShoppingListUpdate,
    CheckOffBody,
)

router = APIRouter(prefix="/api/shopping-list", tags=["shopping-list"])


def _item_is_below_threshold(item: Item) -> bool:
    """True if the item should auto-appear on the shopping list."""
    if item.quantity_mode == QuantityMode.EXACT:
        if item.reorder_threshold is None:
            return False
        return (item.quantity or 0) <= item.reorder_threshold
    # STATUS mode
    return item.status == StockStatus.OUT


def _row_from_entry(entry: ShoppingListEntry, item: Item) -> ShoppingListEntryResponse:
    return ShoppingListEntryResponse(
        id=entry.id,
        item_id=item.id,
        item_name=item.name,
        quantity=item.quantity,
        quantity_mode=item.quantity_mode,
        status=item.status,
        reorder_threshold=item.reorder_threshold,
        location_id=item.location_id,
        added_manually=entry.added_manually,
        sort_order=entry.sort_order,
        auto=False,
    )


def _row_from_item_auto(item: Item) -> ShoppingListEntryResponse:
    return ShoppingListEntryResponse(
        id=None,
        item_id=item.id,
        item_name=item.name,
        quantity=item.quantity,
        quantity_mode=item.quantity_mode,
        status=item.status,
        reorder_threshold=item.reorder_threshold,
        location_id=item.location_id,
        added_manually=False,
        sort_order=None,
        auto=True,
    )


@router.get("/", response_model=List[ShoppingListEntryResponse])
def get_shopping_list(db: Session = Depends(get_db)) -> List[ShoppingListEntryResponse]:
    """Return unified shopping list: persisted rows + auto-computed entries.

    Deduplication: an item with a persisted shopping_list row is NOT emitted
    as a separate auto-entry.
    """
    # Non-archived items only (RESEARCH.md Pattern 1)
    items = db.query(Item).filter(Item.archived == False).all()  # noqa: E712
    items_by_id = {i.id: i for i in items}

    persisted = db.query(ShoppingListEntry).all()
    persisted_item_ids = {e.item_id for e in persisted}

    rows: List[ShoppingListEntryResponse] = []

    for entry in persisted:
        item = items_by_id.get(entry.item_id)
        if item is None:
            # Orphaned entry (item archived or deleted) — skip.
            continue
        rows.append(_row_from_entry(entry, item))

    for item in items:
        if item.id in persisted_item_ids:
            continue
        if _item_is_below_threshold(item):
            rows.append(_row_from_item_auto(item))

    # Sort: persisted rows (sort_order present) ASC first, then auto rows by name.
    # Python sort is stable; tuple comparison handles NULLS LAST via a large sentinel.
    SENTINEL = 10 ** 9
    rows.sort(key=lambda r: (r.sort_order if r.sort_order is not None else SENTINEL, r.item_name))
    return rows


# ---------------------------------------------------------------------------
# Write endpoints (Plan 02 — SHOP-02, SHOP-03, RSTO-03)
# ---------------------------------------------------------------------------


def _record_txn(
    db: Session,
    item_id: int,
    action: str,
    user,
    delta: Optional[float] = None,
) -> None:
    """Insert an append-only Transaction row. Mirrors backend/routers/items.py."""
    txn = Transaction(
        item_id=item_id,
        action=action,
        delta=delta,
        ha_user_id=user.id if user else None,
        ha_user_name=user.name if user else None,
    )
    db.add(txn)


@router.post("/", response_model=ShoppingListEntryResponse, status_code=201)
def add_to_shopping_list(
    body: ShoppingListCreate,
    db: Session = Depends(get_db),
) -> ShoppingListEntryResponse:
    """SHOP-02: Manually add an inventory item to the shopping list."""
    item = db.query(Item).filter(Item.id == body.item_id).first()
    if item is None or item.archived:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = (
        db.query(ShoppingListEntry)
        .filter(ShoppingListEntry.item_id == body.item_id)
        .first()
    )
    if existing is not None:
        # Pitfall 2: no duplicate entries per item_id.
        raise HTTPException(status_code=409, detail="Item already on shopping list")

    # Next sort_order = max existing + 1 (or 1 if empty / all NULL)
    max_sort = db.query(func.max(ShoppingListEntry.sort_order)).scalar()
    next_sort = (max_sort or 0) + 1

    entry = ShoppingListEntry(
        item_id=body.item_id,
        added_manually=True,
        checked_off=False,
        sort_order=next_sort,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return _row_from_entry(entry, item)


@router.delete("/{entry_id}")
def delete_shopping_list_entry(
    entry_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Remove a shopping list entry. Does NOT modify the item."""
    entry = db.query(ShoppingListEntry).filter(ShoppingListEntry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Shopping list entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.patch("/{entry_id}", response_model=ShoppingListEntryResponse)
def update_shopping_list_entry(
    entry_id: int,
    body: ShoppingListUpdate,
    db: Session = Depends(get_db),
) -> ShoppingListEntryResponse:
    """Update sort_order on drag-end (D-05)."""
    entry = db.query(ShoppingListEntry).filter(ShoppingListEntry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Shopping list entry not found")
    item = db.query(Item).filter(Item.id == entry.item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Referenced item not found")

    data = body.model_dump(exclude_unset=True)
    if "sort_order" in data:
        entry.sort_order = data["sort_order"]

    db.commit()
    db.refresh(entry)
    return _row_from_entry(entry, item)


@router.post("/{entry_id}/check-off")
def check_off_shopping_list_entry(
    entry_id: int,
    body: CheckOffBody,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Atomic restock (SHOP-03, RSTO-03, D-07, D-08).

    - Increment item.quantity by body.quantity_added.
    - If item was in status mode, flip to exact mode with quantity = added.
    - Record 'quantity_change' Transaction attributed to HA user.
    - Remove entry from shopping_list if D-08 removal condition met:
        threshold IS NULL (no threshold set → always remove on any restock)
        OR new_quantity >= threshold (threshold=0 covered: 0+N >= 0 is always true for N>0)
    """
    entry = db.query(ShoppingListEntry).filter(ShoppingListEntry.id == entry_id).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Shopping list entry not found")

    item = db.query(Item).filter(Item.id == entry.item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Referenced item not found")

    quantity_added = body.quantity_added

    if item.quantity_mode == QuantityMode.STATUS:
        # Restocking a status-mode item: flip to exact with the restocked count.
        item.quantity_mode = QuantityMode.EXACT
        item.status = None
        new_quantity = quantity_added
    else:
        new_quantity = (item.quantity or 0) + quantity_added

    item.quantity = new_quantity

    # Record transaction before removal so attribution survives even if delete raises.
    _record_txn(
        db, item.id, action="quantity_change",
        user=request.state.user, delta=float(quantity_added),
    )

    # D-08 removal condition:
    #   threshold IS NULL → always remove (no threshold to fall under)
    #   threshold IS NOT NULL → remove when new_quantity >= threshold
    #   threshold=0 is covered by the second branch: new_quantity >= 0 always true for N>0
    threshold = item.reorder_threshold
    should_remove = (threshold is None) or (new_quantity >= threshold)
    if should_remove:
        db.delete(entry)

    db.commit()
    db.refresh(item)

    return {
        "ok": True,
        "removed": should_remove,
        "item_id": item.id,
        "new_quantity": new_quantity,
    }
