"""Journey planner endpoints: /plan and /plan/day."""

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from app import crowd_model as cm
from app import planner
from app import routing_engine as re_
from app.schemas import DayPlanRequest, DayPlanResponse, PlanRequest, PlanResponse, StationPoint

router = APIRouter(prefix="/api")

MAX_DAYS_AHEAD = 180


def station_point(station_id: str) -> StationPoint:
    info = re_.STATION_INFO[station_id]
    return StationPoint(id=station_id, name=info["name"], lat=info["lat"], lon=info["lon"])


def resolve_station(raw: str, role: str) -> str:
    station_id = raw.strip().lower()
    if station_id not in re_.STATION_INFO:
        raise HTTPException(status_code=400, detail=f"Unknown {role} station: '{raw}'")
    return station_id


def resolve_date(raw, now) -> date:
    if raw is None:
        return now.date()
    try:
        day = date.fromisoformat(raw)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"date: '{raw}' is not a real calendar date")
    if day < now.date() - timedelta(days=1) or day > now.date() + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(status_code=422, detail=f"date: choose a day between yesterday and {MAX_DAYS_AHEAD} days from now")
    return day


def default_time(day: date, now) -> str:
    """Today defaults to the next five-minute mark; other days to a typical morning start."""
    if day == now.date():
        rounded = planner.round_to_minute(now) + timedelta(minutes=(5 - now.minute % 5) % 5)
        return rounded.strftime("%H:%M")
    return "08:30"


@router.post("/plan", response_model=PlanResponse)
def plan_journey(request: PlanRequest):
    origin = resolve_station(request.origin, "origin")
    destination = resolve_station(request.destination, "destination")
    if origin == destination:
        raise HTTPException(status_code=400, detail="Origin and destination must be different.")

    now = cm.now_ist()
    day = resolve_date(request.date, now)
    moment = planner.combine(day, request.time or default_time(day, now))

    try:
        result = planner.plan_trip(origin, destination, moment, request.when, request.preference,
                                   request.is_raining, list(request.avoid), station_point, now)
    except planner.PlanError as err:
        raise HTTPException(status_code=err.status, detail=str(err))

    return PlanResponse(origin=station_point(origin), destination=station_point(destination), **result)


@router.post("/plan/day", response_model=DayPlanResponse)
def plan_day(request: DayPlanRequest):
    origin = resolve_station(request.origin, "origin")
    stops = []
    for i, stop in enumerate(request.stops, start=1):
        stops.append({"station": resolve_station(stop.station, f"stop {i}"),
                      "stay_minutes": stop.stay_minutes, "leave_at": stop.leave_at})
    if stops[0]["station"] == origin:
        raise HTTPException(status_code=400, detail="The first stop must differ from where you start.")

    now = cm.now_ist()
    day = resolve_date(request.date, now)
    start = planner.combine(day, request.start_time)

    try:
        result = planner.plan_day(origin, start, stops, request.return_to_origin, request.preference,
                                  request.is_raining, list(request.avoid), station_point, now)
    except planner.PlanError as err:
        raise HTTPException(status_code=err.status, detail=str(err))

    return DayPlanResponse(**result)
