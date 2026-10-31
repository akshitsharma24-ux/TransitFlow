"""
TransitFlow — Journey planner

The routing engine answers "which stations, in which order". This module
answers "what will the journey actually be like if I start at 8:50 tomorrow":

* every ride is placed on the clock: you wait for the next service (half the
  headway on average, more when trains are too full to board), ride, walk,
  change, and arrive at a real time;
* the crowd on each ride is evaluated at the minute that ride happens, not
  once for the whole trip;
* the same trip is re-evaluated for departures before and after yours, which
  is what powers the "best time to leave" advice;
* a day plan chains several trips together with the time spent at each stop.

All numbers rest on crowd_model.py (an expected-value model, not a live
passenger count) and the fares and in-vehicle times already in the routing
engine, so everything here is an estimate and is labelled that way by the API.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Optional

from app import crowd_model as cm
from app import routing_engine as re_

PREFERENCES = ("balanced", "fastest", "cheapest", "comfortable", "least_crowded", "fewest_transfers")
PREFERENCE_LABELS = {
    "balanced": "Smart pick", "fastest": "Fastest", "cheapest": "Cheapest",
    "comfortable": "Most comfortable", "least_crowded": "Least crowded", "fewest_transfers": "Fewest changes",
}

# How the planner trades things off when it has to pick one journey.
VALUE_OF_RUPEE_IN_MINUTES = 0.22   # Rs 100 is worth about 22 minutes of a rider's time
TRANSFER_HASSLE_MINUTES = 12.0     # each change costs effort beyond its walking time
ROAD_LEG_HASSLE_MINUTES = 6.0      # a bus or cab leg inside a longer trip: finding the stop, traffic uncertainty
EARLIER_SHIFT_PENALTY = 0.15       # minutes of cost per minute you set off earlier than asked
ADVISOR_MIN_GAIN = 6.0               # minutes saved before the advisor suggests a different time
LATER_SHIFT_PENALTY = 0.35         # ... and per minute you set off later (you arrive later too)
CROWD_DISCOMFORT_WEIGHT = 1.4      # minutes of discomfort per minute on a completely packed ride
CROWD_DISCOMFORT_POWER = 1.6       # discomfort grows faster than crowding itself
CAB_PICKUP_MINUTES = 4             # time to get a cab or auto on the road
MIN_BOARDING_WAIT = 1

# Hub tips shown when a plan changes at these stations.
HUB_TIPS = {
    "dadar": "Dadar is Mumbai's busiest interchange; allow a few extra minutes at peak.",
    "dadar_central": "Dadar is Mumbai's busiest interchange; allow a few extra minutes at peak.",
    "andheri": "Andheri's platforms and skywalks get very crowded at peak; leave a buffer.",
    "kurla": "Kurla has separate Central and Harbour platform groups; follow the signs for the right one.",
    "ghatkopar": "The Metro 1 skywalk at Ghatkopar is a short walk; keep to the signed route.",
}


def default_station_point(station_id: str) -> dict:
    info = re_.STATION_INFO[station_id]
    return {"id": station_id, "name": info["name"], "lat": info["lat"], "lon": info["lon"]}


# --- Time helpers ---------------------------------------------------------

def hhmm(moment: datetime) -> str:
    return moment.strftime("%H:%M")


def round_to_minute(moment: datetime) -> datetime:
    return (moment + timedelta(seconds=30)).replace(second=0, microsecond=0)


def combine(day, time_str: str) -> datetime:
    hours, minutes = (int(x) for x in time_str.split(":"))
    return datetime(day.year, day.month, day.day, hours, minutes, tzinfo=cm.IST)


# --- Simulating one candidate on the clock --------------------------------

AlertDelay = Callable[[Optional[str], datetime], int]


@dataclass
class SimResult:
    candidate: dict
    start: datetime
    end: datetime
    steps: list
    cost: int
    ride_minutes: int
    wait_minutes: int
    walk_minutes: int
    transfers: int
    crowd_score: float          # headline crowd for the whole journey
    worst_leg_score: float
    discomfort: float           # minutes of crowd discomfort
    effective_minutes: float    # duration + discomfort + change hassle (no money)
    warnings: list

    @property
    def duration(self) -> int:
        return int((self.end - self.start).total_seconds() // 60)


def _station_name(station_id: str) -> str:
    return re_.STATION_INFO[station_id]["name"]


def simulate(candidate: dict, start: datetime, rain: bool = False,
             alert_delay: Optional[AlertDelay] = None) -> SimResult:
    """Place one routing candidate on the clock, starting at the origin at `start`."""
    t = round_to_minute(start)
    start = t
    steps, warnings = [], []
    cost = ride_minutes = wait_minutes = walk_minutes = 0
    ride_results = []   # (leg crowd dict, minutes)
    ride_modes = []

    legs = candidate["legs"]
    for i, leg in enumerate(legs):
        a, b = leg["from_station"], leg["to_station"]
        if leg["type"] == "walk":
            minutes = leg["time_minutes"]
            next_ride = next((l for l in legs[i + 1:] if l["type"] == "ride"), None)
            if a != b:
                note = f"Walk from {_station_name(a)} to {_station_name(b)}"
            elif next_ride and next_ride["mode"] in ("bus", "road"):
                note = f"Walk out of {_station_name(a)} to the {'bus stop' if next_ride['mode'] == 'bus' else 'cab and auto stand'}"
            else:
                note = f"Change platforms or mode at {_station_name(a)}"
            steps.append({
                "kind": "walk", "start": t, "end": t + timedelta(minutes=minutes), "minutes": minutes,
                "mode": None, "line": None, "from_station": a, "to_station": b, "note": note,
            })
            t += timedelta(minutes=minutes)
            walk_minutes += minutes
            continue

        mode, line = leg["mode"], leg["line"]
        label = line or re_.MODE_LABELS.get(mode, mode)

        service_start, was_closed = cm.next_service_time(line, mode, t)
        headway = cm.headway_minutes(line, mode, service_start)
        if was_closed:
            wait = int((service_start - t).total_seconds() // 60)
            warnings.append(f"{label} is not running at {hhmm(t)}; this plan waits for the first service at {hhmm(service_start)}.")
            skip_extra = 0.0
        else:
            stops = cm.stations_between(line, a, b) if line else [a, b]
            t_hours = t.hour + t.minute / 60.0
            first_hop = cm.segment_crowd(line, mode, stops[0], stops[1], t_hours, cm.day_type_for(t), rain)
            # Too-full services leave some riders behind; model it as the
            # expected extra headway you spend waiting for a train you can board.
            p_skip = max(0.0, min(1.0, (first_hop - 0.62) / 0.38)) * 0.55
            skip_extra = p_skip * headway
            base = CAB_PICKUP_MINUTES if mode == "road" else headway / 2.0
            wait = max(MIN_BOARDING_WAIT, int(round(base + skip_extra)))

        delay = alert_delay(line, t) if alert_delay and not was_closed else 0
        wait += delay

        board_at = t + timedelta(minutes=wait)
        if wait >= MIN_BOARDING_WAIT:
            if mode == "road":
                note = f"Hail a cab or auto; pickup is usually about {CAB_PICKUP_MINUTES} minutes."
            elif was_closed:
                note = f"Waiting for the first {label} service."
            else:
                note = f"{label} runs about every {headway:.0f} min at this hour."
                if skip_extra >= 1.0:
                    note += " Expect to let a full train go."
                if delay:
                    note += f" Includes a simulated {delay}-minute delay."
            steps.append({
                "kind": "wait", "start": t, "end": board_at, "minutes": wait, "mode": mode, "line": line,
                "from_station": a, "to_station": a, "note": note, "headway": round(headway, 1),
                "delay": delay or None,
            })
            wait_minutes += wait

        minutes = leg["time_minutes"]
        crowd = cm.leg_crowd(line, mode, a, b, board_at, minutes, rain)
        steps.append({
            "kind": "ride", "start": board_at, "end": board_at + timedelta(minutes=minutes), "minutes": minutes,
            "mode": mode, "line": line, "from_station": a, "to_station": b,
            "stops": leg["hop_count"], "cost": leg["cost_rupees"], "crowd": crowd,
            "note": None,
        })
        t = board_at + timedelta(minutes=minutes)
        cost += leg["cost_rupees"]
        ride_minutes += minutes
        ride_results.append((crowd, minutes))
        ride_modes.append(mode)

    if ride_results:
        total = sum(m for _, m in ride_results)
        mean_score = sum(c["score"] * m for c, m in ride_results) / total
        worst = max(c["score"] for c, _ in ride_results)
        crowd_score = 0.6 * mean_score + 0.4 * worst
        discomfort = sum(CROWD_DISCOMFORT_WEIGHT * m * (c["score"] ** CROWD_DISCOMFORT_POWER) for c, m in ride_results)
    else:
        crowd_score = worst = discomfort = 0.0

    transfers = max(0, len(ride_results) - 1)
    duration = int((t - start).total_seconds() // 60)
    road_legs = sum(1 for m in ride_modes if m in ("bus", "road")) if transfers else 0
    effective = duration + discomfort + TRANSFER_HASSLE_MINUTES * transfers + ROAD_LEG_HASSLE_MINUTES * road_legs

    return SimResult(candidate=candidate, start=start, end=t, steps=steps, cost=cost, ride_minutes=ride_minutes,
                     wait_minutes=wait_minutes, walk_minutes=walk_minutes, transfers=transfers,
                     crowd_score=round(crowd_score, 3), worst_leg_score=round(worst, 3),
                     discomfort=round(discomfort, 1), effective_minutes=round(effective, 1), warnings=warnings)


# --- Choosing between simulated candidates --------------------------------

def generalized_cost(sim: SimResult) -> float:
    """Everything the 'smart pick' cares about, in minutes."""
    return sim.effective_minutes + VALUE_OF_RUPEE_IN_MINUTES * sim.cost


def _comfort_blend(sim: SimResult) -> float:
    # Lower is better. Engine comfort (1-5) and predicted crowd count equally;
    # a small money term stops a very expensive cab from winning on comfort alone.
    return 0.5 * (5 - sim.candidate["comfort_score"]) / 4 + 0.5 * sim.crowd_score + 0.0008 * sim.cost


def preference_key(sim: SimResult, preference: str) -> tuple:
    if preference == "fastest":
        return (sim.duration, sim.cost, sim.crowd_score)
    if preference == "cheapest":
        return (sim.cost, sim.duration, sim.crowd_score)
    if preference == "comfortable":
        return (round(_comfort_blend(sim), 3), sim.duration)
    if preference == "least_crowded":
        return (round(sim.crowd_score, 2), sim.duration, sim.cost)
    if preference == "fewest_transfers":
        return (sim.transfers, sim.duration, sim.cost)
    return (round(generalized_cost(sim), 1), sim.duration)


def usable_candidates(origin: str, destination: str, avoid: list[str]) -> list[dict]:
    """Routing candidates, minus anything that rides an avoided mode or is hopelessly slow."""
    candidates = re_.explore_routes(origin, destination)
    if avoid:
        candidates = [c for c in candidates if not any(m in avoid for m in c["modes"])]
    if not candidates:
        return []
    best = min(c["time_minutes"] for c in candidates)
    cheapest = min(c["cost_rupees"] for c in candidates)
    # Keep anything reasonably close in time, plus the cheapest at any speed:
    # a rider who picks "cheapest" accepts a slower trip, but not an absurd one.
    return [c for c in candidates
            if c["time_minutes"] <= best * 1.8 + 15 or c["cost_rupees"] == cheapest]


def simulate_all(candidates: list[dict], start: datetime, rain: bool, alert_delay: Optional[AlertDelay]) -> list[SimResult]:
    return [simulate(c, start, rain, alert_delay) for c in candidates]


def best_for(sims: list[SimResult], preference: str) -> SimResult:
    return min(sims, key=lambda s: preference_key(s, preference))


# --- Presenting a simulated journey ---------------------------------------

def _crowd_summary(sim: SimResult) -> dict:
    score = sim.crowd_score
    ride_steps = [s for s in sim.steps if s["kind"] == "ride"]
    return {
        "level": cm.crowd_level_for_score(score), "score": round(score, 2), "index": cm.crowd_index(score),
        "peak_level": cm.crowd_level_for_score(sim.worst_leg_score), "peak_score": round(sim.worst_leg_score, 2),
        "seat_chance": cm.seat_chance(max((s["crowd"]["score"] for s in ride_steps), default=0.0)),
    }


def _tips(sim: SimResult, rain: bool) -> list[str]:
    tips = []
    rides = [s for s in sim.steps if s["kind"] == "ride"]
    worst = max(rides, key=lambda s: s["crowd"]["score"], default=None)
    if worst and worst["crowd"]["score"] >= 0.75:
        label = worst["line"] or re_.MODE_LABELS.get(worst["mode"], worst["mode"])
        tip = (f"The {label} stretch from {_station_name(worst['from_station'])} to {_station_name(worst['to_station'])} "
               f"will likely be packed around {hhmm(worst['start'])}.")
        if worst["mode"] == "train":
            tip += " First class is usually far less crowded at this hour if you can afford it."
        tips.append(tip)
    if worst and worst["crowd"]["peak"] >= 0.6 and worst["line"] and worst["minutes"] >= 12:
        tips.append(f"On the {worst['line']} the load peaks around {_station_name(worst['crowd']['peak_station'])}.")
    for s in sim.steps:
        if s["kind"] == "walk" and s["from_station"] == s["to_station"] and s["from_station"] in HUB_TIPS:
            tips.append(HUB_TIPS[s["from_station"]])
            break
    if rain:
        if rides and all(s["line"] == "Aqua Line" for s in rides):
            tips.append("This trip stays underground on the Aqua Line, so rain will not affect it.")
        elif any(s["mode"] == "train" for s in rides):
            tips.append("Rain slows trains and floods some stretches; add a 10-15 minute buffer and carry an umbrella.")
        elif any(s["mode"] == "road" for s in rides):
            tips.append("Roads are slow in heavy rain; a rail or metro option is safer on time.")
    longest_wait = max((s for s in sim.steps if s["kind"] == "wait"), key=lambda s: s["minutes"], default=None)
    if longest_wait and longest_wait["minutes"] >= 8 and not any("first service" in (w or "") for w in sim.warnings):
        tips.append(f"Services are sparse at this hour; the wait at {_station_name(longest_wait['from_station'])} may be {longest_wait['minutes']} minutes.")
    return tips[:4]


def _label(sim: SimResult) -> str:
    names = []
    for s in sim.steps:
        if s["kind"] == "ride":
            name = s["line"] or re_.MODE_LABELS.get(s["mode"], s["mode"])
            if name not in names:
                names.append(name)
    return " + ".join(names) if names else "Walk"


def present(sim: SimResult, rain: bool, badges: list[str], station_point: Callable = None) -> dict:
    """Plain dict for the API layer: itinerary with clock times, crowd and tips."""
    station_point = station_point or default_station_point
    candidate = sim.candidate
    steps = []
    for s in sim.steps:
        out = {
            "kind": s["kind"], "start": s["start"].isoformat(), "end": s["end"].isoformat(), "minutes": s["minutes"],
            "mode": s["mode"], "line": s["line"], "note": s.get("note"),
            "from_station": station_point(s["from_station"]), "to_station": station_point(s["to_station"]),
        }
        if s["kind"] == "ride":
            crowd = s["crowd"]
            out.update({
                "stops": s["stops"], "cost_rupees": s["cost"],
                "crowd": {"level": crowd["level"], "score": round(crowd["score"], 2), "index": cm.crowd_index(crowd["score"]),
                          "seat_chance": crowd["seat_chance"], "peak_station": _station_name(crowd["peak_station"])},
            })
        if s["kind"] == "wait":
            out.update({"headway_minutes": s.get("headway"), "delay_minutes": s.get("delay")})
        steps.append(out)

    legs = [{
        "type": l["type"], "mode": l["mode"], "line": l["line"],
        "from_station": station_point(l["from_station"]), "to_station": station_point(l["to_station"]),
        "time_minutes": l["time_minutes"], "cost_rupees": l["cost_rupees"],
    } for l in candidate["legs"]]

    via = [_station_name(l["from_station"]) for l in candidate["legs"] if l["type"] == "walk"]

    return {
        "label": _label(sim), "badges": badges,
        "depart": sim.start.isoformat(), "arrive": sim.end.isoformat(),
        "duration_minutes": sim.duration, "ride_minutes": sim.ride_minutes,
        "wait_minutes": sim.wait_minutes, "walk_minutes": sim.walk_minutes,
        "cost_rupees": sim.cost, "transfers": sim.transfers,
        "comfort_score": candidate["comfort_score"], "crowd": _crowd_summary(sim),
        "discomfort_minutes": sim.discomfort, "effective_minutes": sim.effective_minutes,
        "steps": steps, "legs": legs, "via": list(dict.fromkeys(via)),
        "path": [station_point(sid) for sid in candidate["station_path"]],
        "fare_pass": re_.fare_pass_insight(candidate["modes"], sim.cost),
        "tips": _tips(sim, rain), "warnings": sim.warnings,
    }


# --- Trip planning ---------------------------------------------------------

CATEGORY_BADGES = (
    ("fastest", "Fastest"), ("cheapest", "Cheapest"), ("least_crowded", "Least crowded"),
    ("comfortable", "Most comfortable"), ("fewest_transfers", "Fewest changes"),
)


def _advisor_window(candidates, start, preference, rain, alert_delay, offsets) -> list[dict]:
    window = []
    for offset in offsets:
        moment = start + timedelta(minutes=offset)
        best = best_for(simulate_all(candidates, moment, rain, alert_delay), preference)
        shift = (EARLIER_SHIFT_PENALTY * -offset) if offset < 0 else (LATER_SHIFT_PENALTY * offset)
        window.append({
            "offset_minutes": offset, "depart": best.start.isoformat(), "arrive": best.end.isoformat(),
            "duration_minutes": best.duration, "cost_rupees": best.cost,
            "crowd_score": round(best.crowd_score, 2), "crowd_level": cm.crowd_level_for_score(best.crowd_score),
            "effective_minutes": best.effective_minutes, "label": _label(best),
            # What the rider "pays" for this slot: the journey itself plus the cost of shifting their plans.
            "advisor_cost": round(best.effective_minutes + shift, 1),
        })
    return window


def _advisor_insight(window: list[dict], selected_i: int, best_i: int) -> str:
    sel, best = window[selected_i], window[best_i]
    gain = sel["advisor_cost"] - best["advisor_cost"]
    if best_i == selected_i or gain < ADVISOR_MIN_GAIN:
        return "Your timing is already close to the best in this window."

    clock = lambda iso: iso[11:16]
    lead = f"Leaving at {clock(best['depart'])} instead of {clock(sel['depart'])}"
    if best["crowd_level"] != sel["crowd_level"]:
        lead += f" turns a {sel['crowd_level'].lower()} ride into a {best['crowd_level'].lower()} one"
    else:
        lead += f" saves about {int(round(gain))} minutes of effort"

    shift = best["offset_minutes"] - sel["offset_minutes"]
    if shift < 0:
        return f"{lead}; you would still be there by {best['arrive'][11:16]}."
    return f"{lead}, but you would arrive at {best['arrive'][11:16]} instead of {sel['arrive'][11:16]}."


class PlanError(Exception):
    """Raised for planning problems the API turns into HTTP errors."""

    def __init__(self, message: str, status: int = 404):
        super().__init__(message)
        self.status = status


def plan_trip(
    origin: str, destination: str, moment: datetime, when: str = "depart", preference: str = "balanced",
    rain: bool = False, avoid: Optional[list[str]] = None, station_point: Optional[Callable] = None,
    now: Optional[datetime] = None,
) -> dict:
    """
    Plan one journey. With when="depart", `moment` is when you reach the
    origin station; with when="arrive", it is the time you must be at the
    destination and the planner finds when to set off.
    """
    avoid = avoid or []
    now = now or cm.now_ist()
    candidates = usable_candidates(origin, destination, avoid)
    if not candidates:
        suffix = f" without {', '.join(avoid)}" if avoid else ""
        raise PlanError(f"No route found between these stations{suffix}.")

    # Simulated live service alerts only matter close to the present.
    from app import live
    near_now = lambda m: abs((m - now).total_seconds()) <= 3600
    alert_delay = live.alert_delay_minutes if near_now(moment) else None

    arrive_mode = when == "arrive"
    notes = []
    if arrive_mode:
        buffer_min = 5
        step = 5
        scan = []
        for back in range(0, 181, step):
            depart = moment - timedelta(minutes=back)
            best = best_for(simulate_all(candidates, depart, rain, alert_delay), preference)
            scan.append((depart, best))
        feasible = [(d, b) for d, b in scan if b.end <= moment - timedelta(minutes=buffer_min)]
        if not feasible:
            raise PlanError("This journey takes longer than the three hours before your deadline; try an earlier arrival time.", 422)
        # Favour comfort, but do not set off far earlier than needed.
        def arrive_cost(pair):
            d, b = pair
            slack = (moment - timedelta(minutes=buffer_min) - b.end).total_seconds() / 60.0
            return b.effective_minutes + 0.3 * max(0.0, slack - 10)
        chosen_depart, _ = min(feasible, key=arrive_cost)
        latest_depart = max(d for d, _ in feasible)
        notes.append(f"Arrive by {hhmm(moment)} with a {buffer_min}-minute buffer; the latest you could leave is {hhmm(latest_depart)}.")
    else:
        chosen_depart = round_to_minute(moment)

    sims = simulate_all(candidates, chosen_depart, rain, alert_delay)
    recommended = best_for(sims, preference)

    # Category winners as alternatives, each tagged with why it is listed.
    picked: dict[int, list[str]] = {}
    order: list[SimResult] = []

    def add(sim: SimResult, badge: Optional[str]):
        key = id(sim)
        if key not in picked:
            picked[key] = []
            order.append(sim)
        if badge and badge not in picked[key]:
            picked[key].append(badge)

    add(recommended, "Recommended")
    for pref, badge in CATEGORY_BADGES:
        add(best_for(sims, pref), badge)

    # Departure advisor around the chosen time.
    if arrive_mode:
        offsets = list(range(-120, 16, 15))
    else:
        offsets = list(range(-120, 121, 15))
    window = _advisor_window(candidates, chosen_depart, preference, rain, alert_delay, offsets)
    selected_i = offsets.index(0)
    if arrive_mode:
        deadline = moment - timedelta(minutes=5)
        for w in window:
            w["feasible"] = datetime.fromisoformat(w["arrive"]) <= deadline
        feasible_idx = [i for i, w in enumerate(window) if w["feasible"]]
        best_i = min(feasible_idx, key=lambda i: window[i]["advisor_cost"]) if feasible_idx else selected_i
    else:
        for w in window:
            w["feasible"] = True
        best_i = min(range(len(window)), key=lambda i: window[i]["advisor_cost"])

    # Only point at a "best" slot when it is worth the shift; otherwise the chart
    # and the insight would disagree about whether to move at all.
    if window[selected_i]["advisor_cost"] - window[best_i]["advisor_cost"] < ADVISOR_MIN_GAIN:
        best_i = selected_i

    peak_i = max(range(len(window)), key=lambda i: window[i]["crowd_score"])
    if window[peak_i]["crowd_score"] - min(w["crowd_score"] for w in window) >= 0.12:
        peak_cluster = [w for w in window if w["crowd_score"] >= window[peak_i]["crowd_score"] - 0.04]
        notes.append(f"Crowds on this route peak for departures between {peak_cluster[0]['depart'][11:16]} "
                     f"and {peak_cluster[-1]['depart'][11:16]}.")

    itineraries = [present(sim, rain, picked[id(sim)], station_point) for sim in order]

    warnings = []
    for it in itineraries[:1]:
        warnings.extend(it["warnings"])
    if rain:
        notes.append("Rain adds crowd on rail and metro and slows road traffic; the plan accounts for both.")
    live_used = alert_delay is not None

    return {
        "when": when, "preference": preference, "is_raining": rain,
        "day_type": cm.day_type_for(chosen_depart),
        "requested_time": moment.isoformat(),
        "recommended": itineraries[0], "alternatives": itineraries[1:],
        "advisor": {
            "window": window, "selected_index": selected_i, "best_index": best_i,
            "insight": _advisor_insight(window, selected_i, best_i),
        },
        "notes": notes, "warnings": warnings, "live_alerts_included": live_used,
        "generated_at": now.isoformat(),
    }


# --- Day planning -----------------------------------------------------------

def plan_day(
    origin: str, start: datetime, stops: list[dict], return_to_origin: bool, preference: str,
    rain: bool, avoid: list[str], station_point: Callable, now: Optional[datetime] = None,
) -> dict:
    """
    Chain trips across a day. `stops` are the places visited after `origin`,
    each {"station": id, "stay_minutes": int | None, "leave_at": "HH:MM" | None}.
    A stop with leave_at waits until then (or goes straight on if already past);
    otherwise it stays stay_minutes. The final stop needs no stay time.
    """
    now = now or cm.now_ist()
    from app import live
    sequence = [{"station": s["station"], "stay_minutes": s.get("stay_minutes"), "leave_at": s.get("leave_at")} for s in stops]
    if return_to_origin and (not sequence or sequence[-1]["station"] != origin):
        sequence.append({"station": origin, "stay_minutes": 0, "leave_at": None})

    items, trips = [], []
    here, clock = origin, round_to_minute(start)
    totals = {"travel": 0, "wait": 0, "cost": 0, "crowded_minutes": 0, "discomfort": 0.0}
    warnings, modes_used = [], set()

    for i, nxt in enumerate(sequence):
        if nxt["station"] == here:
            raise PlanError(f"Stop {i + 1} is the same station as the previous stop.", 422)
        candidates = usable_candidates(here, nxt["station"], avoid)
        if not candidates:
            raise PlanError(f"No route from {_station_name(here)} to {_station_name(nxt['station'])}.")
        alert_delay = live.alert_delay_minutes if abs((clock - now).total_seconds()) <= 3600 else None
        sim = best_for(simulate_all(candidates, clock, rain, alert_delay), preference)
        item = present(sim, rain, [], station_point)
        items.append({"kind": "trip", "from_station": station_point(here), "to_station": station_point(nxt["station"]),
                      "start": item["depart"], "end": item["arrive"], "itinerary": item})
        trips.append(sim)
        totals["travel"] += sim.duration
        totals["wait"] += sim.wait_minutes
        totals["cost"] += sim.cost
        totals["discomfort"] += sim.discomfort
        totals["crowded_minutes"] += sum(s["minutes"] for s in sim.steps
                                          if s["kind"] == "ride" and s["crowd"]["score"] >= 0.52)
        for m in sim.candidate["modes"]:
            modes_used.add(m)
        warnings.extend(w for w in sim.warnings if w not in warnings)

        clock, here = sim.end, nxt["station"]
        if i == len(sequence) - 1:
            break

        if nxt.get("leave_at"):
            leave = combine(clock, nxt["leave_at"])
            if leave < clock - timedelta(hours=12):
                leave += timedelta(days=1)
            if leave < clock:
                warnings.append(f"You reach {_station_name(here)} at {hhmm(clock)}, after your planned departure at {nxt['leave_at']}; the plan continues immediately.")
                leave = clock
        else:
            leave = clock + timedelta(minutes=nxt.get("stay_minutes") or 0)
        if leave > clock:
            items.append({"kind": "stay", "from_station": station_point(here), "to_station": station_point(here),
                          "start": clock.isoformat(), "end": leave.isoformat(), "itinerary": None,
                          "minutes": int((leave - clock).total_seconds() // 60)})
        clock = leave

    daily_cost = totals["cost"]
    pass_advice = None
    pass_modes = [m for m in ("train", "metro", "bus") if m in modes_used]
    if pass_modes and daily_cost > 0:
        monthly_singles = daily_cost * 26
        pass_total = sum(re_.MONTHLY_PASS_COST[m] for m in pass_modes)
        pass_advice = {
            "monthly_singles": monthly_singles, "monthly_pass": pass_total, "modes": pass_modes,
            "saves": monthly_singles - pass_total,
            "text": (f"Doing this every working day costs about ₹{monthly_singles} a month in single fares against "
                     f"₹{pass_total} for monthly passes, so passes would save about ₹{monthly_singles - pass_total}."
                     if monthly_singles > pass_total else
                     f"At about ₹{monthly_singles} a month in single fares, passes (₹{pass_total}) would not pay off for this routine."),
        }

    return {
        "preference": preference, "is_raining": rain, "day_type": cm.day_type_for(start),
        "items": items,
        "summary": {
            "start": items[0]["start"] if items else start.isoformat(),
            "end": items[-1]["end"] if items else start.isoformat(),
            "trips": len(trips), "travel_minutes": totals["travel"], "wait_minutes": totals["wait"],
            "cost_rupees": totals["cost"], "crowded_minutes": totals["crowded_minutes"],
            "discomfort_minutes": round(totals["discomfort"], 1),
        },
        "pass_advice": pass_advice, "warnings": warnings, "generated_at": now.isoformat(),
    }
