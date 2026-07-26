import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Train, Sparkles, TrainFront } from 'lucide-react';
import { fetchStations, calculateRoute } from './api';
import SearchBoard from './components/SearchBoard';
import BentoResultsGrid from './components/BentoResultsGrid';
import { LoadingSkeleton, EmptyState, ErrorState } from './components/StatusStates';
import SplashScreen from './components/SplashScreen';
import HeroCanvasAnimation from './components/HeroCanvasAnimation';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [stationsMap, setStationsMap] = useState({});
  const [isStationsLoading, setIsStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState(null);

  const now = new Date();
  const currentHour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  const [origin, setOrigin] = useState('churchgate');
  const [destination, setDestination] = useState('dahanukarwadi');
  const [priority, setPriority] = useState('fastest');
  const [isRaining, setIsRaining] = useState(false);
  const [hour, setHour] = useState(currentHour);
  const [dayType, setDayType] = useState(isWeekend ? 'weekend' : 'weekday');

  const [isLoading, setIsLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const [savedRoutes, setSavedRoutes] = useState(() => {
    try {
      const saved = localStorage.getItem('transitflow_saved_routes');
      return saved ? JSON.parse(saved) : [
        { origin: 'churchgate', destination: 'dahanukarwadi' },
        { origin: 'borivali', destination: 'bkc' },
      ];
    } catch (e) {
      return [];
    }
  });

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const recents = localStorage.getItem('transitflow_recent_searches');
      return recents ? JSON.parse(recents) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    let isMounted = true;
    fetchStations()
      .then((data) => {
        if (isMounted) {
          setStationsMap(data);
          setIsStationsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load stations:', err);
          setStationsError(err.message || 'Failed to connect to backend server.');
          setIsStationsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[type="text"]');
        if (input) input.focus();
      } else if (e.key === 'Escape') {
        setRouteData(null);
        setRouteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async (overrideOrigin, overrideDest) => {
    const targetOrigin = overrideOrigin || origin;
    const targetDest = overrideDest || destination;

    if (!targetOrigin || !targetDest) return;

    setIsLoading(true);
    setRouteError(null);

    const payload = {
      origin: targetOrigin,
      destination: targetDest,
      priority,
      is_raining: isRaining,
      hour,
      day_type: dayType,
    };

    try {
      const res = await calculateRoute(payload);
      setRouteData(res);
      setSelectedRouteIndex(0);

      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (r) => !(r.origin === targetOrigin && r.destination === targetDest)
        );
        const updated = [{ origin: targetOrigin, destination: targetDest }, ...filtered].slice(0, 5);
        localStorage.setItem('transitflow_recent_searches', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('Route calculation error:', err);
      setRouteError(err.message || 'Route calculation failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isStationsLoading && !stationsError && Object.keys(stationsMap).length > 0) {
      handleSearch('churchgate', 'dahanukarwadi');
    }
  }, [isStationsLoading, stationsError]);

  const handleToggleBookmark = (targetRoute) => {
    const rOrigin = targetRoute?.origin || origin;
    const rDest = targetRoute?.destination || destination;

    setSavedRoutes((prev) => {
      const exists = prev.some((r) => r.origin === rOrigin && r.destination === rDest);
      let updated;
      if (exists) {
        updated = prev.filter((r) => !(r.origin === rOrigin && r.destination === rDest));
      } else {
        updated = [...prev, { origin: rOrigin, destination: rDest }];
      }
      localStorage.setItem('transitflow_saved_routes', JSON.stringify(updated));
      return updated;
    });
  };

  const isCurrentBookmarked = savedRoutes.some(
    (r) => r.origin === origin && r.destination === destination
  );

  const handleSelectSavedRoute = (route) => {
    setOrigin(route.origin);
    setDestination(route.destination);
    handleSearch(route.origin, route.destination);
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('transitflow_recent_searches');
  };

  const searchBoardRef = useRef(null);

  const handleScrollToSearch = () => {
    if (searchBoardRef.current) {
      searchBoardRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const options = routeData?.options || [];

  return (
    <div className="min-h-screen bg-transparent text-[#F2F5F7] flex flex-col font-sans antialiased selection:bg-[#3FCFE0] selection:text-[#0B1622]">
      {/* 1.5s Session-Based Animated Intro Splash Screen */}
      <SplashScreen onComplete={() => setShowSplash(false)} />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-[#3FCFE0]/20 px-4 lg:px-8 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3FCFE0] to-[#4DD9E8] text-[#0B1622] flex items-center justify-center font-bold shadow-[0_0_15px_rgba(63,207,224,0.4)]">
            <TrainFront className="w-5 h-5" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-[#F2F5F7] tracking-tight flex items-center gap-2">
              TransitFlow
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#3FCFE0]/15 text-[#3FCFE0] border border-[#3FCFE0]/30">
                Metro 2026
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-slate-300">
          <div className="hidden md:flex items-center gap-2 bg-[#101B28]/90 px-3 py-1.5 rounded-xl border border-[#3FCFE0]/20">
            <span className="w-2 h-2 rounded-full bg-[#3FCFE0] animate-pulse" />
            <span>FastAPI Dijkstra Active</span>
          </div>

          <kbd className="hidden lg:inline-flex items-center gap-1 bg-[#101B28] border border-slate-700 px-2 py-1 rounded text-[11px] text-slate-400">
            Ctrl + K
          </kbd>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-12 relative z-10">
        {/* Scroll-Scrubbed Metro Train Canvas Hero */}
        <HeroCanvasAnimation onScrollToSearch={handleScrollToSearch} />

        {/* Search Board Container Anchor */}
        <div ref={searchBoardRef} className="pt-4 scroll-mt-20">
          <SearchBoard
            origin={origin}
            setOrigin={setOrigin}
            destination={destination}
            setDestination={setDestination}
            priority={priority}
            setPriority={setPriority}
            isRaining={isRaining}
            setIsRaining={setIsRaining}
            hour={hour}
            setHour={setHour}
            dayType={dayType}
            setDayType={setDayType}
            onSearch={() => handleSearch()}
            isLoading={isLoading}
            stationsMap={stationsMap}
            savedRoutes={savedRoutes}
            recentSearches={recentSearches}
            onSelectSavedRoute={handleSelectSavedRoute}
            onToggleBookmark={() => handleToggleBookmark()}
            isCurrentBookmarked={isCurrentBookmarked}
            onClearRecent={handleClearRecent}
            isLocationLoading={isLocationLoading}
            setIsLocationLoading={setIsLocationLoading}
            locationError={locationError}
            setLocationError={setLocationError}
          />
        </div>

        {/* Results Workspace */}
        <div className="space-y-4">
          {routeData && (
            <div className="flex items-center justify-between pb-2 border-b border-[#3FCFE0]/20 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#3FCFE0]" />
                <span>
                  FOUND <strong className="text-[#F2F5F7]">{options.length}</strong> ROUTE OPTIONS
                </span>
              </span>
              <span className="uppercase text-[11px] px-2.5 py-0.5 rounded-full bg-[#101B28] border border-[#D99A3D]/40 text-[#E8A94D] font-bold">
                PRIORITY: {routeData.priority}
              </span>
            </div>
          )}

          {isLoading && <LoadingSkeleton />}

          {routeError && (
            <ErrorState
              message={routeError}
              onRetry={() => handleSearch()}
            />
          )}

          {!isLoading && !routeError && options.length === 0 && (
            <EmptyState
              onSelectPreset={(orig, dest) => {
                setOrigin(orig);
                setDestination(dest);
                handleSearch(orig, dest);
              }}
            />
          )}

          {/* Bento Grid Layout */}
          {!isLoading && !routeError && options.length > 0 && (
            <BentoResultsGrid
              options={options}
              selectedIndex={selectedRouteIndex}
              onSelectOption={setSelectedRouteIndex}
              stationsMap={stationsMap}
              priority={priority}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-[#3FCFE0]/20 py-5 px-6 text-center text-xs font-mono text-slate-400 glass-panel mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TransitFlow 2026 Engine • Real Dijkstra Multimodal Routing</span>
          <span className="text-slate-400">
            Western Line • Metro Yellow • Metro Red • Metro Aqua
          </span>
        </div>
      </footer>
    </div>
  );
}
