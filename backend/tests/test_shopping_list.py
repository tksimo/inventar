"""Tests for GET /api/shopping-list/ — Wave 0 RED + GREEN tests (SHOP-01, D-02, D-03).

Wave 0 tests (1-12) cover the auto-population contract, deduplication, and ordering.
They FAIL before the router is registered (RED phase) and PASS after Task 2 (GREEN phase).
"""
import pytest
from sqlalchemy import inspect
from db.database import engine, SessionLocal
from models import Item, ShoppingListEntry, QuantityMode, StockStatus


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
