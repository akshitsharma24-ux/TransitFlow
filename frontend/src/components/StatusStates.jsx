import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Compass, RefreshCw } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 shadow-lg overflow-hidden relative"
        >
          {/* Top accent bar shimmer */}
          <div className="h-1.5 w-full rounded-t-xl shimmer-bg" />

          <div className="flex items-center justify-between">
            <div className="h-6 w-48 rounded-lg shimmer-bg" />
            <div className="h-5 w-20 rounded-full shimmer-bg" />
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
            <div className="h-10 rounded-lg shimmer-bg" />
            <div className="h-10 rounded-lg shimmer-bg" />
            <div className="h-10 rounded-lg shimmer-bg" />
          </div>

          <div className="h-4 w-3/4 rounded-md shimmer-bg" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ onSelectPreset }) {
  const presets = [
    { origin: 'churchgate', destination: 'dahanukarwadi', label: 'Churchgate → Dahanukarwadi' },
    { origin: 'borivali', destination: 'bkc', label: 'Borivali → Bandra Kurla Complex' },
    { origin: 'dahisar_east', destination: 'andheri', label: 'Dahisar East → Andheri' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-2xl p-8 border border-slate-800/80 text-center space-y-4 max-w-lg mx-auto my-6"
    >
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-glow-emerald">
        <Compass className="w-6 h-6 animate-pulse-subtle" />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-bold font-display text-slate-100">
          Ready for Route Computation
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Select an Origin and Destination station above to calculate multimodal Western & Metro routes.
        </p>
      </div>

      <div className="pt-2">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
          Try Popular Commutes
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPreset(p.origin, p.destination)}
              className="text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-emerald-400 px-3 py-1.5 rounded-xl transition-all shadow-sm"
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
      className="rounded-2xl bg-red-950/40 border border-red-500/40 p-6 text-center space-y-4 max-w-md mx-auto my-6 shadow-2xl"
    >
      <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto shadow-glow-red">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold font-display text-red-200">
          Route Routing Error
        </h3>
        <p className="text-xs font-mono text-red-300 bg-red-950/80 p-3 rounded-xl border border-red-900/60 leading-relaxed text-left break-words">
          {message || 'An error occurred while communicating with the backend.'}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-950 bg-red-400 hover:bg-red-300 px-4 py-2 rounded-xl transition-colors shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      )}
    </motion.div>
  );
}
