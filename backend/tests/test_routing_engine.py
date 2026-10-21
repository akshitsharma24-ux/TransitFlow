"""Unit tests for app/routing_engine.py (graph, fares, crowding, ranking)."""

import networkx as nx
import pytest

from app import routing_engine as re_


# --- Fare logic ---------------------------------------------------------

@pytest.mark.parametrize("line, hops, expected", [
    ("Yellow Line", 16, 40),   # full line, calibrated against the real fare
    ("Red Line", 13, 40),      # full line, calibrated against the real fare
    ("Yellow Line", 1, 10),    # shortest ride still pays the first slab
    ("Yellow Line", 4, 10),    # last hop of the first band (band = 5)
    ("Yellow Line", 5, 20),    # first hop of the second band
    ("Yellow Line", 100, 50),  # capped at 50
    ("Aqua Line", 26, 80),     # capped at 80
])
def test_metro_slab_fare(line, hops, expected):
    assert re_.metro_slab_fare(line, hops) == expected


def test_metro_slab_fare_never_decreases_with_distance():
    for line in re_.METRO_FARE_PARAMS:
        fares = [re_.metro_slab_fare(line, h) for h in range(1, 40)]
        assert fares == sorted(fares)


def test_fare_pass_insight_for_train_and_for_road_only():
    insight = re_.fare_pass_insight(["train", "train"], 30)
    assert insight["mode"] == "train"
    assert insight["monthly_pass_cost"] == 500
    assert insight["breakeven_commute_days"] == round((500 / 30) / 2, 1)
    assert re_.fare_pass_insight(["road"], 80) is None
    assert re_.fare_pass_insight(["train"], 0) is None


# --- Graph construction -------------------------------------------------

def test_graph_size_matches_seed_data():
    assert len(re_.STATION_INFO) == 112
    assert re_.GRAPH.number_of_nodes() == 126
    assert re_.GRAPH.number_of_edges() == 364


def test_graph_is_one_connected_component():
    assert nx.number_weakly_connected_components(re_.GRAPH) == 1


def test_every_edge_has_non_negative_weights():
    # Dijkstra (and therefore Yen's algorithm) is only correct for
    # non-negative weights.
    for _, _, attr in re_.GRAPH.edges(data=True):
        assert attr["time_minutes"] >= 0
        assert attr["cost_rupees"] >= 0
        assert 1 <= attr["comfort_score"] <= 5


def test_comfort_objective_weight_is_between_zero_and_one():
    for _, _, attr in re_.GRAPH.edges(data=True):
        assert 0 <= re_._edge_weight(attr, "comfort") <= 1


def test_station_mode_nodes_and_transfer_edges_exist_at_hub():
    # Dadar (Western) has a train layer and a road/bus layer, so the engine
    # must have generated a same-station transfer between them.
    assert ("dadar", "train") in re_.GRAPH
    assert ("dadar", "bus") in re_.GRAPH
    transfer = re_.GRAPH.get_edge_data(("dadar", "train"), ("dadar", "bus"))
    assert any(e["mode"] == "transfer" and e["time_minutes"] == 5 for e in transfer.values())


def test_interchange_expanded_in_both_directions():
    a = re_.GRAPH.get_edge_data(("andheri", "train"), ("andheri_west", "metro"))
    b = re_.GRAPH.get_edge_data(("andheri_west", "metro"), ("andheri", "train"))
    assert a and b
    assert all(e["time_minutes"] == 6 for e in a.values())


# --- Leg building -------------------------------------------------------

def test_build_legs_groups_same_line_hops_into_one_ride():
    path = [("churchgate", "train"), ("marine_lines", "train"), ("charni_road", "train")]
    legs, stations, modes, comfort, total_time, total_cost = re_._build_legs(path, "time")
    assert len(legs) == 1
    assert legs[0]["type"] == "ride"
    assert legs[0]["hop_count"] == 2
    assert legs[0]["from_station"] == "churchgate" and legs[0]["to_station"] == "charni_road"
    assert stations == ["churchgate", "marine_lines", "charni_road"]
    assert total_cost >= re_.MINIMUM_FARE


def test_build_legs_separates_ride_and_walk():
    path = [("andheri", "train"), ("andheri_west", "metro"), ("lower_oshiwara", "metro")]
    legs, *_ = re_._build_legs(path, "time")
    assert [l["type"] for l in legs] == ["walk", "ride"]
    assert legs[0]["cost_rupees"] == 0
    assert legs[1]["line"] == "Yellow Line"


# --- Route generation ---------------------------------------------------

def test_explore_routes_returns_distinct_physical_signatures():
    candidates = re_.explore_routes("andheri", "churchgate")
    assert len(candidates) >= 2
    signatures = [
        tuple((l["mode"], l["line"], l["from_station"], l["to_station"])
              for l in c["legs"] if l["type"] == "ride")
        for c in candidates
    ]
    assert len(signatures) == len(set(signatures))


def test_explore_routes_unknown_station_gives_empty_list():
    assert re_.explore_routes("nowhere", "churchgate") == []


def test_every_candidate_starts_and_ends_at_requested_stations():
    for c in re_.explore_routes("csmt", "thane"):
        assert c["station_path"][0] == "csmt"
        assert c["station_path"][-1] == "thane"


def test_route_computation_is_deterministic():
    a = re_.get_ranked_routes("churchgate", "dahanukarwadi", "fastest", False, 9, "weekday")
    b = re_.get_ranked_routes("churchgate", "dahanukarwadi", "fastest", False, 9, "weekday")
    assert a == b


# --- Ranking ------------------------------------------------------------

PAIRS = [("churchgate", "dahanukarwadi"), ("andheri", "borivali"), ("csmt", "thane")]


@pytest.mark.parametrize("origin, destination", PAIRS)
def test_fastest_sorted_by_time(origin, destination):
    routes = re_.get_ranked_routes(origin, destination, "fastest", False, 9, "weekday")
    times = [r["time_minutes"] for r in routes]
    assert times == sorted(times)


@pytest.mark.parametrize("origin, destination", PAIRS)
def test_cheapest_sorted_by_cost(origin, destination):
    routes = re_.get_ranked_routes(origin, destination, "cheapest", False, 9, "weekday")
    costs = [r["cost_rupees"] for r in routes]
    assert costs == sorted(costs)


@pytest.mark.parametrize("origin, destination", PAIRS)
def test_comfortable_sorted_by_descending_comfort(origin, destination):
    routes = re_.get_ranked_routes(origin, destination, "comfortable", False, 9, "weekday")
    comfort = [r["comfort_score"] for r in routes]
    assert comfort == sorted(comfort, reverse=True)


def test_rain_penalty_never_improves_a_route_score():
    dry = re_.get_ranked_routes("andheri", "churchgate", "fastest", False, 9, "weekday")
    wet = re_.get_ranked_routes("andheri", "churchgate", "fastest", True, 9, "weekday")
    by_key = lambda rs: {(r["time_minutes"], r["cost_rupees"], r["comfort_score"]): r["score"] for r in rs}
    dry_scores, wet_scores = by_key(dry), by_key(wet)
    assert dry_scores.keys() == wet_scores.keys()
    assert all(wet_scores[k] >= dry_scores[k] for k in dry_scores)


# --- Crowd model --------------------------------------------------------

@pytest.mark.parametrize("score, level", [
    (0.00, "Comfortable"), (0.29, "Comfortable"), (0.30, "Moderate"),
    (0.51, "Moderate"), (0.52, "Busy"), (0.74, "Busy"), (0.75, "Packed"), (1.0, "Packed"),
])
def test_crowd_level_thresholds(score, level):
    assert re_.crowd_level_for_score(score) == level


def test_weekday_peak_is_busier_than_night_on_western_line():
    peak = re_.crowd_score_for("Western Line", "train", 18, "weekday")
    night = re_.crowd_score_for("Western Line", "train", 3, "weekday")
    assert peak > night


def test_crowd_score_stays_within_zero_and_one():
    for line, mode in [("Western Line", "train"), ("Aqua Line", "metro"), (None, "bus")]:
        for day in ("weekday", "weekend"):
            for hour in range(24):
                assert 0.0 <= re_.crowd_score_for(line, mode, hour, day) <= 1.0


def test_predict_crowd_has_24_hour_curve():
    route = re_.get_ranked_routes("andheri", "churchgate", "fastest", False, 9, "weekday")[0]
    forecast = re_.predict_crowd(route["legs"], 9, "weekday")
    assert [h["hour"] for h in forecast["hourly"]] == list(range(24))
    assert forecast["level"] in {"Comfortable", "Moderate", "Busy", "Packed"}


def test_predict_crowd_for_walk_only_route():
    forecast = re_.predict_crowd([{"type": "walk"}], 9, "weekday")
    assert forecast["level"] == "Comfortable" and forecast["hourly"] == []
