"""Tests for app/live.py (snapshot, simulated alerts, rider reports, atlas)."""

from datetime import datetime, timedelta

import pytest

from app import crowd_model as cm
from app import live

MONDAY_9AM = datetime(2026, 11, 2, 9, 0, tzinfo=cm.IST)
NIGHT = datetime(2026, 11, 2, 2, 30, tzinfo=cm.IST)


# --- Snapshot ----------------------------------------------------------------

def test_snapshot_covers_every_line_with_both_directions():
    snap = live.snapshot(MONDAY_9AM)
    assert {l["line"] for l in snap["lines"]} == set(cm.LINE_CHAINS)
    for line in snap["lines"]:
        assert line["in_service"]
        assert line["inbound"] and line["outbound"]
        assert 0 <= line["index"] <= 100


def test_snapshot_is_deterministic_for_the_same_minute():
    assert live.snapshot(MONDAY_9AM) == live.snapshot(MONDAY_9AM)


def test_hotspots_are_sorted_busiest_first_and_one_per_station():
    snap = live.snapshot(MONDAY_9AM)
    scores = [h["score"] for h in snap["hotspots"]]
    assert scores == sorted(scores, reverse=True)
    assert len({h["station_id"] for h in snap["hotspots"]}) == len(snap["hotspots"])
    assert snap["calmest"][0]["score"] <= snap["hotspots"][0]["score"]


def test_lines_report_not_running_in_the_small_hours():
    snap = live.snapshot(NIGHT)
    metro = next(l for l in snap["lines"] if l["line"] == "Aqua Line")
    assert metro["status"] == "Not running" and metro["index"] is None


def test_snapshot_discloses_what_is_simulated():
    snap = live.snapshot(MONDAY_9AM)
    assert "simulated" in snap["sources"]["simulated"].lower()


def test_rain_raises_the_network_wide_crowd():
    dry = live.snapshot(MONDAY_9AM, rain=False)
    wet = live.snapshot(MONDAY_9AM, rain=True)
    assert sum(l["index"] for l in wet["lines"]) > sum(l["index"] for l in dry["lines"])


def test_line_ribbon_lists_stations_in_order_with_directional_readings():
    ribbon = live.line_ribbon("Western Line", MONDAY_9AM)
    ids = [s["id"] for s in ribbon["stations"]]
    assert ids[0] == "churchgate" and ids[-1] == "virar"
    assert ribbon["stations"][0]["inbound"] is None          # no train towards Churchgate from Churchgate
    assert ribbon["stations"][-1]["outbound"] is None
    assert ribbon["stations"][10]["inbound"]["index"] > ribbon["stations"][10]["outbound"]["index"]   # AM peak


# --- Simulated alerts ----------------------------------------------------------

def test_alerts_are_repeatable():
    day = MONDAY_9AM.date()
    assert live._alert_events("Western Line", day) == live._alert_events("Western Line", day)


def test_alerts_only_occur_while_the_line_runs_and_have_sane_values():
    for line in cm.LINE_CHAINS:
        for offset in range(0, 14):
            day = (MONDAY_9AM + timedelta(days=offset)).date()
            for e in live._alert_events(line, day):
                assert e["end"] > e["start"] and 5 <= e["delay_minutes"] <= 16
                assert e["station"] in cm.LINE_CHAINS[line]
                assert 4 <= e["start"].hour <= 24 or e["start"].hour == 0


def test_some_day_has_an_active_alert_and_it_is_marked_simulated():
    for offset in range(0, 60):
        base = MONDAY_9AM + timedelta(days=offset)
        for line in ("Western Line", "Central Line"):
            events = live._alert_events(line, base.date())
            if events:
                moment = events[0]["start"] + timedelta(minutes=1)
                alerts = live.active_alerts(moment)
                assert alerts and all(a["simulated"] is True for a in alerts)
                assert live.alert_delay_minutes(line, moment) == events[0]["delay_minutes"]
                return
    pytest.fail("no simulated alert found in 60 days")


def test_alert_delay_is_zero_for_roads_and_unknown_lines():
    assert live.alert_delay_minutes(None, MONDAY_9AM) == 0
    assert live.alert_delay_minutes("Nonexistent Line", MONDAY_9AM) == 0


# --- Rider reports -------------------------------------------------------------

def test_blend_without_reports_returns_the_model_unchanged():
    assert live.blend_reports(0.4, []) == (0.4, 0.0)


def test_fresh_reports_pull_the_reading_towards_what_riders_say():
    blended, share = live.blend_reports(0.2, [("Packed", 1.0), ("Packed", 2.0), ("Packed", 3.0)])
    assert blended > 0.5 and 0 < share <= 0.75


def test_old_reports_count_for_less_than_new_ones():
    fresh, _ = live.blend_reports(0.2, [("Packed", 1.0)])
    stale, _ = live.blend_reports(0.2, [("Packed", 120.0)])
    assert fresh > stale
    assert stale == pytest.approx(0.2, abs=0.01)


def test_the_model_always_keeps_a_share_of_the_answer():
    _, share = live.blend_reports(0.1, [("Packed", 0.0)] * 50)
    assert share <= 0.75


def test_report_is_stored_and_shows_up_in_the_station_reading():
    before = live.station_status("matunga_road", MONDAY_9AM)["reports_last_hour"]
    assert live.record_report("matunga_road", "Packed", "client-a", int(MONDAY_9AM.timestamp())) == "ok"
    status = live.station_status("matunga_road", MONDAY_9AM)
    assert status["reports_last_hour"] == before + 1
    assert any(s["inbound"] and s["inbound"]["report_share"] > 0 for s in status["services"])


def test_same_client_cannot_flood_a_station():
    t = int(MONDAY_9AM.timestamp()) + 5000
    assert live.record_report("sion", "Busy", "client-b", t) == "ok"
    assert live.record_report("sion", "Packed", "client-b", t + 30) == "cooldown"
    assert live.record_report("sion", "Packed", "client-c", t + 30) == "ok"
    assert live.record_report("sion", "Packed", "client-b", t + 200) == "ok"


def test_reports_older_than_an_hour_are_ignored():
    t = int(MONDAY_9AM.timestamp()) + 20000
    live.record_report("kurla", "Packed", "client-d", t)
    assert live.recent_reports(t + 3700, "kurla") == {}
    assert len(live.recent_reports(t + 600, "kurla")["kurla"]) == 1


# --- Atlas -----------------------------------------------------------------------

def test_atlas_has_a_cell_for_every_half_hour_and_every_line():
    atlas = live.atlas("weekday", "inbound")
    assert len(atlas["slots"]) == 48 and atlas["slots"][0] == "00:00" and atlas["slots"][-1] == "23:30"
    assert {row["line"] for row in atlas["lines"]} == set(cm.LINE_CHAINS)
    assert all(len(row["values"]) == 48 for row in atlas["lines"])


def test_atlas_shows_the_morning_inbound_peak_and_closed_hours():
    western = next(r for r in live.atlas("weekday", "inbound")["lines"] if r["line"] == "Western Line")
    assert western["values"][18] > western["values"][26] > western["values"][8]   # 09:00 > 13:00 > 04:00 (closed -> None handled below)


def test_atlas_marks_hours_when_a_line_is_closed():
    aqua = next(r for r in live.atlas("weekday", "inbound")["lines"] if r["line"] == "Aqua Line")
    assert aqua["values"][4] is None and aqua["values"][20] is not None
