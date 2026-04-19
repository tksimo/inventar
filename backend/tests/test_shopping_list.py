"""Tests for GET /api/shopping-list/ — Wave 0 RED + GREEN tests (SHOP-01, D-02, D-03).

Wave 0 tests (1-12) cover the auto-population contract, deduplication, and ordering.
They FAIL before the router is registered (RED phase) and PASS after Task 2 (GREEN phase).

Wave 1 tests (13-30) cover the write endpoints: POST/DELETE/PATCH/check-off.
They FAIL (RED) until Plan 02 Task 2 implements the endpoints (GREEN).
"""
import pytest
from sqlalchemy import inspect
from db.database import engine, SessionLocal
from models import Item, ShoppingListEntry, QuantityMode, StockStatus, Transaction


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        # Wipe shopping_list and items before each test for isolation
        session.query(ShoppingListEntry).delete()
        session.query(Item).delete()
        session.commit()
        yield session
    finally:
        session.close()


def _make_item(session, *, name="X", threshold=None, quantity=None,
               quantity_mode=QuantityMode.EXACT, status=None, archived=False):
    item = Item(
        name=name,
        quantity_mode=quantity_mode,
        quantity=quantity,
        status=status,
        reorder_threshold=threshold,
        archived=archived,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def test_sort_order_column_exists():
    """Migration 0004 added sort_order INTEGER nullable to shopping_list."""
    insp = inspect(engine)
    cols = {c["name"]: c for c in insp.get_columns("shopping_list")}
    assert "sort_order" in cols
    # SQLAlchemy reports SQLite INTEGER as Integer
    assert "INT" in str(cols["sort_order"]["type"]).upper()
    assert cols["sort_order"]["nullable"] is True


def test_get_empty_list_returns_200_with_empty_array(client, db_session):
    r = client.get("/api/shopping-list/")
    assert r.status_code == 200
    assert r.json() == []


def test_item_with_null_threshold_not_auto_populated(client, db_session):
    # D-03: threshold IS NULL never auto-appears
    _make_item(db_session, name="Salt", threshold=None, quantity=0)
    r = client.get("/api/shopping-list/")
    assert r.status_code == 200
    assert r.json() == []


def test_item_below_threshold_auto_populated(client, db_session):
    # SHOP-01 / D-02: quantity (2) <= threshold (3) -> auto-include
    item = _make_item(db_session, name="Milk", threshold=3, quantity=2)
    r = client.get("/api/shopping-list/")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    row = body[0]
    assert row["item_id"] == item.id
    assert row["auto"] is True
    assert row["id"] is None
    assert row["item_name"] == "Milk"
    assert row["quantity"] == 2


def test_item_at_threshold_auto_populated(client, db_session):
    _make_item(db_session, name="Bread", threshold=3, quantity=3)
    body = client.get("/api/shopping-list/").json()
    assert len(body) == 1


def test_item_above_threshold_not_auto_populated(client, db_session):
    _make_item(db_session, name="Detergent", threshold=3, quantity=4)
    assert client.get("/api/shopping-list/").json() == []


def test_item_status_out_auto_populated(client, db_session):
    # D-02: status='out' always auto-appears (regardless of threshold)
    item = _make_item(
        db_session, name="Oil",
        quantity_mode=QuantityMode.STATUS,
        status=StockStatus.OUT,
        threshold=None,
        quantity=None,
    )
    body = client.get("/api/shopping-list/").json()
    assert len(body) == 1
    assert body[0]["item_id"] == item.id
    assert body[0]["auto"] is True


def test_item_status_have_not_auto_populated(client, db_session):
    _make_item(
        db_session, name="Vinegar",
        quantity_mode=QuantityMode.STATUS,
        status=StockStatus.HAVE,
        threshold=None,
        quantity=None,
    )
    assert client.get("/api/shopping-list/").json() == []


def test_archived_item_not_auto_populated(client, db_session):
    _make_item(db_session, name="Legacy", threshold=3, quantity=0, archived=True)
    assert client.get("/api/shopping-list/").json() == []


def test_manual_entry_deduplicated_with_auto(client, db_session):
    # Pitfall 2: if a shopping_list row already exists for an item,
    # do NOT emit a separate auto-entry. Return the persisted row.
    item = _make_item(db_session, name="Coffee", threshold=3, quantity=0)
    entry = ShoppingListEntry(
        item_id=item.id,
        added_manually=True,
        checked_off=False,
        sort_order=5,
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    body = client.get("/api/shopping-list/").json()
    assert len(body) == 1
    row = body[0]
    assert row["id"] == entry.id
    assert row["auto"] is False
    assert row["added_manually"] is True
    assert row["sort_order"] == 5


def test_manual_entry_appears_even_when_stock_ok(client, db_session):
    item = _make_item(db_session, name="Butter", threshold=3, quantity=10)
    entry = ShoppingListEntry(
        item_id=item.id, added_manually=True, checked_off=False, sort_order=1,
    )
    db_session.add(entry)
    db_session.commit()

    body = client.get("/api/shopping-list/").json()
    assert len(body) == 1
    assert body[0]["auto"] is False


def test_sort_order_ordering(client, db_session):
    # Order: persisted sort_order ASC NULLS LAST, then name ASC for ties/autos
    a = _make_item(db_session, name="Apples", threshold=3, quantity=10)
    b = _make_item(db_session, name="Bananas", threshold=3, quantity=10)
    c = _make_item(db_session, name="Cherries", threshold=3, quantity=0)  # auto

    db_session.add_all([
        ShoppingListEntry(item_id=a.id, added_manually=True, sort_order=2),
        ShoppingListEntry(item_id=b.id, added_manually=True, sort_order=1),
    ])
    db_session.commit()

    body = client.get("/api/shopping-list/").json()
    names = [row["item_name"] for row in body]
    assert names == ["Bananas", "Apples", "Cherries"]


# ---------------------------------------------------------------------------
# Wave 1: Write endpoints (Tests 13-30) — RED until Plan 02 Task 2
# ---------------------------------------------------------------------------


def test_post_manual_add_creates_entry(client, db_session):
    # SHOP-02: manual add creates a persisted row with added_manually=True
    item = _make_item(db_session, name="Butter", threshold=None, quantity=10)
    r = client.post("/api/shopping-list/", json={"item_id": item.id})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["id"] is not None
    assert body["item_id"] == item.id
    assert body["added_manually"] is True
    assert body["sort_order"] == 1
    assert body["auto"] is False


def test_post_second_add_assigns_next_sort_order(client, db_session):
    # Second manual add gets sort_order=2
    a = _make_item(db_session, name="A")
    b = _make_item(db_session, name="B")
    client.post("/api/shopping-list/", json={"item_id": a.id})
    r = client.post("/api/shopping-list/", json={"item_id": b.id})
    assert r.json()["sort_order"] == 2


def test_post_duplicate_returns_409(client, db_session):
    # Pitfall 2: no duplicate entries per item_id
    item = _make_item(db_session)
    r1 = client.post("/api/shopping-list/", json={"item_id": item.id})
    assert r1.status_code == 201
    r2 = client.post("/api/shopping-list/", json={"item_id": item.id})
    assert r2.status_code == 409
    assert "already" in r2.json()["detail"].lower()


def test_post_unknown_item_returns_404(client, db_session):
    r = client.post("/api/shopping-list/", json={"item_id": 99999})
    assert r.status_code == 404


def test_post_archived_item_returns_404(client, db_session):
    item = _make_item(db_session, archived=True)
    r = client.post("/api/shopping-list/", json={"item_id": item.id})
    assert r.status_code == 404


def test_post_extra_fields_rejected(client, db_session):
    # T-04-01: extra fields must be rejected (extra="forbid" on ShoppingListCreate)
    item = _make_item(db_session)
    r = client.post("/api/shopping-list/", json={"item_id": item.id, "checked_off": True})
    assert r.status_code == 422


def test_delete_removes_entry(client, db_session):
    item = _make_item(db_session, name="Apples", threshold=None, quantity=5)
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    r = client.delete(f"/api/shopping-list/{entry_id}")
    assert r.status_code in (200, 204)
    body = client.get("/api/shopping-list/").json()
    assert all(row.get("id") != entry_id for row in body)


def test_delete_unknown_returns_404(client, db_session):
    assert client.delete("/api/shopping-list/99999").status_code == 404


def test_patch_updates_sort_order(client, db_session):
    a = _make_item(db_session, name="A")
    b = _make_item(db_session, name="B")
    e1 = client.post("/api/shopping-list/", json={"item_id": a.id}).json()["id"]
    client.post("/api/shopping-list/", json={"item_id": b.id})
    r = client.patch(f"/api/shopping-list/{e1}", json={"sort_order": 99})
    assert r.status_code == 200
    assert r.json()["sort_order"] == 99


def test_patch_sort_order_out_of_bounds_returns_422(client, db_session):
    # T-04-09: sort_order must be in [1, 10000]
    item = _make_item(db_session)
    e = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    assert client.patch(f"/api/shopping-list/{e}", json={"sort_order": 0}).status_code == 422
    assert client.patch(f"/api/shopping-list/{e}", json={"sort_order": 999999}).status_code == 422


def test_patch_unknown_returns_404(client, db_session):
    assert client.patch("/api/shopping-list/99999", json={"sort_order": 1}).status_code == 404


def test_check_off_removes_entry_when_above_threshold(client, db_session):
    # SHOP-03, D-08 non-zero threshold: quantity+added >= threshold → remove
    item = _make_item(db_session, name="Milk", threshold=3, quantity=1)
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    r = client.post(f"/api/shopping-list/{entry_id}/check-off", json={"quantity_added": 3})
    assert r.status_code == 200
    db_session.expire_all()
    refreshed = db_session.query(Item).filter(Item.id == item.id).one()
    assert refreshed.quantity == 4
    body = client.get("/api/shopping-list/").json()
    assert all(row.get("id") != entry_id for row in body)
    # Attribution transaction recorded
    txns = db_session.query(Transaction).filter(
        Transaction.item_id == item.id,
        Transaction.action == "quantity_change",
    ).all()
    assert len(txns) == 1
    assert txns[0].delta == 3


def test_check_off_keeps_entry_when_below_threshold(client, db_session):
    # Pitfall 6: threshold=5, bought 1 → new qty 2 < threshold → entry stays
    item = _make_item(db_session, name="Bread", threshold=5, quantity=1)
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    r = client.post(f"/api/shopping-list/{entry_id}/check-off", json={"quantity_added": 1})
    assert r.status_code == 200
    db_session.expire_all()
    assert db_session.query(Item).filter(Item.id == item.id).one().quantity == 2
    body = client.get("/api/shopping-list/").json()
    found = [row for row in body if row.get("id") == entry_id]
    assert len(found) == 1
    assert found[0]["quantity"] == 2


def test_check_off_removes_when_threshold_zero(client, db_session):
    # D-08 default path: threshold=0, bought 1 → new_qty=1 >= 0 → removed
    item = _make_item(db_session, name="Salt", threshold=0, quantity=0)
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    r = client.post(f"/api/shopping-list/{entry_id}/check-off", json={"quantity_added": 1})
    assert r.status_code == 200
    db_session.expire_all()
    assert db_session.query(Item).filter(Item.id == item.id).one().quantity == 1
    body = client.get("/api/shopping-list/").json()
    assert all(row.get("id") != entry_id for row in body)


def test_check_off_flips_status_item_to_exact(client, db_session):
    # RSTO-03 + status mode: restocking flips to exact with new quantity
    item = _make_item(
        db_session, name="Oil",
        quantity_mode=QuantityMode.STATUS,
        status=StockStatus.OUT,
        quantity=None, threshold=None,
    )
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    r = client.post(f"/api/shopping-list/{entry_id}/check-off", json={"quantity_added": 2})
    assert r.status_code == 200
    db_session.expire_all()
    refreshed = db_session.query(Item).filter(Item.id == item.id).one()
    assert refreshed.quantity_mode == QuantityMode.EXACT
    assert refreshed.quantity == 2
    assert refreshed.status is None
    body = client.get("/api/shopping-list/").json()
    assert all(row.get("id") != entry_id for row in body)


def test_check_off_quantity_added_must_be_positive(client, db_session):
    # T-04-02: quantity_added must be > 0
    item = _make_item(db_session)
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    assert client.post(f"/api/shopping-list/{entry_id}/check-off", json={"quantity_added": 0}).status_code == 422
    assert client.post(f"/api/shopping-list/{entry_id}/check-off", json={"quantity_added": -3}).status_code == 422


def test_check_off_unknown_returns_404(client, db_session):
    r = client.post("/api/shopping-list/99999/check-off", json={"quantity_added": 1})
    assert r.status_code == 404


def test_check_off_records_transaction_attribution(client, db_session):
    # T-04-11: check-off records ha_user_name from HA ingress header
    # Using same headers as test_items.py attribution tests
    item = _make_item(db_session, name="Eggs", threshold=3, quantity=1)
    entry_id = client.post("/api/shopping-list/", json={"item_id": item.id}).json()["id"]
    headers = {
        "X-Ingress-Remote-User-Name": "Alice",
        "X-Ingress-Remote-User-ID": "alice-123",
    }
    r = client.post(
        f"/api/shopping-list/{entry_id}/check-off",
        json={"quantity_added": 3},
        headers=headers,
    )
    assert r.status_code == 200
    db_session.expire_all()
    txn = db_session.query(Transaction).filter(
        Transaction.item_id == item.id,
        Transaction.action == "quantity_change",
    ).order_by(Transaction.id.desc()).first()
    assert txn is not None
    assert txn.ha_user_name == "Alice"


# ---------------------------------------------------------------------------
# Plan 05 (gap closure): POST /api/shopping-list/items/{item_id}/restock
# Fixes UAT Test 6 Gap 1 — auto entries (id=None) could not be checked off.
# ---------------------------------------------------------------------------


def test_restock_by_item_auto_entry_happy_path(client, db_session):
    item = _make_item(db_session, name="Milk", threshold=0, quantity=0)
    body_before = client.get("/api/shopping-list/").json()
    assert len(body_before) == 1
    assert body_before[0]["auto"] is True
    assert body_before[0]["id"] is None
    assert body_before[0]["item_id"] == item.id

    r = client.post(
        f"/api/shopping-list/items/{item.id}/restock",
        json={"quantity_added": 1},
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["ok"] is True
    assert payload["removed"] is True
    assert payload["item_id"] == item.id
    assert payload["new_quantity"] == 1

    db_session.expire_all()
    refreshed = db_session.query(Item).filter(Item.id == item.id).one()
    assert refreshed.quantity == 1

    txn = db_session.query(Transaction).filter(
        Transaction.item_id == item.id,
        Transaction.action == "quantity_change",
    ).order_by(Transaction.id.desc()).first()
    assert txn is not None
    assert txn.delta == 1

    assert client.get("/api/shopping-list/").json() == []


def test_restock_by_item_status_out_flips_to_exact(client, db_session):
    item = _make_item(
        db_session, name="Oil",
        quantity_mode=QuantityMode.STATUS,
        status=StockStatus.OUT,
        quantity=None, threshold=None,
    )
    r = client.post(
        f"/api/shopping-list/items/{item.id}/restock",
        json={"quantity_added": 3},
    )
    assert r.status_code == 200

    db_session.expire_all()
    refreshed = db_session.query(Item).filter(Item.id == item.id).one()
    assert refreshed.quantity_mode == QuantityMode.EXACT
    assert refreshed.quantity == 3
    assert refreshed.status is None

    assert client.get("/api/shopping-list/").json() == []


def test_restock_by_item_kept_on_list_when_persisted_and_below_threshold(client, db_session):
    item = _make_item(db_session, name="Bread", threshold=5, quantity=1)
    entry_id = client.post(
        "/api/shopping-list/", json={"item_id": item.id}
    ).json()["id"]

    r = client.post(
        f"/api/shopping-list/items/{item.id}/restock",
        json={"quantity_added": 1},
    )
    assert r.status_code == 200
    payload = r.json()
    assert payload["removed"] is False

    db_session.expire_all()
    assert db_session.query(Item).filter(Item.id == item.id).one().quantity == 2

    body = client.get("/api/shopping-list/").json()
    matching = [row for row in body if row.get("id") == entry_id]
    assert len(matching) == 1
    assert matching[0]["quantity"] == 2


def test_restock_by_item_deletes_persisted_entry_when_above_threshold(client, db_session):
    item = _make_item(db_session, name="Eggs", threshold=3, quantity=1)
    entry_id = client.post(
        "/api/shopping-list/", json={"item_id": item.id}
    ).json()["id"]

    r = client.post(
        f"/api/shopping-list/items/{item.id}/restock",
        json={"quantity_added": 5},
    )
    assert r.status_code == 200
    assert r.json()["removed"] is True

    db_session.expire_all()
    assert db_session.query(Item).filter(Item.id == item.id).one().quantity == 6

    body = client.get("/api/shopping-list/").json()
    assert all(row.get("id") != entry_id for row in body)
    assert all(row["item_id"] != item.id for row in body)


def test_restock_by_item_unknown_returns_404(client, db_session):
    r = client.post(
        "/api/shopping-list/items/99999/restock",
        json={"quantity_added": 1},
    )
    assert r.status_code == 404


def test_restock_by_item_archived_returns_404(client, db_session):
    item = _make_item(db_session, name="Legacy", threshold=3, quantity=0, archived=True)
    r = client.post(
        f"/api/shopping-list/items/{item.id}/restock",
        json={"quantity_added": 1},
    )
    assert r.status_code == 404


def test_restock_by_item_quantity_added_bounds(client, db_session):
    item = _make_item(db_session, name="Test", threshold=0, quantity=0)
    url = f"/api/shopping-list/items/{item.id}/restock"
    assert client.post(url, json={"quantity_added": 0}).status_code == 422
    assert client.post(url, json={"quantity_added": -1}).status_code == 422
    assert client.post(url, json={"quantity_added": 20000}).status_code == 422
