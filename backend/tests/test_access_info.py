"""Tests for GET /api/access-info endpoint (Plan 02-07 Task 2).

Covers four behaviours:
  1. Via ingress with user name: {via_ingress: true, user_name: "Alice"}
  2. No ingress headers: {via_ingress: false, user_name: null}
  3. Ingress path present but no user name: {via_ingress: true, user_name: null}
  4. Endpoint is under /api prefix (accessible without ingress path rewriting).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def test_access_info_via_ingress_with_user(client):
    """Behaviour 1: Ingress path + user name headers -> via_ingress=true, user_name='Alice'."""
    resp = client.get(
        "/api/access-info",
        headers={
            "X-Ingress-Path": "/api/hassio_ingress/abc",
            "X-Ingress-Remote-User-Name": "Alice",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["via_ingress"] is True
    assert data["user_name"] == "Alice"


def test_access_info_no_ingress_headers(client):
    """Behaviour 2: No ingress headers -> via_ingress=false, user_name=null."""
    resp = client.get("/api/access-info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["via_ingress"] is False
    assert data["user_name"] is None


def test_access_info_ingress_path_no_user_name(client):
    """Behaviour 3: X-Ingress-Path present but no user name -> via_ingress=true, user_name=null."""
    resp = client.get(
        "/api/access-info",
        headers={"X-Ingress-Path": "/api/hassio_ingress/abc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["via_ingress"] is True
    assert data["user_name"] is None


def test_access_info_under_api_prefix(client):
    """Behaviour 4: Endpoint is registered under /api prefix."""
    # If it were not under /api, the SPA catch-all would serve index.html instead.
    resp = client.get("/api/access-info")
    assert resp.status_code == 200
    # Response must be JSON with the expected keys
    data = resp.json()
    assert "via_ingress" in data
    assert "user_name" in data
