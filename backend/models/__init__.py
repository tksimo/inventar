"""Full v1 ORM schema.

Per CONTEXT.md D-11, ALL v1 tables are created in Phase 1 even though most
UI lands in Phase 2. This avoids schema migrations during feature work.
Transactions table is append-only (STATE.md constraint) -- callers must INSERT
only; never UPDATE/DELETE rows.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from db.database import Base


class QuantityMode(enum.Enum):
    EXACT = "exact"
    STATUS = "status"


class StockStatus(enum.Enum):
    HAVE = "have"
    LOW = "low"
    OUT = "out"


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    is_default = Column(Boolean, nullable=False, default=False)
    items = relationship("Item", back_populates="category")


class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    items = relationship("Item", back_populates="location")


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    barcode = Column(String, nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity_mode = Column(SAEnum(QuantityMode), nullable=False, default=QuantityMode.EXACT)
    quantity = Column(Integer, nullable=True)
    status = Column(SAEnum(StockStatus), nullable=True)
    reorder_threshold = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    calories = Column(Float, nullable=True)
    protein = Column(Float, nullable=True)
    carbs = Column(Float, nullable=True)
    fat = Column(Float, nullable=True)
    archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    category = relationship("Category", back_populates="items")
    location = relationship("Location", back_populates="items")
    transactions = relationship("Transaction", back_populates="item", passive_deletes=True)


class Transaction(Base):
    """Append-only audit log. Never UPDATE or DELETE rows."""
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    action = Column(String, nullable=False)  # "add" | "update" | "delete" | "quantity_change"
    delta = Column(Float, nullable=True)
    ha_user_id = Column(String, nullable=True)
    ha_user_name = Column(String, nullable=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    item = relationship("Item", back_populates="transactions")


class ShoppingListEntry(Base):
    __tablename__ = "shopping_list"
    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    added_manually = Column(Boolean, nullable=False, default=False)
    checked_off = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    sort_order = Column(Integer, nullable=True)
    free_text = Column(String, nullable=True)


class Recipe(Base):
    """A cookable recipe. Phase 5 — RECP-01."""
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    instructions = Column(Text, nullable=True)
    source_url = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    ingredients = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeIngredient.sort_order",
    )


class RecipeIngredient(Base):
    """A single ingredient row in a recipe. Phase 5 — RECP-01, D-01.

    item_id is nullable: ingredients may be linked to an inventory item
    (D-02/D-07) or left unlinked permanently (D-03).
    """
    __tablename__ = "recipe_ingredients"
    id = Column(Integer, primary_key=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    sort_order = Column(Integer, nullable=True)
    recipe = relationship("Recipe", back_populates="ingredients")
    item = relationship("Item")


__all__ = [
    "QuantityMode",
    "StockStatus",
    "Category",
    "Location",
    "Item",
    "Transaction",
    "ShoppingListEntry",
    "Recipe",
    "RecipeIngredient",
]
