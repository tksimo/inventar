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

# SPA mount (conditional -- frontend/dist may not exist during backend-only tests)
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
_ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
if os.path.isdir(_ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """Catch-all for React Router client-side routes.

        Registered LAST so API routes (e.g. /healthz) take precedence.
        """
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        return {"error": "frontend not built"}
