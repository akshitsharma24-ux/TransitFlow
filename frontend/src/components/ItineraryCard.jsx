import { motion } from 'framer-motion';
import { ArrowRight, Repeat2 } from 'lucide-react';
import { getLineConfig } from '../utils/lineColors';
import { clock, minutesLabel } from '../utils/time';
import CrowdChip from './CrowdChip';

/** Compact summary of one itinerary; used as a selectable tile. */
export default function ItineraryCard({ itinerary, selected, onSelect, index = 0 }) {
  const rides = itinerary.steps.filter((s) => s.kind === 'ride');
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      aria-pressed={selected}
      className={`text-left w-full rounded-2xl border p-4 space-y-3 transition-all cursor-pointer ${
        selected
          ? 'bg-[#3FCFE0]/10 border-[#3FCFE0]/70 shadow-[0_0_24px_rgba(63,207,224,0.18)]'
          : 'bg-[#101B28]/85 border-slate-800 hover:border-[#3FCFE0]/40'
      }`}
    >
      <div className="flex flex-wrap gap-1.5 min-h-[20px]">
        {itinerary.badges.map((b) => (
          <span key={b} className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
            b === 'Recommended' ? 'bg-[#3FCFE0]/20 border-[#3FCFE0]/50 text-[#3FCFE0]' : 'bg-[#0B1622] border-slate-700 text-slate-300'
          }`}>{b}</span>
        ))}
      </div>

      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-lg font-bold text-[#F2F5F7] tabular-nums">{clock(itinerary.depart)}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-500 self-center" />
        <span className="text-lg font-bold text-[#F2F5F7] tabular-nums">{clock(itinerary.arrive)}</span>
      </div>

      <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
        <span>{minutesLabel(itinerary.duration_minutes)}</span>
        <span className="text-[#3FCFE0]">{'₹'}{itinerary.cost_rupees}</span>
        {itinerary.transfers > 0 && (
          <span className="flex items-center gap-1 text-slate-400"><Repeat2 className="w-3 h-3" />{itinerary.transfers}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {rides.map((r, i) => {
          const conf = getLineConfig(r.line, r.mode);
          return (
            <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conf.color }} title={r.line || r.mode} />
          );
        })}
        <span className="text-[11px] text-slate-400 truncate">{itinerary.label}</span>
      </div>

      <CrowdChip level={itinerary.crowd.level} index={itinerary.crowd.index} size="sm" />
    </motion.button>
  );
}
