"""Pydantic models shared by the API routers."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"
ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"
Preference = Literal["balanced", "fastest", "cheapest", "comfortable", "least_crowded", "fewest_transfers"]
ModeName = Literal["train", "metro", "bus", "road"]


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


# --- Planner ---------------------------------------------------------------

class PlanRequest(BaseModel):
    origin: str
    destination: str
    date: Optional[str] = Field(default=None, pattern=ISO_DATE, description="IST date, YYYY-MM-DD; default today")
    time: Optional[str] = Field(default=None, pattern=HHMM, description="24-hour HH:MM; default now")
    when: Literal["depart", "arrive"] = "depart"
    preference: Preference = "balanced"
    is_raining: bool = False
    avoid: list[ModeName] = []


class StepCrowd(BaseModel):
    level: str
    score: float
    index: int
    seat_chance: float
    peak_station: str


class Step(BaseModel):
    kind: Literal["wait", "ride", "walk"]
    start: str
    end: str
    minutes: int
    mode: Optional[str] = None
    line: Optional[str] = None
    note: Optional[str] = None
    from_station: StationPoint
    to_station: StationPoint
    stops: Optional[int] = None
    cost_rupees: Optional[int] = None
    crowd: Optional[StepCrowd] = None
    headway_minutes: Optional[float] = None
    delay_minutes: Optional[int] = None


class JourneyCrowd(BaseModel):
    level: str
    score: float
    index: int
    peak_level: str
    peak_score: float
    seat_chance: float


class Itinerary(BaseModel):
    label: str
    badges: list[str]
    depart: str
    arrive: str
    duration_minutes: int
    ride_minutes: int
    wait_minutes: int
    walk_minutes: int
    cost_rupees: int
    transfers: int
    comfort_score: float
    crowd: JourneyCrowd
    discomfort_minutes: float
    effective_minutes: float
    steps: list[Step]
    legs: list[Leg]
    via: list[str]
    path: list[StationPoint]
    fare_pass: Optional[FarePassInsight] = None
    tips: list[str]
    warnings: list[str]


class AdvisorSlot(BaseModel):
    offset_minutes: int
    depart: str
    arrive: str
    duration_minutes: int
    cost_rupees: int
    crowd_score: float
    crowd_level: str
    effective_minutes: float
    advisor_cost: float
    label: str
    feasible: bool = True


class Advisor(BaseModel):
    window: list[AdvisorSlot]
    selected_index: int
    best_index: int
    insight: str


class PlanResponse(BaseModel):
    origin: StationPoint
    destination: StationPoint
    when: str
    preference: str
    is_raining: bool
    day_type: str
    requested_time: str
    recommended: Itinerary
    alternatives: list[Itinerary]
    advisor: Advisor
    notes: list[str]
    warnings: list[str]
    live_alerts_included: bool
    generated_at: str


class DayStop(BaseModel):
    station: str
    stay_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    leave_at: Optional[str] = Field(default=None, pattern=HHMM)


class DayPlanRequest(BaseModel):
    origin: str
    date: Optional[str] = Field(default=None, pattern=ISO_DATE)
    start_time: str = Field(pattern=HHMM)
    stops: list[DayStop] = Field(min_length=1, max_length=8)
    return_to_origin: bool = True
    preference: Preference = "balanced"
    is_raining: bool = False
    avoid: list[ModeName] = []


class DayItem(BaseModel):
    kind: Literal["trip", "stay"]
    from_station: StationPoint
    to_station: StationPoint
    start: str
    end: str
    minutes: Optional[int] = None
    itinerary: Optional[Itinerary] = None


class DaySummary(BaseModel):
    start: str
    end: str
    trips: int
    travel_minutes: int
    wait_minutes: int
    cost_rupees: int
    crowded_minutes: int
    discomfort_minutes: float


class PassAdvice(BaseModel):
    monthly_singles: int
    monthly_pass: int
    modes: list[str]
    saves: int
    text: str


class DayPlanResponse(BaseModel):
    preference: str
    is_raining: bool
    day_type: str
    items: list[DayItem]
    summary: DaySummary
    pass_advice: Optional[PassAdvice] = None
    warnings: list[str]
    generated_at: str


# --- Live ------------------------------------------------------------------

class CrowdReportRequest(BaseModel):
    station: str
    level: Literal["Comfortable", "Moderate", "Busy", "Packed"]
