import { useState, useEffect } from "react";
import SearchBoard from "./components/SearchBoard";
import RouteCard from "./components/RouteCard";
import MapPanel from "./components/MapPanel";
import SavedRoutes from "./components/SavedRoutes";
import { EmptyState, ErrorState } from "./components/StatusStates";

const BACKEND_URL = "http://127.0.0.1:8000";

function App() {
  const [stations, setStations] = useState({});
  const [origin, setOrigin] = useState("borivali");
  const [destination, setDestination] = useState("churchgate");
  const [priority, setPriority] = useState("fastest");
  const [isRaining, setIsRaining] = useState(false);
  const [hour, setHour] = useState(new Date().getHours());
  const [dayType, setDayType] = useState(
    [0, 6].includes(new Date().getDay()) ? "weekend" : "weekday"
  );

  const [results, setResults] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/stations`)
      .then((res) => res.json())
      .then(setStations)
      .catch(() => setError("Could not load station list. Is the backend running?"));
  }, []);

  async function runSearch(o, d) {
    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedIndex(0);

    try {
      const response = await fetch(`${BACKEND_URL}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: o, destination: d, priority,
          is_raining: isRaining, hour, day_type: dayType,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || `Backend returned status ${response.status}`);
      }

      setResults(await response.json());
    } catch (err) {
      setError(err.message || "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(origin, destination);
  }

  function selectSavedRoute(o, d) {
    setOrigin(o);
    setDestination(d);
    runSearch(o, d);
  }

  const selectedRoute = results?.options?.[selectedIndex];

  return (
    <div className="min-h-screen bg-paper font-body">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <SearchBoard
          stations={stations}
          origin={origin} setOrigin={setOrigin}
          destination={destination} setDestination={setDestination}
          priority={priority} setPriority={setPriority}
          hour={hour} setHour={setHour}
          dayType={dayType} setDayType={setDayType}
          isRaining={isRaining} setIsRaining={setIsRaining}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {Object.keys(stations).length > 0 && (
          <SavedRoutes
            stations={stations}
            origin={origin}
            destination={destination}
            onSelect={selectSavedRoute}
          />
        )}

        <div className="grid lg:grid-cols-5 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-3">
            {error && <ErrorState message={error} />}

            {!error && !results && <EmptyState />}

            {results && (
              <>
                <div className="flex items-baseline justify-between mb-1 px-1">
                  <h2 className="font-display font-semibold text-ink text-sm">
                    {results.options.length} route{results.options.length !== 1 ? "s" : ""} found
                  </h2>
                  {results.is_raining && (
                    <span className="font-mono text-[10px] text-monsoon">rain-adjusted</span>
                  )}
                </div>
                {results.options.map((option, i) => (
                  <RouteCard
                    key={i}
                    option={option}
                    rank={i}
                    selected={i === selectedIndex}
                    onSelect={() => setSelectedIndex(i)}
                  />
                ))}
              </>
            )}
          </div>

          <div className="lg:col-span-3">
            <MapPanel route={selectedRoute} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
