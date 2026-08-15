import React from 'react';
import { motion } from 'framer-motion';
import { Clock, IndianRupee, Smile } from 'lucide-react';

const ACCENT = '#E8A33D';
const MUTED = '#B4B0A0';

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
    <div className="flex-1 min-w-[220px] space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-muted">
        <Icon className="w-3.5 h-3.5 text-amber-dim" />
        <span>{metric.label}</span>
      </div>
      <div className="space-y-1.5">
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
              className="w-full flex items-center gap-2.5 cursor-pointer text-left"
            >
              <span className={`w-5 shrink-0 text-[10px] font-mono font-bold ${isSelected ? 'text-amber-dim' : 'text-ink-muted'}`}>
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 h-2 bg-ink-line overflow-hidden relative">
                <motion.span
                  className="absolute inset-y-0 left-0"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: idx * 0.03 }}
                />
              </span>
              <span className={`w-12 shrink-0 text-right text-[11px] font-mono tnum ${isSelected ? 'text-amber-dim font-bold' : 'text-ink-soft'}`}>
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
    <div className="rounded-sm border border-ink-line bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Comparison · all {options.length} services
        </h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-5 pt-1">
        {METRICS.map((metric) => (
          <MetricPanel key={metric.key} metric={metric} options={options} selectedIndex={selectedIndex} onSelectOption={onSelectOption} />
        ))}
      </div>
    </div>
  );
}
