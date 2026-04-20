"""Pydantic v2 schemas for Shopping List CRUD (Phase 4).

- ShoppingListCreate: POST body for manual add (SHOP-02, Plan 02).
- ShoppingListUpdate: PATCH body for drag-and-drop sort_order change (SHOP-01, Plan 02).
- CheckOffBody: POST body for check-off (SHOP-03, Plan 02).
- ShoppingListEntryResponse: unified response envelope covering both
  persisted shopping_list rows AND auto-computed entries (item below
  threshold). `auto=True` rows have `id=None` — they do not exist in
  the DB until materialized (e.g. by drag-and-drop or check-off).

Threat mitigations (T-04-01, T-04-02, T-04-03):
  All request schemas use extra='forbid' (ASVS V5). Numeric bounds on
  quantity_added (CheckOffBody) and sort_order (ShoppingListUpdate)
  prevent integer overflow / negative injection.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models import QuantityMode, StockStatus


class ShoppingListCreate(BaseModel):
    """POST /api/shopping-list/ — manual add OR free-text add (SHOP-02, RECP-04 D-10).

    Exactly one of (item_id, free_text) must be provided. Enforced by a
    model_validator so the error is raised at schema parsing, before any
    DB write occurs.
    """

    model_config = ConfigDict(extra="forbid")

    item_id: Optional[int] = Field(None, gt=0)
    free_text: Optional[str] = Field(None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def _exactly_one_of(self) -> "ShoppingListCreate":
        has_item = self.item_id is not None
        has_text = self.free_text is not None
        if has_item == has_text:
            # both set or neither set -> invalid
            raise ValueError(
                "ShoppingListCreate: exactly one of {item_id, free_text} must be set"
            )
        return self


class ShoppingListUpdate(BaseModel):
    """PATCH /api/shopping-list/{id} — used by drag-and-drop reordering (D-05)."""

    model_config = ConfigDict(extra="forbid")

    sort_order: Optional[int] = Field(None, ge=1, le=10000)


class CheckOffBody(BaseModel):
    """POST /api/shopping-list/{id}/check-off — quantity prompt result (D-07, SHOP-03)."""

    model_config = ConfigDict(extra="forbid")

    quantity_added: int = Field(..., gt=0, le=10000)


class ShoppingListEntryResponse(BaseModel):
    """Unified response for GET /api/shopping-list/.

    auto=True  -> computed from an item below threshold, not yet persisted
                 (id=None, added_manually=False, sort_order=None).
    auto=False -> a real ShoppingListEntry row (id set, sort_order possibly
                 set from drag-and-drop).
    free_text  -> non-null when the row is an unlinked text entry (item_id=None)
                 added via RECP-04 (D-10).
    """

    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    id: Optional[int] = None
    item_id: Optional[int] = None
    item_name: Optional[str] = None
    quantity: Optional[int] = None
    quantity_mode: Optional[QuantityMode] = None
    status: Optional[StockStatus] = None
    reorder_threshold: Optional[int] = None
    location_id: Optional[int] = None
    added_manually: bool = False
    sort_order: Optional[int] = None
    free_text: Optional[str] = None
    auto: bool


__all__ = [
    "ShoppingListCreate",
    "ShoppingListUpdate",
    "CheckOffBody",
    "ShoppingListEntryResponse",
]
