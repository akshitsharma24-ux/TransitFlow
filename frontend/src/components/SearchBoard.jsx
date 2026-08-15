import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRightLeft,
  CloudRain,
  Zap,
  IndianRupee,
  Smile,
  Search,
  Clock,
  BookmarkPlus,
  BookmarkCheck,
  Sparkles,
  TrainFront,
  Navigation,
  Check
} from 'lucide-react';
import StationAutocomplete from './StationAutocomplete';
import SavedRoutes from './SavedRoutes';
import { findNearestStationKey } from '../utils/haversine';

export default function SearchBoard({
  origin,
  setOrigin,
  destination,
  setDestination,
  priority,
  setPriority,
  isRaining,
  setIsRaining,
  hour,
  setHour,
  dayType,
  setDayType,
  onSearch,
  isLoading,
  stationsMap,
  savedRoutes,
  recentSearches,
  onSelectSavedRoute,
  onToggleBookmark,
  isCurrentBookmarked,
  onClearRecent,
  isLocationLoading,
  setIsLocationLoading,
  locationError,
  setLocationError,
}) {
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearestKey = findNearestStationKey(latitude, longitude, stationsMap);
        if (nearestKey) {
          setOrigin(nearestKey);
        } else {
          setLocationError('No nearby transit station found.');
        }
        setIsLocationLoading(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationError('Could not acquire location. Setting nearest hub (Churchgate).');
        setOrigin('churchgate');
        setIsLocationLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const priorityOptions = [
    { id: 'fastest', label: 'Fastest', icon: Zap },
    { id: 'cheapest', label: 'Cheapest', icon: IndianRupee },
    { id: 'comfortable', label: 'Comfortable', icon: Smile },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (origin && destination) {
      onSearch();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full glass-panel rounded-3xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(7,13,20,0.85)] border border-[#3FCFE0]/30 space-y-6 relative overflow-hidden bg-[#101B28]/95 backdrop-blur-2xl"
    >
      {/* Background Ambient SVG Animated Route Stroke */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          d="M 0 40 Q 250 140, 500 40 T 1000 80 T 1500 30"
          fill="none"
          stroke="url(#searchBoardGrad)"
          strokeWidth="3"
          strokeDasharray="8 8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
        <defs>
          <linearGradient id="searchBoardGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3FCFE0" />
            <stop offset="50%" stopColor="#D99A3D" />
            <stop offset="100%" stopColor="#4DD9E8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Floating Card Title Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#3FCFE0]/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3FCFE0] via-[#2BB5C6] to-[#E8A94D] text-[#0B1622] flex items-center justify-center font-bold shadow-[0_0_20px_rgba(63,207,224,0.4)]">
            <TrainFront className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-[#F2F5F7]">
              Route Search
            </h2>
            <p className="text-xs font-mono text-slate-300">
              Dijkstra Multimodal Algorithm • Real-Time Routing
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#0B1622] border border-[#3FCFE0]/30 text-[#3FCFE0] flex items-center gap-1.5 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#3FCFE0] animate-pulse" />
            <span>Live Engine</span>
          </span>
        </div>
      </div>

      {/* Main Search Form */}
      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        {/* Origin & Destination Autocomplete + Swap */}
        <div className="relative flex flex-col md:flex-row items-stretch md:items-end gap-3">
          <StationAutocomplete
            label="Origin Station"
            placeholder="Type station (e.g. Churchgate)"
            value={origin}
            onChange={(val) => setOrigin(val)}
            stationsMap={stationsMap}
            onUseLocation={handleUseCurrentLocation}
            isLocationLoading={isLocationLoading}
            autoFocus
          />

          <div className="flex justify-center items-center -my-1 md:my-0 md:pb-1">
            <motion.button
              type="button"
              whileHover={{ rotate: 180, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.25 }}
              onClick={handleSwap}
              className="p-3 rounded-full bg-[#0B1622] border border-[#3FCFE0]/40 hover:border-[#3FCFE0] text-slate-200 hover:text-[#3FCFE0] shadow-lg transition-colors cursor-pointer"
              title="Swap Origin and Destination"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </motion.button>
          </div>

          <StationAutocomplete
            label="Destination Station"
            placeholder="Type station (e.g. Dahanukarwadi)"
            value={destination}
            onChange={(val) => setDestination(val)}
            stationsMap={stationsMap}
          />
        </div>

        {locationError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-[#E8A94D] font-mono flex items-center gap-1.5 bg-[#D99A3D]/10 p-2.5 rounded-xl border border-[#D99A3D]/30"
          >
            <span>⚠️</span> {locationError}
          </motion.p>
        )}

        {/* Control Bar: Priority Selector, Hour Slider, Day Type, Rain Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          {/* Priority Options (6 Cols) */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase">
              Optimization Priority
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#0B1622] p-1.5 rounded-2xl border border-[#3FCFE0]/25">
              {priorityOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = priority === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPriority(opt.id)}
                    className={`relative flex items-center justify-center gap-2 py-2 px-2 rounded-xl text-xs font-medium transition-all outline-none cursor-pointer ${
                      isSelected ? 'text-[#0B1622] font-bold' : 'text-slate-300 hover:text-[#F2F5F7]'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activePriorityBg"
                        className="absolute inset-0 bg-gradient-to-r from-[#3FCFE0] via-[#4DD9E8] to-[#2BB5C6] rounded-xl shadow-[0_0_20px_rgba(63,207,224,0.45)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour & Day Type Controls (4 Cols) */}
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#3FCFE0]" />
                <span>Hour: {hour}:00</span>
              </label>

              <div className="flex items-center bg-[#0B1622] border border-[#3FCFE0]/20 rounded-lg p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setDayType('weekday')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    dayType === 'weekday' ? 'bg-[#3FCFE0]/25 text-[#3FCFE0] font-bold' : 'text-slate-400'
                  }`}
                >
                  Wkday
                </button>
                <button
                  type="button"
                  onClick={() => setDayType('weekend')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    dayType === 'weekend' ? 'bg-[#D99A3D]/25 text-[#E8A94D] font-bold' : 'text-slate-400'
                  }`}
                >
                  Wkend
                </button>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="23"
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value, 10))}
              className="w-full h-2.5 bg-[#0B1622] rounded-lg appearance-none cursor-pointer accent-[#3FCFE0] border border-slate-800"
            />
          </div>

          {/* Rain Toggle Switch (2 Cols) */}
          <div className="md:col-span-2 flex items-end">
            <label
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-mono font-medium cursor-pointer transition-all ${
                isRaining
                  ? 'bg-[#3FCFE0]/15 border-[#3FCFE0]/60 text-[#3FCFE0] shadow-[0_0_15px_rgba(63,207,224,0.35)] font-bold'
                  : 'bg-[#0B1622] border-[#3FCFE0]/20 text-slate-400 hover:text-[#F2F5F7]'
              }`}
            >
              <CloudRain className={`w-4 h-4 ${isRaining ? 'text-[#3FCFE0] animate-bounce' : 'text-slate-500'}`} />
              <span>Rain</span>
              <input
                type="checkbox"
                checked={isRaining}
                onChange={(e) => setIsRaining(e.target.checked)}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Action Controls: Bookmark & Submit Button */}
        <div className="flex items-center gap-3 pt-2">
          {origin && destination && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleBookmark}
              className={`p-3.5 rounded-2xl border flex items-center justify-center transition-colors cursor-pointer ${
                isCurrentBookmarked
                  ? 'bg-[#D99A3D]/25 border-[#D99A3D] text-[#E8A94D] shadow-[0_0_15px_rgba(217,154,61,0.35)]'
                  : 'bg-[#0B1622] border-[#3FCFE0]/25 text-slate-400 hover:text-[#F2F5F7]'
              }`}
              title={isCurrentBookmarked ? 'Remove bookmark' : 'Bookmark route'}
            >
              {isCurrentBookmarked ? (
                <BookmarkCheck className="w-5 h-5" />
              ) : (
                <BookmarkPlus className="w-5 h-5" />
              )}
            </motion.button>
          )}

          <motion.button
            type="submit"
            disabled={!origin || !destination || isLoading}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className={`flex-1 py-4 px-6 rounded-2xl font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer ${
              !origin || !destination || isLoading
                ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#3FCFE0] via-[#4DD9E8] to-[#2BB5C6] hover:brightness-110 text-[#0B1622] shadow-[0_0_30px_rgba(63,207,224,0.5)]'
            }`}
          >
            {isLoading ? (
              <>
                <Sparkles className="w-5 h-5 animate-spin text-[#0B1622]" />
                <span>Calculating Optimal Routes...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Search Multimodal Routes</span>
              </>
            )}
          </motion.button>
        </div>
      </form>

      {/* Saved / Recent Routes Bar */}
      <SavedRoutes
        savedRoutes={savedRoutes}
        recentSearches={recentSearches}
        onSelectRoute={(route) => onSelectSavedRoute(route)}
        onRemoveBookmark={(route) => onToggleBookmark(route)}
        onClearRecent={onClearRecent}
        stationsMap={stationsMap}
      />
    </motion.div>
  );
}
