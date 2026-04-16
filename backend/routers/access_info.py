"""Direct-vs-ingress access probe.

Frontend (Plan 02-08) calls this on mount to decide whether to show
a banner: 'Open Web UI from Home Assistant to enable attribution.'

via_ingress is true iff the X-Ingress-Path header was injected by the
HA Supervisor ingress proxy. It is the authoritative signal — direct
port hits never see this header.

user_name is the resolved HA display name when available; null
otherwise. The frontend uses this to render a fallback attribution
label in Plan 02-08.
"""
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["access-info"])


@router.get("/access-info")
def access_info(request: Request) -> dict:
    user = request.state.user  # populated by IngressUserMiddleware
    return {
        "via_ingress": user.ingress_path is not None,
        "user_name": user.name,
    }
