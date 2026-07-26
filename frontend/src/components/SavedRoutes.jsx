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
  if (savedRoutes.length === 0 && recentSearches.length === 0) {
    return null;
  }

  const getStationName = (key) => stationsMap[key]?.name || key;

  return (
    <div className="space-y-3 pt-2">
      {/* Bookmarks */}
      {savedRoutes.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Commutes</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {savedRoutes.map((route, idx) => (
                <motion.div
                  key={`${route.origin}-${route.destination}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex items-center gap-2 bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all shadow-sm"
                >
                  <div
                    className="flex items-center gap-1.5"
                    onClick={() => onSelectRoute(route)}
                  >
                    <span>{getStationName(route.origin)}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    <span>{getStationName(route.destination)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(route);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-0.5"
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

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Searches</span>
            </div>
            {onClearRecent && (
              <button
                onClick={onClearRecent}
                className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map((route, idx) => (
              <motion.div
                key={`recent-${route.origin}-${route.destination}-${idx}`}
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectRoute(route)}
                className="flex items-center gap-1.5 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-all"
              >
                <span>{getStationName(route.origin)}</span>
                <ArrowRight className="w-3 h-3 text-slate-600" />
                <span>{getStationName(route.destination)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
