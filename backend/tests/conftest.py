"""
Shared test setup.

database.py points at "sqlite:///./transitflow.db", a path relative to the
working directory, so the suite always runs from the backend/ folder no
matter where pytest was launched from.
"""

import os

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)

from app.main import app  # noqa: E402  (import after chdir on purpose)


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def route_body():
    """A baseline valid /api/route payload; tests copy and tweak it."""
    return {
        "origin": "andheri",
        "destination": "churchgate",
        "priority": "fastest",
        "is_raining": False,
        "hour": 9,
        "day_type": "weekday",
    }
