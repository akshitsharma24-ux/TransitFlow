"""
TransitFlow — Database Setup (Day 4)

Uses SQLite for local development — zero setup, works on any laptop,
matches the free/no-high-spec requirement. Because this uses SQLAlchemy
(not raw SQLite queries), switching to a real PostgreSQL database later
(e.g. Supabase's free tier, as planned in the project spec) is just a
one-line change to DATABASE_URL — nothing else in the codebase changes.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./transitflow.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — gives each request its own DB session, closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
