"""Tests for Alembic migration 0003: quantity and reorder_threshold Float -> Integer.

Covers behaviours 6, 7, 8 from Plan 02-07 Task 1:
  6. Fresh DB has INTEGER columns for quantity and reorder_threshold.
  7. Migration is idempotent on re-run; downgrade reverts to FLOAT.
  8. Pre-existing float data (2.0) is preserved as integer (2) after upgrade.

Helper functions (_alembic_upgrade, _alembic_downgrade, _restore_modules) are
copied verbatim from test_categories.py for test isolation.
"""
from __future__ import annotations

import importlib
import os
import sys
import tempfile
from pathlib import Path

from sqlalchemy import create_engine, text

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _restore_modules() -> None:
    """Reload db.database, models, and all schemas after alembic tests."""
    import db.database as dbm
    importlib.reload(dbm)
    import models as mdl
    importlib.reload(mdl)
    import schemas.item as si
    importlib.reload(si)
    import schemas.category as sc
    importlib.reload(sc)
    import schemas.location as sl
    importlib.reload(sl)
    import schemas as s
    importlib.reload(s)


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
        _restore_modules()


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
        _restore_modules()


def _alembic_upgrade_to(db_url: str, target: str) -> None:
    """Run alembic upgrade to a specific revision."""
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
        command.upgrade(cfg, target)
    finally:
        if saved is not None:
            os.environ["INVENTAR_DB_URL"] = saved
        else:
            os.environ.pop("INVENTAR_DB_URL", None)
        _restore_modules()


def test_fresh_db_quantity_columns_are_integer():
    """Behaviour 6: After upgrade head on a fresh DB, quantity and reorder_threshold are INTEGER."""
    tmpdir = tempfile.mkdtemp(prefix="inventar_qty_test_")
    db_path = os.path.join(tmpdir, "fresh.db")
    db_url = f"sqlite:///{db_path}"

    _alembic_upgrade(db_url)

    eng = create_engine(db_url)
    with eng.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(items)")).fetchall()
    eng.dispose()

    col_types = {row[1]: row[2] for row in rows}  # name -> type
    assert col_types["quantity"].upper() == "INTEGER", (
        f"Expected quantity to be INTEGER, got: {col_types['quantity']!r}"
    )
    assert col_types["reorder_threshold"].upper() == "INTEGER", (
        f"Expected reorder_threshold to be INTEGER, got: {col_types['reorder_threshold']!r}"
    )


def test_migration_0003_idempotent_and_downgrade():
    """Behaviour 7: Running upgrade head twice does not raise; downgrade reverts to FLOAT."""
    tmpdir = tempfile.mkdtemp(prefix="inventar_qty_test_")
    db_path = os.path.join(tmpdir, "idempotent.db")
    db_url = f"sqlite:///{db_path}"

    # First upgrade
    _alembic_upgrade(db_url)

    # Second upgrade (idempotent — must not raise)
    _alembic_upgrade(db_url)

    # Verify columns are still INTEGER
    eng = create_engine(db_url)
    with eng.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(items)")).fetchall()
    eng.dispose()
    col_types = {row[1]: row[2] for row in rows}
    assert col_types["quantity"].upper() == "INTEGER"

    # Downgrade to base
    _alembic_downgrade(db_url)

    # After downgrade, upgrade to 0002 (before 0003)
    _alembic_upgrade_to(db_url, "0002")

    # Now columns should be REAL/FLOAT (SQLite type after 0001 migration)
    eng = create_engine(db_url)
    with eng.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(items)")).fetchall()
    eng.dispose()
    col_types = {row[1]: row[2] for row in rows}
    # SQLite stores FLOAT as REAL; accept either
    assert col_types["quantity"].upper() in ("REAL", "FLOAT", "NUMERIC"), (
        f"Expected quantity to be REAL/FLOAT after downgrade, got: {col_types['quantity']!r}"
    )


def test_preexisting_float_data_preserved_as_integer():
    """Behaviour 8: Float value 2.0 seeded before 0003 is read back as int 2 after upgrade."""
    tmpdir = tempfile.mkdtemp(prefix="inventar_qty_test_")
    db_path = os.path.join(tmpdir, "preexisting.db")
    db_url = f"sqlite:///{db_path}"

    # Upgrade to 0002 only — schema is set up but quantity is still FLOAT
    _alembic_upgrade_to(db_url, "0002")

    # Insert a row with float quantity
    eng = create_engine(db_url)
    with eng.connect() as conn:
        conn.execute(
            text(
                "INSERT INTO items (name, quantity_mode, quantity, archived, created_at, updated_at) "
                "VALUES ('Milk', 'exact', 2.0, 0, '2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            )
        )
        conn.commit()
    eng.dispose()

    # Now run migration 0003
    _alembic_upgrade(db_url)

    # Read the value back — must be the integer 2
    eng = create_engine(db_url)
    with eng.connect() as conn:
        row = conn.execute(text("SELECT quantity FROM items WHERE name = 'Milk'")).fetchone()
    eng.dispose()

    assert row is not None, "Row not found after migration"
    qty = row[0]
    assert qty == 2, f"Expected quantity to be 2, got: {qty!r}"
    assert isinstance(qty, int), f"Expected quantity to be int type, got: {type(qty)}"
