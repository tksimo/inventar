"""Pydantic response schema for GET /api/ha/summary (HA-01, D-02)."""
from __future__ import annotations

from typing import List

from pydantic import BaseModel, ConfigDict


class HASummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    low_stock_count: int
    out_of_stock_count: int
    total_items: int
    low_stock_items: List[str]
    out_of_stock_items: List[str]
