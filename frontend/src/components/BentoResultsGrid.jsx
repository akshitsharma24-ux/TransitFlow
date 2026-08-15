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
  Info,
  CheckCircle2,
  Share2,
  Check
} from 'lucide-react';
import { Users } from 'lucide-react';
import { getLineConfig, getJourneyComplexity, getCrowdConfig } from '../utils/lineColors';
import MapPanel from './MapPanel';
import RouteComparisonChart from './RouteComparisonChart';
import JourneyTimeline from './JourneyTimeline';
import BestTimeToTravel from './BestTimeToTravel';

function CrowdBadge({ forecast }) {
  if (!forecast) return null;
  const conf = getCrowdConfig(forecast.level);
  return (
    <span
      className={`flex items-center gap-1.5 text-xs px-3 py-0.5 rounded-full font-mono border ${conf.bgClass}`}
      title={`Predicted crowd on ${forecast.driver} around ${forecast.hour}:00 (${forecast.day_type}) — heuristic, based on time-of-day and line patterns`}
    >
      <Users className="w-3 h-3" />
      <span>{conf.label}</span>
      <span className="flex items-end gap-[1.5px] h-2.5 ml-0.5">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className="w-[3px] rounded-sm"
            style={{
              height: `${b * 25}%`,
              backgroundColor: b <= conf.bars ? conf.color : 'currentColor',
              opacity: b <= conf.bars ? 1 : 0.25,
            }}
          />
        ))}
      </span>
    </span>
  );
}

export default function BentoResultsGrid({
  options = [],
  selectedIndex = 0,
  onSelectOption,
  stationsMap = {},
  priority = 'fastest',
  routeData = null,
}) {
  // Track expanded state for each card independently
  const [expandedCards, setExpandedCards] = useState({ 0: true });
  const [justCopied, setJustCopied] = useState(false);

  if (!options || options.length === 0) return null;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1800);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const toggleExpand = (idx, e) => {
    e.stopPropagation();
    setExpandedCards((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const selectedOption = options[selectedIndex] || options[0];

  const times = options.map((o) => o.time_minutes);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return (
    <section className="space-y-8 w-full pt-4">
      {/* Results Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3FCFE0]/25">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#3FCFE0]/20 text-[#3FCFE0] border border-[#3FCFE0]/40 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SEARCH COMPLETE</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              FOUND <strong className="text-[#F2F5F7]">{options.length}</strong> COMPARABLE ROUTES
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#F2F5F7] tracking-tight">
            Compare Route Options
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300 bg-[#101B28] px-4 py-2 rounded-2xl border border-slate-800">
            <TrendingDown className="w-4 h-4 text-[#3FCFE0]" />
            <span>Trip duration range: <strong className="text-[#F2F5F7]">{minTime}m – {maxTime}m</strong></span>
          </div>

          {routeData && (
            <button
              type="button"
              onClick={handleShare}
              title="Copy a shareable link to this search"
              className={`flex items-center gap-1.5 font-mono text-xs px-3.5 py-2 rounded-2xl border transition-colors cursor-pointer ${
                justCopied
                  ? 'bg-[#3FCFE0]/20 border-[#3FCFE0]/50 text-[#3FCFE0]'
                  : 'bg-[#101B28] border-slate-800 text-slate-300 hover:border-[#3FCFE0]/40 hover:text-[#3FCFE0]'
              }`}
            >
              {justCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{justCopied ? 'Copied' : 'Share'}</span>
            </button>
          )}
        </div>
      </div>

      <RouteComparisonChart
        options={options}
        selectedIndex={selectedIndex}
        onSelectOption={onSelectOption}
      />

      {/* Main Grid: Stacked Scannable Cards (Left 7 Cols) & Immersive Map (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: All Route Choices Stacked (Not a carousel) */}
        <div className="lg:col-span-7 space-y-5">
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.06 }}
                whileHover={{ y: -4 }}
                onClick={() => onSelectOption(idx)}
                className={`relative rounded-3xl p-6 sm:p-7 border transition-all cursor-pointer overflow-hidden backdrop-blur-xl ${
                  isSelected
                    ? 'bg-[#101B28]/95 border-[#3FCFE0]/80 shadow-[0_0_35px_rgba(63,207,224,0.3)] ring-2 ring-[#3FCFE0]/50'
                    : 'bg-[#101B28]/80 border-slate-800/90 hover:border-[#3FCFE0]/40 hover:bg-[#101B28]/95 shadow-lg'
                }`}
              >
                {/* Physical Line Color Accent Strip at top of card */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: primaryLine.color }}
                />

                <div className="space-y-5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isTopResult ? (
                          <span className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#3FCFE0] via-[#4DD9E8] to-[#2BB5C6] text-[#0B1622] shadow-[0_0_15px_rgba(63,207,224,0.4)]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>RECOMMENDED #1 ROUTE</span>
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#0B1622] text-[#3FCFE0] border border-[#3FCFE0]/30">
                            OPTION #{idx + 1}
                          </span>
                        )}

                        <span className={`text-xs px-3 py-0.5 rounded-full font-mono capitalize border ${primaryLine.bgClass}`}>
                          {displayMode}
                        </span>

                        <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-0.5 rounded-full bg-[#0B1622] text-slate-300 border border-slate-800">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{getJourneyComplexity(legs)}</span>
                        </span>

                        {option.via && option.via.length > 0 && (
                          <span
                            className="text-xs px-3 py-0.5 rounded-full font-mono bg-[#E8A94D]/10 text-[#E8A94D] border border-[#E8A94D]/30"
                            title="Interchange station(s) this alternative transfers at"
                          >
                            via {option.via.join(' + ')}
                          </span>
                        )}

                        <CrowdBadge forecast={option.crowd_forecast} />
                      </div>

                      <h3 className="text-xl sm:text-2xl font-bold font-display text-[#F2F5F7] tracking-tight truncate">
                        {legs[0]?.from_station?.name || 'Origin'} → {legs[legs.length - 1]?.to_station?.name || 'Destination'}
                      </h3>
                    </div>

                    {/* Fare Callout Badge */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#3FCFE0] bg-[#0B1622] border border-[#3FCFE0]/40 px-4 py-1.5 rounded-2xl inline-flex items-center gap-0.5 shadow-md">
                        <span>₹</span>
                        <span>{option.cost_rupees}</span>
                      </div>
                    </div>
                  </div>

                  {/* Key Comparison Metrics Bar */}
                  <div className="grid grid-cols-3 gap-3 p-4 bg-[#0B1622] rounded-2xl border border-slate-800/90 font-mono">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#3FCFE0]" /> Time
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-[#F2F5F7]">
                        {option.time_minutes} <span className="text-xs font-normal text-slate-400">min</span>
                      </span>
                    </div>

                    <div className="border-x border-slate-800 pl-3">
                      <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#E8A94D]" /> Comfort
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-[#F2F5F7]">
                        {option.comfort_score?.toFixed(1)} <span className="text-xs font-normal text-slate-500">/ 5</span>
                      </span>
                    </div>

                    <div className="pl-3">
                      <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-[#4DD9E8]" /> Fare
                      </span>
                      <span className="text-base sm:text-lg font-bold text-[#3FCFE0] block pt-0.5">
                        ₹{option.cost_rupees} total
                      </span>
                    </div>
                  </div>

                  {/* Summary Explanation */}
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                    {option.explanation}
                  </p>

                  {/* Expand Breakdown Toggle */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(idx, e)}
                      className="text-xs font-mono font-semibold text-[#3FCFE0] hover:text-[#70E2F0] flex items-center gap-2 py-1.5 px-3 rounded-xl hover:bg-[#3FCFE0]/10 transition-colors cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Detailed Itinerary' : 'View Full Detailed Itinerary'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <span className="text-xs font-mono text-slate-400">
                      {legs.length} step{legs.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Expandable Itinerary Breakdown */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden pt-2 space-y-4"
                      >
                        <div className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">
                          Leg-by-Leg Breakdown & Official Ticketing
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {legs.map((leg, legIdx) => {
                            const conf = getLineConfig(leg.line, leg.mode);
                            const Icon = conf.icon;
                            const ticketLink = conf.ticket;

                            return (
                              <div
                                key={legIdx}
                                className="bg-[#0B1622] p-3.5 rounded-2xl border border-slate-800/90 text-xs flex flex-col justify-between gap-3"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="font-mono font-bold text-xs flex items-center gap-1.5"
                                      style={{ color: conf.color }}
                                    >
                                      <Icon className="w-3.5 h-3.5" />
                                      <span>{leg.type === 'walk' ? 'Walk Transfer' : leg.line || leg.mode}</span>
                                    </span>
                                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                      <span className="text-slate-300 font-medium">{leg.time_minutes}m</span>
                                      <span className="text-slate-700">•</span>
                                      <span className={leg.type === 'walk' ? 'text-slate-500' : 'text-[#3FCFE0] font-bold'}>
                                        {leg.type === 'walk' ? 'Free' : `₹${leg.cost_rupees ?? 0}`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-xs text-[#F2F5F7] font-sans">
                                    {leg.from_station?.name} → {leg.to_station?.name}
                                  </div>
                                </div>

                                {ticketLink && leg.type !== 'walk' && (
                                  <a
                                    href={ticketLink.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-between text-[11px] font-mono font-medium text-[#3FCFE0] hover:text-[#70E2F0] bg-[#3FCFE0]/10 hover:bg-[#3FCFE0]/20 border border-[#3FCFE0]/30 px-3 py-1.5 rounded-xl transition-colors mt-1"
                                    title={`Open official ${ticketLink.appName} page`}
                                  >
                                    <span>{ticketLink.label}</span>
                                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Monthly Pass Recommendation Banner */}
                        {option.fare_pass && (
                          <div className="flex items-center gap-3 bg-[#3FCFE0]/10 border border-[#3FCFE0]/30 rounded-2xl p-4 text-xs text-[#3FCFE0] font-mono shadow-md">
                            <Ticket className="w-5 h-5 text-[#3FCFE0] flex-shrink-0" />
                            <div>
                              <strong>Monthly Pass Recommendation:</strong> Monthly pass at ₹
                              {option.fare_pass.monthly_pass_cost} breaks even in{' '}
                              <strong className="text-[#F2F5F7]">{option.fare_pass.breakeven_commute_days} days</strong> of commuting.
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

        {/* RIGHT COLUMN: Sticky Interactive Map Panel (5 Cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-[90px] space-y-4">
          <div className="relative rounded-3xl overflow-hidden border border-[#3FCFE0]/30 shadow-[0_20px_50px_rgba(7,13,20,0.85)] min-h-[460px] flex flex-col bg-[#101B28]">
            <MapPanel selectedOption={selectedOption} stationsMap={stationsMap} />
          </div>

          {/* Active Option Info Box */}
          <div className="rounded-3xl p-5 bg-[#101B28]/90 backdrop-blur-xl border border-slate-800 space-y-3 font-mono text-xs text-slate-300 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-[#3FCFE0] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#3FCFE0]" /> Active Map View
              </span>
              <span className="text-slate-400">Option #{selectedIndex + 1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Mode:</span>
              <span className="font-bold text-[#F2F5F7]">{selectedOption.mode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Duration & Cost:</span>
              <span className="font-bold text-[#E8A94D]">{selectedOption.time_minutes} min • ₹{selectedOption.cost_rupees}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected-route deep dive: timeline + best-time-to-travel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JourneyTimeline option={selectedOption} />
        <BestTimeToTravel option={selectedOption} />
      </div>
    </section>
  );
}
