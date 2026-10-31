"""
TransitFlow — Writable state database

The route graph and crowd rules (transitflow.db) are read-only seed data. Things
users create at run time, today just crowd reports, live in a separate database
so the seed file can be rebuilt freely and so a read-only deploy still serves
every other endpoint.

On a serverless host (Vercel) the only writable place is /tmp, which is wiped
whenever an instance is recycled, so reports there are short-lived. Set
STATE_DATABASE_URL to a PostgreSQL URL to make them durable; nothing else in
the code changes.
"""

import os

from sqlalchemy import Column, Index, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_default = "sqlite:////tmp/transitflow_state.db" if os.environ.get("VERCEL") else "sqlite:///./transitflow_state.db"
STATE_DATABASE_URL = os.environ.get("STATE_DATABASE_URL", _default)

_connect_args = {"check_same_thread": False} if STATE_DATABASE_URL.startswith("sqlite") else {}
state_engine = create_engine(STATE_DATABASE_URL, connect_args=_connect_args)
StateSession = sessionmaker(autocommit=False, autoflush=False, bind=state_engine)
StateBase = declarative_base()


class CrowdReportModel(StateBase):
    """One rider's report of how crowded a station feels right now."""
    __tablename__ = "crowd_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String, nullable=False)
    level = Column(String, nullable=False)        # Comfortable | Moderate | Busy | Packed
    created_at = Column(Integer, nullable=False)  # unix seconds, avoids timezone ambiguity
    client = Column(String, nullable=False)       # short hash of the reporter, for rate limiting only

    # "Reports for this station in the last N minutes" is the only hot query.
    __table_args__ = (Index("ix_crowd_reports_station_time", "station_id", "created_at"),)


def init_state_db() -> bool:
    """Create the tables if possible. False means reports are unavailable (read-only host)."""
    try:
        StateBase.metadata.create_all(bind=state_engine)
        return True
    except Exception:  # pragma: no cover - depends on the host's filesystem
        return False


STATE_DB_READY = init_state_db()
