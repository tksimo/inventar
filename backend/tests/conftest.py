"""Shared pytest fixtures.

Overrides DATABASE_URL to a temp sqlite file before app/models import so that
tests never touch /data (which may not exist on dev machines).
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Ensure backend/ is importable
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Force a temp sqlite path BEFORE importing anything that reads DATABASE_URL
_TMPDIR = tempfile.mkdtemp(prefix="inventar_test_")
os.environ["INVENTAR_DB_URL"] = f"sqlite:///{_TMPDIR}/test.db"
# Unit tests run without the SPA mount. The integration tests in
# test_spa_integration.py and test_smoke_stack.py explicitly clear this
# flag before importing main.
os.environ["INVENTAR_SKIP_SPA"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from db.database import Base, engine  # noqa: E402
import models  # noqa: F401,E402 -- registers tables
from main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)
