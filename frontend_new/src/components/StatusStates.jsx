import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Compass, RefreshCw } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div className="border border-ink-line rounded-sm divide-y divide-ink-line bg-card overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 shimmer-bg" />
            <div className="h-5 w-14 shimmer-bg" />
          </div>
          <div className="h-9 w-full shimmer-bg" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ onSelectPreset }) {
  const presets = [
    { origin: 'churchgate', destination: 'dahanukarwadi', label: 'Churchgate → Dahanukarwadi' },
    { origin: 'borivali', destination: 'bkc', label: 'Borivali → Bandra Kurla Complex' },
    { origin: 'csmt', destination: 'thane', label: 'CSMT → Thane' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card rounded-sm p-8 border border-ink-line text-center space-y-5 max-w-lg mx-auto"
    >
      <div className="w-11 h-11 rounded-sm bg-board text-amber flex items-center justify-center mx-auto">
        <Compass className="w-5 h-5" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ink">Ready when you are</h3>
        <p className="text-sm text-ink-soft max-w-sm mx-auto">
          Pick an origin and destination above to compare services across the network.
        </p>
      </div>
      <div className="pt-1">
        <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block mb-2">Try a popular commute</span>
        <div className="flex flex-wrap justify-center gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPreset(p.origin, p.destination)}
              className="text-xs font-mono bg-surface hover:bg-amber/10 border border-ink-line hover:border-amber/40 text-ink-soft hover:text-amber-dim px-3 py-1.5 rounded-sm transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-sm bg-card border border-signal-red/40 p-6 text-center space-y-4 max-w-md mx-auto"
    >
      <div className="w-11 h-11 rounded-sm bg-signal-red-wash text-[#8F2C22] flex items-center justify-center mx-auto">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-display font-semibold uppercase tracking-wide text-ink">Couldn&apos;t route that</h3>
        <p className="text-xs font-mono text-[#8F2C22] bg-signal-red-wash p-3 rounded-sm border border-signal-red/20 leading-relaxed text-left break-words">
          {message || 'An error occurred while talking to the backend.'}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-amber bg-board hover:bg-[#1C1911] px-4 py-2 rounded-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try again</span>
        </button>
      )}
    </motion.div>
  );
}
