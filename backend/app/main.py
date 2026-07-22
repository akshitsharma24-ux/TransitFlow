"""
TransitFlow — Backend (Day 3)

New in this version:
- RouteRequest now accepts is_raining (bool)
- RouteOption now includes `path`: list of {id, name, lat, lon} for the
  stations along that route, so the frontend can draw it on a map
- Explanations now mention rain impact when relevant

Run it with:
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.graph_data import STATIONS
from app.routing_engine import get_ranked_routes

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
    priority: str = "fastest"     # fastest | cheapest | comfortable
    is_raining: bool = False


class StationPoint(BaseModel):
    id: str
    name: str
    lat: float
    lon: float


class RouteOption(BaseModel):
    mode: str
    time_minutes: int
    cost_rupees: int
    comfort_score: float
    score: float
    explanation: str
    path: list[StationPoint]


class RouteResponse(BaseModel):
    origin: str
    destination: str
    priority: str
    is_raining: bool
    options: list[RouteOption]


# --- Helpers ---

MODE_LABELS = {
    "train": "Local Train",
    "road": "Car / Auto (Road)",
    "metro": "Metro",
}


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

    if is_raining and "train" in route["modes"]:
        parts.append("Note: open platforms and crowding make this less pleasant in rain.")
    elif is_raining and "metro" in route["modes"] and "train" not in route["modes"]:
        parts.append("Unaffected by rain (fully enclosed/underground).")

    return " ".join(parts)


def mode_sequence_label(modes: list[str]) -> str:
    unique_modes = list(dict.fromkeys(modes))
    labels = [MODE_LABELS.get(m, m) for m in unique_modes]
    return " + ".join(labels)


def build_path_points(station_path: list[str]) -> list[StationPoint]:
    points = []
    for station_id in station_path:
        s = STATIONS[station_id]
        points.append(StationPoint(id=station_id, name=s["name"], lat=s["lat"], lon=s["lon"]))
    return points


# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "TransitFlow backend is running"}


@app.get("/stations")
def list_stations():
    return STATIONS


@app.post("/route", response_model=RouteResponse)
def get_routes(request: RouteRequest):
    origin = request.origin.lower()
    destination = request.destination.lower()

    if origin not in STATIONS:
        raise HTTPException(status_code=400, detail=f"Unknown origin station: '{request.origin}'")
    if destination not in STATIONS:
        raise HTTPException(status_code=400, detail=f"Unknown destination station: '{request.destination}'")
    if origin == destination:
        raise HTTPException(status_code=400, detail="Origin and destination must be different.")

    ranked = get_ranked_routes(origin, destination, request.priority, request.is_raining)

    if not ranked:
        raise HTTPException(status_code=404, detail="No routes found between these stations.")

    options = [
        RouteOption(
            mode=mode_sequence_label(r["modes"]),
            time_minutes=r["time_minutes"],
            cost_rupees=r["cost_rupees"],
            comfort_score=r["comfort_score"],
            score=r["score"],
            explanation=describe_route(r, request.is_raining),
            path=build_path_points(r["station_path"]),
        )
        for r in ranked
    ]

    return RouteResponse(
        origin=request.origin,
        destination=request.destination,
        priority=request.priority,
        is_raining=request.is_raining,
        options=options,
    )
