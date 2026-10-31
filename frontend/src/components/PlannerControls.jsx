import { motion } from 'framer-motion';
import { CalendarDays, CloudRain, CloudSun, IndianRupee, Repeat2, Smile, Sparkles, Users, Zap } from 'lucide-react';
import { addDays, dayLabel, istNow, roundUpFive } from '../utils/time';
import { fieldLabel, inputClass } from '../utils/formStyles';

const PREFERENCES = [
  { id: 'balanced', label: 'Smart pick', icon: Sparkles, hint: 'Weighs time, fare, crowd and changes together' },
  { id: 'fastest', label: 'Fastest', icon: Zap, hint: 'Shortest door-to-door time' },
  { id: 'cheapest', label: 'Cheapest', icon: IndianRupee, hint: 'Lowest fare' },
  { id: 'comfortable', label: 'Comfortable', icon: Smile, hint: 'Better vehicles and less crowding' },
  { id: 'least_crowded', label: 'Least crowded', icon: Users, hint: 'Avoid packed trains where possible' },
  { id: 'fewest_transfers', label: 'Fewest changes', icon: Repeat2, hint: 'As direct as possible' },
];

function Segment({ options, value, onChange, label }) {
  return (
    <div className="grid gap-1 bg-[#0B1622] p-1 rounded-2xl border border-[#3FCFE0]/25" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={`relative py-2 px-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${selected ? 'text-[#0B1622] font-bold' : 'text-slate-300 hover:text-[#F2F5F7]'}`}
          >
            {selected && (
              <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#3FCFE0] to-[#2BB5C6]" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const chip = (active) => `px-3 py-1.5 rounded-xl text-xs font-mono border transition-colors cursor-pointer ${
  active ? 'bg-[#3FCFE0]/20 border-[#3FCFE0]/60 text-[#3FCFE0]' : 'bg-[#0B1622] border-slate-800 text-slate-300 hover:border-[#3FCFE0]/40'}`;

/** Leave-at / arrive-by switch with a date and a time. */
export function WhenPicker({ when, onWhen, date, onDate, time, onTime, showMode = true, timeLabel }) {
  const today = istNow().date;
  const nowTime = roundUpFive(istNow().time);
  return (
    <div className="space-y-3">
      {showMode && (
        <div>
          <span className={fieldLabel}>When</span>
          <Segment label="when" value={when} onChange={onWhen}
            options={[{ id: 'depart', label: 'Leave at' }, { id: 'arrive', label: 'Arrive by' }]} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel} htmlFor={`date-${timeLabel || 'main'}`}><CalendarDays className="inline w-3 h-3 mr-1 -mt-0.5" />Date</label>
          <input id={`date-${timeLabel || 'main'}`} type="date" value={date} min={addDays(today, -1)} max={addDays(today, 90)}
            onChange={(e) => e.target.value && onDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`time-${timeLabel || 'main'}`}>{timeLabel || (when === 'arrive' ? 'Arrive by' : 'Leave at')}</label>
          <input id={`time-${timeLabel || 'main'}`} type="time" value={time} onChange={(e) => e.target.value && onTime(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(date === today)} onClick={() => onDate(today)}>Today</button>
        <button type="button" className={chip(date === addDays(today, 1))} onClick={() => onDate(addDays(today, 1))}>Tomorrow</button>
        <span className="w-px bg-slate-800 mx-1" />
        {[['Now', nowTime], ['7:30', '07:30'], ['9:00', '09:00'], ['13:00', '13:00'], ['18:00', '18:00'], ['21:00', '21:00']].map(([label, value]) => (
          <button key={label} type="button" className={chip(time === value)}
            onClick={() => { onTime(value); if (label === 'Now') onDate(today); }}>{label}</button>
        ))}
      </div>
      <p className="text-[11px] font-mono text-slate-500">{dayLabel(date)}</p>
    </div>
  );
}

export function PreferencePicker({ value, onChange }) {
  return (
    <div>
      <span className={fieldLabel}>What matters most</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" role="group" aria-label="Preference">
        {PREFERENCES.map((p) => {
          const Icon = p.icon;
          const selected = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              aria-pressed={selected}
              onClick={() => onChange(p.id)}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                selected
                  ? 'bg-gradient-to-r from-[#3FCFE0] to-[#2BB5C6] text-[#0B1622] border-transparent font-bold shadow-[0_0_18px_rgba(63,207,224,0.35)]'
                  : 'bg-[#0B1622] border-slate-800 text-slate-300 hover:border-[#3FCFE0]/40'}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" /><span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Auto (real forecast) / Rain / Dry, with the forecast shown when available. */
export function RainControl({ mode, onMode, forecast, loading, effective }) {
  return (
    <div>
      <span className={fieldLabel}>Weather</span>
      <Segment label="rain" value={mode} onChange={onMode}
        options={[{ id: 'auto', label: 'Auto forecast' }, { id: 'on', label: 'Rain' }, { id: 'off', label: 'Dry' }]} />
      <p className="mt-1.5 text-[11px] font-mono text-slate-400 flex items-center gap-1.5 min-h-[16px]">
        {effective ? <CloudRain className="w-3.5 h-3.5 text-[#3FCFE0]" /> : <CloudSun className="w-3.5 h-3.5 text-[#E8A94D]" />}
        {mode === 'auto' ? (
          loading ? 'Checking the Mumbai forecast...'
            : forecast ? `Forecast: ${forecast.probability}% chance of rain, ${forecast.millimetres.toFixed(1)} mm in that hour`
              : 'Forecast unavailable for this date, planning as dry'
        ) : mode === 'on' ? 'Planning for rain' : 'Planning for dry weather'}
      </p>
    </div>
  );
}

export function AvoidToggles({ avoid, onChange }) {
  const toggle = (mode) => onChange(avoid.includes(mode) ? avoid.filter((m) => m !== mode) : [...avoid, mode]);
  return (
    <div>
      <span className={fieldLabel}>Avoid</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(avoid.includes('bus'))} aria-pressed={avoid.includes('bus')} onClick={() => toggle('bus')}>Buses</button>
        <button type="button" className={chip(avoid.includes('road'))} aria-pressed={avoid.includes('road')} onClick={() => toggle('road')}>Cabs and autos</button>
      </div>
    </div>
  );
}
