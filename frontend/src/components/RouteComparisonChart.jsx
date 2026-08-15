import React from 'react';
import { motion } from 'framer-motion';
import { Clock, IndianRupee, Smile } from 'lucide-react';

const ACCENT = '#3FCFE0';
const MUTED = '#55698A';

// Three small multiples, not one shared axis — time (min), fare (Rs), and
// comfort (/5) are different units, so cramming them onto one scale would
// misrepresent magnitude. Comfort keeps a fixed 0-5 ceiling (it's already
// an absolute rating); time/cost scale to the current result set so the
// spread between options is what's visible.
const METRICS = [
  { key: 'time_minutes', label: 'Time', unit: 'm', icon: Clock, fixedMax: null },
  { key: 'cost_rupees', label: 'Fare', unit: '₹', icon: IndianRupee, fixedMax: null },
  { key: 'comfort_score', label: 'Comfort', unit: '/5', icon: Smile, fixedMax: 5 },
];

function MetricPanel({ metric, options, selectedIndex, onSelectOption }) {
  const values = options.map((o) => o[metric.key] ?? 0);
  const max = metric.fixedMax ?? Math.max(...values, 1) * 1.12;
  const Icon = metric.icon;

  return (
    <div className="flex-1 min-w-[220px] space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="w-3.5 h-3.5 text-[#3FCFE0]" />
        <span>{metric.label}</span>
      </div>

      <div className="space-y-2">
        {options.map((option, idx) => {
          const isSelected = idx === selectedIndex;
          const value = option[metric.key] ?? 0;
          const pct = Math.max(3, Math.min(100, (value / max) * 100));
          const color = isSelected ? ACCENT : MUTED;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectOption(idx)}
              aria-pressed={isSelected}
              className="w-full flex items-center gap-2.5 group cursor-pointer text-left"
            >
              <span
                className={`w-5 shrink-0 text-[10px] font-mono font-bold ${
                  isSelected ? 'text-[#3FCFE0]' : 'text-slate-500'
                }`}
              >
                #{idx + 1}
              </span>

              <span className="flex-1 h-2 rounded-full bg-slate-800/70 overflow-hidden relative group-hover:bg-slate-800">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.04 }}
                />
              </span>

              <span
                className={`w-12 shrink-0 text-right text-[11px] font-mono tabular-nums ${
                  isSelected ? 'text-[#3FCFE0] font-bold' : 'text-slate-400'
                }`}
              >
                {metric.key === 'comfort_score' ? value.toFixed(1) : Math.round(value)}
                {metric.unit}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RouteComparisonChart({ options = [], selectedIndex = 0, onSelectOption }) {
  if (!options || options.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold font-display text-[#F2F5F7] tracking-tight">
          Compare All {options.length} Options At A Glance
        </h3>
        <span className="text-[10px] font-mono text-slate-500">Click any bar to select that route</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-5 pt-1">
        {METRICS.map((metric) => (
          <MetricPanel
            key={metric.key}
            metric={metric}
            options={options}
            selectedIndex={selectedIndex}
            onSelectOption={onSelectOption}
          />
        ))}
      </div>
    </motion.div>
  );
}
