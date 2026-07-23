"""
TransitFlow — Routing Engine (Day 4)

New in this version:
1. The graph is now built from the DATABASE instead of a hardcoded Python
   list — this is the real "data layer" from the project spec, not a
   stand-in.
2. Peak-hour crowding is now a second rule-based penalty, alongside rain,
   applied the same way: it shifts the ranking, it doesn't just decorate
   the text. Both penalties can stack (e.g. a crowded rainy rush-hour
   train trip should rank noticeably worse than the same route at noon).
3. Bus is now a 4th mode moving through the same pipeline as the others
   — no special-casing needed, which is the payoff of building this as
   a general graph from the start.
"""

from datetime import datetime
from typing import Optional
import networkx as nx

from app.database import SessionLocal
from app.models import StationModel, EdgeModel, CrowdingRuleModel


def build_graph():
    """Builds the routing graph by querying the database (not a Python list)."""
    G = nx.MultiDiGraph()
    db = SessionLocal()

    try:
        for s in db.query(StationModel).all():
            G.add_node(s.id, name=s.name, lat=s.lat, lon=s.lon)

        for e in db.query(EdgeModel).all():
            G.add_edge(
                e.from_station_id, e.to_station_id,
                mode=e.mode, time_minutes=e.time_minutes,
                cost_rupees=e.cost_rupees, comfort_score=e.comfort_score,
            )
    finally:
        db.close()

    return G


# Built once at import time. For a project this size that's fine; if the
# data changes (via seed_data.py), restart the server to pick it up.
GRAPH = build_graph()

# Rain penalty per mode (0-1 additive), same as Day 3 — kept here since
# it's a fixed rule, unlike crowding which is time-dependent and lives in the DB.
RAIN_COMFORT_PENALTY = {
    "train": 0.30,
    "road": 0.10,
    "metro": 0.0,
    "bus": 0.15,
}

MODE_LABELS = {
    "train": "Local Train",
    "road": "Car / Auto (Road)",
    "metro": "Metro",
    "bus": "Bus",
}

# Rough monthly pass costs (₹) for modes that actually offer passes.
# Used to compute break-even trips vs paying per-ride — a real, useful
# comparison Google Maps doesn't surface. Road/auto has no pass concept.
MONTHLY_PASS_COST = {
    "train": 500,
    "metro": 1150,
    "bus": 600,
}


def fare_pass_insight(modes: list[str], cost_rupees: int) -> Optional[dict]:
    """
    For routes using a pass-eligible mode, estimates how many one-way
    trips it takes before a monthly pass becomes cheaper than paying
    per-trip (assuming this same route each time).
    """
    pass_mode = next((m for m in modes if m in MONTHLY_PASS_COST), None)
    if pass_mode is None or cost_rupees <= 0:
        return None

    pass_cost = MONTHLY_PASS_COST[pass_mode]
    # Round trips per month to break even (2 one-way trips = 1 round trip/day)
    breakeven_one_way_trips = pass_cost / cost_rupees
    breakeven_days = breakeven_one_way_trips / 2

    return {
        "mode": pass_mode,
        "monthly_pass_cost": pass_cost,
        "breakeven_commute_days": round(breakeven_days, 1),
    }


def get_crowding_penalties(hour: int, day_type: str) -> dict:
    """
    Queries crowding_rules for anything matching this hour + day_type,
    and returns the worst (max) penalty per mode. Mirrors how rain
    penalties are applied, but sourced from the database and time-aware.
    """
    db = SessionLocal()
    try:
        rules = db.query(CrowdingRuleModel).filter(
            CrowdingRuleModel.start_hour <= hour,
            CrowdingRuleModel.end_hour > hour,
        ).all()
    finally:
        db.close()

    penalties = {}
    for r in rules:
        if r.day_type != "any" and r.day_type != day_type:
            continue
        penalties[r.mode] = max(penalties.get(r.mode, 0.0), r.crowd_penalty)

    return penalties


def default_hour_and_day_type():
    """Falls back to the server's current time if the request doesn't specify one."""
    now = datetime.now()
    hour = now.hour
    day_type = "weekend" if now.weekday() >= 5 else "weekday"
    return hour, day_type


def explore_routes(origin: str, destination: str, max_path_length: int = 6):
    """Finds distinct route candidates between origin and destination."""
    G = GRAPH

    if origin not in G or destination not in G:
        return []

    candidates = []

    for station_path in nx.all_simple_paths(G, origin, destination, cutoff=max_path_length):

        modes_available_first_hop = set()
        if len(station_path) >= 2:
            first_edges = G.get_edge_data(station_path[0], station_path[1])
            modes_available_first_hop = {e["mode"] for e in first_edges.values()}

        for preferred_mode in modes_available_first_hop:
            total_time = 0
            total_cost = 0
            comfort_scores = []
            modes_used = []

            for i in range(len(station_path) - 1):
                a, b = station_path[i], station_path[i + 1]
                edges_between = G.get_edge_data(a, b)

                matching = [e for e in edges_between.values() if e["mode"] == preferred_mode]
                chosen = matching[0] if matching else min(edges_between.values(), key=lambda e: e["cost_rupees"])

                total_time += chosen["time_minutes"]
                total_cost += chosen["cost_rupees"]
                comfort_scores.append(chosen["comfort_score"])
                modes_used.append(chosen["mode"])

            candidates.append({
                "modes": modes_used,
                "station_path": list(station_path),
                "time_minutes": total_time,
                "cost_rupees": total_cost,
                "comfort_score": round(sum(comfort_scores) / len(comfort_scores), 1),
            })

    deduped = {}
    for c in candidates:
        key = tuple(c["modes"])
        if key not in deduped or c["time_minutes"] < deduped[key]["time_minutes"]:
            deduped[key] = c

    return list(deduped.values())


def score_routes(candidates: list[dict], priority: str = "fastest",
                  is_raining: bool = False, hour: int = None, day_type: str = None):
    """
    Scores and ranks candidates. Lower score = better.
    Combines THREE inputs into the comfort penalty: the route's baseline
    comfort, rain (if active), and peak-hour crowding (time-dependent,
    pulled from the database). This is the core "smart ranking" logic
    that differentiates TransitFlow from a plain shortest-path tool.
    """
    if not candidates:
        return []

    if hour is None or day_type is None:
        default_hour, default_day_type = default_hour_and_day_type()
        hour = hour if hour is not None else default_hour
        day_type = day_type if day_type is not None else default_day_type

    crowd_penalties = get_crowding_penalties(hour, day_type)

    weights = {
        "fastest": {"time": 0.6, "cost": 0.2, "comfort": 0.2},
        "cheapest": {"time": 0.2, "cost": 0.6, "comfort": 0.2},
        "comfortable": {"time": 0.2, "cost": 0.2, "comfort": 0.6},
    }.get(priority, {"time": 0.6, "cost": 0.2, "comfort": 0.2})

    times = [c["time_minutes"] for c in candidates]
    costs = [c["cost_rupees"] for c in candidates]

    def normalize(value, values):
        lo, hi = min(values), max(values)
        if hi == lo:
            return 0.0
        return (value - lo) / (hi - lo)

    scored = []
    for c in candidates:
        norm_time = normalize(c["time_minutes"], times)
        norm_cost = normalize(c["cost_rupees"], costs)
        comfort_penalty = (5 - c["comfort_score"]) / 4

        # Worst-leg-dominates rule: if a journey uses multiple modes,
        # the least comfortable leg drives the rain/crowding penalty —
        # one bad segment (e.g. a packed train) shouldn't get diluted
        # away by an otherwise comfortable trip.
        extra_penalty = 0.0
        for m in c["modes"]:
            mode_penalty = (RAIN_COMFORT_PENALTY.get(m, 0.0) if is_raining else 0.0) \
                            + crowd_penalties.get(m, 0.0)
            extra_penalty = max(extra_penalty, mode_penalty)

        comfort_penalty = min(1.0, comfort_penalty + extra_penalty)

        score = (
            weights["time"] * norm_time
            + weights["cost"] * norm_cost
            + weights["comfort"] * comfort_penalty
        )

        scored.append({
            **c,
            "score": round(score, 3),
            "rain_adjusted": is_raining,
            "crowding_context": {"hour": hour, "day_type": day_type},
        })

    return sorted(scored, key=lambda c: c["score"])


def get_ranked_routes(origin: str, destination: str, priority: str = "fastest",
                       is_raining: bool = False, hour: int = None, day_type: str = None):
    candidates = explore_routes(origin.lower(), destination.lower())
    return score_routes(candidates, priority, is_raining, hour, day_type)
