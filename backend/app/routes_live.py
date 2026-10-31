"""Live crowd endpoints: network snapshot, line ribbons, rider reports, crowd atlas."""

import hashlib
from typing import Literal

from fastapi import APIRouter, HTTPException, Request

from app import crowd_model as cm
from app import live
from app import routing_engine as re_
from app.schemas import CrowdReportRequest

router = APIRouter(prefix="/api")


@router.get("/live")
def live_snapshot(rain: bool = False):
    """Crowd and service status across the whole network, right now (Mumbai time)."""
    return live.snapshot(cm.now_ist(), rain)


@router.get("/live/line/{line}")
def live_line(line: str, rain: bool = False):
    if line not in cm.LINE_CHAINS:
        raise HTTPException(status_code=404, detail=f"Unknown line: '{line}'")
    return live.line_ribbon(line, cm.now_ist(), rain)


@router.get("/live/station/{station_id}")
def live_station(station_id: str, rain: bool = False):
    station_id = station_id.lower()
    if station_id not in re_.STATION_INFO:
        raise HTTPException(status_code=404, detail=f"Unknown station: '{station_id}'")
    return live.station_status(station_id, cm.now_ist(), rain)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    agent = request.headers.get("user-agent", "")
    return hashlib.sha256(f"{ip}|{agent}".encode()).hexdigest()[:16]


@router.post("/crowd/report")
def report_crowd(body: CrowdReportRequest, request: Request):
    """Tell TransitFlow how crowded a station feels right now; it is blended into the live reading."""
    station_id = body.station.strip().lower()
    if station_id not in re_.STATION_INFO:
        raise HTTPException(status_code=400, detail=f"Unknown station: '{body.station}'")

    outcome = live.record_report(station_id, body.level, _client_key(request))
    if outcome == "unavailable":
        raise HTTPException(status_code=503, detail="Reports cannot be saved on this deployment right now.")
    if outcome == "cooldown":
        raise HTTPException(status_code=429, detail="Thanks, you already reported this station a moment ago.")
    return {"accepted": True, "status": live.station_status(station_id, cm.now_ist())}


@router.get("/crowd/atlas")
def crowd_atlas(day_type: Literal["weekday", "weekend"] = "weekday",
                direction: Literal["inbound", "outbound"] = "inbound"):
    """Typical crowd index per line for every half hour of the day."""
    return live.atlas(day_type, direction)
