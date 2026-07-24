"""
TransitFlow — Database Models (Day 4)

These match the schema laid out in the project spec (Section 8):
stations, edges, and crowding_rules. This is the real version of what
was previously just a Python list in graph_data.py.
"""

from sqlalchemy import Column, Integer, String, Float
from app.database import Base


class StationModel(Base):
    __tablename__ = "stations"

    id = Column(String, primary_key=True)      # e.g. "borivali"
    name = Column(String, nullable=False)       # e.g. "Borivali"
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)


class EdgeModel(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_station_id = Column(String, nullable=False)
    to_station_id = Column(String, nullable=False)
    mode = Column(String, nullable=False)        # train | road | metro | bus
    line = Column(String, nullable=True)          # e.g. "Western Line", "Yellow Line" — display only
    time_minutes = Column(Integer, nullable=False)
    cost_rupees = Column(Integer, nullable=False)
    comfort_score = Column(Float, nullable=False)  # 1 (worst) - 5 (best), baseline


class InterchangeModel(Base):
    """
    A walking transfer between two DIFFERENT physical stations that serve
    different lines/modes but are close enough to walk between — e.g.
    Andheri (Western Line) to Andheri West (Yellow Line Metro). This is
    different from same-station mode transfers (which the routing engine
    generates automatically) because these connect two distinct station
    records in the database.
    """
    __tablename__ = "interchanges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_station_id = Column(String, nullable=False)
    to_station_id = Column(String, nullable=False)
    walk_minutes = Column(Integer, nullable=False)


class CrowdingRuleModel(Base):
    __tablename__ = "crowding_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mode = Column(String, nullable=False)
    start_hour = Column(Integer, nullable=False)   # 24-hour format, inclusive
    end_hour = Column(Integer, nullable=False)      # exclusive
    day_type = Column(String, nullable=False)       # weekday | weekend | any
    crowd_penalty = Column(Float, nullable=False)   # 0-1 additive comfort penalty
