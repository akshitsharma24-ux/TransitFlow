import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';
import { getCrowdConfig } from '../utils/lineColors';
import { clock, minutesLabel } from '../utils/time';

/**
 * Crowd and journey time for the same trip at different departure times.
 * Bar height is the crowd index, so the rush-hour hump is easy to see.
 */
export default function DepartureAdvisor({ advisor, when, onPick }) {
  const [hovered, setHovered] = useState(null);
  const { window: slots, selected_index: selectedIndex, best_index: bestIndex, insight } = advisor;
  const active = slots[hovered ?? selectedIndex];
  const arriveMode = when === 'arrive';

  return (
    <section className="rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#3FCFE0]" />
        <h3 className="text-sm font-bold font-display text-[#F2F5F7]">Smart departure advisor</h3>
        <span className="ml-auto text-[10px] font-mono text-slate-500">same trip, different start times</span>
      </div>

      <p className="text-sm text-slate-200 bg-[#3FCFE0]/10 border border-[#3FCFE0]/25 rounded-2xl px-4 py-2.5">{insight}</p>

      <div>
        <div className="flex items-end gap-1 h-36" role="list" aria-label="Crowd by departure time">
          {slots.map((slot, i) => {
            const conf = getCrowdConfig(slot.crowd_level);
            const isSelected = i === selectedIndex;
            const isBest = i === bestIndex && bestIndex !== selectedIndex;
            const late = slot.feasible === false;
            return (
              <div key={slot.depart} role="listitem" className="relative flex-1 h-full flex flex-col justify-end items-center">
                {isBest && <Star className="w-3 h-3 text-[#E8A94D] fill-[#E8A94D] mb-0.5" aria-label="Best slot" />}
                <motion.button
                  type="button"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(8, slot.crowd_score * 100)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={() => !late && onPick?.(slot)}
                  disabled={late}
                  aria-label={`Leave ${clock(slot.depart)}, arrive ${clock(slot.arrive)}, ${slot.crowd_level} crowd${late ? ', arrives too late' : ''}`}
                  className={`w-full rounded-t-[4px] outline-none ${late ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{
                    backgroundColor: conf.color,
                    opacity: late ? 0.25 : isSelected || hovered === i ? 1 : 0.55,
                    outline: isSelected ? '2px solid #3FCFE0' : 'none',
                    outlineOffset: '1px',
                    backgroundImage: late ? 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.45) 4px 8px)' : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] font-mono text-slate-500">
          {slots.filter((_, i) => i % 4 === 0).map((s) => <span key={s.depart}>{clock(s.depart)}</span>)}
        </div>
      </div>

      {active && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-300 bg-[#0B1622]/70 border border-slate-800 rounded-2xl px-3.5 py-2.5">
          <span>Leave <strong className="text-[#F2F5F7]">{clock(active.depart)}</strong></span>
          <span>Arrive <strong className="text-[#F2F5F7]">{clock(active.arrive)}</strong></span>
          <span>{minutesLabel(active.duration_minutes)}</span>
          <span className="text-[#3FCFE0]">{'₹'}{active.cost_rupees}</span>
          <span style={{ color: getCrowdConfig(active.crowd_level).color }}>{active.crowd_level}</span>
          <span className="text-slate-500 truncate">{active.label}</span>
          {active.feasible === false && <span className="text-[#d95561]">arrives too late</span>}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-slate-400">
        {['Comfortable', 'Moderate', 'Busy', 'Packed'].map((l) => (
          <span key={l} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getCrowdConfig(l).color }} />{l}
          </span>
        ))}
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm ring-2 ring-[#3FCFE0]" />Your time</span>
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-[#E8A94D] fill-[#E8A94D]" />Best</span>
        <span className="ml-auto">{arriveMode ? 'Click a slot to plan that departure' : 'Click a bar to re-plan from that time'}</span>
      </div>
    </section>
  );
}
