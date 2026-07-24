"""
TransitFlow — Routing Engine (Day 7)

New in this version:
1. Handles InterchangeModel — walking transfers between physically
   different stations (e.g. Andheri Western Line -> Andheri West Metro),
   not just same-station mode switches.
2. Produces structured "legs" per route: a list of ride/walk steps, e.g.
     ride:  Local Train, Churchgate -> Andheri, 45 min
     walk:  Andheri -> Andheri West, 6 min
     ride:  Yellow Line, Andheri West -> Dahanukarwadi, 22 min
   This is what lets the frontend show a real itinerary instead of just
   a mode label.
3. Rain penalty is now LINE-aware, not just mode-aware: Aqua Line is
   underground (fully rain-immune), while Yellow/Red are elevated
   (mildly exposed) — a real distinction the old flat "metro" penalty
   couldn't capture.
"""

from datetime import datetime
from typing import Optional
import networkx as nx

from app.database import SessionLocal
from app.models import StationModel, EdgeModel, InterchangeModel, CrowdingRuleModel

TRANSFER_COMFORT = 3.0


def build_graph():
    """
    Builds the layered graph: nodes are (station_id, mode) pairs.
    - Real edges (train/metro/bus/road) come from EdgeModel.
    - Same-station mode transfers are auto-generated for any station
      that has more than one mode touching it.
    - Cross-station interchanges (InterchangeModel) are expanded across
      whichever modes exist at each side.
    """
    G = nx.MultiDiGraph()
    db = SessionLocal()

    try:
        edges = db.query(EdgeModel).all()
        interchanges = db.query(InterchangeModel).all()

        modes_by_station = {}
        for e in edges:
            modes_by_station.setdefault(e.from_station_id, set()).add(e.mode)
            modes_by_station.setdefault(e.to_station_id, set()).add(e.mode)

        for station_id, modes in modes_by_station.items():
            for mode in modes:
                G.add_node((station_id, mode), station_id=station_id, mode=mode)

        for e in edges:
            G.add_edge(
                (e.from_station_id, e.mode), (e.to_station_id, e.mode),
                mode=e.mode, line=e.line, time_minutes=e.time_minutes,
                cost_rupees=e.cost_rupees, comfort_score=e.comfort_score,
            )

        # Same-station transfers (e.g. a hub station with both train and bus)
        for station_id, modes in modes_by_station.items():
            for m1 in modes:
                for m2 in modes:
                    if m1 != m2:
                        G.add_edge(
                            (station_id, m1), (station_id, m2),
                            mode="transfer", line=None, time_minutes=5,
                            cost_rupees=0, comfort_score=TRANSFER_COMFORT,
                        )

        # Cross-station interchanges (e.g. Andheri -> Andheri West)
        for ic in interchanges:
            modes_a = modes_by_station.get(ic.from_station_id, set())
            modes_b = modes_by_station.get(ic.to_station_id, set())
            for ma in modes_a:
                for mb in modes_b:
                    G.add_edge(
                        (ic.from_station_id, ma), (ic.to_station_id, mb),
                        mode="transfer", line=None, time_minutes=ic.walk_minutes,
                        cost_rupees=0, comfort_score=TRANSFER_COMFORT,
                    )
                    G.add_edge(
                        (ic.to_station_id, mb), (ic.from_station_id, ma),
                        mode="transfer", line=None, time_minutes=ic.walk_minutes,
                        cost_rupees=0, comfort_score=TRANSFER_COMFORT,
                    )
    finally:
        db.close()

    return G


def load_station_info():
    db = SessionLocal()
    try:
        return {s.id: {"name": s.name, "lat": s.lat, "lon": s.lon} for s in db.query(StationModel).all()}
    finally:
        db.close()


def load_station_services():
    """
    For each station, the distinct (mode, line) combinations that serve it —
    e.g. Andheri -> [{"mode": "train", "line": "Western Line"}],
    Dahisar East -> [{"mode": "metro", "line": "Yellow Line"}, {"mode": "metro", "line": "Red Line"}].
    Used by the frontend to tag search results ("Eksar — Yellow Line Metro").
    """
    db = SessionLocal()
    try:
        edges = db.query(EdgeModel).filter(EdgeModel.mode != "transfer").all()
    finally:
        db.close()

    services = {}
    for e in edges:
        entry = {"mode": e.mode, "line": e.line}
        for station_id in (e.from_station_id, e.to_station_id):
            existing = services.setdefault(station_id, [])
            if entry not in existing:
                existing.append(entry)
    return services


GRAPH = build_graph()
STATION_INFO = load_station_info()
STATION_SERVICES = load_station_services()

# Rain penalty by mode (fallback) and by specific line (override) — this is
# what lets Aqua Line (underground) come out unaffected while Yellow/Red
# (elevated) still take a small hit, and open train platforms take the worst.
RAIN_COMFORT_PENALTY_BY_MODE = {"train": 0.30, "road": 0.10, "metro": 0.05, "bus": 0.15}
RAIN_COMFORT_PENALTY_BY_LINE = {"Aqua Line": 0.0, "Yellow Line": 0.05, "Red Line": 0.05}

MODE_LABELS = {"train": "Local Train", "road": "Car / Auto (Road)", "metro": "Metro", "bus": "Bus"}

MONTHLY_PASS_COST = {"train": 500, "metro": 1150, "bus": 600}


def fare_pass_insight(modes: list[str], cost_rupees: int) -> Optional[dict]:
    pass_mode = next((m for m in modes if m in MONTHLY_PASS_COST), None)
    if pass_mode is None or cost_rupees <= 0:
        return None
    pass_cost = MONTHLY_PASS_COST[pass_mode]
    breakeven_days = (pass_cost / cost_rupees) / 2
    return {"mode": pass_mode, "monthly_pass_cost": pass_cost, "breakeven_commute_days": round(breakeven_days, 1)}


def _weight_time(u, v, parallel_edges):
    return min(attr["time_minutes"] for attr in parallel_edges.values())


def _weight_cost(u, v, parallel_edges):
    return min(attr["cost_rupees"] for attr in parallel_edges.values())


def _weight_comfort(u, v, parallel_edges):
    return min((5 - attr["comfort_score"]) / 4 for attr in parallel_edges.values())


WEIGHT_FUNCS = {"time": _weight_time, "cost": _weight_cost, "comfort": _weight_comfort}


def _best_parallel_edge(u, v, objective):
    parallel_edges = GRAPH.get_edge_data(u, v)
    if objective == "time":
        key = min(parallel_edges, key=lambda k: parallel_edges[k]["time_minutes"])
    elif objective == "cost":
        key = min(parallel_edges, key=lambda k: parallel_edges[k]["cost_rupees"])
    else:
        key = min(parallel_edges, key=lambda k: -parallel_edges[k]["comfort_score"])
    return parallel_edges[key]


def _build_legs(node_path, objective):
    """
    Walks a node path and groups consecutive same (mode, line) hops into
    a single "ride" leg, and transfer hops into "walk" legs. This is what
    produces the human-readable itinerary.
    """
    legs = []
    station_path = [node_path[0][0]]
    modes_used, comfort_scores = [], []
    total_time, total_cost = 0, 0

    for i in range(len(node_path) - 1):
        u, v = node_path[i], node_path[i + 1]
        edge = _best_parallel_edge(u, v, objective)
        from_station, to_station = u[0], v[0]
        total_time += edge["time_minutes"]

        is_walk = edge["mode"] == "transfer"
        if not is_walk:
            total_cost += edge["cost_rupees"]
            comfort_scores.append(edge["comfort_score"])
            modes_used.append(edge["mode"])

        leg_type = "walk" if is_walk else "ride"
        leg_mode = None if is_walk else edge["mode"]
        leg_line = None if is_walk else edge["line"]

        if legs and legs[-1]["type"] == leg_type and legs[-1]["mode"] == leg_mode \
                and legs[-1]["line"] == leg_line and legs[-1]["to_station"] == from_station:
            legs[-1]["to_station"] = to_station
            legs[-1]["time_minutes"] += edge["time_minutes"]
        else:
            legs.append({
                "type": leg_type, "mode": leg_mode, "line": leg_line,
                "from_station": from_station, "to_station": to_station,
                "time_minutes": edge["time_minutes"],
            })

        if not station_path or station_path[-1] != from_station:
            station_path.append(from_station)
        station_path.append(to_station)

    # Dedupe consecutive duplicate station ids (can happen across leg boundaries)
    deduped_station_path = [station_path[0]]
    for sid in station_path[1:]:
        if sid != deduped_station_path[-1]:
            deduped_station_path.append(sid)

    return legs, deduped_station_path, modes_used, comfort_scores, total_time, total_cost


def explore_routes(origin: str, destination: str):
    """Finds distinct route candidates using Dijkstra over the layered graph."""
    modes_at_origin = {mode for (station, mode) in GRAPH.nodes if station == origin}
    modes_at_destination = {mode for (station, mode) in GRAPH.nodes if station == destination}

    if not modes_at_origin or not modes_at_destination:
        return []

    candidates = {}

    for objective, weight_fn in WEIGHT_FUNCS.items():
        for start_mode in modes_at_origin:
            for end_mode in modes_at_destination:
                src, dst = (origin, start_mode), (destination, end_mode)
                try:
                    node_path = nx.dijkstra_path(GRAPH, src, dst, weight=weight_fn)
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue

                legs, station_path, modes_used, comfort_scores, total_time, total_cost = \
                    _build_legs(node_path, objective)

                if not modes_used:
                    continue

                # Dedup key includes line, so a Yellow-Line route and a
                # Red-Line route with the same base mode stay distinct.
                key = tuple((leg["mode"], leg["line"]) for leg in legs if leg["type"] == "ride")

                candidate = {
                    "modes": modes_used,
                    "legs": legs,
                    "station_path": station_path,
                    "time_minutes": total_time,
                    "cost_rupees": total_cost,
                    "comfort_score": round(sum(comfort_scores) / len(comfort_scores), 1),
                }

                if key not in candidates or candidate["time_minutes"] < candidates[key]["time_minutes"]:
                    candidates[key] = candidate

    return list(candidates.values())


def get_crowding_penalties(hour: int, day_type: str) -> dict:
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
    now = datetime.now()
    return now.hour, ("weekend" if now.weekday() >= 5 else "weekday")


def score_routes(candidates: list[dict], priority: str = "fastest",
                  is_raining: bool = False, hour: int = None, day_type: str = None):
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
        return 0.0 if hi == lo else (value - lo) / (hi - lo)

    scored = []
    for c in candidates:
        norm_time = normalize(c["time_minutes"], times)
        norm_cost = normalize(c["cost_rupees"], costs)
        comfort_penalty = (5 - c["comfort_score"]) / 4

        extra_penalty = 0.0
        for leg in c["legs"]:
            if leg["type"] != "ride":
                continue
            rain_component = 0.0
            if is_raining:
                if leg["line"] and leg["line"] in RAIN_COMFORT_PENALTY_BY_LINE:
                    rain_component = RAIN_COMFORT_PENALTY_BY_LINE[leg["line"]]
                else:
                    rain_component = RAIN_COMFORT_PENALTY_BY_MODE.get(leg["mode"], 0.0)
            crowd_component = crowd_penalties.get(leg["mode"], 0.0)
            extra_penalty = max(extra_penalty, rain_component + crowd_component)

        comfort_penalty = min(1.0, comfort_penalty + extra_penalty)

        score = (
            weights["time"] * norm_time
            + weights["cost"] * norm_cost
            + weights["comfort"] * comfort_penalty
        )

        scored.append({**c, "score": round(score, 3), "rain_adjusted": is_raining,
                        "crowding_context": {"hour": hour, "day_type": day_type}})

    return sorted(scored, key=lambda c: c["score"])


def get_ranked_routes(origin: str, destination: str, priority: str = "fastest",
                       is_raining: bool = False, hour: int = None, day_type: str = None):
    candidates = explore_routes(origin.lower(), destination.lower())
    return score_routes(candidates, priority, is_raining, hour, day_type)
