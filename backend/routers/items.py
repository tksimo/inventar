"""Items API router.

Implements ITEM-03/04/05/06, QTY-01/02/03/04, USER-01/02/03 requirements.

Transaction audit trail:
  Every mutation (create, update, quantity_change, delete) inserts an
  append-only Transaction row attributed to the HA ingress user.

Architecture note (N+1 avoidance):
  list_items fetches all active items in one query, then fetches the most
  recent transaction per item in a second query (using a MAX subquery), and
  hydrates last_updated_by_name in Python. At household scale (<1000 items)
  this two-query approach is sufficient and avoids a correlated subquery or
  ORM lazy-load per item.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, Transaction, QuantityMode, StockStatus
from schemas.item import ItemCreate, ItemUpdate, ItemResponse

router = APIRouter(prefix="/api/items", tags=["items"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _record_txn(
    db: Session,
    item_id: int,
    action: str,
    user,
    delta: Optional[float] = None,
) -> None:
    """Insert an append-only Transaction row.

    user may be None (unauthenticated / non-ingress call) — tolerated by
    storing None for ha_user_id and ha_user_name.
    """
    txn = Transaction(
        item_id=item_id,
        action=action,
        delta=delta,
        ha_user_id=user.id if user else None,
        ha_user_name=user.name if user else None,
    )
    db.add(txn)


def _latest_txn_names(db: Session, item_ids: List[int]) -> dict[int, Optional[str]]:
    """Return a mapping of item_id -> ha_user_name from the most recent transaction.

    Uses a subquery on MAX(timestamp) per item_id to avoid an N+1 query pattern.
    Only item_ids in the provided list are queried.
    """
    if not item_ids:
        return {}

    # Subquery: max timestamp per item_id
    sub = (
        db.query(
            Transaction.item_id,
            func.max(Transaction.timestamp).label("max_ts"),
        )
        .filter(Transaction.item_id.in_(item_ids))
        .group_by(Transaction.item_id)
        .subquery()
    )

    # Join back to get ha_user_name for the latest row
    rows = (
        db.query(Transaction.item_id, Transaction.ha_user_name)
        .join(
            sub,
            (Transaction.item_id == sub.c.item_id)
            & (Transaction.timestamp == sub.c.max_ts),
        )
        .all()
    )

    return {row.item_id: row.ha_user_name for row in rows}


def _to_response(item: Item, last_updated_by_name: Optional[str] = None) -> ItemResponse:
    """Convert an ORM Item to an ItemResponse, injecting last_updated_by_name."""
    resp = ItemResponse.model_validate(item)
    # model_validate returns a new instance; we rebuild with the extra field
    return resp.model_copy(update={"last_updated_by_name": last_updated_by_name})


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[ItemResponse])
def list_items(
    include_archived: bool = False,
    db: Session = Depends(get_db),
) -> List[ItemResponse]:
    """List all items. Archived items excluded by default."""
    query = db.query(Item)
    if not include_archived:
        query = query.filter(Item.archived == False)  # noqa: E712
    items = query.all()

    item_ids = [i.id for i in items]
    name_map = _latest_txn_names(db, item_ids)

    return [_to_response(item, name_map.get(item.id)) for item in items]


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    include_archived: bool = False,
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Return a single item by id. Returns 404 if not found or archived."""
    query = db.query(Item).filter(Item.id == item_id)
    if not include_archived:
        query = query.filter(Item.archived == False)  # noqa: E712
    item = query.first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    name_map = _latest_txn_names(db, [item_id])
    return _to_response(item, name_map.get(item_id))


@router.post("/", response_model=ItemResponse, status_code=201)
def create_item(
    body: ItemCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Create a new item and record an 'add' transaction."""
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="name must not be empty")

    item = Item(**body.model_dump())
    db.add(item)
    db.flush()  # populate item.id before recording the transaction

    user = request.state.user
    _record_txn(db, item.id, action="add", user=user)
    db.commit()
    db.refresh(item)

    last_name = user.name if user else None
    return _to_response(item, last_name)


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    body: ItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> ItemResponse:
    """Partially update an item and record the appropriate transaction.

    D-03 auto-flip: caller sends quantity_mode='status', status='out',
    quantity=None simultaneously — treated as a single 'update' action
    and sets quantity to NULL explicitly.

    Quantity-only change (exactly {'quantity': X}) uses action='quantity_change'
    with delta = new - old. All other changes use action='update'.
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    # Obtain only the explicitly supplied keys
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        # Nothing to update — return current state
        name_map = _latest_txn_names(db, [item_id])
        return _to_response(item, name_map.get(item_id))

    # Determine action type
    keys = set(update_data.keys())

    # Check for D-03 auto-flip: quantity_mode, status, quantity all present
    is_auto_flip = (
        "quantity" in update_data
        and update_data["quantity"] is None
        and "quantity_mode" in update_data
    )

    if keys == {"quantity"} and not is_auto_flip:
        # Pure quantity-only update
        old_quantity = item.quantity or 0
        new_quantity = update_data["quantity"]
        delta = int((new_quantity or 0) - old_quantity)  # defensive int cast for pre-migration rows
        action = "quantity_change"
    else:
        delta = None
        action = "update"

    # Apply updates via ORM attribute assignment (never raw SQL — T-02-06 / Pitfall 2)
    for key, value in update_data.items():
        setattr(item, key, value)

    db.flush()
    user = request.state.user
    _record_txn(db, item.id, action=action, user=user, delta=delta)
    db.commit()
    db.refresh(item)

    name_map = _latest_txn_names(db, [item_id])
    return _to_response(item, name_map.get(item_id))


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Delete an item. Inserts 'delete' transaction BEFORE removing the row
    (Transaction FK references items.id — must be recorded while item exists).
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    # Record transaction BEFORE deleting (FK constraint requires item to exist).
    # We must commit the transaction row first, THEN delete the item.
    # If we flush+delete in one commit, SQLAlchemy may reorder the UPDATE/DELETE
    # and set item_id=None on the transaction row due to the relationship cascade.
    user = request.state.user
    txn = Transaction(
        item_id=item_id,
        action="delete",
        delta=None,
        ha_user_id=user.id if user else None,
        ha_user_name=user.name if user else None,
    )
    db.add(txn)
    db.commit()  # commit the transaction row first

    # Now delete the item. Expire the 'transactions' attribute first so SQLAlchemy
    # does NOT try to SET item_id=NULL on related transaction rows before the DELETE
    # (which would violate the NOT NULL constraint). With the attribute expired the
    # ORM does not emit the nullify UPDATE; the FK rows remain as the historical
    # audit trail (the item row itself is gone, but the audit trail still exists).
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is not None:
        db.expire(item, ["transactions"])
        db.delete(item)
        db.commit()

    return {"ok": True}
