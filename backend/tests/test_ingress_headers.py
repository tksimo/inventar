"""INFRA-04: middleware reads X-Ingress-Remote-User-* (NOT X-Remote-User-*)."""
from pathlib import Path


def test_middleware_uses_correct_header_prefix():
    src = (Path(__file__).resolve().parent.parent / "middleware" / "ingress.py").read_text(encoding="utf-8")
    assert "x-ingress-remote-user-name" in src.lower()
    assert "x-ingress-remote-user-id" in src.lower()
    assert "x-ingress-remote-user-display-name" in src.lower()
    # The wrong (pre-release) header name must NOT appear
    lower = src.lower()
    # Guard against the exact wrong strings -- allow substrings like "x-ingress-remote-user" but reject bare "x-remote-user-name"
    assert "x-remote-user-name" not in lower
    assert "x-remote-user-id" not in lower
