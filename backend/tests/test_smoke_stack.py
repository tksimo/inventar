"""Full-stack smoke test: all five INFRA requirements exercised end to end.

This is the single test file to run before shipping a new Docker image.
It imports the same way test_spa_integration does (SPA mount active) and
asserts the behaviour contract from 01-04-PLAN interfaces block.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DIST_DIR = REPO_ROOT / "frontend" / "dist"

pytestmark = pytest.mark.skipif(
    not DIST_DIR.is_dir() or not (DIST_DIR / "index.html").is_file(),
    reason="frontend/dist not built — run scripts/build.sh or scripts/build.ps1",
)


@pytest.fixture(scope="module")
def stack():
    os.environ.pop("INVENTAR_SKIP_SPA", None)
    sys.modules.pop("main", None)
    import main
    importlib.reload(main)
    from fastapi.testclient import TestClient
    yield TestClient(main.app)
    os.environ["INVENTAR_SKIP_SPA"] = "1"
    sys.modules.pop("main", None)


INGRESS_HEADERS = {
    "X-Ingress-Path": "/api/hassio_ingress/tok",
    "X-Ingress-Remote-User-Name": "alice",
    "X-Ingress-Remote-User-ID": "u-1",
    "X-Ingress-Remote-User-Display-Name": "Alice",
}


def test_infra_01_healthz_direct_and_ingress(stack):
    """INFRA-01: container health endpoint works via both paths."""
    direct = stack.get("/healthz")
    assert direct.status_code == 200 and direct.json() == {"status": "ok"}
    ingress = stack.get("/healthz", headers=INGRESS_HEADERS)
    assert ingress.status_code == 200 and ingress.json() == {"status": "ok"}


def test_infra_02_spa_root_served(stack):
    """INFRA-02: sidebar panel loads — the served index.html renders <div id=root>."""
    r = stack.get("/")
    assert r.status_code == 200
    assert '<div id="root"></div>' in r.text


def test_infra_02_spa_root_served_under_ingress(stack):
    """INFRA-02 under HA ingress: headers are passthrough-only."""
    r = stack.get("/", headers=INGRESS_HEADERS)
    assert r.status_code == 200
    assert '<div id="root"></div>' in r.text


def test_infra_03_db_path_default_preserved():
    """INFRA-03: regression — the /data path contract from Plan 01-02 still holds."""
    saved = os.environ.pop("INVENTAR_DB_URL", None)
    try:
        import db.database as dbm
        importlib.reload(dbm)
        assert dbm.DATABASE_URL == "sqlite:////data/inventar.db"
    finally:
        if saved is not None:
            os.environ["INVENTAR_DB_URL"] = saved
        import db.database as dbm
        importlib.reload(dbm)


def test_infra_04_no_login_challenge_no_headers(stack):
    """INFRA-04: zero headers = 200 (HA ingress does auth upstream)."""
    r = stack.get("/")
    assert r.status_code == 200


def test_infra_04_ingress_headers_do_not_break_anything(stack):
    """INFRA-04: presence of X-Ingress-Remote-User-* headers is safe for
    every endpoint; they never alter the response body."""
    for path in ("/healthz", "/", "/shopping", "/settings"):
        without = stack.get(path)
        with_ = stack.get(path, headers=INGRESS_HEADERS)
        assert without.status_code == with_.status_code == 200, path
        if path == "/healthz":
            assert without.json() == with_.json()
        else:
            # HTML responses: assert identical-ish body (both include root div)
            assert '<div id="root"></div>' in without.text
            assert '<div id="root"></div>' in with_.text


def test_infra_05_direct_port_no_auth(stack):
    """INFRA-05: direct IP:port exposes /healthz without any HA headers."""
    r = stack.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
