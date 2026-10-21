"""
Benchmarks for the TransitFlow routing engine and API.

Run from the backend/ folder:

    python benchmarks/benchmark.py engine            # in-process latency, fixed O-D pairs
    python benchmarks/benchmark.py sweep --pairs 1000 --seed 7
    python benchmarks/benchmark.py kvalue            # latency vs Yen's K (variety trade-off)
    python benchmarks/benchmark.py load --url http://127.0.0.1:8000 --levels 1 5 10 25 50

`load` needs a running server (uvicorn app.main:app --port 8000) and httpx.
If psutil is installed and --pid is given, the server's memory and CPU
use are sampled while the load runs. Every command can write its raw
numbers to JSON with --out, so the figures in the report can be traced.
"""

import argparse
import itertools
import json
import os
import random
import statistics
import sys
import threading
import time

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

# Fixed workload used by `engine` and `load`, so runs are comparable.
SCENARIOS = [
    ("churchgate", "dahanukarwadi", "fastest"),
    ("churchgate", "dahanukarwadi", "cheapest"),
    ("churchgate", "dahanukarwadi", "comfortable"),
    ("andheri", "borivali", "fastest"),
    ("csmt", "thane", "fastest"),
    ("dahisar_east", "gundavali", "cheapest"),
    ("virar", "kalyan", "fastest"),
    ("cuffe_parade", "aarey_jvlr", "comfortable"),
]


def percentile(values, p):
    ordered = sorted(values)
    if not ordered:
        return float("nan")
    k = (len(ordered) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


def summarise(ms):
    return {
        "n": len(ms),
        "min": round(min(ms), 2),
        "median": round(statistics.median(ms), 2),
        "mean": round(statistics.fmean(ms), 2),
        "p95": round(percentile(ms, 95), 2),
        "p99": round(percentile(ms, 99), 2),
        "max": round(max(ms), 2),
    }


def timed(fn):
    start = time.perf_counter()
    result = fn()
    return (time.perf_counter() - start) * 1000, result


# --- engine: in-process latency ----------------------------------------

def cmd_engine(args):
    from app import routing_engine as engine

    rows = []
    for origin, destination, priority in SCENARIOS:
        engine.get_ranked_routes(origin, destination, priority, False, 9, "weekday")  # warm-up
        samples, options = [], 0
        for _ in range(args.repeat):
            ms, ranked = timed(lambda: engine.get_ranked_routes(origin, destination, priority, False, 9, "weekday"))
            samples.append(ms)
            options = len(ranked)
        rows.append({"origin": origin, "destination": destination, "priority": priority,
                     "candidates": options, **summarise(samples)})
        print(f"{origin:>14} -> {destination:<14} {priority:<12} candidates={options:<3} "
              f"median={rows[-1]['median']:>7.2f} ms  p95={rows[-1]['p95']:>7.2f} ms")
    return rows


# --- sweep: many random O-D pairs --------------------------------------

def cmd_sweep(args):
    from app import routing_engine as engine

    stations = sorted(engine.STATION_INFO)
    all_pairs = [(a, b) for a in stations for b in stations if a != b]
    random.Random(args.seed).shuffle(all_pairs)
    pairs = all_pairs if args.pairs <= 0 else all_pairs[: args.pairs]

    times, counts, failures = [], [], []
    for origin, destination in pairs:
        try:
            ms, ranked = timed(lambda: engine.get_ranked_routes(origin, destination, "fastest", False, 9, "weekday"))
        except Exception as exc:  # a crash is a finding, not something to hide
            failures.append({"origin": origin, "destination": destination, "error": repr(exc)})
            continue
        if not ranked:
            failures.append({"origin": origin, "destination": destination, "error": "no routes"})
            continue
        times.append(ms)
        counts.append(len(ranked))

    result = {
        "pairs_requested": len(pairs),
        "pairs_ok": len(times),
        "failures": failures,
        "latency_ms": summarise(times),
        "candidates_min": min(counts), "candidates_max": max(counts),
        "candidates_mean": round(statistics.fmean(counts), 2),
        "raw_ms": [round(t, 2) for t in times],
    }
    print(json.dumps({k: v for k, v in result.items() if k != "raw_ms"}, indent=2))
    return result


# --- kvalue: latency and variety against Yen's K -----------------------

def cmd_kvalue(args):
    from app import routing_engine as engine

    stations = sorted(engine.STATION_INFO)
    pairs = [(a, b) for a in stations for b in stations if a != b]
    random.Random(args.seed).shuffle(pairs)
    pairs = pairs[: args.pairs]

    original_k = engine.K_SHORTEST_PER_COMBO
    rows = []
    try:
        for k in args.k:
            engine.K_SHORTEST_PER_COMBO = k
            times, counts = [], []
            for origin, destination in pairs:
                ms, cands = timed(lambda: engine.explore_routes(origin, destination))
                times.append(ms)
                counts.append(len(cands))
            rows.append({"K": k, "median_ms": round(statistics.median(times), 2),
                         "p95_ms": round(percentile(times, 95), 2),
                         "mean_candidates": round(statistics.fmean(counts), 2),
                         "pairs_with_2plus": round(100 * sum(c >= 2 for c in counts) / len(counts), 1)})
            print(rows[-1])
    finally:
        engine.K_SHORTEST_PER_COMBO = original_k
    return rows


# --- load: concurrent HTTP clients -------------------------------------

def cmd_load(args):
    import httpx

    try:
        import psutil
    except ImportError:
        psutil = None
    server = psutil.Process(args.pid) if (psutil and args.pid) else None
    failures = {}

    def one_request(client, i):
        origin, destination, priority = SCENARIOS[i % len(SCENARIOS)]
        body = {"origin": origin, "destination": destination, "priority": priority,
                "is_raining": False, "hour": 9, "day_type": "weekday"}
        start = time.perf_counter()
        try:
            status = client.post(f"{args.url}/api/route", json=body, timeout=60).status_code
        except Exception as exc:  # status 0 = the request never got an HTTP response
            status = 0
            failures[type(exc).__name__] = failures.get(type(exc).__name__, 0) + 1
        return (time.perf_counter() - start) * 1000, status

    results = []
    for level in args.levels:
        latencies, statuses = [], []
        lock = threading.Lock()
        counter = itertools.count()
        total = level * args.per_client
        peak_rss = [0]
        stop_sampling = threading.Event()

        def sampler():
            while not stop_sampling.is_set():
                try:
                    peak_rss[0] = max(peak_rss[0], server.memory_info().rss)
                except Exception:
                    return
                time.sleep(0.05)

        def worker():
            with httpx.Client() as client:
                while True:
                    i = next(counter)
                    if i >= total:
                        return
                    ms, status = one_request(client, i)
                    with lock:
                        latencies.append(ms)
                        statuses.append(status)

        if server:
            server.cpu_percent(None)
            threading.Thread(target=sampler, daemon=True).start()
        started = time.perf_counter()
        threads = [threading.Thread(target=worker) for _ in range(level)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        wall = time.perf_counter() - started
        stop_sampling.set()
        cpu = server.cpu_percent(None) if server else None

        ok = sum(s == 200 for s in statuses)
        row = {"clients": level, "requests": len(statuses), "ok": ok,
               "throughput_rps": round(len(statuses) / wall, 1), "wall_s": round(wall, 2),
               **{f"lat_{k}": v for k, v in summarise(latencies).items() if k != "n"},
               "server_peak_rss_mb": round(peak_rss[0] / 1048576, 1) if server else None,
               "server_cpu_pct": cpu, "client_errors": dict(failures)}
        failures.clear()
        results.append(row)
        print(row)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("engine"); p.add_argument("--repeat", type=int, default=30)
    p = sub.add_parser("sweep"); p.add_argument("--pairs", type=int, default=1000); p.add_argument("--seed", type=int, default=7)
    p = sub.add_parser("kvalue"); p.add_argument("--pairs", type=int, default=300); p.add_argument("--seed", type=int, default=7)
    p.add_argument("--k", type=int, nargs="+", default=[1, 2, 3, 4, 5])
    p = sub.add_parser("load"); p.add_argument("--url", default="http://127.0.0.1:8000")
    p.add_argument("--levels", type=int, nargs="+", default=[1, 5, 10, 25, 50])
    p.add_argument("--per-client", type=int, default=10); p.add_argument("--pid", type=int, default=0)
    for sp in sub.choices.values():
        sp.add_argument("--out", help="write raw results to this JSON file")

    args = parser.parse_args()
    result = {"engine": cmd_engine, "sweep": cmd_sweep, "kvalue": cmd_kvalue, "load": cmd_load}[args.command](args)
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(result, fh, indent=2)


if __name__ == "__main__":
    main()
