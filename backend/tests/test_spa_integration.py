"""End-to-end integration: FastAPI + built SPA + API route ordering.

This test suite runs against the REAL frontend/dist artifact produced by
Plan 01-03. It intentionally does NOT set INVENTAR_SKIP_SPA so that
backend/main.py mounts /assets and registers the catch-all route.

If frontend/dist is missing, these tests are skipped with a clear message
telling the developer to run scripts/build.sh first.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = REPO_ROOT / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"
INDEX_HTML = DIST_DIR / "index.html"


def _dist_ready() -> bool:
    return INDEX_HTML.is_file() and ASSETS_DIR.is_dir() and any(ASSETS_DIR.iterdir())


pytestmark = pytest.mark.skipif(
    not _dist_ready(),
    reason="frontend/dist not built — run scripts/build.sh or scripts/build.ps1",
)


@pytest.fixture(scope="module")
def spa_client():
    """Re-import main.py with INVENTAR_SKIP_SPA cleared so the SPA mount is live."""
    # Force re-import so the module-level mount code runs with the flag cleared.
    os.environ.pop("INVENTAR_SKIP_SPA", None)
    for mod in ("main",):
        sys.modules.pop(mod, None)
    import main  # noqa: WPS433 — deliberate re-import inside fixture
    importlib.reload(main)

    from fastapi.testclient import TestClient
    yield TestClient(main.app)

    # Restore the skip flag so other tests in the session continue to run
    # against the unmounted app (conftest.py sets it at session start).
    os.environ["INVENTAR_SKIP_SPA"] = "1"
    sys.modules.pop("main", None)


def test_healthz_still_returns_json(spa_client):
    """API route must still win against the catch-all (RESEARCH.md Pitfall 5)."""
    r = spa_client.get("/healthz")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert r.json() == {"status": "ok"}


def test_root_serves_index_html(spa_client):
    r = spa_client.get("/")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    body = r.text.lstrip().lower()
    assert body.startswith("<!doctype html>"), f"expected HTML, got: {r.text[:120]}"
    assert '<div id="root"></div>' in r.text


def test_index_html_uses_relative_assets(spa_client):
    """CONTEXT.md D-06 regression guard: the served index.html must have
    no absolute /assets references. Absolute roots break under ingress."""
    r = spa_client.get("/")
    assert 'src="/assets' not in r.text
    assert 'href="/assets' not in r.text


def test_assets_mount_serves_a_real_file(spa_client):
    """Pick any file from frontend/dist/assets and fetch it — prove the mount
    is live and ordered before the catch-all."""
    first_asset = next(ASSETS_DIR.iterdir())
    r = spa_client.get(f"/assets/{first_asset.name}")
    assert r.status_code == 200
    ct = r.headers["content-type"]
    # Static assets must NOT be served as text/html (which would mean the
    # catch-all ate the request).
    assert not ct.startswith("text/html"), (
        f"/assets/{first_asset.name} was served as {ct} — "
        "the catch-all is probably registered before the mount"
    )


def test_deep_link_returns_index_html(spa_client):
    """A GET on a SPA-only client route (no backend match) must return
    the SPA index so that refresh/deep-link under HA ingress works."""
    for path in ("/shopping", "/settings", "/does-not-exist"):
        r = spa_client.get(path)
        assert r.status_code == 200, f"deep link {path} failed: {r.status_code}"
        assert r.headers["content-type"].startswith("text/html")
        assert '<div id="root"></div>' in r.text
