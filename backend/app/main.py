"""
TransitFlow — Backend (Day 7)

New in this version:
- RouteOption now includes `legs`: an ordered list of ride/walk steps,
  each with station names (not just IDs) — this is what lets the
  frontend show a real itinerary like:
    Local Train: Churchgate -> Andheri (45 min)
    Walk: Andheri -> Andheri West (6 min)
    Yellow Line: Andheri West -> Dahanukarwadi (22 min)
- mode label now uses real line names (e.g. "Yellow Line") instead of
  the generic "Metro" when available.

Run it with:
    uvicorn app.main:app --reload

Before running for the first time (or after changing seed_data.py):
    python -m app.seed_data
"""

from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.routing_engine import (
    STATION_INFO, STATION_SERVICES, MODE_LABELS, get_ranked_routes, default_hour_and_day_type, fare_pass_insight,
)

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
    priority: str = "fastest"
    is_raining: bool = False
    hour: Optional[int] = None
    day_type: Optional[str] = None


class StationPoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float


class Leg(BaseModel):
    type: str                 # "ride" | "walk"
    mode: Optional[str]        # "train" | "metro" | "bus" | "road" | None (for walk)
    line: Optional[str]        # e.g. "Yellow Line", None for walk/road/bus
    from_station: StationPoint
    to_station: StationPoint
    time_minutes: int
    cost_rupees: int           # 0 for walk legs


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
    legs: list[Leg]
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

def station_point(station_id: str) -> StationPoint:
    node = STATION_INFO[station_id]
    return StationPoint(id=station_id, name=node["name"], lat=node["lat"], lon=node["lon"])


def leg_label(leg: dict) -> str:
    """Prefers the real line name (e.g. 'Yellow Line') over the generic mode label."""
    if leg["type"] == "walk":
        return "Walk"
    return leg["line"] if leg["line"] else MODE_LABELS.get(leg["mode"], leg["mode"])


def build_legs(raw_legs: list[dict]) -> list[Leg]:
    return [
        Leg(
            type=leg["type"],
            mode=leg["mode"],
            line=leg["line"],
            from_station=station_point(leg["from_station"]),
            to_station=station_point(leg["to_station"]),
            time_minutes=leg["time_minutes"],
            cost_rupees=leg["cost_rupees"],
        )
        for leg in raw_legs
    ]


def mode_sequence_label(legs: list[dict]) -> str:
    """Builds the card title from ride legs, using real line names where available."""
    labels = []
    for leg in legs:
        if leg["type"] != "ride":
            continue
        label = leg_label(leg)
        if label not in labels:
            labels.append(label)
    return " + ".join(labels) if labels else "Walk"


def describe_route(route: dict, is_raining: bool) -> str:
    ride_legs = [l for l in route["legs"] if l["type"] == "ride"]
    walk_legs = [l for l in route["legs"] if l["type"] == "walk"]

    parts = [f"{mode_sequence_label(route['legs'])} route."]

    if len(walk_legs) > 0:
        total_walk = sum(l["time_minutes"] for l in walk_legs)
        parts.append(f"Includes {len(walk_legs)} interchange walk{'s' if len(walk_legs) > 1 else ''} (~{total_walk} min).")

    if route["comfort_score"] <= 2:
        parts.append("Likely crowded, especially at peak hours.")
    elif route["comfort_score"] >= 4:
        parts.append("Comfortable, low-crowding option.")

    if route["cost_rupees"] <= 20:
        parts.append("Very cheap.")
    elif route["cost_rupees"] >= 200:
        parts.append("Expensive relative to other options.")

    if is_raining:
        has_underground = any(l["line"] == "Aqua Line" for l in ride_legs)
        has_train = any(l["mode"] == "train" for l in ride_legs)
        if has_underground and not has_train:
            parts.append("Fully underground on the Aqua Line — unaffected by rain.")
        elif has_train:
            parts.append("Note: open platforms and crowding make this less pleasant in rain.")

    return " ".join(parts)


# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "TransitFlow backend is running", "stations_loaded": len(STATION_INFO)}


@app.get("/stations")
def list_stations():
    return {
        station_id: {**info, "serves": STATION_SERVICES.get(station_id, [])}
        for station_id, info in STATION_INFO.items()
    }


@app.post("/route", response_model=RouteResponse)
def get_routes(request: RouteRequest):
    origin = request.origin.lower()
    destination = request.destination.lower()

    if origin not in STATION_INFO:
        raise HTTPException(status_code=400, detail=f"Unknown origin station: '{request.origin}'")
    if destination not in STATION_INFO:
        raise HTTPException(status_code=400, detail=f"Unknown destination station: '{request.destination}'")
    if origin == destination:
        raise HTTPException(status_code=400, detail="Origin and destination must be different.")

    default_hour, default_day_type = default_hour_and_day_type()
    hour = request.hour if request.hour is not None else default_hour
    day_type = request.day_type if request.day_type is not None else default_day_type

    ranked = get_ranked_routes(origin, destination, request.priority, request.is_raining, hour, day_type)

    if not ranked:
        raise HTTPException(status_code=404, detail="No routes found between these stations.")

    # Dedupe by display label, keeping the best-scoring (ranked is already sorted)
    seen_labels = set()
    deduped_ranked = []
    for r in ranked:
        label = mode_sequence_label(r["legs"])
        if label not in seen_labels:
            seen_labels.add(label)
            deduped_ranked.append(r)

    options = [
        RouteOption(
            mode=mode_sequence_label(r["legs"]),
            time_minutes=r["time_minutes"],
            cost_rupees=r["cost_rupees"],
            comfort_score=r["comfort_score"],
            score=r["score"],
            explanation=describe_route(r, request.is_raining),
            path=[station_point(sid) for sid in r["station_path"]],
            legs=build_legs(r["legs"]),
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
