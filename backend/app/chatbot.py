"""
TransitFlow — Journey assistant

A rule-based assistant, deliberately not a large language model. It needs no
API key or paid service, answers the same way every time, and every reply
comes from the same planner, crowd model and station tables the rest of the
app uses. What it does:

1. Normalise the message and find station names with an n-gram lookup over
   an alias table, then catch typos with Levenshtein edit distance (a dynamic
   programming table, the classic DAA exercise).
2. Pull out the other slots: time and date ("tomorrow 8:45 am", "by 10"),
   preference (cheapest, least crowded ...), rain, modes to avoid.
3. Classify the intent with ordered keyword rules.
4. Fill any missing slot from the conversation context the client sends back
   each turn, so follow-ups like "what about 6 pm?" or "cheapest?" work.
5. Call the planner or live layer and write the answer.

Stateless on the server: the client keeps and returns `context`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from app import crowd_model as cm
from app import live, planner
from app import routing_engine as re_

# --- Text normalisation and station lookup ---------------------------------

STOPWORDS = {
    "the", "a", "an", "to", "from", "in", "on", "at", "by", "for", "and", "or", "of", "is", "are", "it", "me",
    "my", "i", "we", "go", "get", "how", "what", "when", "where", "which", "can", "do", "does", "will", "should",
    "now", "today", "tomorrow", "tonight", "morning", "evening", "afternoon", "night", "noon", "please", "plan",
    "trip", "route", "way", "reach", "travel", "take", "train", "metro", "bus", "cab", "auto", "taxi", "road",
    "line", "station", "cheap", "cheapest", "fast", "fastest", "crowd", "crowded", "busy", "packed", "rain",
    "raining", "rush", "hour", "time", "best", "first", "last", "fare", "cost", "much", "need", "want", "like",
    "show", "tell", "about", "there", "here", "this", "that", "with", "without", "avoid", "least", "less", "more",
    "after", "before", "around", "leave", "arrive", "start", "work", "home", "office", "quick", "quickest",
    "comfortable", "direct", "change", "changes", "delay", "delays", "status", "help", "hello", "thanks", "thank",
}

# Alias -> (station id, landmark the alias names, or None for a station nickname).
MANUAL_ALIASES = {
    "vt": ("csmt", None), "cst": ("csmt", None), "cstm": ("csmt", None), "victoria terminus": ("csmt", None),
    "chhatrapati shivaji terminus": ("csmt", None), "bori": ("borivali", None), "borivli": ("borivali", None),
    "kandivli": ("kandivali", None), "kandivily": ("kandivali", None), "mira rd": ("mira_road", None),
    "bhayander": ("bhayandar", None), "bandra kurla complex": ("bkc", None), "b k c": ("bkc", None),
    "airport": ("csia_t2", "the airport"), "mumbai airport": ("csia_t2", "the airport"),
    "international airport": ("csia_t2", "the international airport"), "t2": ("csia_t2", None),
    "domestic airport": ("csia_t1", "the domestic airport"), "t1": ("csia_t1", None),
    "navi mumbai": ("vashi", "Navi Mumbai"), "new bombay": ("vashi", "Navi Mumbai"), "belapur": ("belapur_cbd", None),
    "cbd belapur": ("belapur_cbd", None), "seawoods": ("seawoods_darave", None), "gtb nagar": ("gtb_nagar", None),
    "dn nagar": ("dn_nagar", None), "d n nagar": ("dn_nagar", None), "jb nagar": ("chakala", None),
    "colaba": ("cuffe_parade", "Colaba"), "nariman point": ("vidhan_bhavan", "Nariman Point"),
    "haji ali": ("mahalaxmi", "Haji Ali"), "phoenix mills": ("lower_parel", "Phoenix Mills"),
    "siddhivinayak temple": ("siddhivinayak", "Siddhivinayak Temple"),
    "spit": ("azad_nagar", "SPIT"), "sardar patel institute of technology": ("azad_nagar", "SPIT"),
    "kings circle": ("matunga_road", None), "versova beach": ("versova", "Versova"),
}


def normalise(text: str) -> str:
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9: ]+", " ", text.replace(".", ""))
    return re.sub(r"\s+", " ", text).strip()


def _build_alias_table() -> dict:
    table: dict = {}
    # Exact names first so a base name always belongs to the main station.
    for sid, info in re_.STATION_INFO.items():
        table.setdefault(normalise(info["name"]), (sid, None))
        table.setdefault(normalise(sid.replace("_", " ")), (sid, None))
    for sid, info in re_.STATION_INFO.items():
        base = normalise(re.sub(r"\(.*?\)", "", info["name"]))
        if base:
            table.setdefault(base, (sid, None))
    table.update({normalise(k): v for k, v in MANUAL_ALIASES.items()})
    return table


ALIASES = _build_alias_table()
MAX_ALIAS_WORDS = max(len(a.split()) for a in ALIASES)
SINGLE_WORD_ALIASES = [a for a in ALIASES if " " not in a and len(a) >= 4 and a not in STOPWORDS]


def edit_distance(a: str, b: str, limit: int = 3) -> int:
    """Levenshtein distance by dynamic programming, giving up once it exceeds `limit`."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ca != cb)))
        if min(current) > limit:
            return limit + 1
        previous = current
    return previous[-1]


@dataclass
class StationMention:
    start: int           # token index range [start, end)
    end: int
    station_id: str
    landmark: Optional[str]
    fuzzy: bool = False


def find_stations(tokens: list[str]) -> list[StationMention]:
    """Longest-match alias lookup over the tokens, then typo-tolerant matching for what is left."""
    taken = [False] * len(tokens)
    found: list[StationMention] = []

    for size in range(min(MAX_ALIAS_WORDS, len(tokens)), 0, -1):
        for i in range(len(tokens) - size + 1):
            if any(taken[i:i + size]):
                continue
            phrase = " ".join(tokens[i:i + size])
            if phrase in ALIASES and not (size == 1 and phrase in STOPWORDS):
                sid, landmark = ALIASES[phrase]
                found.append(StationMention(i, i + size, sid, landmark))
                for k in range(i, i + size):
                    taken[k] = True

    for i, token in enumerate(tokens):
        if taken[i] or len(token) < 4 or token in STOPWORDS or token.isdigit() or ":" in token:
            continue
        limit = 1 if len(token) <= 7 else 2
        best = min(((edit_distance(token, alias, limit), alias) for alias in SINGLE_WORD_ALIASES), default=(limit + 1, ""))
        if best[0] <= limit:
            sid, landmark = ALIASES[best[1]]
            found.append(StationMention(i, i + 1, sid, landmark, fuzzy=True))
            taken[i] = True

    return sorted(found, key=lambda m: m.start)


# --- Slots: time, date, preference, rain, modes -----------------------------

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
PART_OF_DAY = {"early morning": "06:30", "morning": "08:30", "noon": "12:00", "midday": "12:00", "lunch": "13:00",
               "afternoon": "15:00", "evening": "18:30", "tonight": "21:00", "late night": "23:30", "night": "21:30",
               "midnight": "00:00"}
LINE_WORDS = [("western", "Western Line"), ("central", "Central Line"), ("harbour", "Harbour Line"),
              ("harbor", "Harbour Line"), ("yellow", "Yellow Line"), ("red line", "Red Line"), ("aqua", "Aqua Line"),
              ("blue", "Blue Line"), ("metro 1", "Blue Line"), ("line 1", "Blue Line"), ("2a", "Yellow Line"),
              ("line 7", "Red Line"), ("line 3", "Aqua Line")]
PREFERENCE_WORDS = [
    ("least_crowded", ("least crowded", "less crowded", "avoid crowd", "avoid the crowd", "not crowded", "quiet", "empty",
                       "uncrowded", "calm")),
    ("fewest_transfers", ("fewest change", "least change", "no change", "without chang", "direct", "fewest transfer",
                          "least transfer", "no transfer")),
    ("cheapest", ("cheapest", "cheap", "budget", "lowest fare", "save money", "least expensive", "economical")),
    ("fastest", ("fastest", "quickest", "shortest", "least time", "in a hurry", "urgent", "asap", "rush to")),
    ("comfortable", ("comfortable", "comfort", "relaxed", "get a seat", "seat", "easy ride")),
]


def _clock(hour: int, minute: int) -> str:
    return f"{hour:02d}:{minute:02d}"


def parse_time(text: str) -> tuple[Optional[str], bool]:
    """Returns (HH:MM or None, whether the time reads as an arrival deadline)."""
    arrive = bool(re.search(r"\b(arrive|reach|be there|be at|get there|get to|there)\b.*\b(by|before)\b|\b(by|before)\b", text)) \
        and not re.search(r"\bdeparture\b", text)
    evening_word = bool(re.search(r"\b(evening|night|pm|afternoon|tonight)\b", text))
    morning_word = bool(re.search(r"\b(morning|am)\b", text))

    m = re.search(r"\b(\d{1,2}):(\d{2})\s*(am|pm)?\b", text)
    if m:
        hour, minute, ampm = int(m.group(1)), int(m.group(2)), m.group(3)
        if minute < 60 and hour <= 24:
            if ampm == "pm" and hour < 12:
                hour += 12
            if ampm == "am" and hour == 12:
                hour = 0
            return _clock(hour % 24, minute), arrive

    m = re.search(r"\b(\d{1,2})\s*(am|pm)\b", text)
    if m:
        hour = int(m.group(1)) % 12 + (12 if m.group(2) == "pm" else 0)
        return _clock(hour, 0), arrive

    m = re.search(r"\b(?:at|by|before|around|after|near)\s+(\d{1,2})\b", text)
    if m and int(m.group(1)) <= 24:
        hour = int(m.group(1))
        if hour <= 6 and not morning_word:
            hour += 12                     # "at 5" almost always means the afternoon
        elif 7 <= hour <= 11 and evening_word:
            hour += 12
        elif hour == 12 and evening_word is False and morning_word:
            hour = 0
        return _clock(hour % 24, 0), arrive

    for phrase in sorted(PART_OF_DAY, key=len, reverse=True):
        if re.search(rf"\b{phrase}\b", text):
            return PART_OF_DAY[phrase], arrive
    return None, arrive


def parse_date(text: str, now: datetime) -> Optional[date]:
    today = now.date()
    if re.search(r"\bday after tomorrow\b", text):
        return today + timedelta(days=2)
    if re.search(r"\btomorrow\b", text):
        return today + timedelta(days=1)
    if re.search(r"\b(today|tonight)\b", text):
        return today
    if re.search(r"\bweekend\b", text):
        ahead = (5 - today.weekday()) % 7 or 7 if today.weekday() < 5 else 0
        return today + timedelta(days=ahead)
    for i, name in enumerate(WEEKDAYS):
        if re.search(rf"\b{name}\b", text):
            ahead = (i - today.weekday()) % 7 or 7
            return today + timedelta(days=ahead)
    return None


def parse_preference(text: str) -> Optional[str]:
    for preference, words in PREFERENCE_WORDS:
        if any(w in text for w in words):
            return preference
    return None


def parse_avoid(text: str) -> list[str]:
    avoid = []
    for mode, words in (("bus", ("bus",)), ("road", ("cab", "taxi", "auto", "car", "uber", "ola")),
                        ("metro", ("metro",)), ("train", ("local", "train"))):
        if any(re.search(rf"\b(no|without|avoid|skip|not)\s+(the\s+)?{w}\b", text) for w in words):
            avoid.append(mode)
    return avoid


def parse_rain(text: str) -> Optional[bool]:
    if re.search(r"\b(not raining|no rain|dry|clear weather|stopped raining)\b", text):
        return False
    if re.search(r"\b(rain|rains|raining|rainy|monsoon|downpour|wet weather|storm)\b", text):
        return True
    return None


def parse_line(tokens_text: str) -> Optional[str]:
    for word, line in LINE_WORDS:
        if re.search(rf"\b{word}\b", tokens_text):
            return line
    return None


# --- Intent -----------------------------------------------------------------

INTENT_RULES = [
    ("greeting", r"^(hi|hello|hey|namaste|good (morning|afternoon|evening)|yo|hola)\b"),
    ("thanks", r"\b(thanks|thank you|thx|cheers|great job)\b"),
    ("help", r"\b(help|what can you do|how do you work|what do you do|capabilities|who are you|about you)\b"),
    ("day_plan", r"\b(plan (my|the|a) day|day plan|whole day|full day|itinerary for (the )?day|multi.?stop)\b"),
    ("alerts", r"\b(delay|delays|delayed|disruption|disruptions|alert|alerts|problem|breakdown|running late|service update|any issue)\b"),
    ("service_hours", r"\b(first|last)\s+(train|metro|local|service|bus)\b|\bservice hours\b|\bwhat time (does|do).*\b(start|stop|close|run)\b|\bhow late\b"),
    ("best_time", r"\b(best time|when (should|can|to)|what time should|quietest|least crowded time|avoid (the )?(rush|peak|crowd)|when is it (less|least|not) crowded|off.?peak)\b"),
    ("crowd", r"\b(crowd|crowded|packed|busy|jam|jammed|rush|overcrowded|full|congested|footfall)\b"),
    ("fare", r"\b(fare|fares|how much|cost|price|ticket|expensive|charges?)\b"),
    ("line_info", r"\b(stations? on|stops? on|list (the )?stations|how many stations|which (line|lines|metro|train)|what lines?|serves?|stations? (are )?(there|in))\b"),
    ("plan", r"\b(go|get|reach|travel|route|way|plan|commute|journey|trip|going|head|directions?|navigate|from)\b"),
]


def classify(text: str, n_stations: int, has_slots: bool) -> str:
    for intent, pattern in INTENT_RULES:
        if re.search(pattern, text):
            if intent == "plan" and n_stations == 0 and not has_slots:
                continue
            return intent
    if n_stations >= 2:
        return "plan"
    if n_stations == 1:
        return "station"
    return "followup" if has_slots else "unknown"


# --- Reply helpers -----------------------------------------------------------

def sname(station_id: str) -> str:
    return re_.STATION_INFO[station_id]["name"]


def money(value: int) -> str:
    return f"₹{value}"


def pretty_day(day: date, now: datetime) -> str:
    delta = (day - now.date()).days
    if delta == 0:
        return "today"
    if delta == 1:
        return "tomorrow"
    return day.strftime("%A %d %b")


def _suggestions_after_plan(entities: dict) -> list[str]:
    options = ["Cheapest option", "Least crowded option", "What about 6 pm?", "What if it rains?", "Best time to leave?"]
    done = entities.get("preference")
    return [o for o in options if not (done == "cheapest" and o.startswith("Cheapest"))
            and not (done == "least_crowded" and o.startswith("Least"))][:4]


def _card(it: dict) -> dict:
    return {
        "type": "itinerary", "label": it["label"], "depart": it["depart"], "arrive": it["arrive"],
        "duration_minutes": it["duration_minutes"], "cost_rupees": it["cost_rupees"],
        "crowd_level": it["crowd"]["level"], "crowd_index": it["crowd"]["index"],
        "transfers": it["transfers"],
        "steps": [{"kind": s["kind"], "line": s["line"], "mode": s["mode"], "minutes": s["minutes"],
                   "start": s["start"], "from": s["from_station"]["name"], "to": s["to_station"]["name"],
                   "crowd_level": s["crowd"]["level"] if s.get("crowd") else None} for s in it["steps"]
                  if s["kind"] != "walk" or s["minutes"] >= 3],
    }


def _planner_action(entities: dict, day: date, time: str) -> dict:
    return {"type": "open_planner", "label": "Open full itinerary", "params": {
        "from": entities["origin"], "to": entities["destination"], "date": day.isoformat(), "time": time,
        "when": entities.get("when", "depart"), "pref": entities.get("preference") or "balanced",
        "rain": bool(entities.get("rain")), "avoid": entities.get("avoid", [])}}


# --- Handlers ----------------------------------------------------------------

def _plan(entities: dict, now: datetime, reply_prefix: str = "") -> dict:
    origin, destination = entities["origin"], entities["destination"]
    when = entities.get("when", "depart")
    explicit_date = entities.get("date_explicit")

    day = date.fromisoformat(entities["date"]) if entities.get("date") else now.date()
    time = entities.get("time")
    shifted = False
    if not time:
        time = (planner.round_to_minute(now) + timedelta(minutes=(5 - now.minute % 5) % 5)).strftime("%H:%M") \
            if day == now.date() else "08:30"
    moment = planner.combine(day, time)
    if not explicit_date and moment < now - timedelta(minutes=20) and entities.get("time_explicit"):
        day, moment, shifted = day + timedelta(days=1), moment + timedelta(days=1), True
    entities["date"] = day.isoformat()
    entities["time"] = time

    preference = entities.get("preference") or "balanced"
    try:
        result = planner.plan_trip(origin, destination, moment, when, preference, bool(entities.get("rain")),
                                   entities.get("avoid", []), None, now)
    except planner.PlanError as err:
        return {"reply": f"I could not plan that: {err}", "intent": "plan", "card": None, "actions": [],
                "suggestions": ["Allow buses and cabs", "Try a different time"]}

    best = result["recommended"]
    others = {badge: it for it in [best] + result["alternatives"] for badge in it["badges"]}
    when_text = pretty_day(day, now)

    lines = []
    head = (f"{reply_prefix}**{best['label']}** from **{sname(origin)}** to **{sname(destination)}**: "
            f"{'leave' if when == 'depart' else 'set off'} at **{best['depart'][11:16]}** {when_text}, "
            f"arrive **{best['arrive'][11:16]}**. That is {best['duration_minutes']} min and {money(best['cost_rupees'])}.")
    if shifted:
        head += " (That time has passed today, so I planned it for tomorrow.)"
    lines.append(head)

    crowd = best["crowd"]
    ride_steps = [s for s in best["steps"] if s["kind"] == "ride"]
    worst = max(ride_steps, key=lambda s: s["crowd"]["score"], default=None)
    if worst:
        verdict = {"Comfortable": "should be comfortable, with a good chance of a seat",
                   "Moderate": "should be fairly manageable, though seats may be scarce",
                   "Busy": "will be busy, so expect to stand for part of it",
                   "Packed": "will likely be packed, so expect to stand"}[crowd["level"]]
        lines.append(f"The ride {verdict} (crowd index {crowd['index']}/100"
                     + (f", heaviest around {worst['crowd']['peak_station']}" if worst["minutes"] >= 12 else "") + ").")
    if best["transfers"]:
        lines.append(f"It has {best['transfers']} change{'s' if best['transfers'] > 1 else ''}"
                     + (f" (at {', '.join(best['via'][:2])})" if best["via"] else "") + ".")
    if "Cheapest" in others and others["Cheapest"] is not best and others["Cheapest"]["cost_rupees"] < best["cost_rupees"]:
        c = others["Cheapest"]
        lines.append(f"Cheapest is {money(c['cost_rupees'])} via {c['label']} ({c['duration_minutes']} min).")
    if result["advisor"]["insight"] and "already close" not in result["advisor"]["insight"]:
        lines.append(result["advisor"]["insight"])
    lines.extend(best["warnings"][:1])
    lines.extend([t for t in best["tips"] if "will likely be packed" not in t][:1])
    if crowd["level"] == "Packed" and any(s["mode"] == "train" for s in ride_steps):
        lines.append("First class is usually far less crowded at this hour if you can afford it.")

    entities_out = {**entities}
    return {"reply": "\n".join(lines), "intent": "plan", "card": _card(best),
            "actions": [_planner_action(entities_out, day, time)],
            "suggestions": _suggestions_after_plan(entities_out)}


def _crowd(entities: dict, now: datetime, line: Optional[str]) -> dict:
    station = entities.get("station")
    rain = bool(entities.get("rain"))
    if station:
        status = live.station_status(station, now, rain)
        parts = []
        for svc in status["services"]:
            if not svc["in_service"]:
                parts.append(f"{svc['line']} is not running right now.")
                continue
            chain = cm.LINE_CHAINS[svc["line"]]
            towards = f"towards {sname(chain[0])}"
            away = f"towards {sname(chain[-1])}"
            ins, outs = svc["inbound"], svc["outbound"]
            bits = []
            if ins:
                bits.append(f"{towards}: **{ins['level']}** ({ins['index']})")
            if outs:
                bits.append(f"{away}: **{outs['level']}** ({outs['index']})")
            parts.append(f"{svc['line']}: " + "; ".join(bits))
        source = f"Based on the crowd model plus {status['reports_last_hour']} rider report(s) in the last hour." \
            if status["reports_last_hour"] else "This is a model estimate; no rider reports for this station in the last hour."
        reply = f"**{status['station']}** at {now.strftime('%H:%M')}:\n" + "\n".join(parts) + f"\n{source}"
        return {"reply": reply, "intent": "crowd", "card": None, "actions": [],
                "suggestions": [f"Best time to leave {status['station']}?", "Any delays right now?"]}

    snap = live.snapshot(now, rain)
    if line:
        entry = next((l for l in snap["lines"] if l["line"] == line), None)
        if not entry or not entry["in_service"]:
            return {"reply": f"{line} is not running at {now.strftime('%H:%M')}.", "intent": "crowd", "card": None,
                    "actions": [], "suggestions": ["Any delays right now?"]}
        chain = cm.LINE_CHAINS[line]
        reply = (f"**{line}** right now ({now.strftime('%H:%M')}): {entry['level']} overall (index {entry['index']}).\n"
                 f"Towards {sname(chain[0])}: **{entry['inbound']['level']}** ({entry['inbound']['index']}). "
                 f"Towards {sname(chain[-1])}: **{entry['outbound']['level']}** ({entry['outbound']['index']}).")
        if entry["alert"]:
            reply += f"\nSimulated alert: {entry['alert']}"
        return {"reply": reply, "intent": "crowd", "card": None, "actions": [], "suggestions": ["Any delays right now?"]}

    hot = snap["hotspots"][:3]
    reply = (f"Across the network at {now.strftime('%H:%M')} the busiest spots are "
             + ", ".join(f"**{h['station']}** ({h['line']}, {h['level']})" for h in hot) + ".")
    calm = snap["calmest"][:2]
    if calm:
        reply += " Calmest right now: " + ", ".join(f"{c['station']} ({c['line']})" for c in calm) + "."
    return {"reply": reply, "intent": "crowd", "card": None, "actions": [], "suggestions": [
        "How crowded is Dadar?", "Is the Western Line busy?", "Any delays right now?"]}


def _best_time(entities: dict, now: datetime) -> dict:
    origin, destination = entities.get("origin"), entities.get("destination")
    if not (origin and destination):
        return {"reply": "Tell me the two stations, for example: \"best time to travel from Borivali to Churchgate\".",
                "intent": "best_time", "card": None, "actions": [], "suggestions": ["Best time Borivali to Churchgate"]}
    day = date.fromisoformat(entities["date"]) if entities.get("date") else now.date()
    rows = live.best_times(origin, destination, day, bool(entities.get("rain")))
    reasonable = [r for r in rows if 6 <= int(r["depart"][11:13]) < 22]
    calm = sorted(reasonable, key=lambda r: (r["crowd_score"], r["duration_minutes"]))[:3]
    busy = max(reasonable, key=lambda r: r["crowd_score"])
    calm_times = sorted({r["depart"][11:16] for r in calm})
    reply = (f"For **{sname(origin)} to {sname(destination)}** {pretty_day(day, now)}, the quietest departures are around "
             f"**{', '.join(calm_times)}** ({calm[0]['crowd_level']}). It is worst around **{busy['depart'][11:16]}** "
             f"({busy['crowd_level']}, {busy['duration_minutes']} min).")
    return {"reply": reply, "intent": "best_time", "card": None,
            "actions": [_planner_action({**entities}, day, calm[0]["depart"][11:16])],
            "suggestions": ["Plan it at the quietest time", "Cheapest option"]}


def _service_hours(entities: dict, line: Optional[str], now: datetime) -> dict:
    lines = [line] if line else []
    if not lines and entities.get("station"):
        lines = [l for l, chain in cm.LINE_CHAINS.items() if entities["station"] in chain]
    if not lines:
        lines = list(cm.LINE_CHAINS)

    def fmt(hours):
        h = hours % 24
        return f"{int(h):02d}:{int(round((h - int(h)) * 60)):02d}"

    rows = []
    for l in lines:
        first, last = cm.service_hours(l, cm.line_mode(l))
        rows.append(f"{l}: first about {fmt(first)}, last about {fmt(last)}")
    return {"reply": "Approximate service hours:\n" + "\n".join(rows) + "\nExact times vary by station and direction; check the operator's timetable for the last train.",
            "intent": "service_hours", "card": None, "actions": [], "suggestions": ["Any delays right now?"]}


def _line_info(entities: dict, line: Optional[str]) -> dict:
    station = entities.get("station")
    if station and not line:
        serving = [l for l, chain in cm.LINE_CHAINS.items() if station in chain]
        names = ", ".join(serving) if serving else "no rail or metro line (only bus and road links)"
        return {"reply": f"**{sname(station)}** is served by: {names}.", "intent": "line_info", "card": None,
                "actions": [], "suggestions": [f"How crowded is {sname(station)}?"]}
    if line:
        chain = cm.LINE_CHAINS[line]
        mid = [sname(s) for s in chain[1:-1]]
        sample = ", ".join(mid[:6]) + (", ..." if len(mid) > 6 else "")
        return {"reply": f"The **{line}** has **{len(chain)} stations**, from {sname(chain[0])} to {sname(chain[-1])}. Stops include {sample}.",
                "intent": "line_info", "card": None, "actions": [], "suggestions": [f"Is the {line} busy?"]}
    lines = "\n".join(f"{l}: {len(c)} stations" for l, c in cm.LINE_CHAINS.items())
    return {"reply": f"TransitFlow covers {len(re_.STATION_INFO)} stations on {len(cm.LINE_CHAINS)} lines:\n{lines}",
            "intent": "line_info", "card": None, "actions": [], "suggestions": ["Stations on the Harbour Line"]}


def _alerts(now: datetime) -> dict:
    alerts = live.active_alerts(now)
    if not alerts:
        return {"reply": "No disruptions reported on any line right now. (Alerts here come from a simulated feed, since there is no operator data connection.)",
                "intent": "alerts", "card": None, "actions": [], "suggestions": ["Busiest stations right now"]}
    text = "\n".join(f"{a['line']}: {a['message']}" for a in alerts)
    return {"reply": f"Right now (simulated feed):\n{text}", "intent": "alerts", "card": None, "actions": [],
            "suggestions": ["Busiest stations right now"]}


def _fare(entities: dict, now: datetime) -> dict:
    origin, destination = entities.get("origin"), entities.get("destination")
    if not (origin and destination):
        return {"reply": "Which two stations? For example: \"fare from Andheri to Churchgate\".", "intent": "fare",
                "card": None, "actions": [], "suggestions": ["Fare Andheri to Churchgate"]}
    cand = planner.usable_candidates(origin, destination, entities.get("avoid", []))
    if not cand:
        return {"reply": "I could not find a route between those stations.", "intent": "fare", "card": None,
                "actions": [], "suggestions": []}
    cheapest = min(cand, key=lambda c: (c["cost_rupees"], c["time_minutes"]))
    fastest = min(cand, key=lambda c: (c["time_minutes"], c["cost_rupees"]))
    ride_labels = lambda c: " + ".join(dict.fromkeys(l["line"] or re_.MODE_LABELS.get(l["mode"], l["mode"]) for l in c["legs"] if l["type"] == "ride"))
    reply = (f"**{sname(origin)} to {sname(destination)}**: the cheapest is **{money(cheapest['cost_rupees'])}** via {ride_labels(cheapest)} "
             f"({cheapest['time_minutes']} min in vehicle).")
    if fastest is not cheapest:
        reply += f" The fastest is {money(fastest['cost_rupees'])} via {ride_labels(fastest)} ({fastest['time_minutes']} min)."
    reply += "\nFares are estimates calibrated to published ranges, not operator data."
    return {"reply": reply, "intent": "fare", "card": None, "actions": [], "suggestions": ["Plan it for tomorrow 9 am"]}


HELP_TEXT = (
    "I'm TransitBot, a rule-based assistant (no external AI service). I can:\n"
    "- Plan a journey: \"Borivali to Churchgate tomorrow 8:45 am\"\n"
    "- Say how crowded a station or line is: \"How crowded is Dadar?\"\n"
    "- Find the best time to leave: \"Best time to go from Andheri to BKC\"\n"
    "- Compare cost: \"Cheapest way from Thane to Vashi\"\n"
    "- Report delays and service hours: \"Any delays?\", \"Last train on the Western Line\"\n"
    "Follow-ups work too, like \"what about 6 pm?\" or \"if it rains?\"."
)


# --- Entry point ----------------------------------------------------------------

def respond(message: str, context: Optional[dict] = None, now: Optional[datetime] = None) -> dict:
    now = now or cm.now_ist()
    context = dict(context or {})
    text = normalise(message)
    tokens = text.split()

    mentions = find_stations(tokens)
    consumed = {i for m in mentions for i in range(m.start, m.end)}
    rest_text = " ".join(t for i, t in enumerate(tokens) if i not in consumed)

    # Roles: "from X", "to Y", otherwise order of appearance.
    origin = destination = None
    ordered = [m.station_id for m in mentions]
    for m in mentions:
        before = tokens[m.start - 1] if m.start else ""
        if before in ("from", "leaving", "starting") and origin is None:
            origin = m.station_id
        elif before in ("to", "towards", "toward", "reach", "at") and destination is None and before != "at":
            destination = m.station_id
    remaining = [s for s in ordered if s not in (origin, destination)]
    if origin is None and destination is None and len(ordered) >= 2:
        origin, destination = ordered[0], ordered[1]
    elif origin is None and remaining and len(ordered) >= 2:
        origin = remaining.pop(0)
    elif destination is None and remaining and len(ordered) >= 2:
        destination = remaining.pop(0)
    if origin and destination and origin == destination:
        destination = None

    time, arrive = parse_time(text)
    day = parse_date(text, now)
    preference = parse_preference(text)
    rain = parse_rain(text)
    avoid = parse_avoid(text)
    line = parse_line(rest_text)

    single = ordered[0] if len(ordered) == 1 else None
    has_slots = any(v is not None for v in (time, day, preference, rain)) or bool(avoid)
    intent = classify(text, len(ordered), has_slots)
    # "from Borivali" / "to Dadar" is the start of a trip, not a station lookup.
    if intent == "station" and (origin or destination):
        intent = "plan"

    # Follow-ups ("what about 6 pm?") inherit the remembered journey and settings.
    # A fresh message that names both stations starts over, so a rain or
    # cheapest setting from three questions ago does not leak into it.
    fresh = bool(origin and destination)
    inherit = (intent == "followup") or (intent in ("plan", "best_time", "fare") and not fresh and len(ordered) < 2)
    remembered = lambda key, default=None: context.get(key, default) if inherit else default
    entities = {
        "origin": origin or remembered("origin"),
        "destination": destination or remembered("destination"),
        "station": single, "line": line,
        "time": time or remembered("time"),
        "date": day.isoformat() if day else remembered("date"),
        "date_explicit": bool(day), "time_explicit": bool(time),
        "when": "arrive" if (arrive and time) else remembered("when", "depart"),
        "preference": preference or remembered("preference"),
        "rain": rain if rain is not None else bool(remembered("rain", False)),
        "avoid": avoid or list(remembered("avoid", []) or []),
    }

    # A bare station with no "from"/"to" ("Thane?") fills whichever end of the
    # remembered journey is still missing.
    if intent in ("plan", "followup") and single and origin is None and destination is None:
        if entities["origin"] and not entities["destination"]:
            entities["destination"] = single
        elif not entities["origin"]:
            entities["origin"] = single

    landmark_note = ""
    for m in mentions:
        if m.landmark:
            landmark_note += f"(Using {sname(m.station_id)}, the nearest station to {m.landmark}.) "

    if intent == "greeting":
        out = {"reply": "Hi! I'm TransitBot. Tell me where you're going and when, and I'll plan it with crowd forecasts. Try one of these.",
               "intent": intent, "card": None, "actions": [],
               "suggestions": ["Borivali to Churchgate tomorrow 8:45 am", "How crowded is Dadar?", "Any delays right now?"]}
    elif intent == "thanks":
        out = {"reply": "Happy to help. Safe travels!", "intent": intent, "card": None, "actions": [],
               "suggestions": ["Plan another trip", "Any delays right now?"]}
    elif intent == "help":
        out = {"reply": HELP_TEXT, "intent": intent, "card": None, "actions": [],
               "suggestions": ["Andheri to BKC at 9 am", "How crowded is the Western Line?", "Last train on the Harbour Line"]}
    elif intent == "day_plan":
        out = {"reply": "The Day Planner chains several stops into one timed schedule, with the crowd and cost of every trip. Opening it is the quickest way.",
               "intent": intent, "card": None,
               "actions": [{"type": "navigate", "label": "Open Day Planner", "view": "day"}], "suggestions": []}
    elif intent == "alerts":
        out = _alerts(now)
    elif intent == "service_hours":
        out = _service_hours(entities, line, now)
    elif intent == "best_time":
        out = _best_time(entities, now)
    elif intent == "crowd" and origin and destination:
        out = _plan(entities, now, landmark_note)
    elif intent == "crowd":
        out = _crowd({**entities, "station": single}, now, line if not single else None)
    elif intent == "fare":
        out = _fare(entities, now)
    elif intent == "line_info":
        out = _line_info({**entities, "station": single}, line)
    elif intent == "station":
        out = _line_info({**entities, "station": single}, None)
        out["reply"] += "\nAsk me for a route, its crowd level, or the best time to leave."
        out["suggestions"] = [f"How crowded is {sname(single)}?", f"Route from {sname(single)} to Churchgate"]
    elif intent in ("plan", "followup") and entities["origin"] and entities["destination"]:
        out = _plan(entities, now, landmark_note)
    elif intent in ("plan", "followup"):
        have = entities["origin"] or entities["destination"]
        out = {"reply": (f"Got **{sname(have)}**. Where {'to' if entities['origin'] else 'from'}?" if have
                         else "Which stations? For example: \"Borivali to Churchgate tomorrow 8:45 am\"."),
               "intent": "plan", "card": None, "actions": [], "suggestions": ["Andheri to BKC at 9 am", "Thane to Vashi"]}
    else:
        out = {"reply": "I didn't quite get that. I can plan trips, check crowds, find the best time to leave and report delays. Try \"Borivali to Churchgate at 8:45 am\".",
               "intent": "unknown", "card": None, "actions": [],
               "suggestions": ["What can you do?", "How crowded is Dadar?", "Any delays right now?"]}

    if landmark_note and intent != "plan" and out.get("reply"):
        out["reply"] = landmark_note + out["reply"]

    new_context = {k: entities.get(k) for k in ("origin", "destination", "date", "time", "when", "preference", "rain", "avoid")}
    if intent in ("plan", "followup", "best_time", "fare") and not (entities["origin"] and entities["destination"]):
        new_context = {**{k: context.get(k) for k in new_context}, **{k: v for k, v in new_context.items() if v}}
    elif intent not in ("plan", "followup", "best_time", "fare"):
        new_context = {k: context.get(k) for k in new_context}
    out["entities"] = {k: v for k, v in entities.items() if k not in ("date_explicit", "time_explicit")}
    out["context"] = new_context
    return out
