"""Wave 0 test scaffolds for Locations API.

Schema unit tests: GREEN after Plan 02-01.
Router-level tests: RED until Plan 02-02 (routers not yet implemented).

Covers: ORG-04, ORG-03 (location assign to item)
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


# ---------------------------------------------------------------------------
# GREEN after Plan 02-01 — schema unit test
# ---------------------------------------------------------------------------

def test_location_schema_create_requires_name():
    """LocationCreate requires name field."""
    # GREEN after Plan 02-01 — schema unit test
    from pydantic import ValidationError
    from schemas import LocationCreate

    with pytest.raises(ValidationError):
        LocationCreate()  # type: ignore[call-arg]


def test_location_response_schema():
    """LocationResponse exposes id and name."""
    # GREEN after Plan 02-01 — schema unit test
    from schemas import LocationResponse

    loc = LocationResponse(id=1, name="Kitchen cabinet")
    assert loc.id == 1
    assert loc.name == "Kitchen cabinet"


# ---------------------------------------------------------------------------
# RED until Plan 02-02 — router implementation
# ---------------------------------------------------------------------------

def test_create_location(client):
    # RED until Plan 02-02 — router implementation
    resp = client.post("/api/locations/", json={"name": "Kitchen top shelf"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Kitchen top shelf"
    assert "id" in data


def test_rename_location(client):
    # RED until Plan 02-02 — router implementation
    create_resp = client.post("/api/locations/", json={"name": "Old shelf name"})
    assert create_resp.status_code == 201
    loc_id = create_resp.json()["id"]

    patch_resp = client.patch(f"/api/locations/{loc_id}", json={"name": "New shelf name"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "New shelf name"


def test_delete_location(client):
    # RED until Plan 02-02 — router implementation
    create_resp = client.post("/api/locations/", json={"name": "Garage shelf"})
    assert create_resp.status_code == 201
    loc_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/locations/{loc_id}")
    assert del_resp.status_code in {200, 204}


def test_delete_location_nullifies_item_refs(client):
    # RED until Plan 02-02 — router implementation
    # Per Pitfall 7: deleting a location must nullify location_id on items, not cascade-delete.
    loc_resp = client.post("/api/locations/", json={"name": "Basement"})
    assert loc_resp.status_code == 201
    loc_id = loc_resp.json()["id"]

    item_resp = client.post("/api/items/", json={"name": "Old Lamp", "location_id": loc_id})
    assert item_resp.status_code == 201
    item_id = item_resp.json()["id"]

    del_resp = client.delete(f"/api/locations/{loc_id}")
    assert del_resp.status_code in {200, 204}

    # Item must still exist with location_id nullified
    list_resp = client.get("/api/items/")
    assert list_resp.status_code == 200
    items = list_resp.json()
    matching = [i for i in items if i["id"] == item_id]
    assert len(matching) == 1
    assert matching[0]["location_id"] is None
