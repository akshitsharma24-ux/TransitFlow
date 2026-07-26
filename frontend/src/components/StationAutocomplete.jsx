import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Check, Navigation } from 'lucide-react';
import { getLineConfig } from '../utils/lineColors';

export default function StationAutocomplete({
  label,
  placeholder,
  value, // station key id (e.g. "churchgate")
  onChange, // (stationKeyId) => void
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

  // Sync display query with current value
  useEffect(() => {
    if (value && stationsMap[value]) {
      setQuery(stationsMap[value].name);
    } else if (!value) {
      setQuery('');
    }
  }, [value, stationsMap]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching stations
  const matches = Object.entries(stationsMap)
    .filter(([key, station]) => {
      if (!query.trim()) return true;
      const lowerQuery = query.toLowerCase().trim();
      return (
        station.name.toLowerCase().includes(lowerQuery) ||
        key.toLowerCase().includes(lowerQuery)
      );
    })
    .slice(0, 8); // Max 8 suggestions

  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setIsOpen(true);
    setSelectedIndex(-1);
    // Clear selected value if typing non-matching text
    if (value && stationsMap[value] && stationsMap[value].name !== text) {
      onChange('');
    }
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
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
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

  const selectedStationObj = value ? stationsMap[value] : null;

  return (
    <div className="relative flex-1" ref={containerRef}>
      <label className="block text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {onUseLocation && (
          <button
            type="button"
            onClick={onUseLocation}
            disabled={isLocationLoading}
            className="text-[11px] font-sans text-[#3FCFE0] hover:text-[#70E2F0] flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-[#3FCFE0]/10 cursor-pointer"
            title="Use current GPS location"
          >
            <Navigation className={`w-3 h-3 ${isLocationLoading ? 'animate-spin' : ''}`} />
            <span>Near Me</span>
          </button>
        )}
      </label>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <MapPin className={`w-4 h-4 ${value ? 'text-[#3FCFE0]' : 'text-slate-500'}`} />
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
          className="w-full pl-10 pr-10 py-2.5 bg-[#0B1622] border border-[#3FCFE0]/20 focus:border-[#3FCFE0] focus:ring-2 focus:ring-[#3FCFE0]/25 rounded-xl text-[#F2F5F7] placeholder-slate-500 text-sm font-medium transition-all shadow-inner outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Options */}
      <AnimatePresence>
        {isOpen && matches.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-[#101B28]/95 backdrop-blur-md border border-[#3FCFE0]/30 rounded-xl shadow-2xl divide-y divide-slate-800/60"
          >
            {matches.map(([key, station], idx) => {
              const isSelected = value === key;
              const isHighlighted = selectedIndex === idx;

              return (
                <motion.li
                  key={key}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.1, delay: idx * 0.02 }}
                  onClick={() => handleSelect(key)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                    isHighlighted ? 'bg-[#3FCFE0]/20' : isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#F2F5F7] truncate">
                        {station.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#3FCFE0] flex-shrink-0" />}
                    </div>

                    {/* Animated Line Tags */}
                    {station.serves && station.serves.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {station.serves.map((s, i) => {
                          const conf = getLineConfig(s.line, s.mode);
                          return (
                            <span
                              key={i}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border ${conf.bgClass}`}
                            >
                              {s.line || s.mode}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    {station.lat.toFixed(2)}, {station.lon.toFixed(2)}
                  </span>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
