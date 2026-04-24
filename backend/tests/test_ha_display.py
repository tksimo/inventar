"""Tests for GET /api/ha/summary — Wave 0 RED + GREEN tests (HA-01, HA-02).

These tests define the full contract for the HA summary endpoint:
  - Response shape and key set (D-02)
  - Low/out-of-stock logic including boundary and no-double-count guard
  - Archived items excluded everywhere
  - CORS headers present on cross-origin requests (T-06-02)
  - No X-Frame-Options or CSP frame-ancestors header blocking iframe embedding (HA-02)
"""
import pytest
from db.database import SessionLocal
from models import Item, QuantityMode, StockStatus


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        # Wipe items before each test for isolation
        session.query(Item).delete()
        session.commit()
        yield session
    finally:
        session.close()


def _make_item(
    session,
    *,
    name="X",
    quantity_mode=QuantityMode.EXACT,
    quantity=None,
    status=None,
    threshold=None,
    archived=False,
):
    """Create and persist a test Item. Returns the refreshed ORM object."""
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


# ---------------------------------------------------------------------------
# Basic contract tests
# ---------------------------------------------------------------------------


def test_no_auth_required(client, db_session):
    """D-03: GET /api/ha/summary with no auth headers returns 200."""
    r = client.get("/api/ha/summary")
    assert r.status_code == 200


def test_response_shape_has_all_keys(client, db_session):
    """D-02: Response JSON contains exactly the 5 expected keys."""
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    expected_keys = {
        "low_stock_count",
        "out_of_stock_count",
        "total_items",
        "low_stock_items",
        "out_of_stock_items",
    }
    assert set(body.keys()) == expected_keys


def test_empty_inventory(client, db_session):
    """Fresh DB returns zeroed response."""
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    assert r.json() == {
        "low_stock_count": 0,
        "out_of_stock_count": 0,
        "total_items": 0,
        "low_stock_items": [],
        "out_of_stock_items": [],
    }


# ---------------------------------------------------------------------------
# Low-stock tests
# ---------------------------------------------------------------------------


def test_low_stock_status_mode(client, db_session):
    """STATUS mode, status=LOW → appears in low_stock_items."""
    _make_item(db_session, name="Milk", quantity_mode=QuantityMode.STATUS, status=StockStatus.LOW)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Milk" in body["low_stock_items"]
    assert body["low_stock_count"] == 1


def test_low_stock_exact_mode(client, db_session):
    """EXACT mode with quantity < reorder_threshold → appears in low_stock_items."""
    _make_item(db_session, name="Coffee", quantity_mode=QuantityMode.EXACT, quantity=1, threshold=3)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Coffee" in body["low_stock_items"]
    assert body["low_stock_count"] == 1


def test_low_stock_exact_at_threshold_boundary(client, db_session):
    """EXACT mode with quantity == reorder_threshold is still low-stock (inclusive)."""
    _make_item(db_session, name="Tea", quantity_mode=QuantityMode.EXACT, quantity=3, threshold=3)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Tea" in body["low_stock_items"]
    assert body["low_stock_count"] == 1


def test_low_stock_exact_requires_threshold_set(client, db_session):
    """EXACT mode with quantity=0 but reorder_threshold=None does NOT appear in low_stock_items.
    It may still appear in out_of_stock_items via the quantity=0 rule (Pitfall 3).
    """
    _make_item(db_session, name="Salt", quantity_mode=QuantityMode.EXACT, quantity=0, threshold=None)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    # Must NOT be in low_stock
    assert "Salt" not in body["low_stock_items"]
    assert body["low_stock_count"] == 0


# ---------------------------------------------------------------------------
# Out-of-stock tests
# ---------------------------------------------------------------------------


def test_out_of_stock_status_mode(client, db_session):
    """STATUS mode, status=OUT → appears in out_of_stock_items."""
    _make_item(db_session, name="Pasta", quantity_mode=QuantityMode.STATUS, status=StockStatus.OUT)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Pasta" in body["out_of_stock_items"]
    assert body["out_of_stock_count"] == 1


def test_out_of_stock_exact_zero(client, db_session):
    """EXACT mode with quantity=0 → appears in out_of_stock_items."""
    _make_item(db_session, name="Rice", quantity_mode=QuantityMode.EXACT, quantity=0)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Rice" in body["out_of_stock_items"]
    assert body["out_of_stock_count"] == 1


def test_no_double_count(client, db_session):
    """EXACT mode with quantity=0 AND reorder_threshold=5 appears ONLY in out_of_stock_items.
    low_stock_count must be 0. (Pitfall 4 guard)
    """
    _make_item(db_session, name="Oats", quantity_mode=QuantityMode.EXACT, quantity=0, threshold=5)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Oats" in body["out_of_stock_items"]
    assert "Oats" not in body["low_stock_items"]
    assert body["low_stock_count"] == 0
    assert body["out_of_stock_count"] == 1


def test_exact_quantity_none_not_out_of_stock(client, db_session):
    """EXACT mode with quantity=None does NOT appear in out_of_stock_items (Pitfall 3)."""
    _make_item(db_session, name="Sugar", quantity_mode=QuantityMode.EXACT, quantity=None, threshold=None)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "Sugar" not in body["out_of_stock_items"]
    assert body["out_of_stock_count"] == 0


# ---------------------------------------------------------------------------
# Archived item exclusion
# ---------------------------------------------------------------------------


def test_archived_excluded(client, db_session):
    """Archived items do not appear in any list and are not counted."""
    _make_item(
        db_session,
        name="OldItem",
        quantity_mode=QuantityMode.STATUS,
        status=StockStatus.OUT,
        archived=True,
    )
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    body = r.json()
    assert "OldItem" not in body["out_of_stock_items"]
    assert "OldItem" not in body["low_stock_items"]
    assert body["total_items"] == 0
    assert body["out_of_stock_count"] == 0


def test_total_items_counts_active_only(client, db_session):
    """total_items equals count of non-archived items only."""
    _make_item(db_session, name="A", quantity_mode=QuantityMode.EXACT, quantity=10)
    _make_item(db_session, name="B", quantity_mode=QuantityMode.EXACT, quantity=10)
    _make_item(db_session, name="C", quantity_mode=QuantityMode.EXACT, quantity=10)
    _make_item(db_session, name="Archived", quantity_mode=QuantityMode.EXACT, quantity=0, archived=True)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    assert r.json()["total_items"] == 3


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------


def test_item_names_sorted_alphabetically(client, db_session):
    """low_stock_items are sorted alphabetically by name."""
    _make_item(db_session, name="Zebra", quantity_mode=QuantityMode.STATUS, status=StockStatus.LOW)
    _make_item(db_session, name="Apple", quantity_mode=QuantityMode.STATUS, status=StockStatus.LOW)
    _make_item(db_session, name="Milk", quantity_mode=QuantityMode.STATUS, status=StockStatus.LOW)
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    assert r.json()["low_stock_items"] == ["Apple", "Milk", "Zebra"]


# ---------------------------------------------------------------------------
# Header tests (HA-02 — iframe embedding compatibility)
# ---------------------------------------------------------------------------


def test_no_xframe_options_header(client, db_session):
    """Response does NOT contain X-Frame-Options header (HA-02 — enables iframe embedding)."""
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    assert "x-frame-options" not in {k.lower() for k in r.headers.keys()}


def test_no_csp_frame_ancestors(client, db_session):
    """If a Content-Security-Policy header is present it must NOT contain frame-ancestors (HA-02)."""
    r = client.get("/api/ha/summary")
    assert r.status_code == 200
    csp = r.headers.get("content-security-policy", "")
    assert "frame-ancestors" not in csp.lower()


def test_cors_header_present_on_origin_request(client, db_session):
    """Cross-origin GET returns Access-Control-Allow-Origin: * (T-06-02, CORS config)."""
    r = client.get("/api/ha/summary", headers={"Origin": "http://homeassistant.local:8123"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
