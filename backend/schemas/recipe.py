"""Pydantic v2 schemas for Recipe CRUD + URL import + ingredient check + cook (Phase 5).

All schemas use extra='forbid' (ASVS V5) so clients cannot inject unknown fields.
Numeric bounds (gt, ge, le) prevent overflow / negative values at the validation
layer before any DB write occurs.

Threat mitigations (T-05-01, T-05-02, T-05-03, T-05-04):
  - Unknown fields rejected (extra='forbid').
  - URL length bounded (max_length=2000) to prevent log/DB bloat.
  - Ingredient name/unit bounded to keep ingredient rows small.
  - Cook amount bounded to prevent pathological deductions.

Schemas declared in this one file because they share request/response types
and are all consumed by the same router (backend/routers/recipes.py in Plan 02).
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class RecipeIngredientIn(BaseModel):
    """One ingredient line as sent by the client (D-01)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=200)
    quantity: Optional[float] = Field(None, ge=0, le=100000)
    unit: Optional[str] = Field(None, max_length=20)
    item_id: Optional[int] = Field(None, gt=0)


class RecipeIngredientResponse(BaseModel):
    """One ingredient line as serialized from the ORM."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    item_id: Optional[int] = None
    sort_order: Optional[int] = None


class RecipeCreate(BaseModel):
    """POST /api/recipes/ — create a recipe manually (RECP-01)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=200)
    instructions: Optional[str] = Field(None, max_length=20000)
    source_url: Optional[str] = Field(None, max_length=2000)
    ingredients: List[RecipeIngredientIn] = Field(default_factory=list)


class RecipeUpdate(BaseModel):
    """PATCH /api/recipes/{id} — update a recipe (RECP-01).

    If `ingredients` is provided (not None), it REPLACES the entire ingredient
    list (per D-01 — simplest contract; avoids partial update ambiguity).
    """

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    instructions: Optional[str] = Field(None, max_length=20000)
    source_url: Optional[str] = Field(None, max_length=2000)
    ingredients: Optional[List[RecipeIngredientIn]] = None


class RecipeResponse(BaseModel):
    """GET /api/recipes/{id} — full detail including ingredients."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    instructions: Optional[str] = None
    source_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    ingredients: List[RecipeIngredientResponse] = Field(default_factory=list)


class RecipeListItem(BaseModel):
    """GET /api/recipes/ — list row (no instructions for payload size)."""

    model_config = ConfigDict(extra="forbid")

    id: int
    name: str
    source_url: Optional[str] = None
    ingredient_count: int
    created_at: datetime
    updated_at: datetime


class RecipeImportUrlBody(BaseModel):
    """POST /api/recipes/import-url — parse a recipe from a URL (RECP-02, D-04)."""

    model_config = ConfigDict(extra="forbid")

    url: str = Field(..., min_length=1, max_length=2000)


class IngredientCheckItem(BaseModel):
    """One row in GET /api/recipes/{id}/check response (D-08, D-09)."""

    model_config = ConfigDict(extra="forbid")

    ingredient_id: int
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    item_id: Optional[int] = None
    matched_item_name: Optional[str] = None
    status: Literal["have", "low", "missing"]
    unit_mismatch: bool = False


class IngredientCheckResponse(BaseModel):
    """GET /api/recipes/{id}/check — per-ingredient availability envelope (RECP-03)."""

    model_config = ConfigDict(extra="forbid")

    recipe_id: int
    ingredients: List[IngredientCheckItem] = Field(default_factory=list)
    missing_count: int = 0


class RecipeCookIngredient(BaseModel):
    """One deduction entry in POST /api/recipes/{id}/cook body (D-11, D-14)."""

    model_config = ConfigDict(extra="forbid")

    ingredient_id: int = Field(..., gt=0)
    item_id: int = Field(..., gt=0)
    amount: float = Field(..., gt=0, le=100000)


class RecipeCookBody(BaseModel):
    """POST /api/recipes/{id}/cook — user-reviewed deductions (RECP-05)."""

    model_config = ConfigDict(extra="forbid")

    deductions: List[RecipeCookIngredient] = Field(default_factory=list)


__all__ = [
    "RecipeIngredientIn",
    "RecipeIngredientResponse",
    "RecipeCreate",
    "RecipeUpdate",
    "RecipeResponse",
    "RecipeListItem",
    "RecipeImportUrlBody",
    "IngredientCheckItem",
    "IngredientCheckResponse",
    "RecipeCookIngredient",
    "RecipeCookBody",
]
