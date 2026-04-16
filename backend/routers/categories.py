"""Categories API router.

Implements ORG-02, ORG-06 requirements.

Default flag:
  The is_default column is used ONLY for default-first ordering in GET
  (Category.is_default.desc()). It no longer gates write access — default
  categories are fully renameable and deletable (UAT Test 11 design change).
  Only the Alembic migration 0002 sets is_default=True; the POST endpoint
  always forces is_default=False on newly created categories (T-02-02, T-02-15).

FK null-out on delete:
  Deleting any category nullifies item.category_id on all referring items
  before the category row is removed (Pitfall 7 / T-02-14).
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models import Category, Item
from schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/api/categories", tags=["categories"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)) -> List[CategoryResponse]:
    """Return all categories ordered so defaults appear first, then alphabetically."""
    categories = (
        db.query(Category)
        .order_by(Category.is_default.desc(), Category.name.asc())
        .all()
    )
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, db: Session = Depends(get_db)) -> CategoryResponse:
    """Return a single category by id."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryResponse.model_validate(cat)


@router.post("/", response_model=CategoryResponse, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)) -> CategoryResponse:
    """Create a new custom category.

    is_default is always set to False server-side regardless of request body
    (CategoryCreate schema intentionally excludes the field — T-02-15).
    Returns 409 if the category name already exists.
    """
    cat = Category(name=body.name, is_default=False)
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists")
    db.refresh(cat)
    return CategoryResponse.model_validate(cat)


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
) -> CategoryResponse:
    """Rename a category.

    All categories (including defaults) are renameable (UAT Test 11).
    """
    cat = db.query(Category).filter(Category.id == category_id).first()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cat, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists")
    db.refresh(cat)
    return CategoryResponse.model_validate(cat)


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a category.

    All categories (including defaults) are deletable (UAT Test 11).
    Before deleting, nullifies item.category_id on all referring items
    to prevent FK orphan rows (Pitfall 7 / T-02-14).
    """
    cat = db.query(Category).filter(Category.id == category_id).first()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found")

    # Nullify category_id on all items that reference this category (T-02-14)
    db.query(Item).filter(Item.category_id == category_id).update({"category_id": None})

    db.delete(cat)
    db.commit()
    return {"ok": True}
