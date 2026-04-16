"""Pydantic v2 schemas for Item CRUD.

- ItemCreate: validated request body for POST /api/items/
- ItemUpdate: validated request body for PATCH /api/items/{id}
- ItemResponse: serialized response including enum values as lowercase strings

Threat mitigations (T-02-01):
  extra='forbid' on all create/update schemas prevents clients from injecting
  unknown columns (e.g. archived bypass, is_default spoofing).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from models import QuantityMode, StockStatus


class ItemCreate(BaseModel):
    """Request body for creating a new inventory item."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1)
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    quantity_mode: Optional[QuantityMode] = None
    quantity: Optional[int] = None
    status: Optional[StockStatus] = None
    reorder_threshold: Optional[int] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None


class ItemUpdate(BaseModel):
    """Request body for patching an existing inventory item.

    All fields are Optional. Use .model_dump(exclude_unset=True) in the
    router to obtain only the fields the caller explicitly provided.
    """

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    quantity_mode: Optional[QuantityMode] = None
    quantity: Optional[int] = None
    status: Optional[StockStatus] = None
    reorder_threshold: Optional[int] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None


class ItemResponse(BaseModel):
    """Response schema for a single inventory item.

    use_enum_values=True ensures QuantityMode and StockStatus serialize as
    their lowercase .value strings ('exact', 'status', 'have', 'low', 'out')
    rather than the enum member names (RESEARCH.md Pitfall 3).

    last_updated_by_name is populated by the router via a JOIN on the
    transactions table — it is None when no updates have been made.
    """

    model_config = ConfigDict(from_attributes=True, use_enum_values=True, extra="forbid")

    id: int
    name: str
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    quantity_mode: QuantityMode = QuantityMode.EXACT
    quantity: Optional[int] = None
    status: Optional[StockStatus] = None
    reorder_threshold: Optional[int] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    archived: bool = False
    created_at: datetime
    updated_at: datetime
    # Populated by router via transaction JOIN (Plan 02-02).
    last_updated_by_name: Optional[str] = None


__all__ = ["ItemCreate", "ItemUpdate", "ItemResponse"]
