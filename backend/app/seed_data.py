"""
TransitFlow — Seed Data (Day 7)

MAJOR EXPANSION: real station lists for the Mumbai Suburban Western Line
and all three Mumbai Metro lines you asked for (Yellow/Line 2A, Red/Line 7,
Aqua/Line 3), sourced from Wikipedia and official metro info pages, not
guessed. Run this to (re)build the database:

    python -m app.seed_data

--- Honest notes on data accuracy ---

1. STATION ORDER AND NAMES are real (Western Line Churchgate-Virar, 29
   stations; Yellow Line 2A, 17 stations; Red Line 7, 14 stations; Aqua
   Line 3, 27 stations).

2. COORDINATES are computed by linearly interpolating between a handful
   of real anchor points along each line (see ANCHOR dicts below) — NOT
   individually surveyed for every station. This gives a reasonable
   relative layout for the map, but isn't GPS-accurate. If you want
   precise coordinates before final submission, pull them from
   OpenStreetMap (Overpass API) or an official GTFS feed.

3. TIMINGS AND FARES per hop are estimated averages (e.g. ~2 min/hop
   metro, ~3 min/hop local train), calibrated to roughly match known
   end-to-end journey times, not scraped from a live timetable. State
   this plainly in your report, same as earlier data — it's completely
   normal for a project at this stage.

4. INTERCHANGES (walking transfers between different physical stations,
   e.g. Andheri Western Line -> Andheri West Metro) are estimated walk
   times based on real known distances/skywalks, not measured.
"""

from app.database import Base, engine, SessionLocal
from app.models import StationModel, EdgeModel, InterchangeModel, CrowdingRuleModel


# --- Line definitions: (station_id, display_name), in real physical order ---

WESTERN_LINE = [
    ("churchgate", "Churchgate"), ("marine_lines", "Marine Lines"), ("charni_road", "Charni Road"),
    ("grant_road", "Grant Road"), ("mumbai_central", "Mumbai Central"), ("mahalaxmi", "Mahalaxmi"),
    ("lower_parel", "Lower Parel"), ("prabhadevi", "Prabhadevi"), ("dadar", "Dadar"),
    ("matunga_road", "Matunga Road"), ("mahim", "Mahim Junction"), ("bandra", "Bandra"),
    ("khar_road", "Khar Road"), ("santacruz", "Santacruz"), ("vile_parle", "Vile Parle"),
    ("andheri", "Andheri"), ("jogeshwari", "Jogeshwari"), ("ram_mandir", "Ram Mandir"),
    ("goregaon", "Goregaon"), ("malad", "Malad"), ("kandivali", "Kandivali"),
    ("borivali", "Borivali"), ("dahisar", "Dahisar"), ("mira_road", "Mira Road"),
    ("bhayandar", "Bhayandar"), ("naigaon", "Naigaon"), ("vasai_road", "Vasai Road"),
    ("nalasopara", "Nalasopara"), ("virar", "Virar"),
]

YELLOW_LINE = [  # Metro Line 2A: Dahisar East -> Andheri West
    ("dahisar_east", "Dahisar East"), ("anand_nagar", "Anand Nagar"), ("kandarpada", "Kandarpada"),
    ("mandapeshwar", "Mandapeshwar"), ("eksar", "Eksar"), ("borivali_west", "Borivali West"),
    ("pahadi_eksar", "Pahadi Eksar"), ("kandivali_west", "Kandivali West"),
    ("dahanukarwadi", "Dahanukarwadi"), ("valnai", "Valnai"), ("malad_west", "Malad West"),
    ("lower_malad", "Lower Malad"), ("pahadi_goregaon", "Pahadi Goregaon"),
    ("goregaon_west", "Goregaon West"), ("oshiwara", "Oshiwara"), ("lower_oshiwara", "Lower Oshiwara"),
    ("andheri_west", "Andheri West"),
]

RED_LINE = [  # Metro Line 7: Dahisar East -> Gundavali (Andheri East). Shares dahisar_east with Yellow.
    ("dahisar_east", "Dahisar East"), ("ovaripada", "Ovaripada"), ("national_park", "National Park"),
    ("devipada", "Devipada"), ("magathane", "Magathane"), ("poisar", "Poisar"), ("akurli", "Akurli"),
    ("kurar", "Kurar"), ("dindoshi", "Dindoshi"), ("aarey", "Aarey"), ("goregaon_e", "Goregaon East"),
    ("jogeshwari_e", "Jogeshwari East"), ("shankarwadi", "Shankarwadi"), ("gundavali", "Gundavali (Andheri East)"),
]

AQUA_LINE = [  # Metro Line 3: Cuffe Parade -> Aarey JVLR (fully underground except the last station)
    ("cuffe_parade", "Cuffe Parade"), ("vidhan_bhavan", "Vidhan Bhavan"), ("churchgate_metro", "Churchgate (Metro)"),
    ("hutatma_chowk", "Hutatma Chowk"), ("csmt_metro", "CSMT (Metro)"), ("kalbadevi", "Kalbadevi"),
    ("girgaon", "Girgaon"), ("grant_road_metro", "Grant Road (Metro)"), ("mumbai_central_metro", "Mumbai Central (Metro)"),
    ("mahalaxmi_metro", "Mahalaxmi (Metro)"), ("science_museum", "Science Museum"),
    ("acharya_atre_chowk", "Acharya Atre Chowk"), ("worli", "Worli"), ("siddhivinayak", "Siddhivinayak"),
    ("dadar_metro", "Dadar (Metro)"), ("shitladevi", "Shitladevi"), ("dharavi", "Dharavi"),
    ("bkc", "Bandra Kurla Complex"), ("bandra_colony", "Bandra Colony"), ("santacruz_metro", "Santacruz (Metro)"),
    ("csia_t1", "CSIA Terminal 1"), ("sahar_road", "Sahar Road"), ("csia_t2", "CSIA Terminal 2"),
    ("marol_naka", "Marol Naka"), ("midc", "MIDC"), ("seepz", "SEEPZ"), ("aarey_jvlr", "Aarey JVLR"),
]

LINES = [
    ("Western Line", WESTERN_LINE, "train"),
    ("Yellow Line", YELLOW_LINE, "metro"),
    ("Red Line", RED_LINE, "metro"),
    ("Aqua Line", AQUA_LINE, "metro"),
]

# Real anchor coordinates (lat, lon) for a handful of stations per line —
# everything else on that line is interpolated between these by position.
ANCHORS = {
    "Western Line": {
        "churchgate": (18.9354, 72.8276), "dadar": (19.0178, 72.8478), "bandra": (19.0596, 72.8295),
        "andheri": (19.1197, 72.8468), "goregaon": (19.1653, 72.8494), "malad": (19.1863, 72.8484),
        "borivali": (19.2307, 72.8567), "dahisar": (19.2544, 72.8567), "virar": (19.4550, 72.8110),
    },
    "Yellow Line": {
        "dahisar_east": (19.2511, 72.8670), "dahanukarwadi": (19.2062, 72.8347),
        "malad_west": (19.1874, 72.8397), "andheri_west": (19.1291, 72.8314),
    },
    "Red Line": {
        "dahisar_east": (19.2511, 72.8670), "aarey": (19.1547, 72.8781),
        "goregaon_e": (19.1653, 72.8697), "gundavali": (19.1150, 72.8552),
    },
    "Aqua Line": {
        "cuffe_parade": (18.9142, 72.8215), "churchgate_metro": (18.9354, 72.8276),
        "dadar_metro": (19.0178, 72.8478), "bkc": (19.0662, 72.8681),
        "santacruz_metro": (19.0822, 72.8412), "seepz": (19.1197, 72.8697),
        "aarey_jvlr": (19.1547, 72.8781),
    },
}


def interpolate_positions(ordered_stops, anchors):
    """
    Given [(id, name), ...] in real physical order and a dict of
    id -> (lat, lon) for SOME of those stations, linearly interpolates
    positions for every station between the nearest anchors on either
    side. First and last stops must be anchors (enforced by ANCHORS above).
    """
    ids = [sid for sid, _ in ordered_stops]
    anchor_idx = sorted(ids.index(sid) for sid in anchors if sid in ids)

    positions = {}
    for seg_start, seg_end in zip(anchor_idx, anchor_idx[1:]):
        lat1, lon1 = anchors[ids[seg_start]]
        lat2, lon2 = anchors[ids[seg_end]]
        span = seg_end - seg_start
        for i in range(seg_start, seg_end + 1):
            frac = (i - seg_start) / span if span else 0
            positions[ids[i]] = (lat1 + (lat2 - lat1) * frac, lon1 + (lon2 - lon1) * frac)

    return positions


def fare_slab(hop_index: int, per_hop: int, slab_size: int = 10, cap: int = 40) -> int:
    """Rough fare-slab approximation: cost increases every `slab_size` hops, capped."""
    return min(cap, per_hop * (1 + hop_index // slab_size))


STATIONS = {}
RAW_EDGES = []  # (from, to, mode, line, time_minutes, cost_rupees, comfort_score)

for line_name, stops, mode in LINES:
    positions = interpolate_positions(stops, ANCHORS[line_name])

    for sid, name in stops:
        lat, lon = positions[sid]
        # dahisar_east is shared between Yellow and Red — don't overwrite with a slightly different value
        STATIONS.setdefault(sid, {"name": name, "lat": lat, "lon": lon})

    per_hop_time = 3 if mode == "train" else 2
    per_hop_cost = 5 if mode == "train" else 10
    comfort = {"train": 2, "metro": 4}[mode]
    if line_name == "Aqua Line":
        comfort = 4.5  # newest, least crowded of the three metro lines

    for i in range(len(stops) - 1):
        (from_id, _), (to_id, _) = stops[i], stops[i + 1]
        cost = fare_slab(i, per_hop_cost)
        RAW_EDGES.append((from_id, to_id, mode, line_name, per_hop_time, cost, comfort))

# --- Bus and road data (unchanged core corridor from Day 4, ids still match) ---
RAW_EDGES += [
    ("borivali", "malad", "road", None, 20, 80, 5),
    ("malad", "andheri", "road", None, 20, 90, 5),
    ("andheri", "vile_parle", "road", None, 12, 50, 5),
    ("vile_parle", "bandra", "road", None, 20, 90, 5),
    ("bandra", "dadar", "road", None, 20, 80, 5),
    ("dadar", "churchgate", "road", None, 20, 70, 5),
    ("borivali", "churchgate", "road", None, 90, 380, 5),
    ("andheri", "churchgate", "road", None, 70, 250, 5),
    ("borivali", "andheri", "road", None, 35, 160, 5),

    ("borivali", "malad", "bus", None, 18, 10, 3),
    ("malad", "andheri", "bus", None, 20, 10, 3),
    ("andheri", "vile_parle", "bus", None, 10, 8, 3),
    ("vile_parle", "bandra", "bus", None, 18, 10, 3),
    ("bandra", "dadar", "bus", None, 18, 10, 3),
    ("dadar", "churchgate", "bus", None, 20, 10, 3),
    ("borivali", "andheri", "bus", None, 45, 25, 3),
]

# --- Interchanges: walking transfers between DIFFERENT physical stations ---
# (station_a, station_b, walk_minutes) — real known interchange points.
INTERCHANGES = [
    ("churchgate", "churchgate_metro", 6),
    ("grant_road", "grant_road_metro", 6),
    ("mumbai_central", "mumbai_central_metro", 6),
    ("mahalaxmi", "mahalaxmi_metro", 6),
    ("dadar", "dadar_metro", 7),
    ("santacruz", "santacruz_metro", 6),
    ("bandra", "bandra_colony", 12),
    ("bandra", "bkc", 15),
    ("andheri", "andheri_west", 6),   # matches the Churchgate -> Andheri -> Yellow Line example
    ("andheri", "gundavali", 8),      # via footover bridge / skywalk
    ("goregaon", "goregaon_e", 6),
    ("jogeshwari", "jogeshwari_e", 6),
    ("malad", "malad_west", 7),
    ("borivali", "borivali_west", 7),
    ("aarey", "aarey_jvlr", 8),
]

CROWDING_RULES = [
    ("train", 8, 11, "weekday", 0.35),
    ("train", 18, 21, "weekday", 0.35),
    ("bus", 8, 11, "weekday", 0.15),
    ("bus", 18, 21, "weekday", 0.15),
    ("metro", 8, 10, "weekday", 0.10),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        db.query(EdgeModel).delete()
        db.query(InterchangeModel).delete()
        db.query(CrowdingRuleModel).delete()
        db.query(StationModel).delete()
        db.commit()

        for station_id, attrs in STATIONS.items():
            db.add(StationModel(id=station_id, name=attrs["name"], lat=attrs["lat"], lon=attrs["lon"]))

        for frm, to, mode, line, time_min, cost, comfort in RAW_EDGES:
            db.add(EdgeModel(from_station_id=frm, to_station_id=to, mode=mode, line=line,
                              time_minutes=time_min, cost_rupees=cost, comfort_score=comfort))
            db.add(EdgeModel(from_station_id=to, to_station_id=frm, mode=mode, line=line,
                              time_minutes=time_min, cost_rupees=cost, comfort_score=comfort))

        for a, b, walk_min in INTERCHANGES:
            db.add(InterchangeModel(from_station_id=a, to_station_id=b, walk_minutes=walk_min))

        for mode, start_hour, end_hour, day_type, penalty in CROWDING_RULES:
            db.add(CrowdingRuleModel(mode=mode, start_hour=start_hour, end_hour=end_hour,
                                      day_type=day_type, crowd_penalty=penalty))

        db.commit()
        print(f"Seeded {len(STATIONS)} stations, {len(RAW_EDGES) * 2} directional edges, "
              f"{len(INTERCHANGES)} interchanges, {len(CROWDING_RULES)} crowding rules into transitflow.db")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
