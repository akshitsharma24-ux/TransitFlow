import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Ticket,
  ExternalLink,
  ChevronDown,
  Share2,
  Check,
} from 'lucide-react';
import { getLineConfig, getJourneyComplexity, getCrowdConfig } from '../utils/lineColors';
import MapPanel from './MapPanel';
import RouteComparisonChart from './RouteComparisonChart';
import JourneyTimeline from './JourneyTimeline';
import BestTimeToTravel from './BestTimeToTravel';

function StatusDot({ level }) {
  const conf = getCrowdConfig(level);
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conf.color }} />;
}

export default function BentoResultsGrid({
  options = [],
  selectedIndex = 0,
  onSelectOption,
  stationsMap = {},
  priority = 'fastest',
  routeData = null,
}) {
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
    setExpandedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const selectedOption = options[selectedIndex] || options[0];
  const firstLegs = options[0]?.legs || [];
  const originName = firstLegs[0]?.from_station?.name || 'Origin';
  const destName = firstLegs[firstLegs.length - 1]?.to_station?.name || 'Destination';

  return (
    <section className="space-y-6 w-full">
      {/* Manifest header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-ink-muted">
            {options.length} services found
          </span>
          <h2 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">
            {originName} <span className="text-ink-muted">▸</span> {destName}
          </h2>
        </div>

        {routeData && (
          <button
            type="button"
            onClick={handleShare}
            title="Copy a shareable link to this search"
            className={`flex items-center gap-1.5 font-mono text-xs px-3.5 py-2 rounded-sm border transition-colors cursor-pointer ${
              justCopied
                ? 'bg-amber/15 border-amber/50 text-amber-dim'
                : 'bg-surface border-ink-line text-ink-soft hover:border-amber/40 hover:text-amber-dim'
            }`}
          >
            {justCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{justCopied ? 'Copied' : 'Share'}</span>
          </button>
        )}
      </div>

      <RouteComparisonChart options={options} selectedIndex={selectedIndex} onSelectOption={onSelectOption} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Manifest table */}
        <div className="lg:col-span-7 border border-ink-line rounded-sm bg-card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[28px_1.6fr_1fr_64px_64px_88px_20px] gap-3 px-5 py-2 bg-board text-[#8F8A76] text-[10px] font-mono uppercase tracking-wider">
            <span></span>
            <span>Service</span>
            <span>Via</span>
            <span className="text-right">Time</span>
            <span className="text-right">Fare</span>
            <span>Status</span>
            <span></span>
          </div>

          <div className="divide-y divide-ink-line">
            {options.map((option, idx) => {
              const isSelected = selectedIndex === idx;
              const isExpanded = !!expandedCards[idx];
              const legs = option.legs || [];
              const primaryLine = getLineConfig(
                legs.find((l) => l.type === 'ride')?.line,
                legs.find((l) => l.type === 'ride')?.mode || option.mode
              );
              const crowd = option.crowd_forecast ? getCrowdConfig(option.crowd_forecast.level) : null;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.3, delay: idx * 0.03, ease: 'easeOut' }}
                  onClick={() => onSelectOption(idx)}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-amber/8' : 'hover:bg-surface'}`}
                  style={{ borderLeft: isSelected ? '3px solid #E8A33D' : '3px solid transparent' }}
                >
                  <div className="grid grid-cols-[28px_1fr_20px] sm:grid-cols-[28px_1.6fr_1fr_64px_64px_88px_20px] gap-3 px-5 py-3.5 items-center">
                    <span className="font-mono text-[11px] text-ink-muted tnum">{String(idx + 1).padStart(2, '0')}</span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-sm font-mono border ${primaryLine.bgClass}`}>
                          {option.mode}
                        </span>
                        <span className="text-[10px] font-mono text-ink-muted hidden sm:inline">{getJourneyComplexity(legs)}</span>
                      </div>
                    </div>

                    <div className="hidden sm:block text-xs font-mono text-ink-soft truncate">
                      {option.via && option.via.length > 0 ? option.via.join(' → ') : '—'}
                    </div>

                    <div className="hidden sm:block text-right font-mono text-sm font-semibold text-ink tnum">
                      {option.time_minutes}m
                    </div>
                    <div className="hidden sm:block text-right font-mono text-sm font-semibold text-ink tnum">
                      ₹{option.cost_rupees}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px]">
                      <StatusDot level={option.crowd_forecast?.level} />
                      <span style={{ color: crowd?.color }}>{crowd?.label}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => toggleExpand(idx, e)}
                      className="text-ink-muted hover:text-amber-dim transition-colors"
                    >
                      <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
                        <ChevronDown className="w-4 h-4" />
                      </motion.span>
                    </button>
                  </div>

                  {/* Mobile stat row */}
                  <div className="sm:hidden flex items-center gap-4 px-5 pb-3 -mt-1 font-mono text-xs text-ink-soft">
                    <span className="tnum font-semibold text-ink">{option.time_minutes}m</span>
                    <span className="tnum font-semibold text-ink">₹{option.cost_rupees}</span>
                    <span className="flex items-center gap-1.5">
                      <StatusDot level={option.crowd_forecast?.level} />
                      <span style={{ color: crowd?.color }}>{crowd?.label}</span>
                    </span>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 space-y-3 bg-surface border-t border-ink-line">
                          <p className="text-xs text-ink-soft leading-relaxed pt-3">{option.explanation}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {legs.map((leg, legIdx) => {
                              const conf = getLineConfig(leg.line, leg.mode);
                              const Icon = conf.icon;
                              const ticketLink = conf.ticket;
                              return (
                                <div key={legIdx} className="bg-card p-3 rounded-sm border border-ink-line text-xs flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-xs flex items-center gap-1.5" style={{ color: conf.color }}>
                                      <Icon className="w-3.5 h-3.5" />
                                      <span>{leg.type === 'walk' ? 'Walk transfer' : leg.line || leg.mode}</span>
                                    </span>
                                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-soft">
                                      <span className="tnum">{leg.time_minutes}m</span>
                                      <span>•</span>
                                      <span className={leg.type === 'walk' ? 'text-ink-muted' : 'text-amber-dim font-bold tnum'}>
                                        {leg.type === 'walk' ? 'Free' : `₹${leg.cost_rupees ?? 0}`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-ink font-sans">{leg.from_station?.name} → {leg.to_station?.name}</div>
                                  {ticketLink && leg.type !== 'walk' && (
                                    <a
                                      href={ticketLink.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center justify-between text-[11px] font-mono font-medium text-amber-dim hover:text-[#6B5628] bg-amber/8 border border-amber/25 px-2.5 py-1.5 rounded-sm transition-colors"
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

                          {option.fare_pass && (
                            <div className="flex items-center gap-3 bg-amber/8 border border-amber/25 rounded-sm p-3.5 text-xs text-amber-dim font-mono">
                              <Ticket className="w-4 h-4 shrink-0" />
                              <div>
                                <strong>Monthly pass:</strong> a ₹{option.fare_pass.monthly_pass_cost} pass breaks even in{' '}
                                <strong className="text-ink">{option.fare_pass.breakeven_commute_days} days</strong> of commuting.
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Map + active info */}
        <div className="lg:col-span-5 lg:sticky lg:top-[80px] space-y-4">
          <MapPanel selectedOption={selectedOption} stationsMap={stationsMap} />

          <div className="rounded-sm p-4 bg-card border border-ink-line space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-ink-line">
              <span className="font-semibold text-amber-dim uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> On the map
              </span>
              <span className="text-ink-muted">#{String(selectedIndex + 1).padStart(2, '0')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Service</span>
              <span className="font-semibold text-ink">{selectedOption.mode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted">Duration &amp; fare</span>
              <span className="font-semibold text-ink tnum">{selectedOption.time_minutes}m • ₹{selectedOption.cost_rupees}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JourneyTimeline option={selectedOption} />
        <BestTimeToTravel option={selectedOption} />
      </div>
    </section>
  );
}
