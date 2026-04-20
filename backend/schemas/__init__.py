"""Pydantic v2 schema package for the Inventar backend.

Exports the canonical request/response models for all three resource types.
"""
from schemas.item import ItemCreate, ItemUpdate, ItemResponse
from schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from schemas.location import LocationCreate, LocationUpdate, LocationResponse
from schemas.shopping_list import (
    ShoppingListCreate,
    ShoppingListUpdate,
    CheckOffBody,
    ShoppingListEntryResponse,
)
from schemas.recipe import (
    RecipeIngredientIn,
    RecipeIngredientResponse,
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeListItem,
    RecipeImportUrlBody,
    IngredientCheckItem,
    IngredientCheckResponse,
    RecipeCookIngredient,
    RecipeCookBody,
)

__all__ = [
    "ItemCreate",
    "ItemUpdate",
    "ItemResponse",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryResponse",
    "LocationCreate",
    "LocationUpdate",
    "LocationResponse",
    "ShoppingListCreate",
    "ShoppingListUpdate",
    "CheckOffBody",
    "ShoppingListEntryResponse",
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
