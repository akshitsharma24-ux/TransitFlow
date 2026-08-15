import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Zap, IndianRupee, Smile, CloudRain, Bookmark, Clock, CornerDownLeft, Command } from 'lucide-react';
import { getLineConfig } from '../utils/lineColors';

/**
 * Ctrl/Cmd+K quick-action palette — jump straight to a station pair, flip
 * priority, or toggle rain without touching the search form controls.
 */
export default function CommandPalette({
  isOpen,
  onClose,
  stationsMap = {},
  savedRoutes = [],
  recentSearches = [],
  onRunRoute,
  onSetPriority,
  onToggleRain,
  isRaining,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const stationEntries = useMemo(() => Object.entries(stationsMap), [stationsMap]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = [];

    const routeItems = [
      ...savedRoutes.map((r) => ({ ...r, kind: 'saved' })),
      ...recentSearches.map((r) => ({ ...r, kind: 'recent' })),
    ];
    routeItems.forEach((r) => {
      const originName = stationsMap[r.origin]?.name || r.origin;
      const destName = stationsMap[r.destination]?.name || r.destination;
      const label = `${originName} → ${destName}`;
      if (!q || label.toLowerCase().includes(q)) {
        result.push({
          type: 'route',
          id: `route-${r.kind}-${r.origin}-${r.destination}`,
          label,
          hint: r.kind === 'saved' ? 'Saved commute' : 'Recent search',
          icon: r.kind === 'saved' ? Bookmark : Clock,
          action: () => onRunRoute(r.origin, r.destination),
        });
      }
    });

    if (q.length >= 2) {
      let matchCount = 0;
      for (const [key, station] of stationEntries) {
        if (matchCount >= 6) break;
        if (station.name.toLowerCase().includes(q) || key.toLowerCase().includes(q)) {
          matchCount++;
          const primaryService = station.serves?.[0];
          const conf = primaryService ? getLineConfig(primaryService.line, primaryService.mode) : null;
          result.push({
            type: 'station',
            id: `station-${key}`,
            label: station.name,
            hint: conf ? conf.name : 'Station',
            icon: Search,
            action: () => onRunRoute(key, null),
          });
        }
      }
    }

    const actionDefs = [
      { match: ['fastest', 'fast', 'quick'], label: 'Prioritize fastest routes', icon: Zap, action: () => onSetPriority('fastest') },
      { match: ['cheapest', 'cheap', 'fare'], label: 'Prioritize cheapest routes', icon: IndianRupee, action: () => onSetPriority('cheapest') },
      { match: ['comfortable', 'comfort'], label: 'Prioritize comfortable routes', icon: Smile, action: () => onSetPriority('comfortable') },
      {
        match: ['rain', 'weather'],
        label: isRaining ? 'Turn off rain-aware routing' : 'Turn on rain-aware routing',
        icon: CloudRain,
        action: onToggleRain,
      },
    ];
    actionDefs.forEach((a, idx) => {
      if (!q || a.match.some((m) => m.includes(q) || q.includes(m))) {
        result.push({
          type: 'action',
          id: `action-${idx}`,
          label: a.label,
          hint: 'Action',
          icon: a.icon,
          action: a.action,
        });
      }
    });

    return result.slice(0, 9);
  }, [query, stationEntries, savedRoutes, recentSearches, stationsMap, onRunRoute, onSetPriority, onToggleRain, isRaining]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setActiveIndex(0);
  };

  const runItem = (item) => {
    if (!item) return;
    item.action();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(items[activeIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-[#0B1622]/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[12vh] left-1/2 -translate-x-1/2 z-[201] w-[92vw] max-w-xl"
          >
            <div className="rounded-2xl border border-[#3FCFE0]/30 bg-[#101B28]/98 backdrop-blur-2xl shadow-[0_30px_80px_rgba(7,13,20,0.9)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
                <Search className="w-4 h-4 text-[#3FCFE0] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Jump to a station, saved route, or action…"
                  className="flex-1 bg-transparent outline-none text-sm text-[#F2F5F7] placeholder-slate-500 font-sans"
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 border border-slate-700 rounded-md px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>

              <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
                {items.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs font-mono text-slate-500">
                    No matches. Try a station name or "cheapest" / "rain".
                  </div>
                )}
                {items.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => runItem(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                        isActive ? 'bg-[#3FCFE0]/12' : ''
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-[#3FCFE0]/20 text-[#3FCFE0]' : 'bg-slate-800/80 text-slate-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-[#F2F5F7] font-medium truncate">{item.label}</span>
                        <span className="block text-[10px] font-mono text-slate-500">{item.hint}</span>
                      </span>
                      {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-[#3FCFE0] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Command className="w-3 h-3" /> TransitFlow Quick Actions
                </span>
                <span>↑↓ navigate · ↵ select</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
