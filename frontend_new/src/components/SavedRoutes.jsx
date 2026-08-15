import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Clock, ArrowRight, Trash2 } from 'lucide-react';

export default function SavedRoutes({
  savedRoutes = [],
  recentSearches = [],
  onSelectRoute,
  onRemoveBookmark,
  onClearRecent,
  stationsMap = {},
}) {
  if (savedRoutes.length === 0 && recentSearches.length === 0) return null;
  const getStationName = (key) => stationsMap[key]?.name || key;

  return (
    <div className="px-6 sm:px-8 pb-6 space-y-3 border-t border-ink-line pt-5">
      {savedRoutes.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-dim uppercase tracking-wider mb-2">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved commutes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {savedRoutes.map((route) => (
                <motion.div
                  key={`${route.origin}-${route.destination}`}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  className="group flex items-center gap-2 bg-surface border border-ink-line hover:border-amber/50 text-ink-soft px-3 py-1.5 rounded-sm text-xs font-medium cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5" onClick={() => onSelectRoute(route)}>
                    <span>{getStationName(route.origin)}</span>
                    <ArrowRight className="w-3 h-3 text-ink-muted group-hover:text-amber-dim transition-colors" />
                    <span>{getStationName(route.destination)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(route);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-[#8F2C22] transition-opacity p-0.5"
                    title="Remove bookmark"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {recentSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent searches</span>
            </div>
            {onClearRecent && (
              <button onClick={onClearRecent} className="text-[10px] text-ink-muted hover:text-ink transition-colors">
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((route, idx) => (
              <motion.div
                key={`recent-${route.origin}-${route.destination}-${idx}`}
                onClick={() => onSelectRoute(route)}
                className="flex items-center gap-1.5 bg-surface hover:bg-card border border-ink-line text-ink-muted hover:text-ink px-2.5 py-1 rounded-sm text-xs font-mono cursor-pointer transition-colors"
              >
                <span>{getStationName(route.origin)}</span>
                <ArrowRight className="w-3 h-3 text-ink-muted" />
                <span>{getStationName(route.destination)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
