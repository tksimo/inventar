"""Health check endpoint for HA Supervisor and direct-port monitoring.

Per CONTEXT.md D-07: GET /healthz returns {"status": "ok"} with HTTP 200.
This is also the endpoint used by INFRA-05 direct-port smoke tests.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
