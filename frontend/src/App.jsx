import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrainFront, Sparkles, MapPin, Search } from 'lucide-react';
import { fetchStations, calculateRoute } from './api';
import SearchBoard from './components/SearchBoard';
import BentoResultsGrid from './components/BentoResultsGrid';
import StatsStrip from './components/StatsStrip';
import FeaturesSection from './components/FeaturesSection';
import { LoadingSkeleton, EmptyState, ErrorState } from './components/StatusStates';
import SplashScreen from './components/SplashScreen';
import HeroCanvasAnimation from './components/HeroCanvasAnimation';
import HowItWorksSection from './components/HowItWorksSection';
import CommandPalette from './components/CommandPalette';
import ScrollProgressBar from './components/ScrollProgressBar';
import NetworkMap from './components/NetworkMap';
import useLenis from './hooks/useLenis';

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

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const lenisRef = useLenis();

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

  const resultsRef = useRef(null);

  // Shareable routes: a pasted ?from=&to=&priority=&rain= link pre-fills the
  // form before the first search fires, and every search afterwards keeps
  // the URL in sync (see handleSearch) so the address bar is always a valid
  // link back to what's on screen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const to = params.get('to');
    const p = params.get('priority');
    const rain = params.get('rain');
    if (from) setOrigin(from);
    if (to) setDestination(to);
    if (p) setPriority(p);
    if (rain != null) setIsRaining(rain === '1');
  }, []);

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
        setIsPaletteOpen(true);
      } else if (e.key === 'Escape') {
        if (isPaletteOpen) return; // palette closes itself on Escape
        setRouteData(null);
        setRouteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen]);

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

      const shareParams = new URLSearchParams();
      shareParams.set('from', targetOrigin);
      shareParams.set('to', targetDest);
      shareParams.set('priority', priority);
      if (isRaining) shareParams.set('rain', '1');
      window.history.replaceState(null, '', `?${shareParams.toString()}`);

      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (r) => !(r.origin === targetOrigin && r.destination === targetDest)
        );
        const updated = [{ origin: targetOrigin, destination: targetDest }, ...filtered].slice(0, 5);
        localStorage.setItem('transitflow_recent_searches', JSON.stringify(updated));
        return updated;
      });

      // Smooth scroll down to results workspace (through Lenis when active)
      setTimeout(() => {
        if (!resultsRef.current) return;
        if (lenisRef.current) {
          lenisRef.current.scrollTo(resultsRef.current, { offset: -90, duration: 1.2 });
        } else {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Route calculation error:', err);
      setRouteError(err.message || 'Route calculation failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isStationsLoading && !stationsError && Object.keys(stationsMap).length > 0) {
      // No args: picks up whatever origin/destination are already in state —
      // either the defaults, or a shareable-link override applied on mount.
      handleSearch();
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

  const handlePaletteRunRoute = (o, d) => {
    if (d) {
      setOrigin(o);
      setDestination(d);
      handleSearch(o, d);
    } else {
      setOrigin(o);
    }
  };

  const handlePaletteToggleRain = () => setIsRaining((prev) => !prev);

  const options = routeData?.options || [];

  return (
    <div className="min-h-screen bg-[#0B1622] text-[#F2F5F7] flex flex-col font-sans antialiased selection:bg-[#3FCFE0] selection:text-[#0B1622]">
      <ScrollProgressBar />

      {/* 1.5s Session-Based Intro Splash Screen */}
      <SplashScreen onComplete={() => setShowSplash(false)} />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        stationsMap={stationsMap}
        savedRoutes={savedRoutes}
        recentSearches={recentSearches}
        onRunRoute={handlePaletteRunRoute}
        onSetPriority={setPriority}
        onToggleRain={handlePaletteToggleRain}
        isRaining={isRaining}
      />

      {/* Header Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-[#3FCFE0]/20 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xl bg-[#0B1622]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3FCFE0] via-[#4DD9E8] to-[#E8A94D] text-[#0B1622] flex items-center justify-center font-bold shadow-[0_0_15px_rgba(63,207,224,0.4)]">
            <TrainFront className="w-5 h-5" />
          </div>
          <div>
            <span className="font-display font-extrabold text-lg text-[#F2F5F7] tracking-tight flex items-center gap-2">
              TransitFlow
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#3FCFE0]/15 text-[#3FCFE0] border border-[#3FCFE0]/30">
                2026 Router
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-slate-300">
          <div className="hidden sm:flex items-center gap-2 bg-[#101B28] px-3.5 py-1.5 rounded-xl border border-[#3FCFE0]/25 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#3FCFE0] animate-pulse" />
            <span>FastAPI Dijkstra Active</span>
          </div>

          <kbd
            onClick={() => setIsPaletteOpen(true)}
            className="hidden lg:inline-flex items-center gap-1 bg-[#101B28] border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] text-slate-400 cursor-pointer hover:border-[#3FCFE0]/50 hover:text-[#3FCFE0] transition-colors"
            title="Open quick actions"
          >
            Ctrl + K
          </kbd>
        </div>
      </header>

      {/* Main Page Layout Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
        {/* 1. Cinematic Moving-Metro Hero with Embedded Floating Search Board */}
        <HeroCanvasAnimation>
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
        </HeroCanvasAnimation>

        {/* 2. Verified Real Stats Strip */}
        <StatsStrip />

        {/* 3. Results Workspace (Comparable List & Interactive Map) */}
        <div ref={resultsRef} className="space-y-6 pt-4 scroll-mt-24">
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

          {!isLoading && !routeError && options.length > 0 && (
            <BentoResultsGrid
              options={options}
              selectedIndex={selectedRouteIndex}
              onSelectOption={setSelectedRouteIndex}
              stationsMap={stationsMap}
              priority={priority}
              routeData={routeData}
            />
          )}
        </div>

        {/* 4. Full System Network Map — explore every line */}
        <NetworkMap />

        {/* 5. Real Algorithmic Features Section */}
        <FeaturesSection />

        {/* 6. Scroll-Driven Algorithm Deep-Dive (Dijkstra + Yen's, scoring, penalties) */}
        <HowItWorksSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#3FCFE0]/20 py-8 px-6 text-xs font-mono text-slate-400 glass-panel mt-20 bg-[#0B1622]/95">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-300 font-display font-semibold">
            <div className="w-6 h-6 rounded-lg bg-[#3FCFE0] text-[#0B1622] flex items-center justify-center text-xs font-bold">
              TF
            </div>
            <span>TransitFlow 2026 • Algorithmic Multimodal Engine</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
            <span>Western Line</span>
            <span>•</span>
            <span>Central Line</span>
            <span>•</span>
            <span>Yellow Line 2A</span>
            <span>•</span>
            <span>Red Line 7</span>
            <span>•</span>
            <span>Aqua Line 3</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
