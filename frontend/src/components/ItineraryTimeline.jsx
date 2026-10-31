import { motion } from 'framer-motion';
import { Clock3, Flag, Footprints, Lightbulb, TriangleAlert } from 'lucide-react';
import { getLineConfig } from '../utils/lineColors';
import { clock, minutesLabel } from '../utils/time';
import CrowdChip, { CrowdBar } from './CrowdChip';
import { seatText } from '../utils/crowd';

function Row({ time, rail, children, delay = 0 }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="grid grid-cols-[3.25rem_1.75rem_1fr] gap-x-2 sm:gap-x-3"
    >
      <div className="pt-1 text-right font-mono text-xs text-slate-300 tabular-nums">{time}</div>
      <div className="flex flex-col items-center">{rail}</div>
      <div className="pb-4 min-w-0">{children}</div>
    </motion.li>
  );
}

const Line = ({ color, dashed }) => (
  <span
    className="w-1 flex-1 rounded-full min-h-[28px]"
    style={dashed ? { backgroundImage: `repeating-linear-gradient(${color} 0 4px, transparent 4px 9px)` } : { backgroundColor: color }}
  />
);

const Dot = ({ color, children }) => (
  <span
    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ring-4 ring-[#101B28]"
    style={{ backgroundColor: color }}
  >
    {children}
  </span>
);

/** Clock-based itinerary: wait, ride, walk and arrive, each with its time and crowd. */
export default function ItineraryTimeline({ itinerary, originName, destinationName }) {
  const { steps } = itinerary;
  return (
    <div className="space-y-4">
      <ol>
        <Row time={clock(itinerary.depart)} rail={<><Dot color="#0F9B6E">A</Dot><Line color="#334155" dashed /></>}>
          <div className="text-sm font-bold text-[#F2F5F7] leading-tight">{originName}</div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Start</div>
        </Row>

        {steps.map((step, i) => {
          const delay = Math.min(i * 0.05, 0.4);
          if (step.kind === 'wait') {
            return (
              <Row key={i} time={clock(step.start)} delay={delay}
                rail={<Line color="#475569" dashed />}>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Clock3 className="w-3 h-3" />
                  <span>Wait {step.minutes} min at {step.from_station.name}</span>
                </div>
                {step.note && <div className="text-[11px] text-slate-500 mt-0.5">{step.note}</div>}
              </Row>
            );
          }
          if (step.kind === 'walk') {
            return (
              <Row key={i} time={clock(step.start)} delay={delay}
                rail={<Line color="#64748b" dashed />}>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Footprints className="w-3 h-3 text-slate-400" />
                  <span>{step.minutes} min</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{step.note}</div>
              </Row>
            );
          }
          const conf = getLineConfig(step.line, step.mode);
          const Icon = conf.icon;
          const label = step.line || (step.mode === 'road' ? 'Car / Auto' : step.mode === 'bus' ? 'Bus' : step.mode);
          return (
            <Row key={i} time={clock(step.start)} delay={delay}
              rail={<Line color={conf.color} />}>
              <div className="rounded-2xl border bg-[#0B1622]/70 p-3 space-y-2" style={{ borderColor: `${conf.color}55` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md ${conf.badgeClass}`}>
                    <Icon className="w-3 h-3" />{label}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {minutesLabel(step.minutes)}{step.stops > 1 ? ` · ${step.stops} stops` : ''} · {'₹'}{step.cost_rupees}
                  </span>
                  <span className="ml-auto text-[11px] font-mono text-slate-500">arrive {clock(step.end)}</span>
                </div>
                <div className="text-sm text-[#F2F5F7]">
                  {step.from_station.name} <span className="text-slate-500">{'→'}</span> {step.to_station.name}
                </div>
                {step.crowd && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CrowdChip level={step.crowd.level} index={step.crowd.index} size="sm" />
                      <span className="text-[11px] text-slate-400">{seatText(step.crowd.seat_chance)}</span>
                    </div>
                    <CrowdBar level={step.crowd.level} index={step.crowd.index} />
                    {step.line && step.minutes >= 12 && step.crowd.index >= 55 && (
                      <div className="text-[11px] text-slate-500">Heaviest around {step.crowd.peak_station}</div>
                    )}
                  </div>
                )}
              </div>
            </Row>
          );
        })}

        <li className="grid grid-cols-[3.25rem_1.75rem_1fr] gap-x-2 sm:gap-x-3">
          <div className="pt-1 text-right font-mono text-xs text-slate-300 tabular-nums">{clock(itinerary.arrive)}</div>
          <div className="flex flex-col items-center"><Dot color="#C0263B"><Flag className="w-3 h-3" /></Dot></div>
          <div>
            <div className="text-sm font-bold text-[#F2F5F7] leading-tight">{destinationName}</div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Arrive</div>
          </div>
        </li>
      </ol>

      {itinerary.warnings?.map((w) => (
        <div key={w} className="flex items-start gap-2 text-xs text-[#E8A94D] bg-[#D99A3D]/10 border border-[#D99A3D]/30 rounded-2xl px-3.5 py-2.5">
          <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{w}</span>
        </div>
      ))}
      {itinerary.tips?.length > 0 && (
        <ul className="space-y-1.5">
          {itinerary.tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs text-slate-300 bg-[#0B1622]/60 border border-slate-800 rounded-2xl px-3.5 py-2.5">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#3FCFE0]" /><span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
