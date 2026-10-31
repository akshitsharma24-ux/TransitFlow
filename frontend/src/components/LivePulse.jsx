import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Flame, Info, Megaphone, RefreshCw, Send, Siren, TrainFront, Users } from 'lucide-react';
import { fetchLive, reportCrowd } from '../api';
import { getCrowdConfig, getLineConfig } from '../utils/lineColors';
import StationAutocomplete from './StationAutocomplete';
import { CrowdBar } from './CrowdChip';
import LineRibbon from './LineRibbon';
import CrowdAtlas from './CrowdAtlas';

const REFRESH_MS = 20000;
const LEVELS = ['Comfortable', 'Moderate', 'Busy', 'Packed'];

function LineCard({ entry }) {
  const conf = getLineConfig(entry.line, entry.mode);
  const Icon = conf.icon;
  const running = entry.in_service;
  const levelConf = running ? getCrowdConfig(entry.level) : null;
  const statusStyle = !running ? 'text-slate-400 border-slate-700' : entry.status === 'Delayed' ? 'text-[#E8A94D] border-[#D99A3D]/50 bg-[#D99A3D]/10' : 'text-[#4bbd97] border-[#2D8B6F]/40 bg-[#2D8B6F]/10';
  return (
    <motion.div layout className="rounded-2xl border bg-[#101B28]/90 p-4 space-y-3" style={{ borderColor: `${conf.color}55` }}>
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${conf.color}25`, color: conf.color }}><Icon className="w-4 h-4" /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold font-display text-[#F2F5F7] truncate">{entry.line}</div>
          <div className="text-[10px] font-mono text-slate-500">{entry.mode === 'metro' ? 'Metro' : 'Suburban rail'}{running && entry.headway_minutes ? ` · every ~${Math.round(entry.headway_minutes)} min` : ''}</div>
        </div>
        <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusStyle}`}>
          {!running ? 'Not running' : entry.status === 'Delayed' ? `Delayed +${entry.delay_minutes}m` : 'Normal'}
        </span>
      </div>

      {running ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums" style={{ color: levelConf.color }}>{entry.index}</span>
            <span className="text-xs font-mono text-slate-400">/100 {'·'} {entry.level}</span>
          </div>
          <CrowdBar level={entry.level} index={entry.index} />
          <dl className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            {[['City-bound', entry.inbound], ['Outbound', entry.outbound]].map(([label, d]) => (
              <div key={label} className="rounded-lg bg-[#0B1622]/70 px-2 py-1.5">
                <dt className="text-slate-500">{label}</dt>
                <dd style={{ color: d ? getCrowdConfig(d.level).color : undefined }}>{d ? `${d.level} ${d.index}` : '-'}</dd>
              </div>
            ))}
          </dl>
          {entry.alert && <p className="text-[11px] text-[#E8A94D] leading-snug">{entry.alert}</p>}
        </>
      ) : (
        <p className="text-xs text-slate-400">Out of service at this hour.</p>
      )}
    </motion.div>
  );
}

function ReportWidget({ stationsMap, onSent }) {
  const [station, setStation] = useState('dadar');
  const [state, setState] = useState({ busy: false, message: null, ok: false });

  const send = async (level) => {
    if (!station) return setState({ busy: false, ok: false, message: 'Pick a station first.' });
    setState({ busy: true, message: null, ok: false });
    try {
      const res = await reportCrowd(station, level);
      setState({ busy: false, ok: true, message: `Thanks! ${res.status.station} now has ${res.status.reports_last_hour} report${res.status.reports_last_hour === 1 ? '' : 's'} in the last hour.` });
      onSent?.();
    } catch (err) {
      setState({ busy: false, ok: false, message: err.message });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#101B28]/90 p-5 space-y-3">
      <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#E8A94D]" /><h3 className="text-sm font-bold font-display text-[#F2F5F7]">Report the crowd</h3></div>
      <p className="text-xs text-slate-400">At a station right now? Tell others how it feels. Reports are blended into that station{'’'}s reading and fade after an hour.</p>
      <StationAutocomplete label="Station" placeholder="Where are you?" value={station} onChange={setStation} stationsMap={stationsMap} />
      <div className="grid grid-cols-2 gap-2">
        {LEVELS.map((level) => {
          const c = getCrowdConfig(level);
          return (
            <button key={level} type="button" disabled={state.busy} onClick={() => send(level)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono border cursor-pointer transition-all hover:brightness-125 disabled:opacity-50 ${c.bgClass}`}>
              <Send className="w-3 h-3" />{level}
            </button>
          );
        })}
      </div>
      {state.message && <p role="status" className={`text-xs ${state.ok ? 'text-[#4bbd97]' : 'text-[#d95561]'}`}>{state.message}</p>}
    </div>
  );
}

export default function LivePulse({ stationsMap, onNavigate }) {
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [rain, setRain] = useState(false);
  const [tick, setTick] = useState(0);
  const [showSources, setShowSources] = useState(false);

  const load = useCallback(() => {
    fetchLive(rain).then((data) => { setSnap(data); setError(null); }).catch((err) => setError(err.message));
    setTick((t) => t + 1);
  }, [rain]);

  useEffect(() => {
    // Refresh now and then every 20 seconds, pausing while the tab is hidden.
    const first = setTimeout(load, 0);
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const running = snap?.lines.filter((l) => l.in_service).length ?? 0;
  const top = snap?.hotspots[0];

  return (
    <div className="space-y-8 pt-8 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <span className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full bg-[#B33A44]/15 text-[#ee6b78] border border-[#B33A44]/40">
            <span className="w-2 h-2 rounded-full bg-[#ee6b78] animate-pulse" />LIVE {'·'} SIMULATED FEED
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#F2F5F7]">Live network pulse</h1>
          <p className="text-sm sm:text-base text-slate-300">
            How crowded every line is right now, by direction and station. Readings come from a crowd model, adjusted by rider reports.
            Fluctuations and service alerts are simulated, as there is no operator data feed.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400" aria-live="polite">{snap ? `Updated ${snap.as_of.slice(11, 19)} IST` : 'Loading...'}</span>
          <button type="button" onClick={load} className="p-2 rounded-xl bg-[#101B28] border border-slate-700 text-slate-300 hover:text-[#3FCFE0] hover:border-[#3FCFE0]/50 cursor-pointer transition-colors" aria-label="Refresh now">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setRain((r) => !r)} aria-pressed={rain}
            className={`flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-xl border cursor-pointer transition-colors ${rain ? 'bg-[#3FCFE0]/20 border-[#3FCFE0]/60 text-[#3FCFE0]' : 'bg-[#101B28] border-slate-700 text-slate-300'}`}>
            <CloudRain className="w-3.5 h-3.5" />What if it rains
          </button>
          <button type="button" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-xl border bg-[#101B28] border-slate-700 text-slate-300 hover:text-[#3FCFE0] cursor-pointer transition-colors">
            <Info className="w-3.5 h-3.5" />How is this made?
          </button>
        </div>
      </header>

      {showSources && snap && (
        <ul className="grid md:grid-cols-3 gap-3 text-xs text-slate-300">
          {Object.entries(snap.sources).map(([k, v]) => (
            <li key={k} className="rounded-2xl bg-[#101B28]/90 border border-slate-800 p-4"><div className="font-mono uppercase text-[#3FCFE0] mb-1">{k}</div>{v}</li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-sm text-[#d95561] bg-[#B33A44]/10 border border-[#B33A44]/40 rounded-2xl px-4 py-3">{error}</p>}

      {snap && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [Flame, 'Busiest right now', top ? top.station : '-', top ? `${top.line} · ${top.level}` : ''],
              [TrainFront, 'Lines running', `${running} of ${snap.lines.length}`, snap.day_type],
              [Siren, 'Service alerts', String(snap.alerts.length), snap.alerts.length ? 'simulated' : 'all clear'],
              [Users, 'Rider reports', String(snap.reports_last_hour), 'in the last hour'],
            ].map(([Icon, label, value, sub]) => (
              <div key={label} className="rounded-2xl bg-[#101B28]/90 border border-slate-800 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500"><Icon className="w-3 h-3" />{label}</div>
                <div className="text-xl font-bold font-display text-[#F2F5F7] mt-1 truncate">{value}</div>
                <div className="text-[11px] text-slate-400">{sub}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {snap.lines.map((entry) => <LineCard key={entry.line} entry={entry} />)}
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-[#E8A94D]" /><h3 className="text-sm font-bold font-display text-[#F2F5F7]">Busiest stations</h3></div>
              <ol className="space-y-2.5">
                {snap.hotspots.map((h, i) => {
                  const c = getLineConfig(h.line);
                  return (
                    <li key={h.station_id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
                      <span className="text-xs font-mono text-slate-500">{i + 1}</span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-[#F2F5F7] font-medium truncate">{h.station}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border shrink-0" style={{ color: c.color, borderColor: `${c.color}66` }}>{h.line.replace(' Line', '')}</span>
                        </div>
                        <CrowdBar level={h.level} index={h.index} />
                      </div>
                      <span className="text-xs font-mono tabular-nums" style={{ color: getCrowdConfig(h.level).color }}>{h.index}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="lg:col-span-5 space-y-6">
              <section className="rounded-3xl border border-slate-800/90 bg-[#101B28]/85 p-5 space-y-3">
                <div className="flex items-center gap-2"><Siren className="w-4 h-4 text-[#E8A94D]" /><h3 className="text-sm font-bold font-display text-[#F2F5F7]">Service alerts</h3><span className="ml-auto text-[10px] font-mono text-slate-500">simulated</span></div>
                {snap.alerts.length === 0 ? (
                  <p className="text-sm text-slate-300">No disruptions right now. All running lines are on schedule.</p>
                ) : (
                  <ul className="space-y-2">
                    {snap.alerts.map((a) => (
                      <li key={`${a.line}-${a.since}`} className="text-xs bg-[#D99A3D]/10 border border-[#D99A3D]/30 rounded-xl px-3 py-2 text-slate-200">
                        <strong className="text-[#E8A94D]">{a.line}</strong> {'—'} {a.message} <span className="text-slate-500">until {a.until.slice(11, 16)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <ReportWidget stationsMap={stationsMap} onSent={load} />
            </div>
          </div>
        </>
      )}

      <LineRibbon rain={rain} tick={tick} />
      <CrowdAtlas />

      <div className="text-center">
        <button type="button" onClick={() => onNavigate?.('plan')} className="text-xs font-mono text-[#3FCFE0] hover:underline cursor-pointer">
          Plan a journey around the crowds {'→'}
        </button>
      </div>
    </div>
  );
}
