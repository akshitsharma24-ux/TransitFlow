"""Unit tests for app/planner.py (clock-based itineraries, advisor, day plans)."""

from datetime import datetime, timedelta

import pytest

from app import crowd_model as cm
from app import planner

NOW = datetime(2026, 10, 31, 12, 0, tzinfo=cm.IST)           # a Saturday, far from the planned times
MONDAY = datetime(2026, 11, 2, tzinfo=cm.IST)


def at(hour, minute=0, day=MONDAY):
    return day.replace(hour=hour, minute=minute)


def plan(origin, destination, moment, **kwargs):
    kwargs.setdefault("now", NOW)
    return planner.plan_trip(origin, destination, moment, kwargs.pop("when", "depart"),
                             kwargs.pop("preference", "balanced"), kwargs.pop("rain", False),
                             kwargs.pop("avoid", []), **kwargs)


def parse(iso):
    return datetime.fromisoformat(iso)


# --- A single itinerary is internally consistent -------------------------

@pytest.mark.parametrize("origin, destination", [
    ("borivali", "churchgate"), ("andheri", "ghatkopar"), ("csmt", "panvel"),
    ("dahisar_east", "gundavali"), ("thane", "vashi"), ("cuffe_parade", "aarey_jvlr"),
])
def test_steps_are_contiguous_and_add_up(origin, destination):
    it = plan(origin, destination, at(9))["recommended"]
    steps = it["steps"]
    assert parse(steps[0]["start"]) == parse(it["depart"])
    for prev, nxt in zip(steps, steps[1:]):
        assert parse(prev["end"]) == parse(nxt["start"])
    assert parse(steps[-1]["end"]) == parse(it["arrive"])
    assert sum(s["minutes"] for s in steps) == it["duration_minutes"]
    assert it["duration_minutes"] == it["ride_minutes"] + it["wait_minutes"] + it["walk_minutes"]
    assert sum(s["cost_rupees"] for s in steps if s["kind"] == "ride") == it["cost_rupees"]
    for s in steps:
        assert parse(s["end"]) - parse(s["start"]) == timedelta(minutes=s["minutes"])


def test_every_ride_is_preceded_by_a_wait_of_at_least_a_minute():
    it = plan("borivali", "churchgate", at(9))["recommended"]
    kinds = [s["kind"] for s in it["steps"]]
    for i, k in enumerate(kinds):
        if k == "ride":
            assert kinds[i - 1] == "wait"


def test_each_ride_carries_its_own_crowd_reading():
    it = plan("borivali", "churchgate", at(9))["recommended"]
    rides = [s for s in it["steps"] if s["kind"] == "ride"]
    assert rides and all(r["crowd"]["level"] in {"Comfortable", "Moderate", "Busy", "Packed"} for r in rides)
    assert all(0 <= r["crowd"]["index"] <= 100 for r in rides)


def test_second_leg_is_scored_at_the_time_it_is_ridden_not_the_departure_time():
    # A trip with a change: the later leg happens later, so its reading must be
    # computed from its own boarding minute.
    result = planner.simulate(next(c for c in planner.usable_candidates("borivali", "churchgate", ["road"])
                                   if len([l for l in c["legs"] if l["type"] == "ride"]) == 2), at(8, 20))
    rides = [s for s in result.steps if s["kind"] == "ride"]
    assert rides[1]["start"] > rides[0]["end"]


def test_peak_departure_is_more_crowded_than_midday_for_the_same_trip():
    peak = plan("borivali", "churchgate", at(8, 45), preference="fastest")["recommended"]["crowd"]["score"]
    midday = plan("borivali", "churchgate", at(13), preference="fastest")["recommended"]["crowd"]["score"]
    assert peak > midday + 0.2


def test_rain_makes_the_peak_trip_worse_not_better():
    dry = plan("borivali", "churchgate", at(8, 45), preference="fastest")["recommended"]
    wet = plan("borivali", "churchgate", at(8, 45), preference="fastest", rain=True)["recommended"]
    assert wet["crowd"]["score"] >= dry["crowd"]["score"]
    assert any("Rain" in n for n in plan("borivali", "churchgate", at(8, 45), rain=True)["notes"])


# --- Preferences pick what they claim ------------------------------------

def test_fastest_has_the_shortest_duration_among_everything_shown():
    r = plan("borivali", "churchgate", at(9), preference="fastest")
    shown = [r["recommended"]] + r["alternatives"]
    assert r["recommended"]["duration_minutes"] == min(i["duration_minutes"] for i in shown)


def test_cheapest_has_the_lowest_fare_among_everything_shown():
    r = plan("borivali", "churchgate", at(9), preference="cheapest")
    shown = [r["recommended"]] + r["alternatives"]
    assert r["recommended"]["cost_rupees"] == min(i["cost_rupees"] for i in shown)


def test_least_crowded_has_the_lowest_crowd_score_among_everything_shown():
    r = plan("borivali", "churchgate", at(9), preference="least_crowded")
    shown = [r["recommended"]] + r["alternatives"]
    assert r["recommended"]["crowd"]["score"] == min(i["crowd"]["score"] for i in shown)


def test_fewest_changes_never_beats_a_direct_ride_with_a_changeful_one():
    r = plan("andheri", "ghatkopar", at(9), preference="fewest_transfers")
    shown = [r["recommended"]] + r["alternatives"]
    assert r["recommended"]["transfers"] == min(i["transfers"] for i in shown)


def test_alternatives_are_tagged_with_why_they_are_listed_and_not_duplicated():
    r = plan("borivali", "churchgate", at(9))
    shown = [r["recommended"]] + r["alternatives"]
    assert "Recommended" in r["recommended"]["badges"]
    assert all(i["badges"] for i in shown)
    assert len({tuple((s["line"], s["from_station"]["id"], s["to_station"]["id"]) for s in i["steps"]) for i in shown}) == len(shown)


def test_avoiding_road_removes_every_cab_option():
    r = plan("borivali", "churchgate", at(9), avoid=["road"])
    for it in [r["recommended"]] + r["alternatives"]:
        assert all(s["mode"] != "road" for s in it["steps"])


def test_avoiding_everything_gives_a_clear_error():
    with pytest.raises(planner.PlanError):
        plan("borivali", "churchgate", at(9), avoid=["train", "metro", "bus", "road"])


# --- Service hours --------------------------------------------------------

def test_planning_before_the_first_train_waits_and_says_so():
    r = plan("borivali", "churchgate", at(2, 30), preference="fastest", avoid=["road", "bus"])
    it = r["recommended"]
    first_ride = next(s for s in it["steps"] if s["kind"] == "ride")
    assert parse(first_ride["start"]).hour >= 4
    assert any("first service" in w or "not running" in w for w in it["warnings"])
    assert it["wait_minutes"] >= 60


def test_a_cab_is_always_available_even_at_3am():
    r = plan("borivali", "churchgate", at(3), preference="fastest")
    assert r["recommended"]["steps"][0]["start"] == at(3).isoformat()


# --- Arrive-by planning ---------------------------------------------------

def test_arrive_by_arrives_before_the_deadline_with_the_buffer():
    deadline = at(10)
    r = plan("borivali", "lower_parel", deadline, when="arrive", avoid=["road"])
    assert parse(r["recommended"]["arrive"]) <= deadline - timedelta(minutes=5)
    assert any("latest you could leave" in n for n in r["notes"])


def test_arrive_by_picks_a_departure_that_is_not_absurdly_early():
    deadline = at(10)
    r = plan("borivali", "lower_parel", deadline, when="arrive", avoid=["road"])
    slack = (deadline - parse(r["recommended"]["arrive"])).total_seconds() / 60
    assert slack < 60


def test_arrive_by_with_an_impossible_deadline_is_refused():
    with pytest.raises(planner.PlanError):
        plan("virar", "panvel", at(4, 30), when="arrive", avoid=["road"])


def test_arrive_by_marks_slots_that_would_be_late_as_infeasible():
    r = plan("borivali", "lower_parel", at(10), when="arrive", avoid=["road"])
    window = r["advisor"]["window"]
    assert any(w["feasible"] for w in window)
    assert all(w["feasible"] == (parse(w["arrive"]) <= at(10) - timedelta(minutes=5)) for w in window)


# --- Departure advisor ------------------------------------------------------

def test_advisor_window_is_ordered_and_marks_the_selected_slot():
    r = plan("borivali", "churchgate", at(8, 45), avoid=["road"])
    window = r["advisor"]["window"]
    offsets = [w["offset_minutes"] for w in window]
    assert offsets == sorted(offsets) and 0 in offsets
    assert window[r["advisor"]["selected_index"]]["offset_minutes"] == 0
    assert 0 <= r["advisor"]["best_index"] < len(window)


def test_advisor_finds_a_calmer_slot_when_the_chosen_time_is_peak():
    r = plan("borivali", "churchgate", at(8, 45), avoid=["road"])
    window = r["advisor"]["window"]
    best = window[r["advisor"]["best_index"]]
    selected = window[r["advisor"]["selected_index"]]
    assert best["crowd_score"] <= selected["crowd_score"]
    assert "Leaving at" in r["advisor"]["insight"] or "already close" in r["advisor"]["insight"]


def test_advisor_does_not_suggest_a_pointless_change_off_peak():
    r = plan("borivali", "churchgate", at(13), avoid=["road"])
    assert "already close" in r["advisor"]["insight"]


def test_advisor_never_recommends_a_slot_worse_than_the_selected_one():
    for hour in (7, 8, 9, 12, 18, 21):
        r = plan("andheri", "churchgate", at(hour), avoid=["road"])
        window = r["advisor"]["window"]
        assert window[r["advisor"]["best_index"]]["advisor_cost"] <= window[r["advisor"]["selected_index"]]["advisor_cost"]


# --- Simulated alerts only near the present ------------------------------------

def test_service_alerts_are_only_applied_close_to_now():
    far = plan("borivali", "churchgate", at(9))
    assert far["live_alerts_included"] is False
    near = plan("borivali", "churchgate", NOW + timedelta(minutes=10), now=NOW)
    assert near["live_alerts_included"] is True


# --- Day plans -------------------------------------------------------------------

def day(stops, **kwargs):
    kwargs.setdefault("now", NOW)
    return planner.plan_day("borivali", at(8, 30), stops, kwargs.pop("return_to_origin", True),
                            kwargs.pop("preference", "balanced"), kwargs.pop("rain", False),
                            kwargs.pop("avoid", ["road"]), planner.default_station_point, **kwargs)


def test_day_plan_alternates_trips_and_stays_and_returns_home():
    r = day([{"station": "lower_parel", "stay_minutes": 540}, {"station": "andheri", "stay_minutes": 60}])
    kinds = [i["kind"] for i in r["items"]]
    assert kinds == ["trip", "stay", "trip", "stay", "trip"]
    assert r["items"][-1]["to_station"]["id"] == "borivali"
    assert r["summary"]["trips"] == 3


def test_day_plan_timeline_is_continuous_with_no_gaps():
    r = day([{"station": "lower_parel", "stay_minutes": 540}, {"station": "andheri", "stay_minutes": 60}])
    for prev, nxt in zip(r["items"], r["items"][1:]):
        assert parse(prev["end"]) == parse(nxt["start"])


def test_day_plan_stay_lasts_exactly_the_requested_minutes():
    r = day([{"station": "lower_parel", "stay_minutes": 540}])
    stay = next(i for i in r["items"] if i["kind"] == "stay")
    assert stay["minutes"] == 540


def test_leave_at_overrides_stay_length():
    r = day([{"station": "lower_parel", "leave_at": "18:00"}])
    stay = next(i for i in r["items"] if i["kind"] == "stay")
    assert parse(stay["end"]).strftime("%H:%M") == "18:00"


def test_leave_at_in_the_past_continues_immediately_with_a_warning():
    r = day([{"station": "lower_parel", "leave_at": "08:35"}])
    assert not any(i["kind"] == "stay" for i in r["items"])
    assert any("after your planned departure" in w for w in r["warnings"])


def test_day_totals_equal_the_sum_of_trips():
    r = day([{"station": "lower_parel", "stay_minutes": 540}, {"station": "andheri", "stay_minutes": 60}])
    trips = [i["itinerary"] for i in r["items"] if i["kind"] == "trip"]
    assert r["summary"]["cost_rupees"] == sum(t["cost_rupees"] for t in trips)
    assert r["summary"]["travel_minutes"] == sum(t["duration_minutes"] for t in trips)


def test_day_plan_without_return_ends_at_the_last_stop():
    r = day([{"station": "lower_parel", "stay_minutes": 60}], return_to_origin=False)
    assert r["summary"]["trips"] == 1 and r["items"][-1]["kind"] == "trip"


def test_pass_advice_compares_single_fares_with_monthly_passes():
    r = day([{"station": "lower_parel", "stay_minutes": 540}])
    advice = r["pass_advice"]
    assert advice["monthly_singles"] == r["summary"]["cost_rupees"] * 26
    assert advice["saves"] == advice["monthly_singles"] - advice["monthly_pass"]


def test_repeating_the_same_station_back_to_back_is_refused():
    with pytest.raises(planner.PlanError):
        day([{"station": "lower_parel", "stay_minutes": 10}, {"station": "lower_parel", "stay_minutes": 10}])


def test_best_slot_is_only_marked_when_the_insight_recommends_moving():
    # Regression: the chart used to star a "best" slot while the sentence above
    # it said the chosen time was already fine.
    for hour in (7, 8, 9, 13, 18, 22):
        advisor = plan("borivali", "churchgate", at(hour), avoid=["road"])["advisor"]
        if "already close" in advisor["insight"]:
            assert advisor["best_index"] == advisor["selected_index"]
        else:
            assert advisor["best_index"] != advisor["selected_index"]


@pytest.mark.parametrize("origin, destination", [("borivali", "churchgate"), ("churchgate", "borivali"), ("virar", "churchgate")])
def test_smart_pick_does_not_chain_modes_for_a_marginal_crowd_gain(origin, destination):
    # Regression: with a heavy crowd penalty the pick drifted to Western + Aqua + Bus
    # style itineraries. A direct ride on the trunk line must win these commutes.
    it = plan(origin, destination, at(8, 45), avoid=[])["recommended"]
    assert it["transfers"] == 0
    assert all(s["mode"] not in ("bus", "road") for s in it["steps"] if s["kind"] == "ride")
