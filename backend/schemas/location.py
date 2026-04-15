"""Pydantic v2 schemas for Location CRUD.

- LocationCreate: POST /api/locations/ — name required
- LocationUpdate: PATCH /api/locations/{id} — name optional
- LocationResponse: serialized response with id and name
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    """Request body for creating a new storage location."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1)


class LocationUpdate(BaseModel):
    """Request body for renaming a storage location."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None


class LocationResponse(BaseModel):
    """Response schema for a storage location."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str


__all__ = ["LocationCreate", "LocationUpdate", "LocationResponse"]
