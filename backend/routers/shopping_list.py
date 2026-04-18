"""Shopping list API router (Phase 4, Plan 01 — GET only; Plan 02 adds writes).

Implements SHOP-01 auto-population with deduplication against persisted rows.

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
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, ShoppingListEntry, QuantityMode, StockStatus
from schemas.shopping_list import ShoppingListEntryResponse

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
