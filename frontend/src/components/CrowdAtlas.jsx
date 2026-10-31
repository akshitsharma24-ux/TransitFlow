import { useEffect, useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import { fetchAtlas } from '../api';
import { getCrowdConfig, getLineConfig } from '../utils/lineColors';
import { istNow, isWeekend } from '../utils/time';
import { levelForIndex } from '../utils/crowd';

function Toggle({ value, onChange, options, label }) {
  return (
    <div className="flex bg-[#0B1622] border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}
          className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${value === id ? 'bg-[#3FCFE0]/25 text-[#3FCFE0] font-bold' : 'text-slate-400 hover:text-slate-200'}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Heatmap of typical crowding: one row per line, one column per half hour. */
export default function CrowdAtlas() {
  const [dayType, setDayType] = useState('weekday');
  const [direction, setDirection] = useState('inbound');
  const [loaded, setLoaded] = useState({ key: '', atlas: null, error: null });
  const [hover, setHover] = useState(null);

  const key = `${dayType}-${direction}`;
  useEffect(() => {
    let cancelled = false;
    fetchAtlas(dayType, direction)
      .then((atlas) => { if (!cancelled) setLoaded({ key, atlas, error: null }); })
      .catch((error) => { if (!cancelled) setLoaded({ key, atlas: null, error: error.message }); });
    return () => { cancelled = true; };
  }, [key, dayType, direction]);

  const ready = loaded.key === key;
  const atlas = ready ? loaded.atlas : null;
  const { time: now, date: today } = istNow();
  const nowSlot = Number(now.slice(0, 2)) * 2 + (Number(now.slice(3, 5)) >= 30 ? 1 : 0);

  return (
    <section className="rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Grid3x3 className="w-4 h-4 text-[#3FCFE0]" />
        <h3 className="text-sm font-bold font-display text-[#F2F5F7]">Crowd atlas</h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">Typical crowding by line through the day</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Toggle label="Day type" value={dayType} onChange={setDayType} options={[['weekday', 'Weekday'], ['weekend', 'Weekend']]} />
          <Toggle label="Direction" value={direction} onChange={setDirection} options={[['inbound', 'Towards the city'], ['outbound', 'Away from it']]} />
        </div>
      </div>

      {loaded.error && ready && <p className="text-sm text-[#d95561]">{loaded.error}</p>}
      {!atlas && !loaded.error && <div className="h-56 rounded-2xl bg-[#0B1622]/60 animate-pulse" aria-busy="true" />}

      {atlas && (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[640px] space-y-1">
            <div className="grid" style={{ gridTemplateColumns: '7.5rem repeat(48, minmax(0, 1fr))' }}>
              <span />
              {atlas.slots.map((slot, i) => (
                <span key={slot} className="text-[9px] font-mono text-slate-500 text-left">{i % 6 === 0 ? slot.slice(0, 2) : ''}</span>
              ))}
            </div>
            {atlas.lines.map((row) => {
              const conf = getLineConfig(row.line, row.mode);
              return (
                <div key={row.line} className="grid items-center gap-px" style={{ gridTemplateColumns: '7.5rem repeat(48, minmax(0, 1fr))' }}>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 pr-2 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conf.color }} />{row.line.replace(' Line', '')}
                  </span>
                  {row.values.map((value, i) => {
                    const level = value == null ? null : levelForIndex(value);
                    return (
                      <span
                        key={i}
                        role="img"
                        aria-label={value == null ? `${row.line} ${atlas.slots[i]} not running` : `${row.line} ${atlas.slots[i]} ${level} ${value}`}
                        onMouseEnter={() => setHover({ line: row.line, slot: atlas.slots[i], value, level })}
                        onMouseLeave={() => setHover(null)}
                        className="h-6 first:rounded-l last:rounded-r"
                        style={{
                          backgroundColor: level ? getCrowdConfig(level).color : '#0B1622',
                          opacity: level ? 0.35 + (value / 100) * 0.65 : 1,
                          backgroundImage: level ? undefined : 'repeating-linear-gradient(45deg, transparent 0 3px, rgba(148,163,184,0.12) 3px 6px)',
                          outline: i === nowSlot && (dayType === 'weekend') === isWeekend(today) ? '1px solid #3FCFE0' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono text-slate-400">
        {['Comfortable', 'Moderate', 'Busy', 'Packed'].map((l) => (
          <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getCrowdConfig(l).color }} />{l}</span>
        ))}
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border border-slate-600" />Not running</span>
        <span className="ml-auto text-[#3FCFE0] min-h-[14px]">
          {hover ? `${hover.line} · ${hover.slot} · ${hover.value == null ? 'not running' : `${hover.level} (${hover.value})`}` : 'Hover a cell for details'}
        </span>
      </div>
    </section>
  );
}
