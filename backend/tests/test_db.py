"""INFRA-03: database lives at /data/inventar.db and v1 schema is complete."""
import importlib
import os
import tempfile

from sqlalchemy import create_engine, inspect


EXPECTED_TABLES = {"categories", "locations", "items", "transactions", "shopping_list"}


def _restore_schema_modules() -> None:
    """Reload models and schemas after a db.database reload.

    When db.database is reloaded, models must be reloaded too so that
    Base.metadata has the ORM table definitions. Schemas must also be reloaded
    so that Pydantic's cached validators use the freshly imported QuantityMode /
    StockStatus enum classes (class identity mismatch causes ValidationError in
    subsequent schema unit tests).
    """
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


def test_db_path_default_is_data_inventar_db():
    """When INVENTAR_DB_URL is unset, the default MUST be /data/inventar.db."""
    saved = os.environ.pop("INVENTAR_DB_URL", None)
    try:
        import db.database as dbm
        importlib.reload(dbm)
        assert dbm.DATABASE_URL == "sqlite:////data/inventar.db"
    finally:
        if saved is not None:
            os.environ["INVENTAR_DB_URL"] = saved
        import db.database as dbm
        importlib.reload(dbm)
        _restore_schema_modules()


def test_schema_create_all_v1_tables():
    """All five v1 tables exist after create_all.

    Reloads db.database and models to ensure Base.metadata is fresh regardless
    of what prior tests (e.g. test_db_path_default_is_data_inventar_db) reloaded.
    """
    import db.database as dbm
    importlib.reload(dbm)
    _restore_schema_modules()
    import models as mdl  # noqa: F401 — side effect: registers tables on Base
    Base = dbm.Base
    with tempfile.TemporaryDirectory() as d:
        eng = create_engine(f"sqlite:///{d}/t.db")
        Base.metadata.create_all(eng)
        tables = set(inspect(eng).get_table_names())
        eng.dispose()
        assert EXPECTED_TABLES.issubset(tables), f"missing: {EXPECTED_TABLES - tables}"


def test_migration_upgrade_head_creates_v1_tables():
    """Alembic upgrade head applied to a fresh DB creates the full v1 schema."""
    from alembic import command
    from alembic.config import Config
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    with tempfile.TemporaryDirectory() as d:
        db_path = os.path.join(d, "t.db")
        db_url = f"sqlite:///{db_path}"
        # Set INVENTAR_DB_URL and reload db.database so alembic env.py picks up the fresh path.
        # (db.database.DATABASE_URL is resolved at import; reload re-evaluates os.environ.get)
        saved = os.environ.get("INVENTAR_DB_URL")
        os.environ["INVENTAR_DB_URL"] = db_url
        try:
            import db.database as dbm
            importlib.reload(dbm)
            cfg = Config(os.path.join(backend_dir, "alembic.ini"))
            cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
            cfg.set_main_option("sqlalchemy.url", db_url)
            command.upgrade(cfg, "head")
        finally:
            if saved is not None:
                os.environ["INVENTAR_DB_URL"] = saved
            else:
                os.environ.pop("INVENTAR_DB_URL", None)
            import db.database as dbm
            importlib.reload(dbm)
            _restore_schema_modules()
        eng = create_engine(db_url)
        tables = set(inspect(eng).get_table_names())
        eng.dispose()
        assert EXPECTED_TABLES.issubset(tables), f"migration missing: {EXPECTED_TABLES - tables}"
