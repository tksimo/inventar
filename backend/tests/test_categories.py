"""Tests for Category ORM model and Alembic migration 0002.

Covers ORG-01 (default categories pre-loaded) and the is_default column.
"""
from __future__ import annotations

import importlib
import os
import sys
import tempfile
from pathlib import Path

from sqlalchemy import Boolean, create_engine, text
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _alembic_upgrade(db_url: str) -> None:
    """Run alembic upgrade head against an isolated DB URL."""
    from alembic import command
    from alembic.config import Config

    saved = os.environ.get("INVENTAR_DB_URL")
    os.environ["INVENTAR_DB_URL"] = db_url
    try:
        import db.database as dbm
        importlib.reload(dbm)
        cfg = Config()
        cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        cfg.set_main_option("sqlalchemy.url", db_url)
        command.upgrade(cfg, "head")
    finally:
        if saved is not None:
            os.environ["INVENTAR_DB_URL"] = saved
        else:
            os.environ.pop("INVENTAR_DB_URL", None)
        import db.database as dbm
        importlib.reload(dbm)


def _alembic_downgrade(db_url: str) -> None:
    """Run alembic downgrade base against an isolated DB URL."""
    from alembic import command
    from alembic.config import Config

    saved = os.environ.get("INVENTAR_DB_URL")
    os.environ["INVENTAR_DB_URL"] = db_url
    try:
        import db.database as dbm
        importlib.reload(dbm)
        cfg = Config()
        cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        cfg.set_main_option("sqlalchemy.url", db_url)
        command.downgrade(cfg, "base")
    finally:
        if saved is not None:
            os.environ["INVENTAR_DB_URL"] = saved
        else:
            os.environ.pop("INVENTAR_DB_URL", None)
        import db.database as dbm
        importlib.reload(dbm)


def test_default_categories_present():
    """Running upgrade head on a fresh DB seeds exactly the 4 default categories."""
    # Use ignore_cleanup_errors to handle Windows file-locking on SQLite files.
    tmpdir = tempfile.mkdtemp(prefix="inventar_cat_test_")
    db_path = os.path.join(tmpdir, "test_seed.db")
    db_url = f"sqlite:///{db_path}"

    _alembic_upgrade(db_url)

    eng = create_engine(db_url)
    with eng.connect() as conn:
        rows = conn.execute(
            text("SELECT name, is_default FROM categories ORDER BY name")
        ).fetchall()
    eng.dispose()

    names_defaults = {(r[0], r[1]) for r in rows}
    expected = {
        ("Cleaning & household", 1),
        ("Food & pantry", 1),
        ("Fridge & freezer", 1),
        ("Personal care", 1),
    }
    assert names_defaults == expected, f"Got: {names_defaults}"


def test_category_is_default_column_exists():
    """The Category ORM class has an is_default Boolean NOT NULL attribute."""
    from models import Category

    col = Category.__table__.columns["is_default"]
    assert isinstance(col.type, Boolean)
    assert col.nullable is False


def test_custom_category_defaults_to_false():
    """Creating a Category without is_default results in is_default == False."""
    import importlib
    import db.database as dbm
    importlib.reload(dbm)
    import models as mdl
    importlib.reload(mdl)

    Category = mdl.Category
    Base = dbm.Base

    tmpdir = tempfile.mkdtemp(prefix="inventar_cat_test_")
    db_url = f"sqlite:///{tmpdir}/custom_cat.db"
    eng = create_engine(db_url)
    Base.metadata.create_all(eng)
    with Session(eng) as session:
        cat = Category(name="My Custom Category")
        session.add(cat)
        session.commit()
        session.refresh(cat)
        result = cat.is_default
    eng.dispose()

    assert result is False


def test_migration_0002_is_idempotent_on_downgrade():
    """alembic downgrade base then upgrade head succeeds without errors."""
    tmpdir = tempfile.mkdtemp(prefix="inventar_cat_test_")
    db_path = os.path.join(tmpdir, "idempotent.db")
    db_url = f"sqlite:///{db_path}"

    # First upgrade
    _alembic_upgrade(db_url)
    # Downgrade to base removes column + seeded rows
    _alembic_downgrade(db_url)
    # Second upgrade — must not raise "duplicate column" or similar
    _alembic_upgrade(db_url)

    eng = create_engine(db_url)
    with eng.connect() as conn:
        rows = conn.execute(
            text("SELECT name FROM categories WHERE is_default = 1")
        ).fetchall()
    eng.dispose()

    assert len(rows) == 4, f"Expected 4 default rows after re-upgrade, got: {len(rows)}"
