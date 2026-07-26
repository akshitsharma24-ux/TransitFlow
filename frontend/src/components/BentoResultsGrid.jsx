import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Sparkles,
  Ticket,
  ExternalLink,
  Zap,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin,
  TrendingDown,
  Info
} from 'lucide-react';
import { getLineConfig, getJourneyComplexity } from '../utils/lineColors';
import MapPanel from './MapPanel';

export default function BentoResultsGrid({
  options = [],
  selectedIndex = 0,
  onSelectOption,
  stationsMap = {},
  priority = 'fastest',
}) {
  if (!options || options.length === 0) return null;

  // Track expanded state for each card independently (by index)
  // Default option 0 (recommended route) to expanded
  const [expandedCards, setExpandedCards] = useState({ 0: true });

  const toggleExpand = (idx, e) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const selectedOption = options[selectedIndex] || options[0];

  // Time metrics for analytics banner
  const times = options.map((o) => o.time_minutes);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const bestOption = options[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
      {/* LEFT COLUMN: All Route Option Cards Stacked (7 Cols on desktop) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Header analytics badge */}
        <div className="flex items-center justify-between px-2 py-1 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-[#3FCFE0]">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>SHOWING ALL <strong className="text-[#F2F5F7]">{options.length}</strong> ROUTE CHOICES</span>
          </span>
          <span>RANGE: {minTime}m - {maxTime}m</span>
        </div>

        {/* List of All Returned Options in API Order */}
        {options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          const isExpanded = !!expandedCards[idx];
          const legs = option.legs || [];
          const isTopResult = idx === 0;

          const displayMode = Array.isArray(option.modes)
            ? option.modes.filter((m) => m !== 'walk').join(' + ') || 'walk'
            : (option.mode || 'transit');

          const primaryLine = getLineConfig(
            legs.find((l) => l.type === 'ride')?.line,
            legs.find((l) => l.type === 'ride')?.mode || displayMode
          );

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              onClick={() => onSelectOption(idx)}
              className={`relative rounded-3xl p-5 md:p-6 border transition-all cursor-pointer overflow-hidden ${
                isSelected
                  ? 'bg-[#101B28]/95 border-[#3FCFE0]/80 shadow-[0_0_30px_rgba(63,207,224,0.25)] ring-1 ring-[#3FCFE0]/40'
                  : 'bg-[#101B28]/70 border-slate-800/80 hover:border-slate-700 hover:bg-[#101B28]/90'
              }`}
            >
              {/* Top Accent Line for Option #1 */}
              {isTopResult && (
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: primaryLine.color }}
                />
              )}

              <div className="space-y-4">
                {/* Option Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isTopResult ? (
                        <span className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#3FCFE0] to-[#4DD9E8] text-[#0B1622] shadow-[0_0_15px_rgba(63,207,224,0.4)]">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>RECOMMENDED #1 ROUTE</span>
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#0B1622] text-[#3FCFE0] border border-[#3FCFE0]/30">
                          OPTION #{idx + 1}
                        </span>
                      )}

                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono capitalize border ${primaryLine.bgClass}`}>
                        {displayMode}
                      </span>

                      <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#0B1622] text-slate-300 border border-slate-800">
                        <Layers className="w-3 h-3 text-slate-400" />
                        <span>{getJourneyComplexity(legs)}</span>
                      </span>
                    </div>

                    <h3 className="text-lg md:text-xl font-bold font-display text-[#F2F5F7] tracking-tight pt-0.5 truncate">
                      {legs[0]?.from_station?.name || 'Origin'} → {legs[legs.length - 1]?.to_station?.name || 'Destination'}
                    </h3>
                  </div>

                  {/* Fare Badge (API direct value) */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold font-mono text-[#3FCFE0] bg-[#0B1622] border border-[#3FCFE0]/30 px-3.5 py-1 rounded-2xl inline-flex items-center gap-0.5 shadow-md">
                      <span>₹</span>
                      <span>{option.cost_rupees}</span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Bar */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-3.5 bg-[#0B1622] rounded-2xl border border-slate-800/80 font-mono">
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#3FCFE0]" /> Time
                    </span>
                    <span className="text-lg sm:text-2xl font-bold text-[#F2F5F7]">
                      {option.time_minutes} <span className="text-xs font-normal text-slate-400">min</span>
                    </span>
                  </div>

                  <div className="border-x border-slate-800 pl-2 sm:pl-3">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[#E8A94D]" /> Comfort
                    </span>
                    <span className="text-lg sm:text-2xl font-bold text-[#F2F5F7]">
                      {option.comfort_score?.toFixed(1)} <span className="text-xs font-normal text-slate-500">/ 5</span>
                    </span>
                  </div>

                  <div className="pl-2 sm:pl-3">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                      <Info className="w-3 h-3 text-[#4DD9E8]" /> Fare
                    </span>
                    <span className="text-sm sm:text-base font-bold text-[#3FCFE0] block pt-1">
                      ₹{option.cost_rupees} total
                    </span>
                  </div>
                </div>

                {/* Summary Explanation */}
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {option.explanation}
                </p>

                {/* Toggle Breakdown Button */}
                <div className="pt-1 flex items-center justify-between border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(idx, e)}
                    className="text-xs font-mono font-semibold text-[#3FCFE0] hover:text-[#70E2F0] flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-[#3FCFE0]/10 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Detailed Itinerary' : 'View Full Detailed Itinerary'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  <span className="text-[11px] font-mono text-slate-400">
                    {legs.length} leg{legs.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Expandable Leg-by-Leg Itinerary Breakdown */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden pt-2 space-y-3"
                    >
                      <div className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">
                        Leg Breakdown & Direct Ticketing
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {legs.map((leg, legIdx) => {
                          const conf = getLineConfig(leg.line, leg.mode);
                          const Icon = conf.icon;
                          const ticketLink = conf.ticket;

                          return (
                            <div
                              key={legIdx}
                              className="bg-[#0B1622] p-3 rounded-2xl border border-slate-800/80 text-xs flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span
                                    className="font-mono font-semibold text-[11px] flex items-center gap-1"
                                    style={{ color: conf.color }}
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{leg.type === 'walk' ? 'Walk Transfer' : leg.line || leg.mode}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                    <span className="text-slate-400">{leg.time_minutes}m</span>
                                    <span className="text-slate-700">•</span>
                                    <span className={leg.type === 'walk' ? 'text-slate-500' : 'text-[#3FCFE0] font-bold'}>
                                      {leg.type === 'walk' ? 'Free' : `₹${leg.cost_rupees ?? 0}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-[11px] text-[#F2F5F7] truncate mt-1.5 font-sans">
                                  {leg.from_station?.name} → {leg.to_station?.name}
                                </div>
                              </div>

                              {/* Official External Ticket Link */}
                              {ticketLink && leg.type !== 'walk' && (
                                <a
                                  href={ticketLink.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-between text-[11px] font-mono font-medium text-[#3FCFE0] hover:text-[#70E2F0] bg-[#3FCFE0]/10 hover:bg-[#3FCFE0]/20 border border-[#3FCFE0]/30 px-2.5 py-1 rounded-xl transition-colors mt-1"
                                  title={`Open official ${ticketLink.appName} page`}
                                >
                                  <span>{ticketLink.label}</span>
                                  <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Monthly Pass Callout */}
                      {option.fare_pass && (
                        <div className="flex items-center gap-2.5 bg-[#3FCFE0]/10 border border-[#3FCFE0]/30 rounded-2xl p-3 text-xs text-[#3FCFE0] font-mono">
                          <Ticket className="w-4 h-4 text-[#3FCFE0] flex-shrink-0" />
                          <div>
                            <strong>Pass Recommended:</strong> Monthly train pass at ₹
                            {option.fare_pass.monthly_pass_cost} breaks even in{' '}
                            <strong className="text-[#F2F5F7]">{option.fare_pass.breakeven_commute_days} days</strong>.
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* RIGHT COLUMN: Sticky Interactive Map Panel (5 Cols on desktop) */}
      <div className="lg:col-span-5 lg:sticky lg:top-[80px] space-y-4">
        <div className="relative rounded-3xl overflow-hidden border border-[#3FCFE0]/25 shadow-[0_0_30px_rgba(11,22,34,0.9)] min-h-[420px] flex flex-col bg-[#101B28]">
          <MapPanel selectedOption={selectedOption} stationsMap={stationsMap} />
        </div>

        {/* Commute Summary Analytics Badge */}
        <div className="rounded-3xl p-5 bg-[#101B28]/80 border border-slate-800/80 space-y-3 font-mono text-xs text-slate-300">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3FCFE0] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>FastAPI Route Intelligence</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800">
            <span className="text-slate-400">Total Route Options:</span>
            <span className="font-bold text-[#F2F5F7]">{options.length} options</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800">
            <span className="text-slate-400">Selected Route:</span>
            <span className="font-bold text-[#3FCFE0]">
              Option #{selectedIndex + 1} ({Array.isArray(selectedOption.modes) ? selectedOption.modes.filter((m) => m !== 'walk').join(' + ') : (selectedOption.mode || 'transit')})
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Selected Fare:</span>
            <span className="font-bold text-[#E8A94D]">₹{selectedOption.cost_rupees} ({selectedOption.time_minutes}m)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
