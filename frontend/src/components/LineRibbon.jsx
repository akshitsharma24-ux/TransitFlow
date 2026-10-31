import { useEffect, useState } from 'react';
import { Waypoints } from 'lucide-react';
import { fetchLineRibbon } from '../api';
import { getCrowdConfig, getLineConfig, LINE_ORDER } from '../utils/lineColors';

function Dot({ reading }) {
  if (!reading) return <span className="w-3.5 h-3.5 rounded-full border border-slate-700" aria-hidden />;
  return <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: getCrowdConfig(reading.level).color }} aria-hidden />;
}

/** Every station on one line, coloured by live crowd in each direction. */
export default function LineRibbon({ rain, tick }) {
  const [line, setLine] = useState('Western Line');
  const [loaded, setLoaded] = useState({ key: '', data: null, error: null });
  const [active, setActive] = useState(null);

  const key = `${line}|${rain}|${tick}`;
  useEffect(() => {
    let cancelled = false;
    fetchLineRibbon(line, rain)
      .then((data) => { if (!cancelled) setLoaded({ key, data, error: null }); })
      .catch((error) => { if (!cancelled) setLoaded({ key, data: null, error: error.message }); });
    return () => { cancelled = true; };
  }, [key, line, rain]);

  const data = loaded.data && loaded.data.line === line ? loaded.data : null;
  const conf = getLineConfig(line);
  const station = data?.stations.find((s) => s.id === active) || null;

  return (
    <section className="rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Waypoints className="w-4 h-4 text-[#3FCFE0]" />
        <h3 className="text-sm font-bold font-display text-[#F2F5F7]">Line view</h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">Station by station, right now</span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Line">
        {LINE_ORDER.map((l) => {
          const c = getLineConfig(l);
          const selected = l === line;
          return (
            <button key={l} role="tab" aria-selected={selected} type="button" onClick={() => { setLine(l); setActive(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border cursor-pointer transition-colors ${
                selected ? 'text-[#F2F5F7] bg-[#0B1622]' : 'text-slate-400 bg-transparent border-slate-800 hover:text-slate-200'}`}
              style={selected ? { borderColor: c.color } : undefined}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{l.replace(' Line', '')}
            </button>
          );
        })}
      </div>

      {loaded.error && <p className="text-sm text-[#d95561]">{loaded.error}</p>}
      {!data && !loaded.error && <div className="h-40 rounded-2xl bg-[#0B1622]/60 animate-pulse" aria-busy="true" />}

      {data && !data.in_service && <p className="text-sm text-slate-300 bg-[#0B1622]/60 border border-slate-800 rounded-2xl px-4 py-3">{line} is not running right now.</p>}

      {data && data.in_service && (
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max">
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: conf.color }} />
              {data.inbound_label} (top) / {data.outbound_label} (bottom)
            </div>
            <div className="flex gap-0.5" role="list">
              {data.stations.map((s) => (
                <button key={s.id} type="button" role="listitem" onClick={() => setActive(s.id === active ? null : s.id)}
                  aria-label={`${s.name}: ${s.inbound ? `${data.inbound_label} ${s.inbound.level}` : 'no train that way'}, ${s.outbound ? `${data.outbound_label} ${s.outbound.level}` : 'no train that way'}`}
                  aria-pressed={s.id === active}
                  className={`flex flex-col items-center gap-1.5 px-1 pt-2 pb-1.5 rounded-lg cursor-pointer transition-colors ${s.id === active ? 'bg-[#3FCFE0]/15' : 'hover:bg-slate-800/60'}`}>
                  <Dot reading={s.inbound} />
                  <span className="w-0.5 h-3 rounded-full" style={{ backgroundColor: conf.color }} />
                  <Dot reading={s.outbound} />
                  <span className="text-[10px] font-sans text-slate-300 h-24 mt-1 truncate" style={{ writingMode: 'vertical-rl' }}>{s.name}</span>
                  {s.reports > 0 && <span className="text-[9px] font-mono text-[#E8A94D]" title="Rider reports in the last hour">{s.reports}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {station && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono bg-[#0B1622]/70 border border-slate-800 rounded-2xl p-4">
          <div><div className="text-slate-500">Station</div><div className="text-[#F2F5F7] text-sm font-sans font-semibold">{station.name}</div></div>
          {[['inbound', data.inbound_label], ['outbound', data.outbound_label]].map(([dir, label]) => (
            <div key={dir}>
              <div className="text-slate-500">{label}</div>
              {station[dir] ? (
                <div style={{ color: getCrowdConfig(station[dir].level).color }} className="text-sm font-semibold">
                  {station[dir].level} <span className="text-slate-400">({station[dir].index})</span>
                </div>
              ) : <div className="text-slate-500">No train this way</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
