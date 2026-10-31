"""Unit tests for app/crowd_model.py (minute-level, direction-aware crowd model)."""

from datetime import datetime, timedelta

import pytest

from app import crowd_model as cm

MONDAY = datetime(2026, 11, 2, tzinfo=cm.IST)     # a weekday
SUNDAY = datetime(2026, 11, 1, tzinfo=cm.IST)


def at(day, hour, minute=0):
    return day.replace(hour=hour, minute=minute)


# --- Line structure ------------------------------------------------------

def test_every_line_has_a_chain_starting_at_its_cbd_end():
    assert set(cm.LINE_CHAINS) == {"Western Line", "Central Line", "Harbour Line", "Yellow Line",
                                   "Red Line", "Aqua Line", "Blue Line"}
    for line, end in cm.CBD_END.items():
        assert cm.LINE_CHAINS[line][0] == end


def test_chain_lengths_match_real_station_counts():
    lengths = {line: len(chain) for line, chain in cm.LINE_CHAINS.items()}
    assert lengths == {"Western Line": 29, "Central Line": 26, "Harbour Line": 25, "Yellow Line": 17,
                       "Red Line": 14, "Aqua Line": 27, "Blue Line": 12}


def test_line_position_runs_from_one_at_cbd_to_zero_at_far_end():
    assert cm.line_position("Western Line", "churchgate") == 1.0
    assert cm.line_position("Western Line", "virar") == 0.0
    assert 0 < cm.line_position("Western Line", "dadar") < 1
    assert cm.line_position("Western Line", "kalyan") is None


def test_stations_between_is_ordered_and_inclusive_in_both_directions():
    forward = cm.stations_between("Western Line", "churchgate", "dadar")
    assert forward[0] == "churchgate" and forward[-1] == "dadar" and len(forward) == 9
    assert cm.stations_between("Western Line", "dadar", "churchgate") == forward[::-1]


# --- Crowd levels and the time-of-day rhythm ----------------------------

@pytest.mark.parametrize("score, level", [(0.0, "Comfortable"), (0.299, "Comfortable"), (0.3, "Moderate"),
                                          (0.52, "Busy"), (0.75, "Packed"), (1.0, "Packed")])
def test_level_thresholds(score, level):
    assert cm.crowd_level_for_score(score) == level


def test_seat_chance_falls_as_crowd_rises_and_stays_a_probability():
    values = [cm.seat_chance(s / 20) for s in range(21)]
    assert values == sorted(values, reverse=True)
    assert all(0.0 <= v <= 1.0 for v in values)


def test_rhythm_is_continuous_between_hours():
    # Interpolated, so no jump at the top of the hour.
    for h in range(23):
        before = cm.rhythm_at("train", "weekday", h + 0.99)
        after = cm.rhythm_at("train", "weekday", h + 1.01)
        assert abs(before - after) < 0.05


def test_rhythm_interpolates_between_hour_centres():
    a = cm.rhythm_at("train", "weekday", 8.5)
    b = cm.rhythm_at("train", "weekday", 9.5)
    mid = cm.rhythm_at("train", "weekday", 9.0)
    assert min(a, b) - 1e-9 <= mid <= max(a, b) + 1e-9


def test_rhythm_wraps_across_midnight():
    assert cm.rhythm_at("train", "weekday", 23.9) == pytest.approx(cm.rhythm_at("train", "weekday", -0.1), abs=1e-9)


# --- Direction and position ---------------------------------------------

def segment(line, a, b, hour, day="weekday", rain=False):
    mode = cm.line_mode(line)
    return cm.segment_crowd(line, mode, a, b, hour, day, rain)


def test_morning_peak_is_heavier_towards_the_cbd():
    inbound = segment("Western Line", "borivali", "goregaon", 9.0)       # heading towards Churchgate
    outbound = segment("Western Line", "goregaon", "borivali", 9.0)
    assert inbound > outbound + 0.2


def test_evening_peak_is_heavier_away_from_the_cbd():
    inbound = segment("Western Line", "borivali", "goregaon", 18.7)
    outbound = segment("Western Line", "goregaon", "borivali", 18.7)
    assert outbound > inbound + 0.2


def test_weekend_has_far_less_directional_skew_than_weekday():
    weekday_gap = segment("Western Line", "borivali", "goregaon", 9.0) - segment("Western Line", "goregaon", "borivali", 9.0)
    weekend_gap = segment("Western Line", "borivali", "goregaon", 9.0, "weekend") - segment("Western Line", "goregaon", "borivali", 9.0, "weekend")
    assert abs(weekend_gap) < weekday_gap / 2


def test_busiest_section_is_mid_line_not_the_far_end():
    far_end = segment("Western Line", "virar", "nalasopara", 9.0)
    max_load = segment("Western Line", "mahim", "matunga_road", 9.0)
    assert max_load > far_end


def test_blue_line_connects_two_suburbs_so_direction_does_not_matter():
    a = segment("Blue Line", "versova", "dn_nagar", 9.0)
    b = segment("Blue Line", "dn_nagar", "versova", 9.0)
    assert a == pytest.approx(b)


def test_peak_hour_is_busier_than_dead_of_night_on_every_line():
    for line in cm.LINE_CHAINS:
        chain = cm.LINE_CHAINS[line]
        peak = max(segment(line, chain[3], chain[4], 9.0), segment(line, chain[4], chain[3], 9.0))
        night = segment(line, chain[3], chain[4], 3.0)
        assert peak > night


def test_trunk_lines_run_fuller_than_newer_metro():
    western = segment("Western Line", "borivali", "goregaon", 9.0)
    aqua = segment("Aqua Line", "aarey_jvlr", "seepz", 9.0)
    assert western > aqua


def test_rain_raises_rail_crowds_but_not_roads():
    dry = segment("Western Line", "borivali", "goregaon", 9.0)
    wet = segment("Western Line", "borivali", "goregaon", 9.0, rain=True)
    assert wet > dry
    assert cm.segment_crowd(None, "road", None, None, 9.0, "weekday", True) == cm.segment_crowd(None, "road", None, None, 9.0, "weekday", False)


def test_scores_always_within_zero_and_one():
    for line, chain in cm.LINE_CHAINS.items():
        mode = cm.line_mode(line)
        for i in range(len(chain) - 1):
            for t in (0, 3.3, 6, 9, 12.5, 18.7, 23.9):
                for day in ("weekday", "weekend"):
                    for rain in (False, True):
                        for a, b in ((chain[i], chain[i + 1]), (chain[i + 1], chain[i])):
                            assert 0.0 <= cm.segment_crowd(line, mode, a, b, t, day, rain) <= 1.0


# --- Whole-leg crowd -----------------------------------------------------

def test_leg_crowd_reports_where_it_peaks_and_stays_between_average_and_peak():
    result = cm.leg_crowd("Western Line", "train", "borivali", "churchgate", at(MONDAY, 8, 45), 63)
    assert result["average"] <= result["score"] <= result["peak"]
    assert result["peak_station"] in cm.LINE_CHAINS["Western Line"]
    assert result["level"] in {"Comfortable", "Moderate", "Busy", "Packed"}


def test_a_ride_that_starts_before_the_peak_is_scored_by_when_it_is_actually_ridden():
    early = cm.leg_crowd("Western Line", "train", "borivali", "churchgate", at(MONDAY, 5, 30), 63)
    in_peak = cm.leg_crowd("Western Line", "train", "borivali", "churchgate", at(MONDAY, 8, 30), 63)
    assert in_peak["score"] > early["score"] + 0.2


def test_leg_crowd_on_a_roadless_leg_uses_a_single_hop():
    result = cm.leg_crowd(None, "bus", "dadar", "churchgate", at(MONDAY, 9), 20)
    assert 0.0 <= result["score"] <= 1.0


# --- Headways and service hours -----------------------------------------

def test_headway_is_shortest_at_peak_and_longest_at_night():
    peak = cm.headway_minutes("Western Line", "train", at(MONDAY, 9))
    midday = cm.headway_minutes("Western Line", "train", at(MONDAY, 14))
    night = cm.headway_minutes("Western Line", "train", at(MONDAY, 23, 30))
    assert peak < midday < night
    assert 3.0 <= peak <= 5.0


def test_service_runs_normally_inside_the_window():
    moment, closed = cm.next_service_time("Western Line", "train", at(MONDAY, 12))
    assert (moment, closed) == (at(MONDAY, 12), False)


def test_before_first_train_waits_for_it_the_same_day():
    moment, closed = cm.next_service_time("Western Line", "train", at(MONDAY, 2))
    assert closed and moment == at(MONDAY, 4, 15)


def test_after_last_metro_waits_for_the_next_morning():
    moment, closed = cm.next_service_time("Aqua Line", "metro", at(MONDAY, 23, 30))
    assert closed and moment.date() == (MONDAY + timedelta(days=1)).date() and moment.hour == 5


def test_late_night_trains_still_run_in_the_first_minutes_after_midnight():
    moment, closed = cm.next_service_time("Western Line", "train", at(MONDAY, 0, 20))
    assert not closed


def test_road_never_closes():
    assert cm.next_service_time(None, "road", at(MONDAY, 3))[1] is False


# --- Station readings ----------------------------------------------------

def test_station_crowd_is_none_at_a_terminus_with_no_train_that_way():
    assert cm.station_crowd("Western Line", "churchgate", True, at(MONDAY, 9)) is None
    assert cm.station_crowd("Western Line", "virar", False, at(MONDAY, 9)) is None
    assert cm.station_crowd("Western Line", "dadar", True, at(MONDAY, 9)) is not None


def test_reference_datetime_gives_a_weekday_and_a_weekend_day():
    assert cm.day_type_for(cm.reference_datetime("weekday", 9)) == "weekday"
    assert cm.day_type_for(cm.reference_datetime("weekend", 9)) == "weekend"
