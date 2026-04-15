"""Wave 0 test scaffolds for Items API.

Schema unit tests: GREEN after Plan 02-01.
Router-level tests: RED until Plan 02-02 (routers not yet implemented).

Covers: ITEM-03/04/05/06, QTY-01/02/03/04, ORG-03/05/06, USER-02/03
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


# ---------------------------------------------------------------------------
# GREEN after Plan 02-01 — schema unit test
# ---------------------------------------------------------------------------

def test_item_response_serializes_enum_as_lowercase_string():
    """ItemResponse.model_validate serializes QuantityMode.EXACT as 'exact', not 'EXACT'."""
    # GREEN after Plan 02-01 — schema unit test
    from models import Item, QuantityMode
    from schemas import ItemResponse

    item = Item(
        id=1,
        name="Test Item",
        quantity_mode=QuantityMode.EXACT,
        archived=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    result = ItemResponse.model_validate(item).model_dump()
    assert result["quantity_mode"] == "exact", f"Expected 'exact', got {result['quantity_mode']!r}"
    assert result["status"] is None


def test_item_update_exclude_unset():
    """ItemUpdate.model_dump(exclude_unset=True) returns only explicitly set fields."""
    # GREEN after Plan 02-01 — schema unit test
    from schemas import ItemUpdate

    update = ItemUpdate(quantity=5)
    dumped = update.model_dump(exclude_unset=True)
    assert dumped == {"quantity": 5}, f"Expected only quantity, got: {dumped}"


def test_item_create_rejects_unknown_fields():
    """ItemCreate rejects unknown fields (extra='forbid')."""
    # GREEN after Plan 02-01 — schema unit test
    from pydantic import ValidationError
    from schemas import ItemCreate

    with pytest.raises(ValidationError):
        ItemCreate(name="Milk", unknown_field="bad")


def test_item_create_requires_name():
    """ItemCreate requires name with min_length=1."""
    # GREEN after Plan 02-01 — schema unit test
    from pydantic import ValidationError
    from schemas import ItemCreate

    with pytest.raises(ValidationError):
        ItemCreate(name="")


def test_enum_values_lowercase_in_schema():
    """ItemResponse serializes StockStatus.HAVE as 'have'."""
    # GREEN after Plan 02-01 — schema unit test
    from models import Item, QuantityMode, StockStatus
    from schemas import ItemResponse

    item = Item(
        id=2,
        name="Status Item",
        quantity_mode=QuantityMode.STATUS,
        status=StockStatus.HAVE,
        archived=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    result = ItemResponse.model_validate(item).model_dump()
    assert result["status"] == "have", f"Expected 'have', got {result['status']!r}"
    assert result["quantity_mode"] == "status"


# ---------------------------------------------------------------------------
# RED until Plan 02-02 — router implementation
# ---------------------------------------------------------------------------

def test_create_item(client):
    # RED until Plan 02-02 — router implementation
    response = client.post("/api/items/", json={"name": "Milk"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Milk"


def test_update_item(client):
    # RED until Plan 02-02 — router implementation
    create_resp = client.post("/api/items/", json={"name": "Cheese"})
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    patch_resp = client.patch(f"/api/items/{item_id}", json={"notes": "gouda"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["notes"] == "gouda"


def test_delete_item(client):
    # RED until Plan 02-02 — router implementation
    create_resp = client.post("/api/items/", json={"name": "Butter"})
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    del_resp = client.delete(f"/api/items/{item_id}")
    assert del_resp.status_code in {200, 204}


def test_item_notes(client):
    # RED until Plan 02-02 — router implementation
    resp = client.post("/api/items/", json={"name": "Yoghurt", "notes": "Greek style"})
    assert resp.status_code == 201
    assert resp.json()["notes"] == "Greek style"


def test_exact_quantity(client):
    # RED until Plan 02-02 — router implementation
    resp = client.post("/api/items/", json={"name": "Apples", "quantity": 6.0, "quantity_mode": "exact"})
    assert resp.status_code == 201
    assert resp.json()["quantity"] == 6.0
    assert resp.json()["quantity_mode"] == "exact"


def test_status_mode(client):
    # RED until Plan 02-02 — router implementation
    resp = client.post("/api/items/", json={"name": "Soap", "quantity_mode": "status", "status": "have"})
    assert resp.status_code == 201
    assert resp.json()["status"] == "have"


def test_reorder_threshold(client):
    # RED until Plan 02-02 — router implementation
    resp = client.post("/api/items/", json={"name": "Coffee", "reorder_threshold": 2.0})
    assert resp.status_code == 201
    assert resp.json()["reorder_threshold"] == 2.0


def test_quantity_quick_update(client):
    # RED until Plan 02-02 — router implementation
    create_resp = client.post("/api/items/", json={"name": "Eggs", "quantity": 10.0})
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    patch_resp = client.patch(f"/api/items/{item_id}", json={"quantity": 4})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["quantity"] == 4.0


def test_auto_flip_to_out(client):
    # RED until Plan 02-02 — router implementation
    create_resp = client.post("/api/items/", json={"name": "Pepper"})
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    patch_resp = client.patch(
        f"/api/items/{item_id}",
        json={"quantity_mode": "status", "status": "out", "quantity": None},
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["quantity_mode"] == "status"
    assert data["status"] == "out"


def test_transaction_on_create(client):
    # RED until Plan 02-02 — router implementation
    from db.database import SessionLocal
    from models import Transaction

    resp = client.post("/api/items/", json={"name": "Bread"})
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    with SessionLocal() as session:
        txn = session.query(Transaction).filter_by(item_id=item_id, action="add").first()
    assert txn is not None


def test_transaction_on_update(client):
    # RED until Plan 02-02 — router implementation
    from db.database import SessionLocal
    from models import Transaction

    create_resp = client.post("/api/items/", json={"name": "Pasta"})
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    client.patch(f"/api/items/{item_id}", json={"notes": "wholegrain"})

    with SessionLocal() as session:
        updates = session.query(Transaction).filter_by(item_id=item_id, action="update").all()
    assert len(updates) == 1


def test_transaction_attribution(client):
    # RED until Plan 02-02 — router implementation
    from db.database import SessionLocal
    from models import Transaction

    headers = {
        "X-Ingress-Remote-User-Name": "Alice",
        "X-Ingress-Remote-User-ID": "alice-123",
    }
    resp = client.post("/api/items/", json={"name": "Rice"}, headers=headers)
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    with SessionLocal() as session:
        txn = session.query(Transaction).filter_by(item_id=item_id, action="add").first()
    assert txn is not None
    assert txn.ha_user_name == "Alice"


def test_items_include_category(client):
    # RED until Plan 02-02 — router implementation
    cat_resp = client.post("/api/categories/", json={"name": "Test Cat"})
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    item_resp = client.post("/api/items/", json={"name": "Canned beans", "category_id": cat_id})
    assert item_resp.status_code == 201

    list_resp = client.get("/api/items/")
    assert list_resp.status_code == 200
    items = list_resp.json()
    matching = [i for i in items if i["name"] == "Canned beans"]
    assert len(matching) == 1
    assert matching[0]["category_id"] == cat_id


def test_items_include_location(client):
    # RED until Plan 02-02 — router implementation
    loc_resp = client.post("/api/locations/", json={"name": "Top shelf"})
    assert loc_resp.status_code == 201
    loc_id = loc_resp.json()["id"]

    item_resp = client.post("/api/items/", json={"name": "Cereal", "location_id": loc_id})
    assert item_resp.status_code == 201

    list_resp = client.get("/api/items/")
    assert list_resp.status_code == 200
    items = list_resp.json()
    matching = [i for i in items if i["name"] == "Cereal"]
    assert len(matching) == 1
    assert matching[0]["location_id"] == loc_id


def test_item_location(client):
    # RED until Plan 02-02 — router implementation
    loc_resp = client.post("/api/locations/", json={"name": "Fridge door"})
    assert loc_resp.status_code == 201
    loc_id = loc_resp.json()["id"]

    item_resp = client.post("/api/items/", json={"name": "Butter", "location_id": loc_id})
    assert item_resp.status_code == 201
    assert item_resp.json()["location_id"] == loc_id


def test_items_no_cache(client):
    # RED until Plan 02-02 — router implementation
    resp = client.get("/api/items/")
    assert resp.status_code == 200
    cache_control = resp.headers.get("cache-control", "")
    # Should be absent or explicitly no-cache
    assert cache_control == "" or "no-cache" in cache_control or "no-store" in cache_control


def test_last_updated_by_name_populated(client):
    # RED until Plan 02-02 — router implementation
    headers = {
        "X-Ingress-Remote-User-Name": "Alice",
        "X-Ingress-Remote-User-ID": "alice-123",
    }
    create_resp = client.post("/api/items/", json={"name": "Olive oil"}, headers=headers)
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    client.patch(f"/api/items/{item_id}", json={"notes": "extra virgin"}, headers=headers)

    list_resp = client.get("/api/items/")
    assert list_resp.status_code == 200
    items = list_resp.json()
    matching = [i for i in items if i["id"] == item_id]
    assert len(matching) == 1
    assert matching[0]["last_updated_by_name"] == "Alice"


def test_enum_values_lowercase(client):
    # RED until Plan 02-02 — router implementation
    resp = client.post("/api/items/", json={"name": "Salt", "quantity_mode": "exact"})
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    get_resp = client.get("/api/items/")
    assert get_resp.status_code == 200
    items = get_resp.json()
    matching = [i for i in items if i["id"] == item_id]
    assert len(matching) == 1
    assert matching[0]["quantity_mode"] == "exact"
