"""INFRA-02: app works under HA ingress (relative paths, no hard-coded prefix)."""
import re
from pathlib import Path


def test_main_has_no_hardcoded_ingress_prefix():
    """Regression guard: main.py must not embed any HA ingress path prefix.

    HA Supervisor strips /api/hassio_ingress/<token>/ before forwarding, and
    Vite base='./' makes assets relative. If main.py ever adds a prefix
    rewrite, that is a bug.
    """
    main_py = Path(__file__).resolve().parent.parent / "main.py"
    src = main_py.read_text(encoding="utf-8")
    assert "api/hassio_ingress" not in src, "main.py must not reference ingress prefix"


def test_healthz_under_simulated_ingress(client):
    r = client.get(
        "/healthz",
        headers={
            "X-Ingress-Path": "/api/hassio_ingress/abc123",
            "X-Ingress-Remote-User-Name": "alice",
        },
    )
    assert r.status_code == 200
