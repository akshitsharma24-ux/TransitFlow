import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRightLeft, CalendarPlus, Check, Copy, MapPinned, Radio, Route as RouteIcon, Share2, TriangleAlert,
} from 'lucide-react';
import { planTrip } from '../api';
import { resolveRain } from '../utils/weather';
import { addDays, clock, downloadText, istNow, itineraryToText, minutesLabel, dayLabel, isoDay, tripsToIcs } from '../utils/time';
import useRainForecast from '../hooks/useRainForecast';
import StationAutocomplete from './StationAutocomplete';
import { AvoidToggles, PreferencePicker, RainControl, WhenPicker } from './PlannerControls';
import ItineraryCard from './ItineraryCard';
import ItineraryTimeline from './ItineraryTimeline';
import DepartureAdvisor from './DepartureAdvisor';
import CrowdChip from './CrowdChip';
import { seatText } from '../utils/crowd';
import MapPanel from './MapPanel';

const VALID_PREFS = ['balanced', 'fastest', 'cheapest', 'comfortable', 'least_crowded', 'fewest_transfers'];

/** Initial form values from a preset (URL or the assistant), with sensible defaults. */
function buildForm(presetInput) {
  const preset = presetInput ?? {};
  const today = istNow().date;
  return {
    from: preset.from || 'borivali',
    to: preset.to || 'churchgate',
    date: preset.date || addDays(today, 1),
    time: preset.time || '08:30',
    when: preset.when === 'arrive' ? 'arrive' : 'depart',
    pref: VALID_PREFS.includes(preset.pref) ? preset.pref : 'balanced',
    rainMode: preset.rain === true || preset.rain === '1' ? 'on' : preset.rain === false || preset.rain === '0' ? 'off' : 'auto',
    avoid: Array.isArray(preset.avoid) ? preset.avoid : [],
  };
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Planning your journey">
      <div className="h-28 rounded-3xl bg-[#101B28]/80 border border-slate-800" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-2xl bg-[#101B28]/80 border border-slate-800" />)}
      </div>
      <div className="h-72 rounded-3xl bg-[#101B28]/80 border border-slate-800" />
    </div>
  );
}

export default function TripPlanner({ stationsMap, initial, onNavigate }) {
  const [form, setForm] = useState(() => buildForm(initial));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState('');
  const resultsRef = useRef(null);
  const requestId = useRef(0);

  const update = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);
  const { forecast, loading: rainLoading } = useRainForecast(form.date, form.time);
  const effectiveRain = form.rainMode === 'on' || (form.rainMode === 'auto' && Boolean(forecast?.rainy));

  const run = useCallback(async (values) => {
    if (!values.from || !values.to) {
      setError('Choose both a starting station and a destination.');
      return;
    }
    if (values.from === values.to) {
      setError('Origin and destination must be different.');
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const rain = await resolveRain(values);
      const data = await planTrip({
        origin: values.from, destination: values.to, date: values.date, time: values.time, when: values.when,
        preference: values.pref, is_raining: rain, avoid: values.avoid,
      });
      if (id !== requestId.current) return;
      setResult(data);
      setSelected(0);

      const params = new URLSearchParams(window.location.search);
      params.set('view', 'plan');
      Object.entries({ from: values.from, to: values.to, date: values.date, time: values.time, when: values.when,
        pref: values.pref, rain: values.rainMode === 'auto' ? 'auto' : values.rainMode === 'on' ? '1' : '0' })
        .forEach(([k, v]) => params.set(k, v));
      if (values.avoid.length) params.set('avoid', values.avoid.join(',')); else params.delete('avoid');
      window.history.replaceState(null, '', `?${params.toString()}`);

      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      if (id !== requestId.current) return;
      setResult(null);
      setError(err.message || 'Could not plan this journey');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Open straight into a result when arriving from a shared link or the assistant.
  useEffect(() => {
    if (!initial?.from || !initial?.to) return undefined;
    const timer = setTimeout(() => run(buildForm(initial)), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itineraries = useMemo(() => (result ? [result.recommended, ...result.alternatives] : []), [result]);
  const current = itineraries[selected] || null;

  const swap = () => update({ from: form.to, to: form.from });
  const onSubmit = (e) => { e.preventDefault(); run(form); };

  const pickSlot = (slot) => {
    const next = { ...form, when: 'depart', date: isoDay(slot.depart), time: clock(slot.depart) };
    setForm(next);
    run(next);
  };

  const flash = (what) => { setCopied(what); setTimeout(() => setCopied(''), 1800); };
  const originName = result?.origin.name;
  const destName = result?.destination.name;

  const copyText = async () => {
    try { await navigator.clipboard.writeText(itineraryToText(current, originName, destName)); flash('text'); } catch { /* clipboard blocked */ }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); flash('link'); } catch { /* clipboard blocked */ }
  };
  const addToCalendar = () => {
    downloadText(`transitflow-${isoDay(current.depart)}.ics`, tripsToIcs([{ itinerary: current, origin: originName, destination: destName }]));
    flash('cal');
  };

  const examples = [
    ['borivali', 'churchgate', '08:45', 'Borivali to Churchgate'],
    ['andheri', 'ghatkopar', '09:30', 'Andheri to Ghatkopar'],
    ['thane', 'vashi', '18:15', 'Thane to Vashi'],
    ['dahisar_east', 'bkc', '10:00', 'Dahisar to BKC'],
  ];

  return (
    <div className="space-y-8 pt-8 pb-12">
      <header className="space-y-2 max-w-3xl">
        <span className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full bg-[#3FCFE0]/15 text-[#3FCFE0] border border-[#3FCFE0]/30">
          <RouteIcon className="w-3.5 h-3.5" />TRIP PLANNER
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#F2F5F7]">Plan any journey, for any time</h1>
        <p className="text-sm sm:text-base text-slate-300">
          Pick a day and time and get a full itinerary with real clock times, the crowd you can expect on every leg,
          and the best moment to leave. Crowd levels are model estimates built from commuting patterns, not live passenger counts.
        </p>
      </header>

      <form onSubmit={onSubmit} className="rounded-3xl border border-[#3FCFE0]/25 bg-[#101B28]/90 backdrop-blur-xl p-5 sm:p-7 space-y-6 shadow-[0_24px_60px_rgba(7,13,20,0.6)]">
        <div className="relative flex flex-col md:flex-row items-stretch md:items-end gap-3">
          <StationAutocomplete label="From" placeholder="Starting station" value={form.from} onChange={(v) => update({ from: v })} stationsMap={stationsMap} />
          <div className="flex justify-center md:pb-1">
            <button type="button" onClick={swap} title="Swap stations" aria-label="Swap stations"
              className="p-3 rounded-full bg-[#0B1622] border border-[#3FCFE0]/40 hover:border-[#3FCFE0] text-slate-200 hover:text-[#3FCFE0] transition-colors cursor-pointer">
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>
          <StationAutocomplete label="To" placeholder="Destination station" value={form.to} onChange={(v) => update({ to: v })} stationsMap={stationsMap} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WhenPicker when={form.when} onWhen={(when) => update({ when })} date={form.date} onDate={(date) => update({ date })}
            time={form.time} onTime={(time) => update({ time })} />
          <div className="space-y-5">
            <PreferencePicker value={form.pref} onChange={(pref) => update({ pref })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RainControl mode={form.rainMode} onMode={(rainMode) => update({ rainMode })} forecast={forecast} loading={rainLoading} effective={effectiveRain} />
          <AvoidToggles avoid={form.avoid} onChange={(avoid) => update({ avoid })} />
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
          <RouteIcon className="w-5 h-5" />{loading ? 'Planning...' : 'Plan my journey'}
        </button>
      </form>

      <div ref={resultsRef} className="scroll-mt-28 space-y-8" aria-live="polite">
        {loading && !result && <Skeleton />}

        {!loading && !result && !error && (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-[#101B28]/50 p-8 text-center space-y-4">
            <MapPinned className="w-8 h-8 mx-auto text-[#3FCFE0]" />
            <p className="text-slate-300 text-sm">Choose your stations and a time, or try one of these.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {examples.map(([from, to, time, label]) => (
                <button key={label} type="button" onClick={() => { const next = { ...form, from, to, time, when: 'depart' }; setForm(next); run(next); }}
                  className="px-4 py-2 rounded-xl text-xs font-mono bg-[#0B1622] border border-slate-700 text-slate-200 hover:border-[#3FCFE0]/60 hover:text-[#3FCFE0] cursor-pointer transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && current && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: loading ? 0.6 : 1, y: 0 }} className="space-y-8">
            {/* Summary banner */}
            <section className="rounded-3xl border border-[#3FCFE0]/30 bg-gradient-to-br from-[#101B28] to-[#0F2433] p-5 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-slate-400">
                    <span>{dayLabel(isoDay(current.depart))}</span>
                    <span className="text-slate-600">{'·'}</span>
                    <span>{result.day_type}</span>
                    {result.is_raining && <span className="px-2 py-0.5 rounded-full bg-[#3FCFE0]/15 text-[#3FCFE0] border border-[#3FCFE0]/30">rain planned for</span>}
                    {result.live_alerts_included && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D99A3D]/15 text-[#E8A94D] border border-[#D99A3D]/30" title="Close to now, the plan includes simulated service alerts">
                        <Radio className="w-3 h-3" />includes live alerts (simulated)
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-[#F2F5F7] tracking-tight">
                    {originName} <span className="text-slate-500">{'→'}</span> {destName}
                  </h2>
                  <div className="flex items-baseline gap-3 font-mono">
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#3FCFE0] tabular-nums">{clock(current.depart)}</span>
                    <span className="text-slate-500">{'→'}</span>
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#F2F5F7] tabular-nums">{clock(current.arrive)}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[
                    [copied === 'text' ? Check : Copy, copied === 'text' ? 'Copied' : 'Copy', copyText],
                    [copied === 'link' ? Check : Share2, copied === 'link' ? 'Link copied' : 'Share', copyLink],
                    [copied === 'cal' ? Check : CalendarPlus, 'Calendar', addToCalendar],
                  ].map(([Icon, label, handler]) => (
                    <button key={label} type="button" onClick={handler}
                      className="flex items-center gap-1.5 text-xs font-mono px-3.5 py-2 rounded-2xl border bg-[#0B1622] border-slate-700 text-slate-200 hover:border-[#3FCFE0]/50 hover:text-[#3FCFE0] transition-colors cursor-pointer">
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['Journey', minutesLabel(current.duration_minutes), `${current.ride_minutes} riding, ${current.wait_minutes} waiting, ${current.walk_minutes} walking`],
                  ['Fare', `₹${current.cost_rupees}`, current.transfers ? `${current.transfers} change${current.transfers > 1 ? 's' : ''}` : 'No changes'],
                  ['Crowd', current.crowd.level, `index ${current.crowd.index}/100, worst leg ${current.crowd.peak_level.toLowerCase()}`],
                  ['Seat', seatText(current.crowd.seat_chance), `${Math.round(current.crowd.seat_chance * 100)}% chance`],
                ].map(([label, value, sub]) => (
                  <div key={label} className="rounded-2xl bg-[#0B1622]/70 border border-slate-800 p-3.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
                    <div className="text-base sm:text-lg font-bold font-display text-[#F2F5F7] mt-0.5">{value}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>

              {result.notes.length > 0 && (
                <ul className="space-y-1">
                  {result.notes.map((n) => <li key={n} className="text-xs text-slate-300 flex gap-2"><span className="text-[#3FCFE0]">{'•'}</span>{n}</li>)}
                </ul>
              )}
              {result.warnings.map((w) => (
                <div key={w} className="flex items-start gap-2 text-xs text-[#E8A94D] bg-[#D99A3D]/10 border border-[#D99A3D]/30 rounded-2xl px-3.5 py-2.5">
                  <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{w}</span>
                </div>
              ))}
            </section>

            {/* Alternatives */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold font-display text-[#F2F5F7]">Your options <span className="font-mono font-normal text-slate-500">({itineraries.length})</span></h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {itineraries.map((it, i) => (
                  <ItineraryCard key={`${it.label}-${it.depart}-${i}`} itinerary={it} index={i} selected={i === selected} onSelect={() => setSelected(i)} />
                ))}
              </div>
            </section>

            {/* Timeline + map */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-6 rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-5">
                  <RouteIcon className="w-4 h-4 text-[#3FCFE0]" />
                  <h3 className="text-sm font-bold font-display text-[#F2F5F7]">Step by step</h3>
                  <CrowdChip level={current.crowd.level} index={current.crowd.index} size="sm" />
                  <span className="ml-auto text-[10px] font-mono text-slate-500">{current.label}</span>
                </div>
                <ItineraryTimeline itinerary={current} originName={originName} destinationName={destName} />
              </div>
              <div className="xl:col-span-6 xl:sticky xl:top-28">
                <MapPanel selectedOption={current} stationsMap={stationsMap} />
              </div>
            </section>

            <DepartureAdvisor advisor={result.advisor} when={result.when} onPick={pickSlot} />

            {current.fare_pass && (
              <div className="text-xs font-mono text-slate-300 bg-[#101B28]/85 border border-slate-800 rounded-2xl px-4 py-3">
                If you make this trip daily, a {current.fare_pass.mode} monthly pass ({'₹'}{current.fare_pass.monthly_pass_cost}) pays for itself
                after about {Math.ceil(current.fare_pass.breakeven_commute_days)} days of return trips.
              </div>
            )}

            <div className="text-center">
              <button type="button" onClick={() => onNavigate?.('day')} className="text-xs font-mono text-[#3FCFE0] hover:underline cursor-pointer">
                Planning a whole day with several stops? Try the Day Planner {'→'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
