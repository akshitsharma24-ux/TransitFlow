import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Check, Navigation } from 'lucide-react';
import { getLineConfig } from '../utils/lineColors';

export default function StationAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  stationsMap = {},
  onUseLocation,
  isLocationLoading = false,
  autoFocus = false,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && stationsMap[value]) setQuery(stationsMap[value].name);
    else if (!value) setQuery('');
  }, [value, stationsMap]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matches = Object.entries(stationsMap)
    .filter(([key, station]) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase().trim();
      return station.name.toLowerCase().includes(q) || key.toLowerCase().includes(q);
    })
    .slice(0, 8);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setIsOpen(true);
    setSelectedIndex(-1);
    if (value && stationsMap[value] && stationsMap[value].name !== text) onChange('');
  };

  const handleSelect = (key) => {
    const selectedStation = stationsMap[key];
    if (selectedStation) {
      setQuery(selectedStation.name);
      onChange(key);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && matches[selectedIndex]) {
        e.preventDefault();
        handleSelect(matches[selectedIndex][0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative flex-1" ref={containerRef}>
      <label className="block text-[11px] font-mono font-semibold tracking-wider text-ink-muted uppercase mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {onUseLocation && (
          <button
            type="button"
            onClick={onUseLocation}
            disabled={isLocationLoading}
            className="text-[11px] font-sans text-amber-dim hover:text-[#6B5628] flex items-center gap-1 transition-colors px-1.5 py-0.5 cursor-pointer"
            title="Use current GPS location"
          >
            <Navigation className={`w-3 h-3 ${isLocationLoading ? 'animate-spin' : ''}`} />
            <span>Near me</span>
          </button>
        )}
      </label>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <MapPin className={`w-4 h-4 ${value ? 'text-amber-dim' : 'text-ink-muted'}`} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-3 bg-surface border border-ink-line focus:border-amber focus:ring-1 focus:ring-amber/30 rounded-sm text-ink placeholder-ink-muted text-sm font-medium transition-colors outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && matches.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-card border border-ink-line rounded-sm shadow-edge-sm divide-y divide-ink-line"
          >
            {matches.map(([key, station], idx) => {
              const isSelected = value === key;
              const isHighlighted = selectedIndex === idx;
              return (
                <li
                  key={key}
                  onClick={() => handleSelect(key)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                    isHighlighted ? 'bg-amber/10' : isSelected ? 'bg-surface' : 'hover:bg-surface'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink truncate">{station.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-dim flex-shrink-0" />}
                    </div>
                    {station.serves && station.serves.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {station.serves.map((s, i) => {
                          const conf = getLineConfig(s.line, s.mode);
                          return (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono border ${conf.bgClass}`}>
                              {s.line || s.mode}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted tnum">
                    {station.lat.toFixed(2)}, {station.lon.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
