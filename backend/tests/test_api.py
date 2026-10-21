"""Integration tests for the FastAPI endpoints (request validation to response shape)."""

import copy

import pytest


# --- Read-only endpoints ------------------------------------------------

def test_health_endpoint(client):
    res = client.get("/api/")
    assert res.status_code == 200
    assert res.json()["stations_loaded"] == 112


def test_stations_endpoint_lists_all_stations_with_services(client):
    res = client.get("/api/stations")
    assert res.status_code == 200
    stations = res.json()
    assert len(stations) == 112
    assert {"name", "lat", "lon", "serves"} <= stations["andheri"].keys()
    assert {"mode": "train", "line": "Western Line"} in stations["andheri"]["serves"]


def test_network_endpoint_has_five_lines(client):
    res = client.get("/api/network")
    assert res.status_code == 200
    lines = res.json()["lines"]
    assert set(lines) == {"Western Line", "Central Line", "Yellow Line", "Red Line", "Aqua Line"}
    assert all(l["segments"] and l["stations"] for l in lines.values())


# --- POST /api/route: happy path ----------------------------------------

@pytest.mark.parametrize("priority", ["fastest", "cheapest", "comfortable"])
def test_route_returns_ranked_options_for_each_priority(client, route_body, priority):
    body = {**route_body, "priority": priority}
    res = client.post("/api/route", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["priority"] == priority
    assert 1 <= len(data["options"]) <= 6
    key = {"fastest": lambda o: o["time_minutes"],
           "cheapest": lambda o: o["cost_rupees"],
           "comfortable": lambda o: -o["comfort_score"]}[priority]
    values = [key(o) for o in data["options"]]
    assert values == sorted(values)


def test_route_option_has_all_documented_fields(client, route_body):
    option = client.post("/api/route", json=route_body).json()["options"][0]
    for field in ("mode", "time_minutes", "cost_rupees", "comfort_score", "score",
                  "explanation", "path", "legs", "via", "crowd_forecast", "fare_pass"):
        assert field in option
    assert len(option["crowd_forecast"]["hourly"]) == 24
    assert option["time_minutes"] > 0 and option["cost_rupees"] >= 5


def test_route_options_are_physically_distinct(client, route_body):
    body = {**route_body, "origin": "churchgate", "destination": "dahanukarwadi"}
    options = client.post("/api/route", json=body).json()["options"]
    signatures = [
        tuple((l["mode"], l["line"], l["from_station"]["id"], l["to_station"]["id"])
              for l in o["legs"] if l["type"] == "ride")
        for o in options
    ]
    assert len(signatures) == len(set(signatures))


def test_route_accepts_rain_and_weekend(client, route_body):
    body = {**route_body, "is_raining": True, "day_type": "weekend", "hour": 14}
    res = client.post("/api/route", json=body)
    assert res.status_code == 200
    assert res.json()["is_raining"] is True and res.json()["day_type"] == "weekend"


def test_route_defaults_hour_and_day_type_when_omitted(client):
    res = client.post("/api/route", json={"origin": "andheri", "destination": "churchgate"})
    assert res.status_code == 200
    data = res.json()
    assert 0 <= data["hour"] <= 23 and data["day_type"] in ("weekday", "weekend")


def test_route_station_ids_are_case_insensitive(client, route_body):
    res = client.post("/api/route", json={**route_body, "origin": "Andheri"})
    assert res.status_code == 200


def test_cross_line_route_between_central_and_aqua(client, route_body):
    res = client.post("/api/route", json={**route_body, "origin": "csmt", "destination": "thane"})
    assert res.status_code == 200 and res.json()["options"]


# --- POST /api/route: invalid input -------------------------------------

def test_unknown_origin_is_400(client, route_body):
    assert client.post("/api/route", json={**route_body, "origin": "atlantis"}).status_code == 400


def test_unknown_destination_is_400(client, route_body):
    assert client.post("/api/route", json={**route_body, "destination": "atlantis"}).status_code == 400


def test_same_origin_and_destination_is_400(client, route_body):
    assert client.post("/api/route", json={**route_body, "destination": "andheri"}).status_code == 400


def test_missing_origin_is_422(client, route_body):
    body = copy.deepcopy(route_body)
    del body["origin"]
    assert client.post("/api/route", json=body).status_code == 422


def test_unsupported_priority_is_422(client, route_body):
    assert client.post("/api/route", json={**route_body, "priority": "scenic"}).status_code == 422


@pytest.mark.parametrize("hour", [-1, 24, 42])
def test_hour_out_of_range_is_422(client, route_body, hour):
    assert client.post("/api/route", json={**route_body, "hour": hour}).status_code == 422


@pytest.mark.parametrize("hour", [0, 23])
def test_hour_boundaries_are_accepted(client, route_body, hour):
    assert client.post("/api/route", json={**route_body, "hour": hour}).status_code == 200


def test_unknown_day_type_is_422(client, route_body):
    assert client.post("/api/route", json={**route_body, "day_type": "holiday"}).status_code == 422


def test_non_integer_hour_is_422(client, route_body):
    assert client.post("/api/route", json={**route_body, "hour": "nine"}).status_code == 422


def test_empty_origin_is_400(client, route_body):
    assert client.post("/api/route", json={**route_body, "origin": ""}).status_code == 400
