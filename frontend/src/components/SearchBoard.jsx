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
  Train
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
  const [hasInteracted, setHasInteracted] = useState(false);

  const triggerInteraction = () => {
    if (!hasInteracted) setHasInteracted(true);
  };

  const handleSwap = () => {
    triggerInteraction();
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleUseCurrentLocation = () => {
    triggerInteraction();
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
    triggerInteraction();
    if (origin && destination) {
      onSearch();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass-panel rounded-3xl p-5 md:p-7 shadow-soft-dark border border-[#3FCFE0]/25 space-y-6 relative overflow-hidden bg-[#101B28]/95"
    >
      {/* Background Animated SVG Transit Path */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          d="M 10 30 Q 200 120, 400 30 T 800 90 T 1200 40"
          fill="none"
          stroke="url(#transitLineGrad)"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <defs>
          <linearGradient id="transitLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3FCFE0" />
            <stop offset="33%" stopColor="#D99A3D" />
            <stop offset="66%" stopColor="#4DD9E8" />
            <stop offset="100%" stopColor="#E8B23D" />
          </linearGradient>
        </defs>
      </svg>

      {/* Hero Header Banner */}
      <AnimatePresence>
        {!hasInteracted ? (
          <motion.div
            key="hero-intro"
            initial={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="space-y-2 pb-3 border-b border-[#3FCFE0]/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3FCFE0] via-[#2BB5C6] to-[#D99A3D] text-[#0B1622] flex items-center justify-center font-bold shadow-[0_0_15px_rgba(63,207,224,0.4)]">
                <Train className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-[#F2F5F7]">
                  TransitFlow Search Board
                </h1>
                <p className="text-xs font-mono text-slate-300">
                  Multimodal Dijkstra Engine • Mumbai Western Line, Yellow, Red & Aqua Metro
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center justify-between pb-3 border-b border-[#3FCFE0]/20 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-bold font-display text-base text-[#3FCFE0]">TransitFlow</span>
              <span className="text-[10px] text-slate-400">• MUMBAI MULTIMODAL ROUTER</span>
            </div>
            <button
              type="button"
              onClick={() => setHasInteracted(false)}
              className="text-[10px] text-slate-400 hover:text-[#3FCFE0] transition-colors"
            >
              Show Intro
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Main Search Form */}
      <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
        {/* Origin & Destination Inputs + Swap */}
        <div className="relative flex flex-col md:flex-row items-stretch md:items-end gap-3">
          <StationAutocomplete
            label="Origin Station"
            placeholder="Type station (e.g. Churchgate)"
            value={origin}
            onChange={(val) => {
              triggerInteraction();
              setOrigin(val);
            }}
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
              transition={{ duration: 0.2 }}
              onClick={handleSwap}
              className="p-2.5 rounded-full bg-[#0B1622] border border-[#3FCFE0]/30 hover:border-[#3FCFE0] text-slate-300 hover:text-[#3FCFE0] shadow-md transition-colors"
              title="Swap Origin and Destination"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </motion.button>
          </div>

          <StationAutocomplete
            label="Destination Station"
            placeholder="Type station (e.g. Dahanukarwadi)"
            value={destination}
            onChange={(val) => {
              triggerInteraction();
              setDestination(val);
            }}
            stationsMap={stationsMap}
          />
        </div>

        {locationError && (
          <p className="text-xs text-[#E8A94D] font-mono flex items-center gap-1">
            <span>⚠️</span> {locationError}
          </p>
        )}

        {/* Options Bar: Priority Segmented Control, Hour Slider, Day Type, Rain */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          {/* Priority Segmented Control (6 Cols) */}
          <div className="md:col-span-6">
            <label className="block text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase mb-1.5">
              Routing Priority
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#0B1622] p-1 rounded-2xl border border-[#3FCFE0]/20">
              {priorityOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = priority === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      triggerInteraction();
                      setPriority(opt.id);
                    }}
                    className={`relative flex items-center justify-center gap-2 py-2 px-2 rounded-xl text-xs font-medium transition-all outline-none cursor-pointer ${
                      isSelected ? 'text-[#0B1622] font-bold' : 'text-slate-300 hover:text-[#F2F5F7]'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activePriorityBg"
                        className="absolute inset-0 bg-gradient-to-r from-[#3FCFE0] to-[#4DD9E8] rounded-xl shadow-[0_0_15px_rgba(63,207,224,0.4)]"
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

          {/* Departure Time & Day Type (4 Cols) */}
          <div className="md:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#3FCFE0]" />
                <span>Hour: {hour}:00</span>
              </label>

              <div className="flex items-center bg-[#0B1622] border border-[#3FCFE0]/20 rounded-lg p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setDayType('weekday')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    dayType === 'weekday' ? 'bg-[#3FCFE0]/20 text-[#3FCFE0] font-bold' : 'text-slate-400'
                  }`}
                >
                  Wkday
                </button>
                <button
                  type="button"
                  onClick={() => setDayType('weekend')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    dayType === 'weekend' ? 'bg-[#D99A3D]/20 text-[#E8A94D] font-bold' : 'text-slate-400'
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
              className="w-full h-2 bg-[#0B1622] rounded-lg appearance-none cursor-pointer accent-[#3FCFE0] border border-slate-800"
            />
          </div>

          {/* Rain Toggle Switch (2 Cols) */}
          <div className="md:col-span-2 flex items-end">
            <label
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-mono font-medium cursor-pointer transition-all ${
                isRaining
                  ? 'bg-[#3FCFE0]/15 border-[#3FCFE0]/50 text-[#3FCFE0] shadow-[0_0_12px_rgba(63,207,224,0.3)]'
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
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onToggleBookmark}
              className={`p-3.5 rounded-2xl border flex items-center justify-center transition-colors cursor-pointer ${
                isCurrentBookmarked
                  ? 'bg-[#D99A3D]/20 border-[#D99A3D] text-[#E8A94D] shadow-[0_0_12px_rgba(217,154,61,0.3)]'
                  : 'bg-[#0B1622] border-[#3FCFE0]/20 text-slate-400 hover:text-[#F2F5F7]'
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
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`flex-1 py-3.5 px-6 rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              !origin || !destination || isLoading
                ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#3FCFE0] via-[#4DD9E8] to-[#2BB5C6] hover:brightness-110 text-[#0B1622] shadow-[0_0_25px_rgba(63,207,224,0.45)]'
            }`}
          >
            {isLoading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-[#0B1622]" />
                <span>Computing Dijkstra Graph...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find Optimal Multimodal Routes</span>
              </>
            )}
          </motion.button>
        </div>
      </form>

      {/* Saved / Recent Routes Chips */}
      <SavedRoutes
        savedRoutes={savedRoutes}
        recentSearches={recentSearches}
        onSelectRoute={(route) => {
          triggerInteraction();
          onSelectSavedRoute(route);
        }}
        onRemoveBookmark={(route) => onToggleBookmark(route)}
        onClearRecent={onClearRecent}
        stationsMap={stationsMap}
      />
    </motion.div>
  );
}
