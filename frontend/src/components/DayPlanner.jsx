import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, CalendarPlus, CalendarRange, Check, ChevronDown, Copy, Flag, Home, MapPin, Plus, Route as RouteIcon,
  Trash2, TriangleAlert, Wallet,
} from 'lucide-react';
import { planDay } from '../api';
import { addDays, clock, downloadText, istNow, itineraryToText, minutesLabel, tripsToIcs } from '../utils/time';
import { resolveRain } from '../utils/weather';
import useRainForecast from '../hooks/useRainForecast';
import StationAutocomplete from './StationAutocomplete';
import { AvoidToggles, PreferencePicker, RainControl, WhenPicker } from './PlannerControls';
import { fieldLabel, inputClass } from '../utils/formStyles';
import ItineraryTimeline from './ItineraryTimeline';
import CrowdChip from './CrowdChip';

const STAY_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 540, 600];
let nextId = 1;
const stop = (station, patch = {}) => ({ id: nextId++, station, kind: 'stay', stay: 60, leaveAt: '18:00', ...patch });

const PRESETS = [
  { label: 'Office commute', origin: 'borivali', start: '08:30', stops: [['lower_parel', { stay: 540 }]] },
  { label: 'College and gym', origin: 'borivali', start: '07:45', stops: [['azad_nagar', { kind: 'leave', leaveAt: '16:30' }], ['andheri', { stay: 90 }]] },
  { label: 'Weekend outing', origin: 'andheri', start: '10:00', stops: [['churchgate', { stay: 150 }], ['dadar', { stay: 60 }]] },
];

function stayLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} hr` : `${Math.floor(h)} hr ${minutes % 60} min`;
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl bg-[#0B1622]/70 border border-slate-800 p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500"><Icon className="w-3 h-3" />{label}</div>
      <div className="text-lg font-bold font-display text-[#F2F5F7] mt-0.5">{value}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}

function TripItem({ item, expanded, onToggle }) {
  const it = item.itinerary;
  return (
    <div className="rounded-2xl border border-[#3FCFE0]/25 bg-[#101B28]/90 overflow-hidden">
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-2 cursor-pointer hover:bg-[#3FCFE0]/5 transition-colors">
        <div className="font-mono tabular-nums text-sm text-[#F2F5F7]">{clock(item.start)} <span className="text-slate-500">{'→'}</span> {clock(item.end)}</div>
        <div className="text-sm text-slate-200 min-w-0 truncate">
          {item.from_station.name} <span className="text-slate-500">{'→'}</span> {item.to_station.name}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-xs text-slate-400 truncate max-w-[12rem]">{it.label}</span>
          <span className="text-xs font-mono text-slate-300">{minutesLabel(it.duration_minutes)}</span>
          <span className="text-xs font-mono text-[#3FCFE0]">{'₹'}{it.cost_rupees}</span>
          <CrowdChip level={it.crowd.level} index={it.crowd.index} size="sm" />
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="p-4 pt-1 border-t border-slate-800">
              <ItineraryTimeline itinerary={it} originName={item.from_station.name} destinationName={item.to_station.name} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DayPlanner({ stationsMap, onNavigate }) {
  const today = istNow().date;
  const [origin, setOrigin] = useState('borivali');
  const [date, setDate] = useState(addDays(today, 1));
  const [startTime, setStartTime] = useState('08:30');
  const [stops, setStops] = useState(() => [stop('lower_parel', { stay: 540 }), stop('andheri', { stay: 60 })]);
  const [returnHome, setReturnHome] = useState(true);
  const [pref, setPref] = useState('balanced');
  const [rainMode, setRainMode] = useState('auto');
  const [avoid, setAvoid] = useState([]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});
  const [copied, setCopied] = useState('');
  const resultsRef = useRef(null);

  const { forecast, loading: rainLoading } = useRainForecast(date, startTime);
  const effectiveRain = rainMode === 'on' || (rainMode === 'auto' && Boolean(forecast?.rainy));

  const patchStop = (id, patch) => setStops((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i, delta) => setStops((list) => {
    const j = i + delta;
    if (j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  const applyPreset = (preset) => {
    setOrigin(preset.origin);
    setStartTime(preset.start);
    setStops(preset.stops.map(([station, patch]) => stop(station, patch)));
    setReturnHome(true);
    setResult(null);
    setError(null);
  };

  const build = useCallback(async (e) => {
    e?.preventDefault();
    if (!origin) return setError('Choose where your day starts.');
    if (stops.some((s) => !s.station)) return setError('Every stop needs a station.');
    setLoading(true);
    setError(null);
    try {
      const rain = await resolveRain({ rainMode, date, time: startTime });
      const data = await planDay({
        origin, date, start_time: startTime, return_to_origin: returnHome, preference: pref, is_raining: rain, avoid,
        stops: stops.map((s) => (s.kind === 'leave'
          ? { station: s.station, leave_at: s.leaveAt }
          : { station: s.station, stay_minutes: s.stay })),
      });
      setResult(data);
      setOpen({});
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setResult(null);
      setError(err.message || 'Could not plan this day');
    } finally {
      setLoading(false);
    }
  }, [origin, stops, date, startTime, returnHome, pref, rainMode, avoid]);

  const trips = result?.items.filter((i) => i.kind === 'trip') ?? [];
  const flash = (what) => { setCopied(what); setTimeout(() => setCopied(''), 1800); };

  const dayText = () => {
    const lines = [`TransitFlow day plan (${date})`];
    result.items.forEach((item) => {
      if (item.kind === 'stay') lines.push(`${clock(item.start)}-${clock(item.end)}  At ${item.from_station.name} (${minutesLabel(item.minutes)})`);
      else lines.push('', itineraryToText(item.itinerary, item.from_station.name, item.to_station.name));
    });
    return lines.join('\n');
  };
  const copyDay = async () => { try { await navigator.clipboard.writeText(dayText()); flash('text'); } catch { /* clipboard blocked */ } };
  const exportCalendar = () => {
    downloadText(`transitflow-day-${date}.ics`, tripsToIcs(trips.map((t) => ({
      itinerary: t.itinerary, origin: t.from_station.name, destination: t.to_station.name }))));
    flash('cal');
  };

  const s = result?.summary;

  return (
    <div className="space-y-8 pt-8 pb-12">
      <header className="space-y-2 max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full bg-[#E8A94D]/15 text-[#E8A94D] border border-[#E8A94D]/30">
          <CalendarRange className="w-3.5 h-3.5" />DAY PLANNER
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#F2F5F7]">Plan your whole day</h1>
        <p className="text-sm sm:text-base text-slate-300">
          Add the places you will go and how long you will stay at each. TransitFlow chains the trips together with real clock
          times, so each journey is forecast for the moment you actually make it, and shows what the day costs.
        </p>
      </header>

      <form onSubmit={build} className="rounded-3xl border border-[#3FCFE0]/25 bg-[#101B28]/90 backdrop-blur-xl p-5 sm:p-7 space-y-6 shadow-[0_24px_60px_rgba(7,13,20,0.6)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400 mr-1">Quick start:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-mono bg-[#0B1622] border border-slate-700 text-slate-200 hover:border-[#3FCFE0]/60 hover:text-[#3FCFE0] cursor-pointer transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StationAutocomplete label="Day starts at" placeholder="Home or first station" value={origin} onChange={setOrigin} stationsMap={stationsMap} />
          <WhenPicker showMode={false} when="depart" date={date} onDate={setDate} time={startTime} onTime={setStartTime} timeLabel="Leave at" />
        </div>

        <div className="space-y-3">
          <span className={fieldLabel}>Stops, in order</span>
          <ol className="space-y-3">
            {stops.map((s, i) => (
              <li key={s.id} className="rounded-2xl border border-slate-800 bg-[#0B1622]/60 p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-8 w-6 h-6 shrink-0 rounded-full bg-[#3FCFE0] text-[#0B1622] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                    <StationAutocomplete label={`Stop ${i + 1}`} placeholder="Where to?" value={s.station} onChange={(v) => patchStop(s.id, { station: v })} stationsMap={stationsMap} />
                    <div>
                      <span className={fieldLabel}>Then</span>
                      <div className="flex gap-2">
                        <select aria-label="How to leave" value={s.kind} onChange={(e) => patchStop(s.id, { kind: e.target.value })} className={`${inputClass} !w-auto`}>
                          <option value="stay">Stay for</option>
                          <option value="leave">Leave at</option>
                        </select>
                        {s.kind === 'stay' ? (
                          <select aria-label="Time to stay" value={s.stay} onChange={(e) => patchStop(s.id, { stay: Number(e.target.value) })} className={inputClass}>
                            {STAY_OPTIONS.map((m) => <option key={m} value={m}>{stayLabel(m)}</option>)}
                          </select>
                        ) : (
                          <input aria-label="Leave time" type="time" value={s.leaveAt} onChange={(e) => e.target.value && patchStop(s.id, { leaveAt: e.target.value })} className={inputClass} />
                        )}
                      </div>
                      {i === stops.length - 1 && !returnHome && <p className="text-[11px] text-slate-500 mt-1">The last stop needs no stay time when you do not return.</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 mt-6">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#3FCFE0] disabled:opacity-30 cursor-pointer"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === stops.length - 1} onClick={() => move(i, 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#3FCFE0] disabled:opacity-30 cursor-pointer"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label="Remove stop" disabled={stops.length === 1} onClick={() => setStops((l) => l.filter((x) => x.id !== s.id))} className="p-1.5 rounded-lg text-slate-400 hover:text-[#d95561] disabled:opacity-30 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={stops.length >= 8} onClick={() => setStops((l) => [...l, stop('')])}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono border border-dashed border-[#3FCFE0]/50 text-[#3FCFE0] hover:bg-[#3FCFE0]/10 disabled:opacity-40 cursor-pointer transition-colors">
              <Plus className="w-3.5 h-3.5" />Add a stop
            </button>
            <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
              <input type="checkbox" checked={returnHome} onChange={(e) => setReturnHome(e.target.checked)} className="accent-[#3FCFE0] w-4 h-4" />
              <Home className="w-3.5 h-3.5" />Return to the starting station at the end
            </label>
          </div>
        </div>

        <PreferencePicker value={pref} onChange={setPref} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RainControl mode={rainMode} onMode={setRainMode} forecast={forecast} loading={rainLoading} effective={effectiveRain} />
          <AvoidToggles avoid={avoid} onChange={setAvoid} />
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 text-sm text-[#d95561] bg-[#B33A44]/10 border border-[#B33A44]/40 rounded-2xl px-4 py-3">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading}
          className={`w-full py-4 rounded-2xl font-display font-extrabold text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            loading ? 'bg-slate-800 text-slate-500 cursor-wait'
              : 'bg-gradient-to-r from-[#3FCFE0] via-[#4DD9E8] to-[#2BB5C6] text-[#0B1622] shadow-[0_0_30px_rgba(63,207,224,0.45)] hover:brightness-110'}`}>
          <CalendarRange className="w-5 h-5" />{loading ? 'Building your day...' : 'Build my day'}
        </button>
      </form>

      <div ref={resultsRef} className="scroll-mt-28 space-y-6" aria-live="polite">
        {result && s && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <section className="rounded-3xl border border-[#3FCFE0]/30 bg-gradient-to-br from-[#101B28] to-[#0F2433] p-5 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-extrabold font-display text-[#F2F5F7]">Your day, {clock(s.start)} to {clock(s.end)}</h2>
                  <p className="text-xs font-mono text-slate-400 mt-1">{date} {'·'} {result.day_type}{result.is_raining ? ' · rain planned for' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={copyDay} className="flex items-center gap-1.5 text-xs font-mono px-3.5 py-2 rounded-2xl border bg-[#0B1622] border-slate-700 text-slate-200 hover:border-[#3FCFE0]/50 hover:text-[#3FCFE0] cursor-pointer transition-colors">
                    {copied === 'text' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied === 'text' ? 'Copied' : 'Copy plan'}
                  </button>
                  <button type="button" onClick={exportCalendar} className="flex items-center gap-1.5 text-xs font-mono px-3.5 py-2 rounded-2xl border bg-[#0B1622] border-slate-700 text-slate-200 hover:border-[#3FCFE0]/50 hover:text-[#3FCFE0] cursor-pointer transition-colors">
                    {copied === 'cal' ? <Check className="w-3.5 h-3.5" /> : <CalendarPlus className="w-3.5 h-3.5" />}Calendar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi icon={RouteIcon} label="Travelling" value={minutesLabel(s.travel_minutes)} sub={`${s.trips} trips, ${s.wait_minutes} min waiting`} />
                <Kpi icon={Wallet} label="Fares" value={`₹${s.cost_rupees}`} sub="for the day" />
                <Kpi icon={MapPin} label="In busy trains" value={minutesLabel(s.crowded_minutes)} sub="Busy or Packed legs" />
                <Kpi icon={Flag} label="Discomfort" value={`${Math.round(s.discomfort_minutes)} min`} sub="crowd cost in minutes" />
              </div>

              {result.pass_advice && <p className="text-xs text-slate-300 bg-[#0B1622]/60 border border-slate-800 rounded-2xl px-4 py-3">{result.pass_advice.text}</p>}
              {result.warnings.map((w) => (
                <div key={w} className="flex items-start gap-2 text-xs text-[#E8A94D] bg-[#D99A3D]/10 border border-[#D99A3D]/30 rounded-2xl px-3.5 py-2.5">
                  <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{w}</span>
                </div>
              ))}
            </section>

            <ol className="space-y-3">
              {result.items.map((item, i) => (
                <li key={`${item.kind}-${item.start}-${i}`} className="grid grid-cols-[1.5rem_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`w-3 h-3 rounded-full mt-5 ring-4 ring-[#0B1622] ${item.kind === 'trip' ? 'bg-[#3FCFE0]' : 'bg-[#E8A94D]'}`} />
                    <span className="w-0.5 flex-1 bg-slate-800" />
                  </div>
                  {item.kind === 'trip' ? (
                    <TripItem item={item} expanded={Boolean(open[i])} onToggle={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#E8A94D]/40 bg-[#E8A94D]/5 p-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-mono tabular-nums text-sm text-[#F2F5F7]">{clock(item.start)} {'→'} {clock(item.end)}</span>
                      <span className="text-sm text-slate-200">At {item.from_station.name}</span>
                      <span className="ml-auto text-xs font-mono text-[#E8A94D]">{minutesLabel(item.minutes)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <div className="text-center">
              <button type="button" onClick={() => onNavigate?.('live')} className="text-xs font-mono text-[#3FCFE0] hover:underline cursor-pointer">
                See how crowded the network is right now {'→'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
