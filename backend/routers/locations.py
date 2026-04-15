"""Locations API router.

Implements ORG-03, ORG-04, ORG-05 requirements.

No default-lock: locations have no is_default concept; all locations are
user-created and fully mutable/deletable.

FK null-out on delete:
  Deleting a location nullifies item.location_id on all referring items
  before the location row is removed (Pitfall 7 / T-02-14).

Duplicate name handling:
  POST and PATCH return 409 Conflict on IntegrityError (unique constraint).
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from models import Item, Location
from schemas.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter(prefix="/api/locations", tags=["locations"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[LocationResponse])
def list_locations(db: Session = Depends(get_db)) -> List[LocationResponse]:
    """Return all locations ordered alphabetically."""
    locations = db.query(Location).order_by(Location.name.asc()).all()
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(location_id: int, db: Session = Depends(get_db)) -> LocationResponse:
    """Return a single location by id."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return LocationResponse.model_validate(loc)


@router.post("/", response_model=LocationResponse, status_code=201)
def create_location(body: LocationCreate, db: Session = Depends(get_db)) -> LocationResponse:
    """Create a new storage location.

    Returns 409 if the location name already exists.
    """
    loc = Location(name=body.name)
    db.add(loc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Location name already exists")
    db.refresh(loc)
    return LocationResponse.model_validate(loc)


@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    body: LocationUpdate,
    db: Session = Depends(get_db),
) -> LocationResponse:
    """Rename a location. Returns 409 on duplicate name."""
    loc = db.query(Location).filter(Location.id == location_id).first()
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(loc, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Location name already exists")
    db.refresh(loc)
    return LocationResponse.model_validate(loc)


@router.delete("/{location_id}")
def delete_location(location_id: int, db: Session = Depends(get_db)) -> dict:
    """Delete a location.

    Before deleting, nullifies item.location_id on all referring items
    to prevent FK orphan rows (Pitfall 7 / T-02-14).
    """
    loc = db.query(Location).filter(Location.id == location_id).first()
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")

    # Nullify location_id on all items that reference this location (T-02-14)
    db.query(Item).filter(Item.location_id == location_id).update({"location_id": None})

    db.delete(loc)
    db.commit()
    return {"ok": True}
