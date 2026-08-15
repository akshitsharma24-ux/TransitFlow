"""
TransitFlow — Routing Engine (Day 9)

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
4. explore_routes now runs Yen's k-shortest-paths (via
   nx.shortest_simple_paths) instead of a single plain Dijkstra call per
   objective/mode-pair. Yen's algorithm works BY repeatedly running
   Dijkstra with edges/nodes from earlier paths temporarily excluded, so
   this is still Dijkstra under the hood — it's just no longer thrown
   away after the first result. This is what lets a genuinely different
   alternative (e.g. transferring at Malad instead of Andheri) surface
   even when it isn't the single best path for any one objective.

nx.shortest_simple_paths only accepts a plain Di/Graph, not our layered
MultiDiGraph (parallel train/metro/bus/transfer edges between the same
two nodes), so each objective gets its own collapsed projection first —
see _project_for_objective.
"""

from datetime import datetime
from typing import Optional
import itertools
import math
import networkx as nx

from app.database import SessionLocal
from app.models import StationModel, EdgeModel, InterchangeModel, CrowdingRuleModel

TRANSFER_COMFORT = 3.0
MINIMUM_FARE = 5  # Indian Railways/Metro minimum fare regardless of distance, applied per paid leg

# Metro fare slabs — calibrated against REAL fares (verified via search):
# Yellow Line Andheri West <-> Dahisar East (full line, 16 hops) = ₹40
# Red Line Dahisar East <-> Gundavali (full line, 13 hops) = ₹40
# Official ranges: Yellow/Red ₹10-50, Aqua Line ₹10-80 (longer, underground,
# newer premium line — legitimately pricier, not a bug).
# band = hops per ₹10 step, cap = maximum fare for that line.
METRO_FARE_PARAMS = {
    "Yellow Line": {"band": 5, "cap": 50},
    "Red Line": {"band": 4, "cap": 50},
    "Aqua Line": {"band": 3, "cap": 80},
}


def metro_slab_fare(line: str, num_hops: int) -> int:
    params = METRO_FARE_PARAMS.get(line, {"band": 4, "cap": 60})
    return min(params["cap"], 10 * (1 + num_hops // params["band"]))


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


WEIGHT_OBJECTIVES = ("time", "cost", "comfort")

# How many distinct simple paths Yen's algorithm should surface per
# objective per origin/destination mode-pair, before scoring narrows them
# down. Kept small — the graph already fans out across 3 objectives and
# every mode combination, so this is per-combo, not a global cap.
K_SHORTEST_PER_COMBO = 3


def _edge_weight(attr: dict, objective: str) -> float:
    if objective == "time":
        return attr["time_minutes"]
    if objective == "cost":
        return attr["cost_rupees"]
    return (5 - attr["comfort_score"]) / 4


def _project_for_objective(objective: str) -> nx.DiGraph:
    """
    Collapses the layered MultiDiGraph down to a plain DiGraph for one
    objective, keeping only the cheapest of any parallel edges between a
    given pair of nodes. nx.shortest_simple_paths (Yen's algorithm) requires
    a simple Di/Graph — the real per-hop attributes (line, exact cost, etc.)
    are re-fetched from the original GRAPH afterwards in _build_legs, so
    nothing is lost by collapsing here.
    """
    P = nx.DiGraph()
    P.add_nodes_from(GRAPH.nodes)
    for u, v, attr in GRAPH.edges(data=True):
        w = _edge_weight(attr, objective)
        if not P.has_edge(u, v) or w < P[u][v]["weight"]:
            P.add_edge(u, v, weight=w)
    return P


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
        leg_cost = 0 if is_walk else edge["cost_rupees"]
        leg_comfort = None if is_walk else edge["comfort_score"]

        if legs and legs[-1]["type"] == leg_type and legs[-1]["mode"] == leg_mode \
                and legs[-1]["line"] == leg_line and legs[-1]["to_station"] == from_station:
            legs[-1]["to_station"] = to_station
            legs[-1]["time_minutes"] += edge["time_minutes"]
            legs[-1]["cost_rupees"] += leg_cost
            legs[-1]["hop_count"] += 1
        else:
            legs.append({
                "type": leg_type, "mode": leg_mode, "line": leg_line,
                "from_station": from_station, "to_station": to_station,
                "time_minutes": edge["time_minutes"], "cost_rupees": leg_cost,
                "hop_count": 1, "comfort_score": leg_comfort,
            })

        if not station_path or station_path[-1] != from_station:
            station_path.append(from_station)
        station_path.append(to_station)

    # Dedupe consecutive duplicate station ids (can happen across leg boundaries)
    deduped_station_path = [station_path[0]]
    for sid in station_path[1:]:
        if sid != deduped_station_path[-1]:
            deduped_station_path.append(sid)

    # Fare correction pass, once per completed leg (not per hop — that was
    # the original bug, since summing per-hop charges compounds unrealistically
    # on long lines):
    # 1. Yellow Line / Red Line legs use the real slab-fare lookup, based
    #    on the actual chart supplied (see metro_slab_fare above).
    # 2. Everything else (train, Aqua Line, bus) falls back to the flat
    #    per-hop sum already computed, with the ₹5 minimum-fare floor applied.
    for leg in legs:
        if leg["type"] != "ride":
            continue
        if leg["line"] in ("Yellow Line", "Red Line", "Aqua Line"):
            leg["cost_rupees"] = metro_slab_fare(leg["line"], leg["hop_count"])
        else:
            leg["cost_rupees"] = max(leg["cost_rupees"], MINIMUM_FARE)
    total_cost = sum(leg["cost_rupees"] for leg in legs if leg["type"] == "ride")

    # Time-weighted comfort average — a 45-minute crowded train stretch
    # should weigh more than a 5-minute comfortable metro hop, not be
    # averaged as if they were equal-sized units the way per-hop counting
    # was doing before.
    ride_legs = [leg for leg in legs if leg["type"] == "ride"]
    weighted_time = sum(leg["comfort_score"] * leg["time_minutes"] for leg in ride_legs)
    total_ride_time = sum(leg["time_minutes"] for leg in ride_legs)
    comfort_score = round(weighted_time / total_ride_time, 1) if total_ride_time else 4.5

    return legs, deduped_station_path, modes_used, comfort_score, total_time, total_cost


def explore_routes(origin: str, destination: str):
    """
    Finds distinct route candidates using Yen's k-shortest-paths algorithm
    (nx.shortest_simple_paths) over the layered graph, once per objective
    per origin/destination mode-pair.

    This replaces a single plain nx.dijkstra_path call per combo. Plain
    Dijkstra only ever returns THE single best path for a given weighting —
    so if two interchange choices (say, transferring at Andheri vs. at
    Malad) were only a minute apart on time, the loser vanished completely,
    even though a cost- or comfort-conscious rider might genuinely prefer
    it. Yen's algorithm is Dijkstra run repeatedly with the previous
    winner's edges/nodes temporarily excluded, so it surfaces the next-best
    DISTINCT simple path instead of just discarding it.
    """
    modes_at_origin = {mode for (station, mode) in GRAPH.nodes if station == origin}
    modes_at_destination = {mode for (station, mode) in GRAPH.nodes if station == destination}

    if not modes_at_origin or not modes_at_destination:
        return []

    candidates = {}

    for objective in WEIGHT_OBJECTIVES:
        projected = _project_for_objective(objective)

        for start_mode in modes_at_origin:
            for end_mode in modes_at_destination:
                src, dst = (origin, start_mode), (destination, end_mode)
                if src not in projected or dst not in projected:
                    continue

                try:
                    path_generator = nx.shortest_simple_paths(projected, src, dst, weight="weight")
                    node_paths = list(itertools.islice(path_generator, K_SHORTEST_PER_COMBO))
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue

                for node_path in node_paths:
                    legs, station_path, modes_used, comfort_score_computed, total_time, total_cost = \
                        _build_legs(node_path, objective)

                    # Dedup key is the physical ride signature (mode, line,
                    # and the actual boarding/alighting stations) — not
                    # just the mode/line list — so two routes that use the
                    # same lines but transfer at different interchange
                    # stations stay distinct instead of collapsing into one.
                    # A legitimate case, not junk: for closely-spaced
                    # interchange stations (e.g. Gundavali walking distance
                    # to Andheri West via the Andheri skywalk), the fastest
                    # "route" can genuinely be pure walking with no vehicle
                    # at all — that gets its own fixed key.
                    key = tuple(
                        (leg["mode"], leg["line"], leg["from_station"], leg["to_station"])
                        for leg in legs if leg["type"] == "ride"
                    ) or ("walk_only",)

                    candidate = {
                        "modes": modes_used,
                        "legs": legs,
                        "station_path": station_path,
                        "time_minutes": total_time,
                        "cost_rupees": total_cost,
                        "comfort_score": comfort_score_computed,
                    }

                    if key not in candidates or candidate["time_minutes"] < candidates[key]["time_minutes"]:
                        candidates[key] = candidate

    return list(candidates.values())


def load_crowding_rules():
    db = SessionLocal()
    try:
        return [
            {"mode": r.mode, "start_hour": r.start_hour, "end_hour": r.end_hour,
             "day_type": r.day_type, "crowd_penalty": r.crowd_penalty}
            for r in db.query(CrowdingRuleModel).all()
        ]
    finally:
        db.close()


# Crowding rules are static seed data — load them once instead of hitting the
# DB on every scoring pass (and once per hour for the 24-hour crowd curve).
CROWDING_RULES = load_crowding_rules()


def get_crowding_penalties(hour: int, day_type: str) -> dict:
    penalties = {}
    for r in CROWDING_RULES:
        if not (r["start_hour"] <= hour < r["end_hour"]):
            continue
        if r["day_type"] != "any" and r["day_type"] != day_type:
            continue
        penalties[r["mode"]] = max(penalties.get(r["mode"], 0.0), r["crowd_penalty"])
    return penalties


def default_hour_and_day_type():
    now = datetime.now()
    return now.hour, ("weekend" if now.weekday() >= 5 else "weekday")


# --- Crowd prediction (heuristic, not live ridership) ---
# We have no real-time headcount feed, so this is an honest rule-based
# forecast. crowding_rules now stores one row per (mode, hour, day_type)
# holding a 0-1 "how full is a typical commute rhythm at this hour" factor
# (see seed_data.py's WEEKDAY/WEEKEND_HOURLY_FACTOR curves) — a smooth
# double-peaked shape (AM ~9, PM ~18, PM the fuller of the two) rather than
# a flat penalty that only existed inside two rush-hour blocks. That old
# shape could never show a route as genuinely "Comfortable" (there was
# always at least the flat baseline) and jumped straight to "Packed" at
# the rush-hour boundary instead of ramping. Each line/mode's character
# (trunk suburban trains run fuller than the newer metros, even off-peak)
# is now expressed as a MIN..MAX range that the hourly factor scales into,
# so a 3am train reads as genuinely quiet and a 6pm one as genuinely full.
CROWD_RANGE_BY_LINE = {
    "Western Line": (0.15, 0.95),
    "Central Line": (0.17, 0.95),
    "Yellow Line": (0.08, 0.62),
    "Red Line": (0.08, 0.60),
    "Aqua Line": (0.05, 0.50),
}
CROWD_RANGE_BY_MODE = {
    "train": (0.15, 0.95),
    "metro": (0.08, 0.60),
    "bus": (0.10, 0.70),
    "road": (0.05, 0.35),
}

# Upper bound of each band (exclusive), lowest first.
CROWD_LEVELS = [(0.30, "Comfortable"), (0.52, "Moderate"), (0.75, "Busy"), (1.01, "Packed")]


def crowd_level_for_score(score: float) -> str:
    return next(name for thresh, name in CROWD_LEVELS if score < thresh)


# --- Per-station variation: same line/hour, different route, different curve ---
# Without this, every route whose busiest leg happened to be "Western Line"
# showed the exact same 24h shape regardless of which two stations were
# actually involved. Real Mumbai commuting has two well-known structural
# effects this was missing:
#  1. Stations nearer the city core run fuller than the far suburbs, even
#     at the same hour on the same line.
#  2. The AM peak runs heavier travelling INTO the city, the PM peak
#     heavier travelling OUT of it — direction matters, not just line.
# Both are derived from real station coordinates already in STATION_INFO
# (haversine distance from a CBD reference point), not fabricated.
_CBD_REFERENCE = STATION_INFO.get("churchgate") or STATION_INFO.get("csmt")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


if _CBD_REFERENCE:
    _STATION_CBD_KM = {
        sid: _haversine_km(_CBD_REFERENCE["lat"], _CBD_REFERENCE["lon"], info["lat"], info["lon"])
        for sid, info in STATION_INFO.items()
    }
else:
    _STATION_CBD_KM = {sid: 0.0 for sid in STATION_INFO}
_MAX_CBD_KM = max(_STATION_CBD_KM.values()) or 1.0

AM_PEAK_HOURS = set(range(7, 12))
PM_PEAK_HOURS = set(range(16, 21))
DIRECTION_TILT = 0.18   # how much a leg's direction shifts which peak dominates
CENTRALITY_BOOST = 0.10  # how much being near the CBD raises the crowd ceiling


def station_suburban_factor(station_id: str) -> float:
    """0 = at the CBD reference station, 1 = the farthest station on the network."""
    return min(1.0, _STATION_CBD_KM.get(station_id, 0.0) / _MAX_CBD_KM)


def crowd_score_for(
    line: Optional[str], mode: str, hour: int, day_type: str,
    from_station: Optional[str] = None, to_station: Optional[str] = None,
) -> float:
    lo, hi = CROWD_RANGE_BY_LINE.get(line) or CROWD_RANGE_BY_MODE.get(mode, (0.10, 0.60))
    factor = get_crowding_penalties(hour, day_type).get(mode, 0.0)  # 0-1 rhythm factor

    if from_station and to_station:
        from_sub = station_suburban_factor(from_station)
        to_sub = station_suburban_factor(to_station)
        inbound = to_sub < from_sub - 0.02   # heading toward the CBD
        outbound = to_sub > from_sub + 0.02  # heading away from it

        if hour in AM_PEAK_HOURS:
            factor *= (1 + DIRECTION_TILT) if inbound else (1 - DIRECTION_TILT) if outbound else 1.0
        elif hour in PM_PEAK_HOURS:
            factor *= (1 + DIRECTION_TILT) if outbound else (1 - DIRECTION_TILT) if inbound else 1.0
        factor = max(0.0, min(1.0, factor))

        avg_suburban = (from_sub + to_sub) / 2
        hi = min(1.0, hi + (1 - avg_suburban) * CENTRALITY_BOOST)

    return min(1.0, lo + factor * (hi - lo))


def predict_crowd(legs: list[dict], hour: int, day_type: str) -> dict:
    """
    Headline crowd forecast for a route, driven by its busiest ride leg (the
    stretch the rider actually feels). Also returns a 24-hour curve for that
    same leg so the frontend can answer "when's the best time to travel?".
    """
    ride_legs = [l for l in legs if l["type"] == "ride"]

    worst_score = 0.0
    driver_line = driver_mode = driver_label = None
    driver_from = driver_to = None
    for leg in ride_legs:
        score = crowd_score_for(leg["line"], leg["mode"], hour, day_type, leg["from_station"], leg["to_station"])
        if score > worst_score:
            worst_score = score
            driver_line, driver_mode = leg["line"], leg["mode"]
            driver_from, driver_to = leg["from_station"], leg["to_station"]
            driver_label = leg["line"] or MODE_LABELS.get(leg["mode"], leg["mode"])

    if driver_label is None:  # pure walk route
        return {"level": "Comfortable", "score": 0.1, "driver": "Walk",
                "hour": hour, "day_type": day_type, "hourly": []}

    hourly = []
    for h in range(24):
        s = crowd_score_for(driver_line, driver_mode, h, day_type, driver_from, driver_to)
        hourly.append({"hour": h, "score": round(s, 2), "level": crowd_level_for_score(s)})

    return {"level": crowd_level_for_score(worst_score), "score": round(worst_score, 2),
            "driver": driver_label, "hour": hour, "day_type": day_type, "hourly": hourly}


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
        "fastest": {"time": 0.75, "cost": 0.125, "comfort": 0.125},
        "cheapest": {"time": 0.125, "cost": 0.75, "comfort": 0.125},
        "comfortable": {"time": 0.1, "cost": 0.1, "comfort": 0.8},
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

    # The chosen priority must actually LEAD the ordering. Sorting purely by
    # the blended score was letting an outlier (e.g. a ₹300 car ride) stretch
    # the cost scale so far that real ₹26-vs-₹56 differences normalized to
    # nearly nothing — so "cheapest" could rank a ₹56 route above a ₹32 one.
    # Sort by the priority's raw metric first, then use the blended score as
    # the tiebreaker so near-equal options still order intelligently.
    primary_key = {
        "cheapest": lambda c: (c["cost_rupees"], c["score"]),
        "fastest": lambda c: (c["time_minutes"], c["score"]),
        "comfortable": lambda c: (-c["comfort_score"], c["score"]),
    }.get(priority, lambda c: c["score"])

    return sorted(scored, key=primary_key)


def get_ranked_routes(origin: str, destination: str, priority: str = "fastest",
                       is_raining: bool = False, hour: int = None, day_type: str = None):
    candidates = explore_routes(origin.lower(), destination.lower())
    return score_routes(candidates, priority, is_raining, hour, day_type)
