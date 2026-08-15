import React from 'react';
import { motion } from 'framer-motion';
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
  Loader2,
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
        if (nearestKey) setOrigin(nearestKey);
        else setLocationError('No nearby transit station found.');
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
    if (origin && destination) onSearch();
  };

  return (
    <div className="w-full bg-card border border-ink-line rounded-sm">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-ink-line">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-ink-muted">Panel 01</span>
          <h2 className="text-2xl font-display font-semibold uppercase tracking-wide text-ink -mt-0.5">
            Plan a journey
          </h2>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-sm bg-signal-green-wash text-[#215A39] border border-signal-green/25">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
          Ready
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
        {/* Origin / Destination + Swap */}
        <div className="relative flex flex-col md:flex-row items-stretch md:items-end gap-3">
          <StationAutocomplete
            label="From"
            placeholder="Type a station (e.g. Churchgate)"
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
              whileHover={{ rotate: 180 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.3 }}
              onClick={handleSwap}
              className="p-3 rounded-sm bg-surface border border-ink-line hover:border-amber text-ink-soft hover:text-amber-dim transition-colors cursor-pointer"
              title="Swap origin and destination"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </motion.button>
          </div>

          <StationAutocomplete
            label="To"
            placeholder="Type a station (e.g. Dahanukarwadi)"
            value={destination}
            onChange={(val) => setDestination(val)}
            stationsMap={stationsMap}
          />
        </div>

        {locationError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-[#8F2C22] font-mono flex items-center gap-1.5 bg-signal-red-wash p-2.5 rounded-sm border border-signal-red/25"
          >
            <span>⚠</span> {locationError}
          </motion.p>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          <div className="md:col-span-6 space-y-2">
            <label className="block text-[11px] font-mono font-semibold tracking-wider text-ink-muted uppercase">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-[2px] bg-ink-line border border-ink-line rounded-sm overflow-hidden">
              {priorityOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = priority === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPriority(opt.id)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium transition-colors outline-none cursor-pointer ${
                      isSelected ? 'bg-board text-amber' : 'bg-surface text-ink-soft hover:bg-card'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono font-semibold tracking-wider text-ink-muted uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-dim" />
                <span>Hour · {hour}:00</span>
              </label>
              <div className="flex items-center bg-surface border border-ink-line rounded-sm p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setDayType('weekday')}
                  className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                    dayType === 'weekday' ? 'bg-board text-amber font-semibold' : 'text-ink-muted'
                  }`}
                >
                  Wkday
                </button>
                <button
                  type="button"
                  onClick={() => setDayType('weekend')}
                  className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                    dayType === 'weekend' ? 'bg-board text-amber font-semibold' : 'text-ink-muted'
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
              className="w-full h-1.5 bg-ink-line rounded-none appearance-none cursor-pointer accent-amber"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <label
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-sm border text-xs font-mono font-medium cursor-pointer transition-colors ${
                isRaining
                  ? 'bg-[#3E6491]/12 border-[#3E6491]/50 text-[#2F4D70] font-semibold'
                  : 'bg-surface border-ink-line text-ink-soft hover:text-ink'
              }`}
            >
              <CloudRain className={`w-4 h-4 ${isRaining ? 'text-[#3E6491]' : 'text-ink-muted'}`} />
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

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          {origin && destination && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onToggleBookmark}
              className={`p-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer ${
                isCurrentBookmarked
                  ? 'bg-amber/15 border-amber text-amber-dim'
                  : 'bg-surface border-ink-line text-ink-soft hover:text-ink hover:border-ink-muted'
              }`}
              title={isCurrentBookmarked ? 'Remove bookmark' : 'Bookmark route'}
            >
              {isCurrentBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
            </motion.button>
          )}

          <motion.button
            type="submit"
            disabled={!origin || !destination || isLoading}
            whileHover={!origin || !destination || isLoading ? {} : { scale: 1.005 }}
            whileTap={!origin || !destination || isLoading ? {} : { scale: 0.99 }}
            className={`flex-1 py-4 px-6 rounded-sm font-display font-semibold uppercase tracking-wide text-sm sm:text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer ${
              !origin || !destination || isLoading
                ? 'bg-ink-line text-ink-muted cursor-not-allowed'
                : 'bg-board hover:bg-[#1C1911] text-amber'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Checking board…</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Compare routes</span>
              </>
            )}
          </motion.button>
        </div>
      </form>

      <SavedRoutes
        savedRoutes={savedRoutes}
        recentSearches={recentSearches}
        onSelectRoute={(route) => onSelectSavedRoute(route)}
        onRemoveBookmark={(route) => onToggleBookmark(route)}
        onClearRecent={onClearRecent}
        stationsMap={stationsMap}
      />
    </div>
  );
}
