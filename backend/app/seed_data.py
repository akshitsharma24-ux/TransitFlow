"""
TransitFlow — Seed Data (Day 4)

This is the source of truth for the network data, but instead of being
imported directly like graph_data.py was, it now gets loaded INTO the
database. Run this once (or any time you change the data below) to
(re)populate transitflow.db:

    python -m app.seed_data

New in Day 4: bus mode added, and crowding_rules table populated for the
peak-hour heuristic.
"""

from app.database import Base, engine, SessionLocal
from app.models import StationModel, EdgeModel, CrowdingRuleModel


STATIONS = {
    "borivali": {"name": "Borivali", "lat": 19.2307, "lon": 72.8567},
    "malad": {"name": "Malad", "lat": 19.1863, "lon": 72.8484},
    "andheri": {"name": "Andheri", "lat": 19.1197, "lon": 72.8468},
    "vile_parle": {"name": "Vile Parle", "lat": 19.0994, "lon": 72.8438},
    "bandra": {"name": "Bandra", "lat": 19.0596, "lon": 72.8295},
    "dadar": {"name": "Dadar", "lat": 19.0178, "lon": 72.8478},
    "churchgate": {"name": "Churchgate", "lat": 18.9354, "lon": 72.8276},
}

# Each edge: (from, to, mode, time_minutes, cost_rupees, comfort_score[1-5])
RAW_EDGES = [
    # --- Train line (sequential stops, Western line) ---
    ("borivali", "malad", "train", 8, 5, 2),
    ("malad", "andheri", "train", 10, 5, 2),
    ("andheri", "vile_parle", "train", 5, 5, 2),
    ("vile_parle", "bandra", "train", 10, 5, 2),
    ("bandra", "dadar", "train", 10, 5, 2),
    ("dadar", "churchgate", "train", 15, 5, 2),

    # --- Road (adjacent-station hops, car/auto) ---
    ("borivali", "malad", "road", 20, 80, 5),
    ("malad", "andheri", "road", 20, 90, 5),
    ("andheri", "vile_parle", "road", 12, 50, 5),
    ("vile_parle", "bandra", "road", 20, 90, 5),
    ("bandra", "dadar", "road", 20, 80, 5),
    ("dadar", "churchgate", "road", 20, 70, 5),

    # --- Road (long-haul direct hops) ---
    ("borivali", "churchgate", "road", 90, 380, 5),
    ("andheri", "churchgate", "road", 70, 250, 5),
    ("borivali", "andheri", "road", 35, 160, 5),

    # --- Metro (illustrative shortcut corridor) ---
    ("borivali", "andheri", "metro", 25, 40, 4),
    ("andheri", "churchgate", "metro", 55, 60, 4),

    # --- Bus (new in Day 4: cheaper than road, slower than train due to stops) ---
    ("borivali", "malad", "bus", 18, 10, 3),
    ("malad", "andheri", "bus", 20, 10, 3),
    ("andheri", "vile_parle", "bus", 10, 8, 3),
    ("vile_parle", "bandra", "bus", 18, 10, 3),
    ("bandra", "dadar", "bus", 18, 10, 3),
    ("dadar", "churchgate", "bus", 20, 10, 3),
    ("borivali", "andheri", "bus", 45, 25, 3),   # express bus, fewer stops
]

# Peak-hour crowding rules: extra comfort penalty (0-1 scale) applied on
# top of the baseline comfort_score, when travel falls in this time band.
# Mirrors the same pattern as the rain penalty from Day 3.
CROWDING_RULES = [
    # Local trains: worst during classic Mumbai rush hours, weekdays only
    ("train", 8, 11, "weekday", 0.35),
    ("train", 18, 21, "weekday", 0.35),

    # Buses: affected too, but less severely (more capacity flexibility)
    ("bus", 8, 11, "weekday", 0.15),
    ("bus", 18, 21, "weekday", 0.15),

    # Metro: modern, higher-capacity — mild penalty only at the worst peak
    ("metro", 8, 10, "weekday", 0.10),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Clear existing data so re-running this script is safe/idempotent
        db.query(EdgeModel).delete()
        db.query(CrowdingRuleModel).delete()
        db.query(StationModel).delete()
        db.commit()

        for station_id, attrs in STATIONS.items():
            db.add(StationModel(id=station_id, **attrs))

        for frm, to, mode, time_min, cost, comfort in RAW_EDGES:
            # Add both directions, since the network is undirected in practice
            db.add(EdgeModel(from_station_id=frm, to_station_id=to, mode=mode,
                              time_minutes=time_min, cost_rupees=cost, comfort_score=comfort))
            db.add(EdgeModel(from_station_id=to, to_station_id=frm, mode=mode,
                              time_minutes=time_min, cost_rupees=cost, comfort_score=comfort))

        for mode, start_hour, end_hour, day_type, penalty in CROWDING_RULES:
            db.add(CrowdingRuleModel(mode=mode, start_hour=start_hour, end_hour=end_hour,
                                      day_type=day_type, crowd_penalty=penalty))

        db.commit()
        print(f"Seeded {len(STATIONS)} stations, {len(RAW_EDGES) * 2} directional edges, "
              f"{len(CROWDING_RULES)} crowding rules into transitflow.db")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
