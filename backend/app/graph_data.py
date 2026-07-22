"""
TransitFlow — Graph Data (Day 3)

Expanded from 4 to 7 stations along the Western line corridor, so the
network is no longer trivial. Still hand-curated estimates — replace with
researched real timings/fares before final submission, but the structure
here is what your real CSV-driven data will eventually look like.
"""

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

    # --- Road (long-haul direct hops, common commuter shortcuts) ---
    ("borivali", "churchgate", "road", 90, 380, 5),
    ("andheri", "churchgate", "road", 70, 250, 5),
    ("borivali", "andheri", "road", 35, 160, 5),

    # --- Metro (illustrative shortcut corridor) ---
    ("borivali", "andheri", "metro", 25, 40, 4),
    ("andheri", "churchgate", "metro", 55, 60, 4),
]
