/*
  SearchBoard — the app's signature element.
  Styled like a railway departure indicator board: dark navy, monospace
  digits, amber/green accent readouts. Everything else in the app stays
  quiet so this carries the visual identity.
*/

import { useState } from "react";
import { CloudRain, Search, LocateFixed, Loader2 } from "lucide-react";
import StationAutocomplete from "./StationAutocomplete";

// Straight-line distance between two lat/lon points, in km (haversine formula)
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestStation(stations, lat, lon) {
  let bestId = null;
  let bestDist = Infinity;
  for (const [id, s] of Object.entries(stations)) {
    const d = distanceKm(lat, lon, s.lat, s.lon);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return { id: bestId, distanceKm: bestDist };
}

export default function SearchBoard({
  stations, origin, setOrigin, destination, setDestination,
  priority, setPriority, hour, setHour, dayType, setDayType,
  isRaining, setIsRaining, onSubmit, loading,
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location isn't supported in this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearest = nearestStation(stations, latitude, longitude);
        if (nearest.id) {
          setOrigin(nearest.id);
        } else {
          setLocationError("Couldn't match your location to a station.");
        }
        setLocating(false);
      },
      () => {
        setLocationError("Location access denied or unavailable.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-ink rounded-2xl p-6 sm:p-8 shadow-xl border border-ink/40"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-amber uppercase">Route Board</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-paper">TransitFlow</h1>
        </div>
        <div className="font-mono text-xs text-paper/60 text-right hidden sm:block">
          <p>Mumbai Commute</p>
          <p>Comparison System</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-1">
        <Field label="From">
          <StationAutocomplete
            stations={stations}
            value={origin}
            onChange={setOrigin}
            placeholder="Type a station…"
          />
        </Field>
        <Field label="To">
          <StationAutocomplete
            stations={stations}
            value={destination}
            onChange={setDestination}
            placeholder="Type a station…"
          />
        </Field>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center gap-1.5 text-[11px] font-mono text-paper/50 hover:text-amber transition-colors disabled:opacity-50"
        >
          {locating ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />}
          {locating ? "Finding you…" : "Use my location for From"}
        </button>
        {locationError && <p className="text-[11px] font-mono text-rust mt-1">{locationError}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="board-input">
            <option value="fastest">Fastest</option>
            <option value="cheapest">Cheapest</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </Field>

        <Field label="Hour">
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="board-input">
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{h.toString().padStart(2, "0")}:00</option>
            ))}
          </select>
        </Field>

        <Field label="Day">
          <select value={dayType} onChange={(e) => setDayType(e.target.value)} className="board-input">
            <option value="weekday">Weekday</option>
            <option value="weekend">Weekend</option>
          </select>
        </Field>

        <Field label="Weather">
          <button
            type="button"
            onClick={() => setIsRaining(!isRaining)}
            className={`board-input flex items-center justify-center gap-2 transition-colors ${
              isRaining ? "!bg-monsoon !text-paper" : ""
            }`}
          >
            <CloudRain size={14} />
            {isRaining ? "Raining" : "Dry"}
          </button>
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-signal hover:bg-signal/90 disabled:opacity-60 text-paper font-display font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <Search size={16} />
        {loading ? "Finding routes…" : "Find Routes"}
      </button>

      <style>{`
        .board-input {
          width: 100%;
          background: rgba(244, 246, 245, 0.06);
          border: 1px solid rgba(244, 246, 245, 0.15);
          color: #F4F6F5;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          padding: 10px 12px;
          border-radius: 8px;
          outline: none;
        }
        .board-input:focus {
          border-color: #E8A33D;
          box-shadow: 0 0 0 2px rgba(232, 163, 61, 0.25);
        }
        .board-input option {
          background: #14213D;
          color: #F4F6F5;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.15em] text-paper/50 uppercase block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
