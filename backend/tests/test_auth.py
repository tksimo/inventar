"""INFRA-04: HA ingress auth passes through -- no separate login challenge.

The backend does NOT implement its own auth. It reads HA-set headers on every
request via IngressUserMiddleware and attributes actions to the HA user.
"""
from fastapi.testclient import TestClient


def test_no_login_challenge(client: TestClient):
    """/healthz must return 200 with zero auth headers -- HA does auth upstream."""
    r = client.get("/healthz")
    assert r.status_code == 200, "Backend must not challenge for login"


def test_ingress_user_populated(client: TestClient):
    """Sending the correct HA headers populates request.state.user."""
    from starlette.requests import Request
    from middleware.ingress import IngressUser
    from main import app

    captured: dict = {}

    @app.get("/_test_user")
    def _tu(req: Request):
        u: IngressUser = req.state.user
        captured.update(
            id=u.id, name=u.name, display_name=u.display_name, ingress_path=u.ingress_path
        )
        return {"ok": True}

    # Re-create client so the newly added route is registered
    c = TestClient(app)
    r = c.get(
        "/_test_user",
        headers={
            "X-Ingress-Remote-User-ID": "u-42",
            "X-Ingress-Remote-User-Name": "alice",
            "X-Ingress-Remote-User-Display-Name": "Alice Smith",
            "X-Ingress-Path": "/api/hassio_ingress/tok",
        },
    )
    assert r.status_code == 200
    assert captured == {
        "id": "u-42",
        "name": "alice",
        "display_name": "Alice Smith",
        "ingress_path": "/api/hassio_ingress/tok",
    }
