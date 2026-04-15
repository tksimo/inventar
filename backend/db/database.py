"""SQLAlchemy engine, base, and session lifecycle.

DATABASE_URL is hardcoded to /data/inventar.db. Do NOT parameterize -- /data is
the ONLY path that survives HA add-on updates (see CONTEXT.md D-14 and
REQUIREMENTS.md INFRA-03). Tests override via the INVENTAR_DB_URL env var.
"""
from __future__ import annotations

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Four slashes: sqlite:// (scheme) + // (empty host) + /data/inventar.db (absolute)
DATABASE_URL: str = os.environ.get("INVENTAR_DB_URL", "sqlite:////data/inventar.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
