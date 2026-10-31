"""
TransitFlow — Live layer

Turns the expected-value crowd model into a "right now" view. Three things sit
on top of the model, and the API is explicit about which is which:

1. Rider reports (real data). Anyone can report how crowded a station feels.
   Recent reports are blended into that station's reading, newer ones weighing
   more, and the count is shown so nobody mistakes a model for a measurement.

2. Small fluctuations (simulated). A deterministic wobble of a few percent per
   five-minute bucket, so the numbers move the way real ones do instead of
   sitting on a smooth curve.

3. Service alerts (simulated). Occasional delays are generated from a hash of
   the line, day and half-hour. They are repeatable (same minute, same answer,
   on every server) and flagged `simulated: true`, because there is no
   operator feed behind them. They exist so the planner and assistant can be
   demonstrated reacting to disruption.

Everything is a pure function of the clock plus the report table, so it works
the same on a serverless host as on a laptop.
"""

from __future__ import annotations

import functools
import time
import zlib
from datetime import date, datetime, timedelta
from typing import Optional

from app import crowd_model as cm
from app import routing_engine as re_
from app.state_db import CrowdReportModel, StateSession, STATE_DB_READY

REPORT_HALF_LIFE_MIN = 25.0     # a report loses half its weight after about this long
REPORT_WINDOW_SECONDS = 3600
REPORT_COOLDOWN_SECONDS = 120   # one report per person per station per two minutes
FLUCTUATION = 0.05              # +/- crowd score of the simulated wobble


def _roll(*parts) -> float:
    """Deterministic pseudo-random number in [0, 1) from the given parts (stable across processes)."""
    return zlib.crc32("|".join(str(p) for p in parts).encode()) / 2 ** 32


# --- Simulated service alerts ---------------------------------------------

_TRAIN_CAUSES = ("Signal failure", "Technical snag", "Overhead wire problem", "Track maintenance")
_METRO_CAUSES = ("Technical snag", "Door fault", "Signalling check")


@functools.lru_cache(maxsize=512)
def _alert_events(line: str, day: date) -> tuple:
    """Every simulated disruption on `line` that starts on `day`."""
    mode = cm.line_mode(line)
    chain = cm.LINE_CHAINS.get(line, [])
    first, last = cm.service_hours(line, mode)
    base = 0.05 if mode == "train" else 0.015
    events = []
    for bucket in range(48):
        start_hour = bucket / 2.0
        if start_hour < first or start_hour >= min(last, 24.0) or not chain:
            continue
        busy = cm.rhythm_at(mode, "weekday" if day.weekday() < 5 else "weekend", start_hour + 0.25)
        if _roll("alert", line, day, bucket) >= base * (0.6 + 1.2 * busy):
            continue
        start = datetime(day.year, day.month, day.day, tzinfo=cm.IST) + timedelta(
            minutes=bucket * 30 + int(_roll("start", line, day, bucket) * 25))
        duration = 25 + int(_roll("len", line, day, bucket) * 30)
        delay = 5 + int(_roll("delay", line, day, bucket) * 12)
        station = chain[int(_roll("where", line, day, bucket) * len(chain))]
        causes = _TRAIN_CAUSES if mode == "train" else _METRO_CAUSES
        cause = causes[int(_roll("cause", line, day, bucket) * len(causes))]
        events.append({
            "line": line, "start": start, "end": start + timedelta(minutes=duration), "delay_minutes": delay,
            "station": station, "cause": cause,
        })
    return tuple(events)


def active_alerts(moment: datetime) -> list[dict]:
    """Simulated alerts in force at `moment`."""
    found = []
    for line in cm.LINE_CHAINS:
        for day in (moment.date() - timedelta(days=1), moment.date()):
            for e in _alert_events(line, day):
                if e["start"] <= moment < e["end"]:
                    station = re_.STATION_INFO[e["station"]]["name"]
                    found.append({
                        "line": line, "station": station, "cause": e["cause"], "delay_minutes": e["delay_minutes"],
                        "since": e["start"].isoformat(), "until": e["end"].isoformat(), "simulated": True,
                        "message": f"{e['cause']} near {station}: services about {e['delay_minutes']} min late.",
                    })
    return sorted(found, key=lambda a: -a["delay_minutes"])


def alert_delay_minutes(line: Optional[str], moment: datetime) -> int:
    """Extra waiting time a rider boarding `line` at `moment` should expect from simulated alerts."""
    if not line or line not in cm.LINE_CHAINS:
        return 0
    for day in (moment.date() - timedelta(days=1), moment.date()):
        for e in _alert_events(line, day):
            if e["start"] <= moment < e["end"]:
                return e["delay_minutes"]
    return 0


# --- Rider reports --------------------------------------------------------

def record_report(station_id: str, level: str, client: str, now_epoch: Optional[int] = None) -> str:
    """
    Store a report. Returns "ok", "cooldown" (same client reported this station
    moments ago) or "unavailable" (the state database cannot be written).
    """
    if not STATE_DB_READY:
        return "unavailable"
    now_epoch = now_epoch or int(time.time())
    db = StateSession()
    try:
        recent = db.query(CrowdReportModel.id).filter(
            CrowdReportModel.station_id == station_id,
            CrowdReportModel.client == client,
            CrowdReportModel.created_at >= now_epoch - REPORT_COOLDOWN_SECONDS,
        ).first()
        if recent:
            return "cooldown"
        db.add(CrowdReportModel(station_id=station_id, level=level, created_at=now_epoch, client=client))
        db.commit()
        return "ok"
    except Exception:
        db.rollback()
        return "unavailable"
    finally:
        db.close()


def recent_reports(now_epoch: Optional[int] = None, station_id: Optional[str] = None) -> dict:
    """{station_id: [(level, age_minutes), ...]} for the last hour."""
    if not STATE_DB_READY:
        return {}
    now_epoch = now_epoch or int(time.time())
    db = StateSession()
    try:
        query = db.query(CrowdReportModel.station_id, CrowdReportModel.level, CrowdReportModel.created_at) \
            .filter(CrowdReportModel.created_at >= now_epoch - REPORT_WINDOW_SECONDS)
        if station_id:
            query = query.filter(CrowdReportModel.station_id == station_id)
        grouped: dict = {}
        for sid, level, created in query.all():
            grouped.setdefault(sid, []).append((level, (now_epoch - created) / 60.0))
        return grouped
    except Exception:
        return {}
    finally:
        db.close()


def blend_reports(model_score: float, reports: list) -> tuple[float, float]:
    """
    Blend rider reports into a model score. Each report's weight halves every
    REPORT_HALF_LIFE_MIN minutes. Returns (blended score, share of the answer
    that comes from reports, 0-0.75).
    """
    if not reports:
        return model_score, 0.0
    weights = [0.5 ** (age / REPORT_HALF_LIFE_MIN) for _, age in reports]
    total = sum(weights)
    if total < 0.05:
        return model_score, 0.0
    reported = sum(w * cm.LEVEL_SCORE[level] for (level, _), w in zip(reports, weights)) / total
    share = min(0.75, total / (total + 1.5))
    return (1 - share) * model_score + share * reported, share


# --- Live readings --------------------------------------------------------

def _wobble(line: str, station_id: str, inbound: bool, moment: datetime) -> float:
    bucket = int(moment.timestamp() // 300)
    return (_roll("wobble", line, station_id, inbound, bucket) * 2 - 1) * FLUCTUATION


def station_reading(line: str, station_id: str, inbound: bool, moment: datetime, rain: bool = False,
                    reports: Optional[list] = None, alert_active: bool = False) -> Optional[dict]:
    base = cm.station_crowd(line, station_id, inbound, moment, rain)
    if base is None:
        return None
    score = base + _wobble(line, station_id, inbound, moment) + (0.10 if alert_active else 0.0)
    score = max(0.0, min(1.0, score))
    score, share = blend_reports(score, reports or [])
    return {"score": round(score, 3), "index": cm.crowd_index(score), "level": cm.crowd_level_for_score(score),
            "seat_chance": cm.seat_chance(score), "report_share": round(share, 2)}


def _in_service(line: str, moment: datetime) -> bool:
    first, last = cm.service_hours(line, cm.line_mode(line))
    hours = moment.hour + moment.minute / 60.0
    return (first <= hours < min(last, 24.0)) or (last > 24.0 and hours < last - 24.0)


def _sweep(line: str, moment: datetime, rain: bool, reports: dict, alert_active: bool):
    """Every station reading on a line, in both directions."""
    rows = []
    for sid in cm.LINE_CHAINS[line]:
        station_reports = reports.get(sid, [])
        rows.append({
            "id": sid, "name": re_.STATION_INFO[sid]["name"],
            "inbound": station_reading(line, sid, True, moment, rain, station_reports, alert_active),
            "outbound": station_reading(line, sid, False, moment, rain, station_reports, alert_active),
            "reports": len(station_reports),
        })
    return rows


def line_ribbon(line: str, moment: datetime, rain: bool = False) -> dict:
    alerts = [a for a in active_alerts(moment) if a["line"] == line]
    rows = _sweep(line, moment, rain, recent_reports(int(moment.timestamp())), bool(alerts))
    return {"line": line, "mode": cm.line_mode(line), "in_service": _in_service(line, moment),
            "inbound_label": f"Towards {re_.STATION_INFO[cm.LINE_CHAINS[line][0]]['name']}",
            "outbound_label": f"Towards {re_.STATION_INFO[cm.LINE_CHAINS[line][-1]]['name']}",
            "stations": rows, "alerts": alerts}


def snapshot(moment: datetime, rain: bool = False) -> dict:
    """The whole network right now."""
    reports = recent_reports(int(moment.timestamp()))
    alerts = active_alerts(moment)
    alerts_by_line = {a["line"]: a for a in alerts}

    lines, hotspots = [], []
    for line in cm.LINE_CHAINS:
        mode = cm.line_mode(line)
        in_service = _in_service(line, moment)
        alert = alerts_by_line.get(line)
        entry = {"line": line, "mode": mode, "in_service": in_service,
                 "headway_minutes": round(cm.headway_minutes(line, mode, moment), 1) if in_service else None,
                 "status": "Not running" if not in_service else ("Delayed" if alert else "Normal"),
                 "delay_minutes": alert["delay_minutes"] if alert else 0, "alert": alert["message"] if alert else None,
                 "inbound": None, "outbound": None, "index": None, "level": None}
        if in_service:
            rows = _sweep(line, moment, rain, reports, bool(alert))
            for direction in ("inbound", "outbound"):
                values = [r[direction]["score"] for r in rows if r[direction]]
                if values:
                    mean = sum(values) / len(values)
                    entry[direction] = {"score": round(mean, 3), "index": cm.crowd_index(mean),
                                        "level": cm.crowd_level_for_score(mean)}
            headline = max((entry[d] for d in ("inbound", "outbound") if entry[d]), key=lambda d: d["score"], default=None)
            if headline:
                entry["index"], entry["level"] = headline["index"], headline["level"]
            for r in rows:
                for direction in ("inbound", "outbound"):
                    reading = r[direction]
                    if reading:
                        hotspots.append({"station_id": r["id"], "station": r["name"], "line": line,
                                         "direction": direction, "index": reading["index"], "level": reading["level"],
                                         "score": reading["score"], "reports": r["reports"]})
        lines.append(entry)

    # One row per station: its worst line/direction.
    best: dict = {}
    for h in hotspots:
        if h["station_id"] not in best or h["score"] > best[h["station_id"]]["score"]:
            best[h["station_id"]] = h
    ranked = sorted(best.values(), key=lambda h: -h["score"])

    return {
        "as_of": moment.isoformat(), "day_type": cm.day_type_for(moment), "is_raining": rain,
        "lines": lines, "hotspots": ranked[:8], "calmest": ranked[::-1][:5],
        "alerts": alerts, "reports_last_hour": sum(len(v) for v in reports.values()),
        "sources": {
            "model": "Expected crowd from time-of-day, direction, position on the line and rain.",
            "reports": "Rider reports from the last hour, blended into station readings.",
            "simulated": "Small fluctuations and service alerts are simulated; there is no operator feed.",
        },
        "reports_enabled": STATE_DB_READY,
    }


def station_status(station_id: str, moment: datetime, rain: bool = False) -> dict:
    """Live reading for every line that serves a station."""
    reports = recent_reports(int(moment.timestamp()), station_id).get(station_id, [])
    alerts = {a["line"]: a for a in active_alerts(moment)}
    services = []
    for line, chain in cm.LINE_CHAINS.items():
        if station_id not in chain:
            continue
        in_service = _in_service(line, moment)
        alert = alerts.get(line)
        services.append({
            "line": line, "mode": cm.line_mode(line), "in_service": in_service,
            "inbound": station_reading(line, station_id, True, moment, rain, reports, bool(alert)) if in_service else None,
            "outbound": station_reading(line, station_id, False, moment, rain, reports, bool(alert)) if in_service else None,
            "alert": alert["message"] if alert else None,
        })
    return {"station_id": station_id, "station": re_.STATION_INFO[station_id]["name"], "as_of": moment.isoformat(),
            "reports_last_hour": len(reports), "services": services}


# --- Crowd atlas -----------------------------------------------------------

@functools.lru_cache(maxsize=8)
def atlas(day_type: str, direction: str) -> dict:
    """Average crowd index for each line in 48 half-hour slots; None while the line is closed."""
    inbound = direction == "inbound"
    base_day = cm.reference_datetime(day_type, 0)
    slots = [f"{(m // 60):02d}:{(m % 60):02d}" for m in range(0, 1440, 30)]
    rows = []
    for line, chain in cm.LINE_CHAINS.items():
        values = []
        for slot in range(48):
            moment = base_day + timedelta(minutes=slot * 30 + 15)
            if not _in_service(line, moment):
                values.append(None)
                continue
            scores = [s for s in (cm.station_crowd(line, sid, inbound, moment) for sid in chain) if s is not None]
            values.append(cm.crowd_index(sum(scores) / len(scores)) if scores else None)
        rows.append({"line": line, "mode": cm.line_mode(line), "values": values})
    return {"day_type": day_type, "direction": direction, "slots": slots, "lines": rows,
            "levels": [{"max": int(t * 100), "name": n} for t, n in cm.CROWD_LEVELS]}


def best_times(origin: str, destination: str, day: date, rain: bool = False, preference: str = "balanced") -> list[dict]:
    """
    Quietest and busiest departures across the service day, a coarse sweep
    used by the assistant. Returns one row per half-hour from 05:00 to 23:00.
    """
    from app import planner
    candidates = planner.usable_candidates(origin, destination, [])
    rows = []
    for half_hours in range(10, 47):
        moment = datetime(day.year, day.month, day.day, tzinfo=cm.IST) + timedelta(minutes=half_hours * 30)
        best = planner.best_for(planner.simulate_all(candidates, moment, rain, None), preference)
        rows.append({"depart": best.start.isoformat(), "arrive": best.end.isoformat(),
                     "duration_minutes": best.duration, "cost_rupees": best.cost, "crowd_score": best.crowd_score,
                     "crowd_level": cm.crowd_level_for_score(best.crowd_score),
                     "effective_minutes": best.effective_minutes, "label": planner._label(best)})
    return rows
