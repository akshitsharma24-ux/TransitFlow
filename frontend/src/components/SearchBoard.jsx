/*
  SearchBoard — the app's signature element.
  Styled like a railway departure indicator board: dark navy, monospace
  digits, amber/green accent readouts. Everything else in the app stays
  quiet so this carries the visual identity.
*/

import { CloudRain, Search } from "lucide-react";

export default function SearchBoard({
  stations, origin, setOrigin, destination, setDestination,
  priority, setPriority, hour, setHour, dayType, setDayType,
  isRaining, setIsRaining, onSubmit, loading,
}) {
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

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <Field label="From">
          <input
            list="station-list"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. borivali"
            className="board-input"
          />
        </Field>
        <Field label="To">
          <input
            list="station-list"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. churchgate"
            className="board-input"
          />
        </Field>
      </div>

      <datalist id="station-list">
        {Object.entries(stations).map(([id, s]) => (
          <option key={id} value={id}>{s.name}</option>
        ))}
      </datalist>

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
