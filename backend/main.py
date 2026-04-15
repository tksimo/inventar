"""FastAPI application entry point.

- Binds to 0.0.0.0:8099 when run via uvicorn (see run.sh).
- Exposes /healthz for HA Supervisor health checks and INFRA-05 direct access.
- Attaches IngressUserMiddleware so later phases can attribute changes to HA users.
- The SPA static-file mount is added by Plan 04 (integration) once frontend/dist exists.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from middleware.ingress import IngressUserMiddleware
from routers import health

app = FastAPI(title="Inventar", version="0.1.0")

# Middleware: populate request.state.user from HA ingress headers
app.add_middleware(IngressUserMiddleware)

# API routes FIRST (must come before any catch-all SPA fallback -- see RESEARCH.md Pitfall 5)
app.include_router(health.router)

# SPA static mount + client-route fallback.
#
# Ordering rule (01-RESEARCH.md Pitfall 5): API routes (e.g. /healthz) are
# registered BEFORE the /assets mount and BEFORE the catch-all /{full_path}
# route. FastAPI matches routes in registration order; if the catch-all is
# registered first it will swallow every GET.
#
# Startup rule: if frontend/dist is missing, we raise a clear RuntimeError
# pointing at the build helper. A silent no-op would let the add-on boot
# with a broken UI (blank page or 404), which is much harder to diagnose
# than a fail-fast exception in the container logs.
STATIC_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)
_ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
_INDEX_HTML = os.path.join(STATIC_DIR, "index.html")

# Allow tests (and backend-only unit runs) to opt out of the SPA requirement
# by setting INVENTAR_SKIP_SPA=1 before import. Integration tests intentionally
# do NOT set this flag — they want the full mount.
_SKIP_SPA = os.environ.get("INVENTAR_SKIP_SPA") == "1"

if not _SKIP_SPA:
    if not os.path.isfile(_INDEX_HTML) or not os.path.isdir(_ASSETS_DIR):
        raise RuntimeError(
            "Inventar: frontend/dist is missing or incomplete. "
            f"Expected {_INDEX_HTML} and {_ASSETS_DIR} to exist. "
            "Run scripts/build.sh (Linux/macOS) or scripts/build.ps1 (Windows) "
            "to build the SPA before starting the backend."
        )

    app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """Catch-all for React Router client-side routes.

        Registered LAST so API routes (e.g. /healthz) take precedence.
        Any unmatched GET returns the SPA's index.html so deep-linking,
        browser refresh, and HA ingress all resolve to the React app.
        """
        return FileResponse(_INDEX_HTML)
