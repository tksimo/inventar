"""Public REST summary endpoint for HA REST-sensor polling (HA-01, D-01, D-03).

No authentication required — relies on local network trust (HAOS deployment,
not internet-exposed). See CONTEXT.md D-03 and RESEARCH.md §Security Domain.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, QuantityMode, StockStatus
from schemas.ha_display import HASummaryResponse

router = APIRouter(prefix="/api/ha", tags=["ha-display"])


@router.get("/summary", response_model=HASummaryResponse)
def ha_summary(db: Session = Depends(get_db)) -> HASummaryResponse:
    """Return low/out-of-stock counts and item name lists for HA REST sensors.

    Logic per D-02 (locked):
    - out_of_stock: STATUS mode with status=OUT, or EXACT mode with quantity=0
      (quantity=None is NOT treated as zero — Pitfall 3)
    - low_stock: STATUS mode with status=LOW, or EXACT mode with
      quantity <= reorder_threshold (threshold must be set)
    - Items counted as out-of-stock are excluded from low-stock (no double count — Pitfall 4)
    - Archived items are excluded from all counts and lists
    """
    active = db.query(Item).filter(Item.archived == False).all()  # noqa: E712

    # Build out-of-stock list first so it can be excluded from low-stock
    out_of_stock = [
        i for i in active
        if (i.quantity_mode == QuantityMode.STATUS and i.status == StockStatus.OUT)
        or (i.quantity_mode == QuantityMode.EXACT and i.quantity is not None and i.quantity == 0)
    ]
    out_ids = {i.id for i in out_of_stock}

    low_stock = [
        i for i in active
        if i.id not in out_ids  # exclude items already counted as out-of-stock (Pitfall 4)
        and (
            (i.quantity_mode == QuantityMode.STATUS and i.status == StockStatus.LOW)
            or (
                i.quantity_mode == QuantityMode.EXACT
                and i.reorder_threshold is not None
                and i.quantity is not None
                and i.quantity <= i.reorder_threshold
            )
        )
    ]

    return HASummaryResponse(
        low_stock_count=len(low_stock),
        out_of_stock_count=len(out_of_stock),
        total_items=len(active),
        low_stock_items=sorted(i.name for i in low_stock),
        out_of_stock_items=sorted(i.name for i in out_of_stock),
    )
