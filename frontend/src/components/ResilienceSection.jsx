import React from 'react';

export default function ResilienceSection({ data }) {
  if (!data?.stations?.length) return null;

  const busiest = data.stations.slice(0, 12);
  const maxBetweenness = busiest[0].betweenness || 1;
  const weakPoints = data.stations
    .filter((s) => s.is_articulation)
    .sort((a, b) => b.cut_off - a.cut_off)
    .slice(0, 8);

  return (
    <section aria-labelledby="resilience-heading" className="relative z-10 space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[#3FCFE0]">Network resilience</p>
        <h2 id="resilience-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-[#F2F5F7]">
          What the network depends on
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl border border-[#3FCFE0]/20 p-5">
          <h3 className="font-display font-bold text-[#F2F5F7]">Busiest crossing points</h3>
          <p className="mt-1 mb-4 text-xs text-slate-400">Betweenness: how many shortest journeys pass through each station.</p>
          <ul className="space-y-2.5">
            {busiest.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-32 sm:w-40 shrink-0 truncate text-slate-200" title={s.name}>{s.name}</span>
                <span className="flex-1 h-2 rounded-full bg-[#0B1622] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-[#3FCFE0]"
                    style={{ width: `${(s.betweenness / maxBetweenness) * 100}%` }}
                  />
                </span>
                <span className="w-12 text-right font-mono text-xs text-slate-300">{s.betweenness.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel rounded-2xl border border-[#E8A94D]/25 p-5">
          <h3 className="font-display font-bold text-[#F2F5F7]">Single points of failure</h3>
          <p className="mt-1 mb-4 text-xs text-slate-400">Closing any of these cuts part of the network off.</p>
          {weakPoints.length === 0 ? (
            <p className="text-sm text-slate-300">No single station disconnects the network.</p>
          ) : (
            <ul className="space-y-2.5">
              {weakPoints.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-5 font-mono text-xs text-slate-500">{i + 1}</span>
                    <span className="truncate text-slate-200">{s.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[#E8A94D]">
                    cuts off {s.cut_off} station{s.cut_off === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
