"""INFRA-01 / INFRA-05: /healthz endpoint reachable with and without ingress."""
from fastapi.testclient import TestClient


def test_healthz(client: TestClient):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_direct_port(client: TestClient):
    """INFRA-05: direct port has no HA auth -- /healthz must work with zero headers."""
    r = client.get("/healthz", headers={})
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
