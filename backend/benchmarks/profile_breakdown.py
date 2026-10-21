"""
Where does a /route request spend its time?

Re-runs the steps of routing_engine.explore_routes with a timer around each
one (graph projection, Yen's enumeration, leg building) and then times the
scoring and the per-option crowd/fare-pass work that main.py does.

    python benchmarks/profile_breakdown.py --pairs 300 --seed 7 --out breakdown.json
"""

import argparse
import itertools
import json
import os
import random
import statistics
import sys
import time

import networkx as nx

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from app import routing_engine as engine  # noqa: E402


def run_once(origin, destination):
    t = dict(project=0.0, yen=0.0, legs=0.0, score=0.0, enrich=0.0)

    modes_o = {m for (s, m) in engine.GRAPH.nodes if s == origin}
    modes_d = {m for (s, m) in engine.GRAPH.nodes if s == destination}
    candidates = {}
    for objective in engine.WEIGHT_OBJECTIVES:
        a = time.perf_counter()
        projected = engine._project_for_objective(objective)
        t["project"] += time.perf_counter() - a
        for sm in modes_o:
            for em in modes_d:
                src, dst = (origin, sm), (destination, em)
                if src not in projected or dst not in projected:
                    continue
                a = time.perf_counter()
                try:
                    paths = list(itertools.islice(
                        nx.shortest_simple_paths(projected, src, dst, weight="weight"),
                        engine.K_SHORTEST_PER_COMBO))
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    paths = []
                t["yen"] += time.perf_counter() - a
                a = time.perf_counter()
                for p in paths:
                    legs, sp, modes, comfort, tt, cost = engine._build_legs(p, objective)
                    key = tuple((l["mode"], l["line"], l["from_station"], l["to_station"])
                                for l in legs if l["type"] == "ride") or ("walk_only",)
                    cand = {"modes": modes, "legs": legs, "station_path": sp, "time_minutes": tt,
                            "cost_rupees": cost, "comfort_score": comfort}
                    if key not in candidates or tt < candidates[key]["time_minutes"]:
                        candidates[key] = cand
                t["legs"] += time.perf_counter() - a

    a = time.perf_counter()
    ranked = engine.score_routes(list(candidates.values()), "fastest", False, 9, "weekday")
    t["score"] = time.perf_counter() - a
    a = time.perf_counter()
    for r in ranked[:6]:
        engine.predict_crowd(r["legs"], 9, "weekday")
        engine.fare_pass_insight(r["modes"], r["cost_rupees"])
    t["enrich"] = time.perf_counter() - a
    return {k: v * 1000 for k, v in t.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=int, default=300)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out")
    args = ap.parse_args()

    stations = sorted(engine.STATION_INFO)
    pairs = [(a, b) for a in stations for b in stations if a != b]
    random.Random(args.seed).shuffle(pairs)
    rows = [run_once(o, d) for o, d in pairs[: args.pairs]]

    total = [sum(r.values()) for r in rows]
    summary = {"pairs": len(rows), "mean_total_ms": round(statistics.fmean(total), 2)}
    for key in ("project", "yen", "legs", "score", "enrich"):
        vals = [r[key] for r in rows]
        summary[key] = {"mean_ms": round(statistics.fmean(vals), 3),
                        "share_pct": round(100 * sum(vals) / sum(total), 1)}
    print(json.dumps(summary, indent=2))
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(summary, fh, indent=2)


if __name__ == "__main__":
    main()
