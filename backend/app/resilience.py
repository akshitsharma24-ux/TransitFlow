"""Network resilience: station criticality report and temporary line/station closures."""

import threading
from contextlib import contextmanager

import networkx as nx

from app import routing_engine

# Held for the whole disruption and while the report is computed, so nothing
# ever reads a half-swapped routing_engine.GRAPH.
_LOCK = threading.Lock()
_report = None


def _station_graph() -> nx.Graph:
    G = nx.Graph()
    G.add_nodes_from(node[0] for node in routing_engine.GRAPH.nodes)
    for u, v, attr in routing_engine.GRAPH.edges(data=True):
        a, b = u[0], v[0]
        if a == b:  # same-station mode change, not a link between stations
            continue
        w = attr["time_minutes"]
        if not G.has_edge(a, b) or w < G[a][b]["weight"]:
            G.add_edge(a, b, weight=w)
    return G


def _cut_off(G: nx.Graph, station_id: str) -> int:
    rest = G.subgraph(nx.node_connected_component(G, station_id) - {station_id})
    sizes = [len(c) for c in nx.connected_components(rest)]
    return len(rest) - max(sizes) if sizes else 0


def _compute_report() -> dict:
    G = _station_graph()
    betweenness = nx.betweenness_centrality(G, weight="weight")
    cut_points = set(nx.articulation_points(G))

    stations = [
        {
            "id": sid,
            "name": routing_engine.STATION_INFO.get(sid, {}).get("name", sid),
            "betweenness": betweenness[sid],
            "is_articulation": sid in cut_points,
            "cut_off": _cut_off(G, sid) if sid in cut_points else 0,
        }
        for sid in G.nodes
    ]
    stations.sort(key=lambda s: s["betweenness"], reverse=True)

    lines = sorted({line for _, _, line in routing_engine.GRAPH.edges(data="line") if line})
    return {"stations": stations, "lines": lines}


def resilience_report() -> dict:
    global _report
    with _LOCK:
        if _report is None:
            _report = _compute_report()
        return _report


@contextmanager
def disruption(closed_stations, closed_lines):
    closed_stations, closed_lines = set(closed_stations or ()), set(closed_lines or ())
    with _LOCK:
        if not closed_stations and not closed_lines:
            yield
            return

        original = routing_engine.GRAPH
        original_project = routing_engine._project_for_objective

        G = original.copy()
        G.remove_nodes_from([n for n in original.nodes if n[0] in closed_stations])
        G.remove_edges_from([(u, v, k) for u, v, k, line in G.edges(keys=True, data="line") if line in closed_lines])

        routing_engine.GRAPH = G
        # The cached projection belongs to the full network; the uncached original reads the swapped GRAPH.
        routing_engine._project_for_objective = getattr(original_project, "__wrapped__", original_project)
        try:
            yield
        finally:
            routing_engine.GRAPH = original
            routing_engine._project_for_objective = original_project
