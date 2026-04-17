"""Wave 0 tests for Phase 3 barcode router (ITEM-02, ITEM-08)."""
from __future__ import annotations

import sys
from pathlib import Path

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


class _FakeResp:
    def __init__(self, *, status_code=200, json_body=None):
        self.status_code = status_code
        self._body = json_body or {}

    def json(self):
        return self._body


def _patch_off(monkeypatch, *, resp=None, raises=None, call_tracker=None):
    async def _fake_get(self, url, **kwargs):
        if call_tracker is not None:
            call_tracker.append(url)
        if raises is not None:
            raise raises
        return resp

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)


def test_barcode_found_returns_normalized_product(client, monkeypatch):
    _patch_off(
        monkeypatch,
        resp=_FakeResp(
            json_body={
                "status": 1,
                "product": {
                    "product_name": "Nutella",
                    "image_url": "https://example.com/nutella.jpg",
                    "nutriments": {
                        "energy-kcal_100g": 539,
                        "proteins_100g": 6.3,
                        "carbohydrates_100g": 57.5,
                        "fat_100g": 30.9,
                    },
                },
            }
        ),
    )
    r = client.get("/api/barcode/3017624010701")
    assert r.status_code == 200
    assert r.json() == {
        "barcode": "3017624010701",
        "name": "Nutella",
        "image_url": "https://example.com/nutella.jpg",
        "calories": 539,
        "protein": 6.3,
        "carbs": 57.5,
        "fat": 30.9,
    }


def test_barcode_not_found_returns_404(client, monkeypatch):
    """Covers ITEM-08: OFF returns status:0 → 404 so frontend falls back to manual entry."""
    _patch_off(
        monkeypatch,
        resp=_FakeResp(
            json_body={"status": 0, "status_verbose": "product not found"}
        ),
    )
    r = client.get("/api/barcode/0000000000000")
    assert r.status_code == 404
    assert r.json() == {"detail": "Product not found"}


def test_barcode_empty_product_name_coerced_to_null(client, monkeypatch):
    """Covers Pitfall 6: OFF stores some products with empty product_name — coerce to None."""
    _patch_off(
        monkeypatch,
        resp=_FakeResp(
            json_body={
                "status": 1,
                "product": {
                    "product_name": "",
                    "image_url": None,
                    "nutriments": {},
                },
            }
        ),
    )
    r = client.get("/api/barcode/1111111111111")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] is None
    assert body["image_url"] is None
    assert body["calories"] is None
    assert body["protein"] is None
    assert body["carbs"] is None
    assert body["fat"] is None


def test_barcode_rejects_non_digit_code(client, monkeypatch):
    """Non-digit path values must be rejected with HTTP 422 before any outbound HTTP call."""
    call_tracker: list = []
    _patch_off(monkeypatch, resp=_FakeResp(), call_tracker=call_tracker)

    r1 = client.get("/api/barcode/abc123")
    assert r1.status_code == 422

    r2 = client.get("/api/barcode/../secret")
    assert r2.status_code == 422

    # FastAPI path validator must reject before handler runs
    assert call_tracker == [], f"httpx was called unexpectedly: {call_tracker}"


def test_barcode_rejects_too_long_code(client, monkeypatch):
    """Barcode codes longer than 20 digits must return HTTP 422."""
    call_tracker: list = []
    _patch_off(monkeypatch, resp=_FakeResp(), call_tracker=call_tracker)

    r = client.get("/api/barcode/123456789012345678901")  # 21 digits
    assert r.status_code == 422


def test_barcode_timeout_returns_504(client, monkeypatch):
    """Covers Pitfall 8: httpx.TimeoutException must map to HTTP 504."""
    _patch_off(monkeypatch, raises=httpx.TimeoutException("timeout"))
    r = client.get("/api/barcode/3017624010701")
    assert r.status_code == 504


def test_barcode_off_5xx_returns_404(client, monkeypatch):
    """Upstream 5xx from OFF → 404 so frontend falls back to manual entry (D-08)."""
    _patch_off(monkeypatch, resp=_FakeResp(status_code=503))
    r = client.get("/api/barcode/3017624010701")
    assert r.status_code == 404


def test_barcode_response_only_whitelisted_fields(client, monkeypatch):
    """Extra OFF fields (brands, ingredients_text) must not appear in response (ASVS V5)."""
    _patch_off(
        monkeypatch,
        resp=_FakeResp(
            json_body={
                "status": 1,
                "product": {
                    "product_name": "X",
                    "image_url": "u",
                    "nutriments": {"energy-kcal_100g": 1},
                    "ingredients_text": "secret",
                    "brands": "leak",
                },
            }
        ),
    )
    r = client.get("/api/barcode/3017624010701")
    assert r.status_code == 200
    assert set(r.json().keys()) == {
        "barcode",
        "name",
        "image_url",
        "calories",
        "protein",
        "carbs",
        "fat",
    }
