import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

export default function DisruptionPanel({
  lines, stations, closedLines, setClosedLines, closedStations, setClosedStations,
}) {
  const nameOf = (id) => stations.find((s) => s.id === id)?.name || id;
  const hasClosures = closedLines.length + closedStations.length > 0;

  const toggleLine = (line) =>
    setClosedLines((prev) => (prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]));
  const addStation = (id) => {
    if (id) setClosedStations((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const removeStation = (id) => setClosedStations((prev) => prev.filter((s) => s !== id));
  const clearAll = () => {
    setClosedLines([]);
    setClosedStations([]);
  };

  return (
    <section aria-label="Simulate disruptions" className="glass-panel rounded-2xl border border-[#3FCFE0]/20 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display font-bold text-[#F2F5F7]">
          <ShieldAlert className="w-4 h-4 text-[#E8A94D]" />
          Simulate a disruption
        </h2>
        {hasClosures && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-mono text-slate-300 hover:text-[#3FCFE0] transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {lines.map((line) => {
          const closed = closedLines.includes(line);
          return (
            <button
              key={line}
              type="button"
              aria-pressed={closed}
              onClick={() => toggleLine(line)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                closed
                  ? 'bg-red-500/15 border-red-500/60 text-red-300'
                  : 'bg-[#101B28] border-[#3FCFE0]/25 text-slate-200 hover:border-[#3FCFE0]/60'
              }`}
            >
              <span className={closed ? 'line-through' : ''}>{line}</span>
              {closed && <span className="ml-1.5 font-mono text-[10px] uppercase">closed</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          onChange={(e) => addStation(e.target.value)}
          aria-label="Close a station"
          className="bg-[#101B28] border border-[#3FCFE0]/25 rounded-xl px-3 py-1.5 text-sm text-[#F2F5F7] cursor-pointer"
        >
          <option value="">Close a station…</option>
          {stations
            .filter((s) => !closedStations.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
        </select>

        {closedStations.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-xl bg-red-500/15 border border-red-500/60 text-xs text-red-300"
          >
            {nameOf(id)}
            <button
              type="button"
              onClick={() => removeStation(id)}
              aria-label={`Reopen ${nameOf(id)}`}
              className="p-0.5 rounded-md hover:bg-red-500/25 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {hasClosures && (
        <p className="text-xs font-mono text-[#E8A94D]">Search again to reroute around these closures.</p>
      )}
    </section>
  );
}
