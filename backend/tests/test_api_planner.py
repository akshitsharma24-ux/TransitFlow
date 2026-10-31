"""HTTP-level tests for /plan, /plan/day, /live, /crowd and /chat."""

import copy

import pytest

PLAN = {"origin": "borivali", "destination": "churchgate", "date": None, "time": "08:45",
        "when": "depart", "preference": "balanced", "is_raining": False, "avoid": []}


def future_date(client):
    """A Monday inside the allowed window, whatever today's date is."""
    from datetime import timedelta
    from app import crowd_model as cm
    day = cm.now_ist().date() + timedelta(days=3)
    while day.weekday() != 0:
        day += timedelta(days=1)
    return day.isoformat()


@pytest.fixture()
def plan_body(client):
    body = copy.deepcopy(PLAN)
    body["date"] = future_date(client)
    return body


# --- /plan -----------------------------------------------------------------------

def test_plan_returns_a_full_itinerary(client, plan_body):
    res = client.post("/api/plan", json=plan_body)
    assert res.status_code == 200
    data = res.json()
    assert data["origin"]["id"] == "borivali" and data["destination"]["id"] == "churchgate"
    assert data["day_type"] == "weekday"
    rec = data["recommended"]
    assert rec["depart"].endswith("+05:30") and rec["steps"] and rec["path"] and rec["legs"]
    assert {"level", "score", "index", "seat_chance"} <= rec["crowd"].keys()
    assert data["advisor"]["window"] and data["advisor"]["insight"]


def test_plan_without_time_or_date_defaults_to_now(client):
    res = client.post("/api/plan", json={"origin": "andheri", "destination": "dadar"})
    assert res.status_code == 200
    assert res.json()["recommended"]["steps"]


def test_plan_arrive_mode_meets_the_deadline(client, plan_body):
    plan_body.update({"when": "arrive", "time": "10:00", "origin": "borivali", "destination": "lower_parel", "avoid": ["road"]})
    res = client.post("/api/plan", json=plan_body)
    assert res.status_code == 200
    assert res.json()["recommended"]["arrive"][11:16] <= "09:55"


@pytest.mark.parametrize("change, status", [
    ({"origin": "nowhere"}, 400), ({"destination": "nowhere"}, 400), ({"destination": "borivali"}, 400),
    ({"time": "25:00"}, 422), ({"time": "8:45"}, 422), ({"date": "2026-13-45"}, 422), ({"date": "tomorrow"}, 422),
    ({"date": "1999-01-01"}, 422), ({"date": "2099-01-01"}, 422), ({"preference": "scenic"}, 422),
    ({"when": "whenever"}, 422), ({"avoid": ["helicopter"]}, 422),
    ({"avoid": ["train", "metro", "bus", "road"]}, 404),
])
def test_plan_rejects_bad_input(client, plan_body, change, status):
    res = client.post("/api/plan", json={**plan_body, **change})
    assert res.status_code == status, res.text


def test_plan_station_ids_are_case_insensitive(client, plan_body):
    res = client.post("/api/plan", json={**plan_body, "origin": "BORIVALI", "destination": " Churchgate "})
    assert res.status_code == 200


# --- /plan/day -------------------------------------------------------------------------

def day_body(client):
    return {"origin": "borivali", "date": future_date(client), "start_time": "08:30",
            "stops": [{"station": "lower_parel", "stay_minutes": 540}, {"station": "andheri", "stay_minutes": 60}],
            "return_to_origin": True, "preference": "balanced", "is_raining": False, "avoid": ["road"]}


def test_day_plan_returns_trips_and_stays(client):
    res = client.post("/api/plan/day", json=day_body(client))
    assert res.status_code == 200
    data = res.json()
    assert [i["kind"] for i in data["items"]] == ["trip", "stay", "trip", "stay", "trip"]
    assert data["summary"]["trips"] == 3 and data["summary"]["cost_rupees"] > 0
    assert data["pass_advice"]["text"]


@pytest.mark.parametrize("change, status", [
    ({"stops": []}, 422), ({"start_time": "late"}, 422), ({"origin": "nowhere"}, 400),
    ({"stops": [{"station": "borivali", "stay_minutes": 10}]}, 400),
    ({"stops": [{"station": "dadar", "stay_minutes": -5}]}, 422),
    ({"stops": [{"station": "dadar", "leave_at": "25:61"}]}, 422),
    ({"stops": [{"station": "dadar"}] * 9}, 422),
    ({"stops": [{"station": "dadar", "stay_minutes": 5}, {"station": "dadar", "stay_minutes": 5}]}, 422),
])
def test_day_plan_rejects_bad_input(client, change, status):
    res = client.post("/api/plan/day", json={**day_body(client), **change})
    assert res.status_code == status, res.text


# --- /live and crowd reports ----------------------------------------------------------

def test_live_snapshot_endpoint(client):
    res = client.get("/api/live")
    assert res.status_code == 200
    data = res.json()
    assert data["as_of"].endswith("+05:30") and len(data["lines"]) == 7 and "sources" in data


def test_live_line_and_station_endpoints(client):
    assert len(client.get("/api/live/line/Harbour Line").json()["stations"]) == 25
    assert client.get("/api/live/line/Monorail").status_code == 404
    assert client.get("/api/live/station/dadar").json()["station"] == "Dadar"
    assert client.get("/api/live/station/atlantis").status_code == 404


def test_report_then_cooldown_then_validation(client):
    ok = client.post("/api/crowd/report", json={"station": "mahim", "level": "Packed"}, headers={"user-agent": "t1"})
    assert ok.status_code == 200 and ok.json()["status"]["reports_last_hour"] >= 1
    again = client.post("/api/crowd/report", json={"station": "mahim", "level": "Busy"}, headers={"user-agent": "t1"})
    assert again.status_code == 429
    other = client.post("/api/crowd/report", json={"station": "mahim", "level": "Busy"}, headers={"user-agent": "t2"})
    assert other.status_code == 200
    assert client.post("/api/crowd/report", json={"station": "atlantis", "level": "Busy"}).status_code == 400
    assert client.post("/api/crowd/report", json={"station": "mahim", "level": "Jammed"}).status_code == 422


def test_atlas_endpoint_and_parameters(client):
    data = client.get("/api/crowd/atlas?day_type=weekend&direction=outbound").json()
    assert data["day_type"] == "weekend" and data["direction"] == "outbound" and len(data["slots"]) == 48
    assert client.get("/api/crowd/atlas?day_type=holiday").status_code == 422


# --- /chat ---------------------------------------------------------------------------------

def test_chat_round_trip_with_context(client):
    first = client.post("/api/chat", json={"message": "Borivali to Churchgate tomorrow 8:45 am"}).json()
    assert first["intent"] == "plan" and first["card"]
    second = client.post("/api/chat", json={"message": "cheapest?", "context": first["context"]}).json()
    assert second["entities"]["preference"] == "cheapest"


@pytest.mark.parametrize("payload", [{"message": ""}, {"message": "x" * 501}, {}])
def test_chat_rejects_bad_messages(client, payload):
    assert client.post("/api/chat", json=payload).status_code == 422


def test_chat_survives_hostile_input(client):
    for message in ["'; DROP TABLE stations; --", "<script>alert(1)</script>", "\u0000\u0001", "a" * 400, "🚆🚆🚆"]:
        res = client.post("/api/chat", json={"message": message})
        assert res.status_code == 200 and res.json()["reply"]


# --- The original endpoints still work on the bigger network ---------------------------------

def test_route_endpoint_serves_the_new_lines(client):
    res = client.post("/api/route", json={"origin": "csmt_harbour", "destination": "panvel", "priority": "fastest",
                                            "hour": 9, "day_type": "weekday"})
    assert res.status_code == 200
    assert res.json()["options"][0]["mode"] == "Harbour Line"
    res = client.post("/api/route", json={"origin": "versova", "destination": "ghatkopar_metro", "priority": "fastest"})
    assert res.status_code == 200 and res.json()["options"][0]["mode"] == "Blue Line"
