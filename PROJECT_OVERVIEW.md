# TransitFlow — Project Overview

A handoff reference covering the whole system, intended so another developer or AI
can understand the project quickly.

TransitFlow is an academic mini-project (Sardar Patel Institute of Technology,
Group 57) mapped to **DSGT, DAA, Data Structures, DBMS**.

## What it is

A multi-criteria route-comparison web app for Mumbai's multi-modal public transit.
A user enters an origin + destination and a priority (fastest / cheapest /
comfortable), and gets a ranked set of genuinely distinct route options across
suburban rail, metro, bus, and road — each with time, fare, comfort, a predicted
crowd level, a step-by-step itinerary, and a map.

## Architecture

- **Backend**: Python 3.14, FastAPI + Uvicorn, SQLAlchemy ORM over SQLite,
  NetworkX for graph algorithms, Pydantic models. Runs on `http://127.0.0.1:8000`.
- **Frontend**: React 19 + Vite, Tailwind CSS, Framer Motion, Lenis (smooth
  scroll), MapLibre GL via react-map-gl. Runs on `http://localhost:5173`.
- The frontend calls the backend REST endpoints
  (`BASE_URL = VITE_API_URL || http://127.0.0.1:8000`).

---

## Backend (`backend/app/`)

**`database.py`** — SQLite engine via SQLAlchemy.
`DATABASE_URL = "sqlite:///./transitflow.db"`. Swappable to Postgres by changing
one line.

**`models.py`** — 4 tables:
- `StationModel` (id, name, lat, lon)
- `EdgeModel` (from_station_id, to_station_id, mode `train|metro|bus|road`, line,
  time_minutes, cost_rupees, comfort_score)
- `InterchangeModel` (from_station_id, to_station_id, walk_minutes) — walking
  transfers between *physically distinct* stations
- `CrowdingRuleModel` (mode, start_hour, end_hour, day_type, crowd_penalty)

**`seed_data.py`** — Defines the network and rebuilds the DB
(`python -m app.seed_data`):
- **5 lines**: Western Line (29 stations, train), Central Line (26, train),
  Yellow Line / Metro 2A (17, metro), Red Line / Metro 7 (14, metro),
  Aqua Line / Metro 3 (27, metro). **112 stations total.**
- Coordinates are **linearly interpolated** between a handful of real anchor
  points per line (NOT real GPS — a known accuracy limitation).
- Bus + road edges on a core corridor; **19 interchanges** (e.g. Dadar
  Western↔Central, Andheri↔Andheri West metro).
- Crowding rules (train peaks 8–11 & 18–21 weekday, etc.). Fares/times are
  calibrated estimates.

**`routing_engine.py`** — The core. Loaded once at import: `GRAPH`,
`STATION_INFO`, `STATION_SERVICES`, `CROWDING_RULES` (in-memory cache).
- **Graph model**: `nx.MultiDiGraph` where nodes are `(station_id, mode)` pairs.
  Real edges from `EdgeModel`; same-station mode transfers auto-generated;
  cross-station interchanges expanded across modes.
- **Pathfinding — `explore_routes()`**: For each objective (time / cost / comfort)
  it projects the multigraph to a simple `DiGraph` (best parallel edge per
  objective) and runs **Yen's k-shortest-paths** (`nx.shortest_simple_paths`,
  K=3 per objective per origin/dest mode-pair). This is **Dijkstra run repeatedly**
  with prior paths' edges excluded — it surfaces genuinely different alternatives
  (e.g. transfer at Andheri *vs.* Malad) instead of one best path. Candidates are
  deduped by physical ride signature `(mode, line, from, to)`.
- **`_build_legs()`**: groups consecutive same-line hops into ride legs and
  transfers into walk legs; applies fares (metro slab fares for Yellow/Red/Aqua
  via `metro_slab_fare`; flat per-hop for train/bus; ₹5 minimum fare); computes a
  time-weighted comfort score.
- **Scoring — `score_routes()`**: normalized weighted blend of time/cost/comfort
  per priority, plus line-aware rain penalties (Aqua immune, Yellow/Red small,
  train worst) and hour/day crowd penalties. **Important**: the final sort is
  *priority-led* — cheapest sorts by raw `cost_rupees`, fastest by `time_minutes`,
  comfortable by `-comfort_score`, with the blended `score` only breaking ties.
  (A pure-score sort previously let an outlier ₹300 car ride distort the
  normalization; this was fixed.)
- **Crowd prediction — `predict_crowd()`**: heuristic (not live data). A route's
  crowd = its busiest ride leg's score = per-line baseline + peak penalty. Returns
  level (Comfortable / Moderate / Busy / Packed), score, driver line, and a
  **24-hour `hourly` curve** used by the best-time-to-travel feature.
- Also: `fare_pass_insight()` (monthly-pass breakeven days).

**`main.py`** — FastAPI app + Pydantic response models. `MAX_OPTIONS = 6`.
Endpoints:
- `GET /` — health + station count
- `GET /stations` — all stations with coords + which lines serve them
- `GET /network` — full topology per line (segments + stations) for the overview map
- `POST /route` — body `{origin, destination, priority, is_raining, hour, day_type}`
  → ranked `options[]`, each with `mode`, `time_minutes`, `cost_rupees`,
  `comfort_score`, `score`, `explanation`, `legs[]`, `via[]`, `crowd_forecast`,
  `fare_pass`.

**`requirements.txt`**: fastapi, uvicorn, pydantic, networkx, sqlalchemy.

---

## Frontend (`frontend/src/`)

**`main.jsx`** → **`App.jsx`** (top-level orchestrator): holds all state (origin,
destination, priority, isRaining, hour, dayType, routeData, savedRoutes /
recentSearches in localStorage, command-palette open). Initializes **Lenis smooth
scroll** (`hooks/useLenis.js`). Reads/writes **shareable URL params**
(`?from=&to=&priority=&rain=`). Handles **Ctrl+K** (command palette) and
geolocation. Renders the page sections in order.

**`api.js`** — `fetchStations()`, `fetchNetwork()`, `calculateRoute()`.

**Page sections / components:**
- **`HeroCanvasAnimation.jsx`** — hero. A **270-frame JPG sequence**
  (`public/ezgif-jpg/`) drawn to a full-screen fixed canvas, scroll-scrubbed
  (a "moving metro" background). Premium foreground: animated badge, staggered
  gradient wordmark, embedded `SearchBoard`.
- **`SearchBoard.jsx`** — origin/dest `StationAutocomplete` + swap, priority
  toggle, hour slider, weekday/weekend, rain toggle, bookmark, submit; the
  `SavedRoutes` bar; "Near Me" geolocation (`utils/haversine.js`).
- **`StationAutocomplete.jsx`** — typeahead with per-station line tags.
- **`SavedRoutes.jsx`** — saved-commute + recent-search chips.
- **`BentoResultsGrid.jsx`** — results workspace: `RouteComparisonChart`
  (3 small-multiple bar charts), stacked route cards (crowd badge, "via" chips,
  expandable leg-by-leg itinerary, official ticket links, fare-pass banner),
  a sticky `MapPanel`, then `JourneyTimeline` + `BestTimeToTravel` for the
  selected route.
- **`RouteComparisonChart.jsx`** — three small-multiple bar panels (time / fare /
  comfort) with emphasis coloring (selected route accent, rest muted).
- **`MapPanel.jsx`** — per-route MapLibre map (CARTO **Voyager** light basemap),
  dark line-casing + colored line layers, animated markers, `cooperativeGestures`
  (no scroll hijack), scale bar, recenter button, loading veil + 4s fallback.
- **`NetworkMap.jsx`** — standalone full-system map: all 5 lines from `/network`,
  per-line toggle chips.
- **`JourneyTimeline.jsx`** — animated vertical step-by-step
  board → ride → transfer → arrive view.
- **`BestTimeToTravel.jsx`** — 24-hour crowd column chart, quietest/current hour
  highlighted, "busiest around 8–11am & 6–9pm" callout.
- **`CommandPalette.jsx`** (Ctrl+K quick actions), **`ScrollProgressBar.jsx`**,
  **`StatsStrip.jsx`** (112 stations / 4 modes / 5 lines / 19 hubs),
  **`FeaturesSection.jsx`**, **`HowItWorksSection.jsx`** (scroll-driven algorithm
  pipeline explainer), **`StatusStates.jsx`** (loading / empty / error),
  **`SplashScreen.jsx`** (1.6s intro).
- **`utils/lineColors.js`** — `LINE_CONFIGS` (color/icon/ticket per line; Western
  green, Central violet, Yellow, Red, Aqua blue), `getLineConfig`,
  `CROWD_CONFIGS` / `getCrowdConfig`, `getJourneyComplexity`,
  `OFFICIAL_TICKET_LINKS`.
- **`utils/haversine.js`** — nearest-station lookup for geolocation.
- **`hooks/useLenis.js`** — Lenis smooth-scroll setup (respects reduced-motion).

**Config**:
- `vite.config.js` — PWA plugin + **`optimizeDeps.exclude: ['maplibre-gl']`**.
  This last part is critical: Vite's dep pre-bundler otherwise mangles MapLibre's
  Web Worker URL and the worker 404s, hanging the map on "Loading…".
- `tailwind.config.js` — dark "metro tunnel" theme (navy `#0B1622`, cyan
  `#3FCFE0`, amber accents; per-line jewel-tone colors).
- `index.css` — glass-panel, aurora / gradient-text / shimmer keyframes.

**Key dependencies** (`package.json`): react 19, vite, tailwindcss,
framer-motion, gsap, lucide-react, maplibre-gl, react-map-gl, lenis,
vite-plugin-pwa.

---

## How to run

```bash
# Backend
cd backend && source venv/Scripts/activate   # Windows Git Bash
python -m app.seed_data          # first time / after changing seed_data.py
python -m uvicorn app.main:app --port 8000

# Frontend
cd frontend && npm install
npm run dev                      # http://localhost:5173
```

Note: after restarting the dev server, hard-refresh the browser (Ctrl+Shift+R) —
an already-open tab loses its HMR connection on restart.

---

## Data model / network summary

| Line          | Mode  | Stations | Notes                                   |
|---------------|-------|----------|-----------------------------------------|
| Western Line  | train | 29       | Churchgate → Virar                      |
| Central Line  | train | 26       | CSMT → Kalyan                           |
| Yellow (2A)   | metro | 17       | Dahisar East → Andheri West             |
| Red (7)       | metro | 14       | Dahisar East → Gundavali                |
| Aqua (3)      | metro | 27       | Cuffe Parade → Aarey JVLR (underground) |

Plus a bus + road corridor and 19 walking interchanges. **112 stations total.**

---

## Algorithm notes (for the DSGT / DAA / DS mapping)

- **Graph theory (DSGT)**: layered multigraph, `(station, mode)` nodes, transfer
  and interchange edges; multi-modal shortest paths.
- **Algorithms (DAA)**: Dijkstra's shortest path as the primitive; Yen's
  k-shortest-paths for distinct alternatives; multi-objective weighted scoring;
  min-max normalization.
- **Data structures (DS)**: adjacency structures + priority queues (via NetworkX /
  heapq internally); in-memory caches for the graph and crowding rules.
- **DBMS**: relational tables for stations, edges, interchanges, crowding rules,
  accessed through the SQLAlchemy ORM.

---

## Known limitations / tech debt

- Station coordinates are **interpolated**, not real GPS. Fares and times are
  **estimates**. Crowd prediction is a **heuristic**, not live ridership data.
- `frontend/src/components/RouteCard.jsx` is **dead code** (not imported anywhere).
- `backend/app/__pycache__/*.pyc` is committed to git (should be ignored).
- Repo-wide lint noise: unused `React` imports (React 19 JSX runtime doesn't need
  them) and a few `setState-in-effect` warnings — pre-existing, not blocking.
- No automated tests. The DB is functional but not fully normalized (line/fare
  data still lives on each edge rather than in dedicated `lines` / `fares` tables).

## Suggested next improvements

1. Normalize the DB (dedicated `lines` / `fares` tables, foreign keys) + an ER
   diagram — strengthens the DBMS claim.
2. Add **A\*** with a haversine heuristic and a live "nodes explored: Dijkstra vs
   A\*" comparison — strong DAA demonstration.
3. Real station GPS coordinates (OpenStreetMap / Overpass) — biggest visible
   accuracy win.
4. A `pytest` suite for the routing engine.
5. "Avoid a line" constraint routing; reverse-journey / round-trip fare.
