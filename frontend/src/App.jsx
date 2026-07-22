/*
  TransitFlow — Frontend (Day 3)

  New in this version:
  - Station autocomplete (pulled live from /stations on the backend)
  - Rain toggle checkbox, wired to the backend's is_raining field
  - Leaflet map showing the selected route's path

  Requires: npm install leaflet react-leaflet   (see SETUP.md)
*/

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet's default marker icons don't load correctly with Vite by default —
// this fixes that with icons served from a CDN.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BACKEND_URL = "http://127.0.0.1:8000";
const MUMBAI_CENTER = [19.076, 72.8777];

function App() {
  const [stations, setStations] = useState({});
  const [origin, setOrigin] = useState("borivali");
  const [destination, setDestination] = useState("churchgate");
  const [priority, setPriority] = useState("fastest");
  const [isRaining, setIsRaining] = useState(false);

  const [results, setResults] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load the station list once on page load, for the autocomplete dropdowns
  useEffect(() => {
    fetch(`${BACKEND_URL}/stations`)
      .then((res) => res.json())
      .then(setStations)
      .catch(() => setError("Could not load station list. Is the backend running?"));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedIndex(0);

    try {
      const response = await fetch(`${BACKEND_URL}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, priority, is_raining: isRaining }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || `Backend returned status ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message || "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  const selectedRoute = results?.options?.[selectedIndex];

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>TransitFlow</h1>
      <p style={{ color: "#555" }}>Compare local train, metro, and road routes across Mumbai.</p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 24 }}
      >
        <label>
          Origin
          <input
            list="station-list"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            style={{ display: "block", padding: 8, width: 180 }}
          />
        </label>

        <label>
          Destination
          <input
            list="station-list"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={{ display: "block", padding: 8, width: 180 }}
          />
        </label>

        {/* Shared autocomplete list for both inputs. Note: values are station IDs
            (e.g. "borivali"), matching what the backend expects. A more polished
            version would map display names -> IDs, but IDs are readable enough here. */}
        <datalist id="station-list">
          {Object.entries(stations).map(([id, s]) => (
            <option key={id} value={id}>{s.name}</option>
          ))}
        </datalist>

        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ display: "block", padding: 8 }}
          >
            <option value="fastest">Fastest</option>
            <option value="cheapest">Cheapest</option>
            <option value="comfortable">Most Comfortable</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={isRaining}
            onChange={(e) => setIsRaining(e.target.checked)}
          />
          It's raining
        </label>

        <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
          {loading ? "Finding routes..." : "Find Routes"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {results && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {/* Route list */}
          <div style={{ flex: "1 1 320px", minWidth: 300 }}>
            <h2 style={{ fontSize: 18 }}>
              {results.origin} → {results.destination}
              {results.is_raining && " 🌧️"}
            </h2>
            {results.options.map((option, i) => (
              <div
                key={i}
                onClick={() => setSelectedIndex(i)}
                style={{
                  border: i === selectedIndex ? "2px solid #2563eb" : "1px solid #ddd",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 10,
                  cursor: "pointer",
                  background: i === selectedIndex ? "#eff6ff" : "white",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", fontSize: 16 }}>{option.mode}</h3>
                <p style={{ margin: "2px 0", fontSize: 14 }}>
                  ⏱ {option.time_minutes} min &nbsp;•&nbsp; ₹{option.cost_rupees} &nbsp;•&nbsp; Comfort {option.comfort_score}/5
                </p>
                <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: 13 }}>{option.explanation}</p>
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{ flex: "1 1 400px", minWidth: 300, height: 500 }}>
            <MapContainer center={MUMBAI_CENTER} zoom={11} style={{ height: "100%", width: "100%", borderRadius: 8 }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {selectedRoute && (
                <>
                  <Polyline
                    positions={selectedRoute.path.map((p) => [p.lat, p.lon])}
                    pathOptions={{ color: "#2563eb", weight: 4 }}
                  />
                  {selectedRoute.path.map((p) => (
                    <Marker key={p.id} position={[p.lat, p.lon]}>
                      <Popup>{p.name}</Popup>
                    </Marker>
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
