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
    quantity = Column(Float, nullable=True)
    status = Column(SAEnum(StockStatus), nullable=True)
    reorder_threshold = Column(Float, nullable=True)
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
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    added_manually = Column(Boolean, nullable=False, default=False)
    checked_off = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


__all__ = [
    "QuantityMode",
    "StockStatus",
    "Category",
    "Location",
    "Item",
    "Transaction",
    "ShoppingListEntry",
]
