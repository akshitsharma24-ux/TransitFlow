import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  IndianRupee,
  Smile,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Ticket,
  ExternalLink,
  Layers
} from 'lucide-react';
import { getLineConfig, getJourneyComplexity } from '../utils/lineColors';

export default function RouteCard({
  option,
  index,
  isSelected,
  onSelect,
  isBestOption,
  comparisonStats,
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  const legs = option.legs || [];
  const firstRideLeg = legs.find((l) => l.type === 'ride') || legs[0];
  const primaryLineConfig = getLineConfig(
    firstRideLeg?.line,
    firstRideLeg?.mode || option.mode
  );

  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      onClick={onSelect}
      className={`relative rounded-2xl border transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? 'bg-slate-900/95 border-emerald-600/80 shadow-soft-dark ring-1 ring-emerald-600/30'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
      }`}
    >
      {/* Top Accent Line */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: primaryLineConfig.color }}
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-mono border ${primaryLineConfig.bgClass}`}
              >
                {option.mode}
              </span>

              {/* Step / Transfer Count Badge */}
              <span className="flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/90 text-amber-300 border border-amber-500/30">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>{getJourneyComplexity(legs)}</span>
              </span>

              {isBestOption && (
                <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-700 text-slate-100 shadow-md">
                  <Sparkles className="w-3 h-3" />
                  <span>BEST ROUTE</span>
                </span>
              )}

              {comparisonStats && (
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50">
                  {comparisonStats}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {option.explanation}
            </p>
          </div>

          <button
            type="button"
            onClick={toggleExpand}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
            title={isExpanded ? 'Collapse itinerary' : 'Expand itinerary'}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-center font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" /> Time
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-100 departure-num">
              {option.time_minutes}{' '}
              <span className="text-xs text-slate-400 font-normal">min</span>
            </span>
          </div>

          <div className="border-x border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center justify-center gap-1">
              <IndianRupee className="w-3 h-3 text-amber-400" /> Fare
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-100 departure-num">
              ₹{option.cost_rupees}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center justify-center gap-1">
              <Smile className="w-3 h-3 text-sky-400" /> Comfort
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-100 departure-num">
              {option.comfort_score?.toFixed(1)}{' '}
              <span className="text-xs text-slate-500 font-normal">/ 5</span>
            </span>
          </div>
        </div>

        {/* Fare Pass Note */}
        {option.fare_pass && (
          <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-2.5 text-xs text-emerald-300">
            <Ticket className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 font-mono">
              <span className="font-bold">Monthly Pass (Train):</span> ₹
              {option.fare_pass.monthly_pass_cost} • Breaks even in{' '}
              <span className="font-bold text-emerald-200">
                {option.fare_pass.breakeven_commute_days} days
              </span>
            </div>
          </div>
        )}

        {/* Expandable Detailed Itinerary */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-2 pt-2 border-t border-slate-800/80 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                  Itinerary Breakdown & Booking Links
                </span>
              </div>

              {/* Modal Time Proportion Bar */}
              <div className="space-y-1 py-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>MODAL TIME SPLIT</span>
                  <span>{option.time_minutes} MIN TOTAL</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-950 flex overflow-hidden border border-slate-800/80">
                  {legs.map((l, idx) => {
                    const conf = getLineConfig(l.line, l.mode);
                    const pct = Math.max(5, (l.time_minutes / (option.time_minutes || 1)) * 100);
                    return (
                      <div
                        key={idx}
                        style={{ width: `${pct}%`, backgroundColor: conf.color }}
                        className="h-full transition-all"
                        title={`${l.line || l.mode}: ${l.time_minutes} min`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="relative pl-4 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {legs.map((leg, legIdx) => {
                  const isWalk = leg.type === 'walk';
                  const legConfig = getLineConfig(leg.line, leg.mode);
                  const Icon = legConfig.icon;
                  const ticketLink = legConfig.ticket;

                  return (
                    <div
                      key={legIdx}
                      className="relative flex items-start gap-3 group"
                    >
                      <span
                        className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-slate-950"
                        style={{ backgroundColor: legConfig.color }}
                      />

                      <div className="flex-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <Icon
                              className="w-3.5 h-3.5"
                              style={{ color: legConfig.color }}
                            />
                            <span
                              style={{ color: legConfig.color }}
                              className="font-mono"
                            >
                              {isWalk ? 'Walk Transfer' : leg.line || leg.mode}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-400">{leg.time_minutes} min</span>
                            <span className="text-slate-700">•</span>
                            <span className={isWalk ? "text-slate-500 font-normal" : "text-emerald-400 font-bold"}>
                              {isWalk ? 'Free' : `₹${leg.cost_rupees ?? 0}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <span>{leg.from_station?.name}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>{leg.to_station?.name}</span>
                        </div>

                        {/* Official Ticket Link */}
                        {ticketLink && !isWalk && (
                          <a
                            href={ticketLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 pt-1"
                          >
                            <span>{ticketLink.label}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
