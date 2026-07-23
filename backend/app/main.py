"""
TransitFlow — Backend (Day 4)

New in this version:
- Stations now come from the database (via routing_engine's GRAPH), not
  a hardcoded dict
- RouteRequest accepts optional hour (0-23) and day_type (weekday/weekend)
  for peak-hour crowding; defaults to the server's current time if omitted
- Explanations mention crowding context, not just rain

Run it with:
    uvicorn app.main:app --reload

Before running for the first time (or after changing seed_data.py):
    python -m app.seed_data
"""

from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.routing_engine import GRAPH, MODE_LABELS, get_ranked_routes, default_hour_and_day_type, fare_pass_insight

app = FastAPI(title="TransitFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request/response shapes ---

class RouteRequest(BaseModel):
    origin: str
    destination: str
    priority: str = "fastest"       # fastest | cheapest | comfortable
    is_raining: bool = False
    hour: Optional[int] = None       # 0-23; defaults to current server hour
    day_type: Optional[str] = None   # "weekday" | "weekend"; defaults to today


class StationPoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float


class FarePassInsight(BaseModel):
    mode: str
    monthly_pass_cost: int
    breakeven_commute_days: float


class RouteOption(BaseModel):
    mode: str
    time_minutes: int
    cost_rupees: int
    comfort_score: float
    score: float
    explanation: str
    path: list[StationPoint]
    fare_pass: Optional[FarePassInsight] = None


class RouteResponse(BaseModel):
    origin: str
    destination: str
    priority: str
    is_raining: bool
    hour: int
    day_type: str
    options: list[RouteOption]


# --- Helpers ---

def describe_route(route: dict, is_raining: bool) -> str:
    mode_label = MODE_LABELS.get(route["modes"][0], route["modes"][0])
    parts = [f"{mode_label} route."]

    if route["comfort_score"] <= 2:
        parts.append("Likely crowded, especially at peak hours.")
    elif route["comfort_score"] >= 4:
        parts.append("Comfortable, low-crowding option.")

    if route["cost_rupees"] <= 20:
        parts.append("Very cheap.")
    elif route["cost_rupees"] >= 200:
        parts.append("Expensive relative to other options.")

    ctx = route.get("crowding_context", {})
    is_peak = ctx.get("hour") is not None and (8 <= ctx["hour"] < 11 or 18 <= ctx["hour"] < 21) \
        and ctx.get("day_type") == "weekday"

    if is_raining and "train" in route["modes"]:
        parts.append("Note: open platforms and crowding make this less pleasant in rain.")
    elif is_raining and "metro" in route["modes"] and "train" not in route["modes"]:
        parts.append("Unaffected by rain (fully enclosed/underground).")

    if is_peak and any(m in route["modes"] for m in ("train", "bus")):
        parts.append("This falls in a typical weekday rush-hour window — expect extra crowding.")

    return " ".join(parts)


def mode_sequence_label(modes: list[str]) -> str:
    unique_modes = list(dict.fromkeys(modes))
    labels = [MODE_LABELS.get(m, m) for m in unique_modes]
    return " + ".join(labels)


def build_path_points(station_path: list[str]) -> list[StationPoint]:
    points = []
    for station_id in station_path:
        node = GRAPH.nodes[station_id]
        points.append(StationPoint(id=station_id, name=node["name"], lat=node["lat"], lon=node["lon"]))
    return points


# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "TransitFlow backend is running", "stations_loaded": GRAPH.number_of_nodes()}


@app.get("/stations")
def list_stations():
    return {
        station_id: {"name": data["name"], "lat": data["lat"], "lon": data["lon"]}
        for station_id, data in GRAPH.nodes(data=True)
    }


@app.post("/route", response_model=RouteResponse)
def get_routes(request: RouteRequest):
    origin = request.origin.lower()
    destination = request.destination.lower()

    if origin not in GRAPH:
        raise HTTPException(status_code=400, detail=f"Unknown origin station: '{request.origin}'")
    if destination not in GRAPH:
        raise HTTPException(status_code=400, detail=f"Unknown destination station: '{request.destination}'")
    if origin == destination:
        raise HTTPException(status_code=400, detail="Origin and destination must be different.")

    default_hour, default_day_type = default_hour_and_day_type()
    hour = request.hour if request.hour is not None else default_hour
    day_type = request.day_type if request.day_type is not None else default_day_type

    ranked = get_ranked_routes(origin, destination, request.priority, request.is_raining, hour, day_type)

    if not ranked:
        raise HTTPException(status_code=404, detail="No routes found between these stations.")

    # Different physical paths (e.g. road via Malad vs road via Dadar) can
    # end up with the same display label ("Car / Auto (Road)"). Since
    # `ranked` is already sorted best-first, keeping the first occurrence
    # of each label naturally keeps the best-scoring version of each mode.
    seen_labels = set()
    deduped_ranked = []
    for r in ranked:
        label = mode_sequence_label(r["modes"])
        if label not in seen_labels:
            seen_labels.add(label)
            deduped_ranked.append(r)

    options = [
        RouteOption(
            mode=mode_sequence_label(r["modes"]),
            time_minutes=r["time_minutes"],
            cost_rupees=r["cost_rupees"],
            comfort_score=r["comfort_score"],
            score=r["score"],
            explanation=describe_route(r, request.is_raining),
            path=build_path_points(r["station_path"]),
            fare_pass=fare_pass_insight(r["modes"], r["cost_rupees"]),
        )
        for r in deduped_ranked
    ]

    return RouteResponse(
        origin=request.origin,
        destination=request.destination,
        priority=request.priority,
        is_raining=request.is_raining,
        hour=hour,
        day_type=day_type,
        options=options,
    )
