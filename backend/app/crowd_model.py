"""
TransitFlow — Crowd model v2

There is no passenger-count feed for Mumbai's trains, so crowd levels here are
a *model*, not a measurement. What changed from the first version is how much
of the real commuting pattern the model captures:

1. Minute resolution. The hourly "how full is a typical rhythm" factors stored
   in the crowding_rules table are interpolated between hour centres, so 8:40
   and 9:20 differ and a journey that starts at 8:50 can be evaluated leg by
   leg at the minute each leg is actually ridden.

2. Direction. Morning flow is heavy *towards* the CBD end of each line
   (Churchgate, CSMT, Cuffe Parade ...) and evening flow heavy *away* from it.
   The counter-peak direction runs much emptier. Direction comes from the
   station order on each line, not from a distance guess.

3. Position along the line. Load accumulates as riders board and eases as they
   alight, so the busiest stretch sits about three quarters of the way towards
   the CBD (the Dadar / Bandra section on the Western Line, Kurla - Dadar on
   Central). The far suburban ends start lighter.

4. Rain nudges riders from roads onto rail and metro.

5. Service hours and headways, so a plan can say "first train is at 04:15" and
   estimate how long you will wait on the platform.

Everything here is an estimate built from well-known commuting patterns, and
the API says so. The "live" layer (live.py) adds rider reports and a clearly
labelled simulated feed on top of the expected value computed here.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database import SessionLocal
from app.models import CrowdingRuleModel, EdgeModel

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    return datetime.now(IST)


def day_type_for(moment: datetime) -> str:
    return "weekend" if moment.weekday() >= 5 else "weekday"


def reference_datetime(day_type: str, hour: int, minute: int = 0) -> datetime:
    """A concrete IST datetime on a typical weekday (Mon) or weekend day (Sun)."""
    day = 2 if day_type == "weekday" else 1   # 2 Nov 2026 is a Monday, 1 Nov a Sunday
    return datetime(2026, 11, day, hour, minute, tzinfo=IST)


# --- Per-line character --------------------------------------------------

# (lowest, highest) crowd score a line reaches over the day. Trunk suburban
# lines run fuller than the newer metros even off-peak.
LINE_CROWD_RANGE = {
    "Western Line": (0.15, 0.95),
    "Central Line": (0.17, 0.95),
    "Harbour Line": (0.12, 0.85),
    "Yellow Line": (0.08, 0.62),
    "Red Line": (0.08, 0.60),
    "Aqua Line": (0.05, 0.50),
    "Blue Line": (0.10, 0.80),   # short trains: Metro 1 fills up quickly
}
MODE_CROWD_RANGE = {
    "train": (0.15, 0.95),
    "metro": (0.08, 0.60),
    "bus": (0.10, 0.70),
    "road": (0.05, 0.35),
}

# The end of each line nearest the CBD. "Inbound" means heading towards it.
# Lines in SYMMETRIC_LINES connect two suburbs and have no real inbound flow.
CBD_END = {
    "Western Line": "churchgate",
    "Central Line": "csmt",
    "Harbour Line": "csmt_harbour",
    "Yellow Line": "andheri_west",
    "Red Line": "gundavali",
    "Aqua Line": "cuffe_parade",
}
# Lines that connect two suburbs have no CBD end and no real inbound flow.
SYMMETRIC_LINES = {"Blue Line"}

# Typical gap between services in minutes: (peak, off-peak, late night).
# Approximate figures from published timetables and common experience.
LINE_HEADWAY = {
    "Western Line": (3.5, 7.0, 15.0),
    "Central Line": (3.5, 8.0, 15.0),
    "Harbour Line": (5.0, 10.0, 20.0),
    "Yellow Line": (4.5, 8.0, 14.0),
    "Red Line": (4.5, 8.0, 14.0),
    "Aqua Line": (5.0, 8.0, 12.0),
    "Blue Line": (4.0, 7.0, 10.0),
}
MODE_HEADWAY = {
    "train": (4.0, 8.0, 18.0),
    "metro": (5.0, 8.0, 12.0),
    "bus": (8.0, 12.0, 25.0),
    "road": (3.0, 4.0, 6.0),   # time to get a cab or auto
}

# Approximate first and last service as hours of the IST day (24.75 = 00:45).
LINE_SERVICE = {
    "Western Line": (4.25, 24.75), "Central Line": (4.0, 24.75), "Harbour Line": (4.0, 24.5),
    "Yellow Line": (6.0, 22.75), "Red Line": (6.0, 22.75), "Aqua Line": (5.9, 22.5),
    "Blue Line": (5.5, 23.5),
}
MODE_SERVICE = {"train": (4.25, 24.75), "metro": (6.0, 22.75), "bus": (5.0, 24.0), "road": (0.0, 24.0)}

CROWD_LEVELS = [(0.30, "Comfortable"), (0.52, "Moderate"), (0.75, "Busy"), (1.01, "Packed")]
# Representative score of each level, used when blending rider reports.
LEVEL_SCORE = {"Comfortable": 0.15, "Moderate": 0.40, "Busy": 0.63, "Packed": 0.88}


def crowd_level_for_score(score: float) -> str:
    return next(name for thresh, name in CROWD_LEVELS if score < thresh)


def crowd_index(score: float) -> int:
    """Score 0-1 as a whole-number 0-100 index for display."""
    return int(round(max(0.0, min(1.0, score)) * 100))


def seat_chance(score: float) -> float:
    """Rough probability of finding a seat at some point of the ride (0-1)."""
    return round(max(0.0, min(1.0, 1.0 - (score - 0.12) / 0.55)), 2)


# --- Data loaded once from the database ----------------------------------

def _load_rhythm() -> dict:
    """{(mode, day_type): [24 hourly factors]} from the crowding_rules table."""
    table: dict = {}
    db = SessionLocal()
    try:
        for r in db.query(CrowdingRuleModel).all():
            for day in (("weekday", "weekend") if r.day_type == "any" else (r.day_type,)):
                table.setdefault((r.mode, day), [0.0] * 24)[r.start_hour] = r.crowd_penalty
    finally:
        db.close()
    return table


def _load_line_chains() -> dict:
    """
    {line: [station ids from the CBD end to the far end]} rebuilt from the
    edges table, so adding a line to the seed data needs no change here beyond
    its CBD_END entry.
    """
    db = SessionLocal()
    try:
        rows = db.query(EdgeModel.line, EdgeModel.from_station_id, EdgeModel.to_station_id) \
            .filter(EdgeModel.line.isnot(None), EdgeModel.mode != "transfer").all()
    finally:
        db.close()

    adjacency: dict = {}
    for line, a, b in rows:
        adj = adjacency.setdefault(line, {})
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)

    chains = {}
    for line, adj in adjacency.items():
        start = CBD_END.get(line)
        if start not in adj:
            ends = sorted(s for s, n in adj.items() if len(n) == 1)
            start = ends[0] if ends else next(iter(adj))
        order, seen, current = [start], {start}, start
        while True:
            nxt = [n for n in adj[current] if n not in seen]
            if not nxt:
                break
            current = nxt[0]
            order.append(current)
            seen.add(current)
        chains[line] = order
    return chains


RHYTHM = _load_rhythm()
LINE_CHAINS = _load_line_chains()
_CHAIN_INDEX = {line: {sid: i for i, sid in enumerate(chain)} for line, chain in LINE_CHAINS.items()}


def line_position(line: str, station_id: str) -> Optional[float]:
    """0 at the far end of the line, 1 at the CBD end; None if not on the line."""
    idx = _CHAIN_INDEX.get(line, {}).get(station_id)
    if idx is None:
        return None
    n = len(LINE_CHAINS[line])
    return 1.0 - idx / (n - 1) if n > 1 else 1.0


def stations_between(line: str, from_station: str, to_station: str) -> list[str]:
    """Stations ridden on `line` from one to the other, both ends included."""
    index = _CHAIN_INDEX.get(line, {})
    a, b = index.get(from_station), index.get(to_station)
    if a is None or b is None:
        return [from_station, to_station]
    chain = LINE_CHAINS[line]
    return chain[a:b + 1] if a <= b else chain[b:a + 1][::-1]


# --- The model -----------------------------------------------------------

def rhythm_at(mode: str, day_type: str, t_hours: float) -> float:
    """
    Typical commute rhythm (0-1) at a fractional hour of the day. Each stored
    hourly value is taken to apply at the middle of that hour, and the curve
    is interpolated linearly between hour centres (wrapping across midnight).
    """
    values = RHYTHM.get((mode, day_type))
    if not values:
        return 0.0
    x = (t_hours % 24.0) - 0.5
    i0 = math.floor(x)
    frac = x - i0
    return values[i0 % 24] * (1.0 - frac) + values[(i0 + 1) % 24] * frac


def _bump(t: float, centre: float, spread: float) -> float:
    return math.exp(-(((t - centre) / spread) ** 2))


# How strongly the peak direction is amplified (and the counter-peak damped).
DIRECTION_TILT = 0.45
AM_CENTRE, AM_SPREAD = 9.0, 1.9
PM_CENTRE, PM_SPREAD = 18.7, 2.2

# Rain shifts riders from roads onto rail and metro, so those get fuller.
RAIN_CROWD_BOOST = {"train": 0.07, "metro": 0.09, "bus": 0.05, "road": 0.0}


def position_profile(pos: float, symmetric: bool = False) -> float:
    """Multiplier (0.62 - 1.0) on a line's top crowd level: load builds towards
    the CBD, peaks about three quarters of the way there, then eases. A line
    between two suburbs is simply busiest in the middle."""
    centre, spread = (0.5, 0.38) if symmetric else (0.72, 0.32)
    return 0.62 + 0.38 * math.exp(-(((pos - centre) / spread) ** 2))


def _crowd_range(line: Optional[str], mode: str) -> tuple[float, float]:
    return LINE_CROWD_RANGE.get(line) or MODE_CROWD_RANGE.get(mode, (0.10, 0.60))


def segment_crowd(
    line: Optional[str], mode: str, from_station: Optional[str], to_station: Optional[str],
    t_hours: float, day_type: str, rain: bool = False,
) -> float:
    """
    Expected crowd score (0-1) for one hop of a ride, at a fractional hour.
    With no station information (bus, road, or a bare line/mode lookup) only
    the time-of-day rhythm and the line's character apply.
    """
    lo, hi = _crowd_range(line, mode)
    factor = rhythm_at(mode, day_type, t_hours)

    pos_a = line_position(line, from_station) if line and from_station else None
    pos_b = line_position(line, to_station) if line and to_station else None
    if pos_a is not None and pos_b is not None:
        if line not in SYMMETRIC_LINES:
            inbound = pos_b > pos_a
            sign = 1.0 if inbound else -1.0
            tilt = DIRECTION_TILT * (1.0 if day_type == "weekday" else 0.25)
            lean = _bump(t_hours, AM_CENTRE, AM_SPREAD) - _bump(t_hours, PM_CENTRE, PM_SPREAD)
            factor *= 1.0 + tilt * lean * sign
        hi = min(1.0, hi * position_profile((pos_a + pos_b) / 2.0, line in SYMMETRIC_LINES))

    factor = max(0.0, min(1.0, factor))
    score = lo + factor * (hi - lo)
    if rain:
        score += RAIN_CROWD_BOOST.get(mode, 0.0) * (0.4 + factor)
    return max(0.0, min(1.0, score))


def leg_crowd(
    line: Optional[str], mode: str, from_station: str, to_station: str,
    start: datetime, ride_minutes: float, rain: bool = False,
) -> dict:
    """
    Crowd for a whole ride leg. Walks the line hop by hop, advancing the clock
    as the train advances, so a long ride that starts before the peak and ends
    inside it is scored honestly. `score` blends the average with the worst
    stretch (what the rider remembers); `peak_station` says where it bites.
    """
    stops = stations_between(line, from_station, to_station) if line else [from_station, to_station]
    hops = max(1, len(stops) - 1)
    per_hop = ride_minutes / hops

    scores, worst, worst_station = [], -1.0, to_station
    for i in range(hops):
        moment = start + timedelta(minutes=per_hop * (i + 0.5))
        t_hours = moment.hour + moment.minute / 60.0 + moment.second / 3600.0
        s = segment_crowd(line, mode, stops[i], stops[i + 1], t_hours, day_type_for(moment), rain)
        scores.append(s)
        if s > worst:
            worst, worst_station = s, stops[i + 1] if i + 1 < len(stops) else stops[-1]

    avg = sum(scores) / len(scores)
    felt = 0.65 * avg + 0.35 * worst
    return {"score": round(felt, 3), "average": round(avg, 3), "peak": round(worst, 3),
            "peak_station": worst_station, "level": crowd_level_for_score(felt),
            "seat_chance": seat_chance(felt)}


def headway_minutes(line: Optional[str], mode: str, moment: datetime) -> float:
    """Typical gap between services at this moment."""
    peak, offpeak, night = LINE_HEADWAY.get(line) or MODE_HEADWAY.get(mode, (6.0, 10.0, 20.0))
    t_hours = moment.hour + moment.minute / 60.0
    demand = rhythm_at(mode if mode in ("train", "metro", "bus") else "train", day_type_for(moment), t_hours)
    if mode == "road":
        return offpeak
    if demand >= 0.30:
        return offpeak + (peak - offpeak) * min(1.0, (demand - 0.30) / 0.55)
    return offpeak + (night - offpeak) * min(1.0, (0.30 - demand) / 0.25)


def service_hours(line: Optional[str], mode: str) -> tuple[float, float]:
    return LINE_SERVICE.get(line) or MODE_SERVICE.get(mode, (0.0, 24.0))


def next_service_time(line: Optional[str], mode: str, moment: datetime) -> tuple[datetime, bool]:
    """
    Earliest moment a service can be boarded at or after `moment`.
    Returns (time, waited_for_opening); the flag is True when the line was
    closed and the answer is the next first service.
    """
    first, last = service_hours(line, mode)
    midnight = moment.replace(hour=0, minute=0, second=0, microsecond=0)
    hours_now = (moment - midnight).total_seconds() / 3600.0

    # A late-night window that runs past 24:00 also covers the small hours of
    # the same calendar day (00:00 - 00:45 belongs to yesterday's service).
    if last > 24.0 and hours_now < last - 24.0:
        return moment, False
    if first <= hours_now < min(last, 24.0):
        return moment, False
    if hours_now < first:
        return midnight + timedelta(hours=first), True
    return midnight + timedelta(days=1, hours=first), True


# Station-level crowd for the live pages ------------------------------------

_LINE_MODE: dict = {}


def line_mode(line: str) -> str:
    """'train' or 'metro' for a named line (read once from the edges table)."""
    if not _LINE_MODE:
        db = SessionLocal()
        try:
            for ln, mode in db.query(EdgeModel.line, EdgeModel.mode).filter(EdgeModel.line.isnot(None)).distinct():
                _LINE_MODE[ln] = mode
        finally:
            db.close()
    return _LINE_MODE.get(line, "train")


def station_crowd(line: str, station_id: str, inbound: bool, moment: datetime, rain: bool = False) -> Optional[float]:
    """
    Crowd score for a rider boarding at `station_id` on `line` towards the CBD
    end (inbound) or away from it. None at a terminus where no train runs in
    that direction.
    """
    chain = LINE_CHAINS.get(line)
    idx = _CHAIN_INDEX.get(line, {}).get(station_id)
    if not chain or idx is None:
        return None
    j = idx - 1 if inbound else idx + 1
    if j < 0 or j >= len(chain):
        return None
    t_hours = moment.hour + moment.minute / 60.0
    return segment_crowd(line, line_mode(line), chain[idx], chain[j], t_hours, day_type_for(moment), rain)
