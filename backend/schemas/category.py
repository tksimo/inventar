"""Pydantic v2 schemas for Category CRUD.

- CategoryCreate: POST /api/categories/ — name required, is_default NOT exposed
- CategoryUpdate: PATCH /api/categories/{id} — name optional
- CategoryResponse: serialized response including is_default flag

Threat mitigations (T-02-02):
  is_default is intentionally absent from CategoryCreate so clients cannot
  self-promote a category to default status. Only the seeded migration rows
  (0002) carry is_default=True.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    """Request body for creating a new category."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1)


class CategoryUpdate(BaseModel):
    """Request body for renaming a category."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None


class CategoryResponse(BaseModel):
    """Response schema for a category, including the is_default flag."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    is_default: bool


__all__ = ["CategoryCreate", "CategoryUpdate", "CategoryResponse"]
