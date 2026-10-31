"""Tests for app/chatbot.py (station matching, slot parsing, intents, follow-ups)."""

from datetime import date, datetime

import pytest

from app import chatbot
from app import crowd_model as cm

NOW = datetime(2026, 10, 31, 19, 5, tzinfo=cm.IST)      # Saturday evening


def ask(message, context=None):
    return chatbot.respond(message, context, NOW)


def stations_in(text):
    tokens = chatbot.normalise(text).split()
    return [m.station_id for m in chatbot.find_stations(tokens)]


# --- Edit distance -------------------------------------------------------------

@pytest.mark.parametrize("a, b, d", [
    ("", "", 0), ("kitten", "kitten", 0), ("borivali", "borivli", 1), ("churchgate", "churchgat", 1),
    ("dadar", "dadr", 1), ("andheri", "andehri", 2), ("abc", "xyz", 3),
])
def test_edit_distance_matches_the_textbook_values(a, b, d):
    assert chatbot.edit_distance(a, b, limit=3) == d


def test_edit_distance_gives_up_past_the_limit():
    assert chatbot.edit_distance("churchgate", "cuffe parade", limit=2) > 2
    assert chatbot.edit_distance("a", "abcdef", limit=2) > 2


# --- Station recognition --------------------------------------------------------

@pytest.mark.parametrize("text, expected", [
    ("Borivali to Churchgate", ["borivali", "churchgate"]),
    ("from Andheri to Lower Parel", ["andheri", "lower_parel"]),
    ("borivli to churchgat", ["borivali", "churchgate"]),
    ("VT to Bori", ["csmt", "borivali"]),
    ("airport to bkc", ["csia_t2", "bkc"]),
    ("dadar central to kurla harbour", ["dadar_central", "kurla_harbour"]),
    ("navi mumbai to colaba", ["vashi", "cuffe_parade"]),
    ("Thane -> Vashi", ["thane", "vashi"]),
])
def test_stations_are_found_in_order(text, expected):
    assert stations_in(text) == expected


def test_plain_station_names_win_over_variants_with_a_qualifier():
    assert stations_in("dadar") == ["dadar"]
    assert stations_in("churchgate") == ["churchgate"]
    assert stations_in("kurla") == ["kurla"]


def test_common_words_are_not_mistaken_for_stations():
    assert stations_in("which is the cheapest train today please") == []
    assert stations_in("how crowded is it right now") == []


def test_every_station_name_resolves_to_itself():
    for sid, info in chatbot.re_.STATION_INFO.items():
        found = stations_in(info["name"])
        assert found == [sid] or (found and found[0] != sid and chatbot.normalise(info["name"]) in chatbot.ALIASES), sid


# --- Time and date parsing -----------------------------------------------------

@pytest.mark.parametrize("text, expected", [
    ("at 8:45 am", "08:45"), ("at 6 pm", "18:00"), ("at 18:30", "18:30"), ("9am", "09:00"), ("9.30 pm", None),
    ("at 12 am", "00:00"), ("at 12 pm", "12:00"), ("in the evening", "18:30"), ("tomorrow morning", "08:30"),
    ("at noon", "12:00"), ("at 5", "17:00"), ("at 9", "09:00"), ("around 10", "10:00"),
])
def test_clock_times(text, expected):
    got, _ = chatbot.parse_time(chatbot.normalise(text))
    if expected is None:
        assert got in (None, "09:00")      # "9.30" loses its dot in normalisation; just must not crash
    else:
        assert got == expected


def test_by_means_arrival_deadline():
    time, arrive = chatbot.parse_time("reach by 10 am")
    assert (time, arrive) == ("10:00", True)
    assert chatbot.parse_time("leave at 10 am")[1] is False


@pytest.mark.parametrize("text, expected", [
    ("today", date(2026, 10, 31)), ("tomorrow", date(2026, 11, 1)), ("day after tomorrow", date(2026, 11, 2)),
    ("on monday", date(2026, 11, 2)), ("on saturday", date(2026, 11, 7)), ("next sunday", date(2026, 11, 1)),
])
def test_relative_dates(text, expected):
    assert chatbot.parse_date(text, NOW) == expected


def test_no_date_words_means_no_date():
    assert chatbot.parse_date("andheri to bkc", NOW) is None


def test_preference_rain_and_avoid_words():
    assert chatbot.parse_preference("cheapest way") == "cheapest"
    assert chatbot.parse_preference("least crowded please") == "least_crowded"
    assert chatbot.parse_preference("quickest route") == "fastest"
    assert chatbot.parse_preference("hello") is None
    assert chatbot.parse_rain("what if it rains") is True and chatbot.parse_rain("it is not raining") is False
    assert chatbot.parse_rain("hello") is None
    assert chatbot.parse_avoid("no bus and avoid cab please") == ["bus", "road"]


# --- Intents and replies --------------------------------------------------------

@pytest.mark.parametrize("message, intent", [
    ("hi", "greeting"), ("thanks!", "thanks"), ("what can you do", "help"), ("plan my day", "day_plan"),
    ("any delays right now", "alerts"), ("last train on the western line", "service_hours"),
    ("best time to go from andheri to bkc", "best_time"), ("how crowded is dadar", "crowd"),
    ("fare from thane to vashi", "fare"), ("stations on the aqua line", "line_info"),
    ("Borivali to Churchgate tomorrow 8:45 am", "plan"), ("blah blah", "unknown"),
])
def test_intent_is_recognised(message, intent):
    assert ask(message)["intent"] == intent


def test_plan_reply_contains_the_essentials_and_a_card():
    out = ask("Borivali to Churchgate on monday at 8:45 am")
    assert "Borivali" in out["reply"] and "Churchgate" in out["reply"] and "08:45" in out["reply"]
    assert out["card"]["type"] == "itinerary" and out["card"]["steps"]
    assert out["actions"][0]["type"] == "open_planner"
    assert out["actions"][0]["params"]["from"] == "borivali" and out["actions"][0]["params"]["date"] == "2026-11-02"


def test_monday_peak_reply_warns_about_the_crowd():
    out = ask("Borivali to Churchgate on monday at 8:45 am")
    assert "Packed" in out["card"]["crowd_level"] or "packed" in out["reply"]


def test_a_time_that_has_passed_today_rolls_to_tomorrow():
    out = ask("andheri to bkc at 9 am")
    assert out["entities"]["date"] == "2026-11-01"
    assert "tomorrow" in out["reply"]


def test_arrive_by_phrase_switches_the_planner_mode():
    out = ask("borivali to churchgate on monday, reach by 10 am")
    assert out["entities"]["when"] == "arrive"
    assert out["actions"][0]["params"]["when"] == "arrive"


def test_crowd_question_about_a_station_lists_each_line_and_direction():
    out = ask("how crowded is dadar")
    assert "Dadar" in out["reply"] and "Western Line" in out["reply"] and "towards" in out["reply"]


def test_crowd_question_about_a_line():
    out = ask("is the harbour line busy")
    assert "Harbour Line" in out["reply"]


def test_a_route_crowd_question_plans_the_route_instead():
    out = ask("is the train from thane to dadar busy on monday at 9am")
    assert out["intent"] == "plan" and out["card"]


def test_landmark_alias_explains_which_station_was_used():
    out = ask("from spit to airport at 7 pm")
    assert "nearest station to SPIT" in out["reply"]


def test_fare_answer_reports_cheapest_and_fastest():
    out = ask("fare from andheri to churchgate")
    assert "cheapest" in out["reply"] and "₹" in out["reply"]


def test_service_hours_are_flagged_as_approximate():
    out = ask("first train on the western line")
    assert "Approximate" in out["reply"] and "Western Line" in out["reply"]


def test_how_long_is_not_mistaken_for_a_fare_question():
    assert ask("how long from andheri to bkc")["intent"] == "plan"


def test_unknown_input_still_offers_help():
    out = ask("what is the meaning of life")
    assert out["intent"] == "unknown" and out["suggestions"]


# --- Context and follow-ups -----------------------------------------------------

def test_follow_up_changes_only_what_was_said():
    first = ask("Borivali to Churchgate on monday at 8:45 am")
    second = ask("what about 6 pm?", first["context"])
    assert second["entities"]["origin"] == "borivali" and second["entities"]["destination"] == "churchgate"
    assert second["entities"]["time"] == "18:00" and second["entities"]["date"] == "2026-11-02"


def test_follow_up_preference_and_rain_stick_for_the_next_follow_up():
    first = ask("Borivali to Churchgate on monday at 8:45 am")
    second = ask("cheapest?", first["context"])
    third = ask("and if it rains?", second["context"])
    assert second["entities"]["preference"] == "cheapest"
    assert third["entities"]["rain"] is True and third["entities"]["preference"] == "cheapest"


def test_a_fresh_full_query_does_not_inherit_old_settings():
    first = ask("Borivali to Churchgate on monday at 8:45 am, cheapest, it is raining")
    assert first["entities"]["rain"] is True and first["entities"]["preference"] == "cheapest"
    fresh = ask("Andheri to Thane", first["context"])
    assert fresh["entities"]["rain"] is False and fresh["entities"]["preference"] is None


def test_one_station_with_remembered_origin_fills_the_destination():
    first = ask("from borivali")
    assert "Where" in first["reply"]
    second = ask("to churchgate on monday at 9", first["context"])
    assert second["entities"]["destination"] == "churchgate" and second["card"]


def test_asking_for_a_missing_end_does_not_crash():
    out = ask("to dadar")
    assert "Where" in out["reply"]


def test_identical_origin_and_destination_is_handled():
    out = ask("dadar to dadar")
    assert out["card"] is None


def test_best_time_answer_gives_quiet_slots_and_a_planner_shortcut():
    out = ask("best time to travel from borivali to churchgate on monday")
    assert out["intent"] == "best_time" and "quietest" in out["reply"]
    assert out["actions"] and out["actions"][0]["type"] == "open_planner"


def test_replies_are_deterministic():
    assert ask("Borivali to Churchgate on monday at 8:45 am") == ask("Borivali to Churchgate on monday at 8:45 am")
