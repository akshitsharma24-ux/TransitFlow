"""
TransitFlow — Routing Engine (Day 3)

New in this version:
1. Each candidate route now includes its full station-by-station path
   (needed so the frontend can draw it on the map).
2. Scoring is now rain-aware: when is_raining=True, open/crowded modes
   (train) get a comfort penalty, since standing on an exposed platform
   or packed compartment is worse in rain. This is the actual
   "differentiator" feature from the project pitch — not live sensor
   data, just an honest rule-based adjustment.
3. max_path_length raised to accommodate the longer 7-station network.
"""

import networkx as nx
from app.graph_data import STATIONS, RAW_EDGES


def build_graph():
    G = nx.MultiDiGraph()

    for station_id, attrs in STATIONS.items():
        G.add_node(station_id, **attrs)

    for frm, to, mode, time_min, cost, comfort in RAW_EDGES:
        G.add_edge(frm, to, mode=mode, time_minutes=time_min, cost_rupees=cost, comfort_score=comfort)
        G.add_edge(to, frm, mode=mode, time_minutes=time_min, cost_rupees=cost, comfort_score=comfort)

    return G


GRAPH = build_graph()

# Rain penalty applied to comfort_score (0-1 scale, added to comfort_penalty
# after normalization — see score_routes). Only affects modes with real
# outdoor/crowding exposure; metro (underground/enclosed) is unaffected.
RAIN_COMFORT_PENALTY = {
    "train": 0.30,   # open platforms, packed compartments get worse
    "road": 0.10,    # traffic gets worse in rain, but you're not exposed
    "metro": 0.0,    # enclosed, underground — no rain impact
}


def explore_routes(origin: str, destination: str, max_path_length: int = 6):
    """
    Finds distinct route candidates between origin and destination.
    Now also records the full station_path for each candidate (for the map).
    """
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

    # Deduplicate by mode sequence, keeping the fastest of each
    deduped = {}
    for c in candidates:
        key = tuple(c["modes"])
        if key not in deduped or c["time_minutes"] < deduped[key]["time_minutes"]:
            deduped[key] = c

    return list(deduped.values())


def score_routes(candidates: list[dict], priority: str = "fastest", is_raining: bool = False):
    """
    Scores and ranks candidate routes. Lower score = better.
    If is_raining is True, applies an extra comfort penalty to
    exposed/crowded modes (train), pulling them down the ranking —
    this is what makes "comfortable" and rainy-day results differ
    from a plain Google Maps "fastest route" answer.
    """
    if not candidates:
        return []

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
        comfort_penalty = (5 - c["comfort_score"]) / 4  # 0 = most comfortable, 1 = least

        if is_raining:
            # Apply the worst (highest) rain penalty among modes used in this route
            rain_add = max(RAIN_COMFORT_PENALTY.get(m, 0.0) for m in c["modes"])
            comfort_penalty = min(1.0, comfort_penalty + rain_add)

        score = (
            weights["time"] * norm_time
            + weights["cost"] * norm_cost
            + weights["comfort"] * comfort_penalty
        )

        scored.append({**c, "score": round(score, 3), "rain_adjusted": is_raining})

    return sorted(scored, key=lambda c: c["score"])


def get_ranked_routes(origin: str, destination: str, priority: str = "fastest", is_raining: bool = False):
    """Main entry point used by the API: origin/destination in, ranked routes out."""
    candidates = explore_routes(origin.lower(), destination.lower())
    return score_routes(candidates, priority, is_raining)
