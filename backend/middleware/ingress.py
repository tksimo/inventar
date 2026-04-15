"""HA ingress user middleware.

Reads the ONLY correct headers (per RESEARCH.md Q1 and supervisor source):
    X-Ingress-Remote-User-ID
    X-Ingress-Remote-User-Name
    X-Ingress-Remote-User-Display-Name
    X-Ingress-Path

Do NOT read X-Remote-User-* -- those are a pre-release name and are never set
by HA Supervisor.
"""
from __future__ import annotations

from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


@dataclass
class IngressUser:
    id: str | None
    name: str | None
    display_name: str | None
    ingress_path: str | None


class IngressUserMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        h = request.headers
        request.state.user = IngressUser(
            id=h.get("x-ingress-remote-user-id"),
            name=h.get("x-ingress-remote-user-name"),
            display_name=h.get("x-ingress-remote-user-display-name"),
            ingress_path=h.get("x-ingress-path"),
        )
        return await call_next(request)
