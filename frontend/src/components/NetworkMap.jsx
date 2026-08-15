import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Source, Layer, Marker, Popup, NavigationControl, AttributionControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion } from 'framer-motion';
import { Network as NetworkIcon } from 'lucide-react';
import { fetchNetwork } from '../api';
import { getLineConfig } from '../utils/lineColors';

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const LINE_ORDER = ['Western Line', 'Central Line', 'Yellow Line', 'Red Line', 'Aqua Line'];

export default function NetworkMap() {
  const mapRef = useRef(null);
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [active, setActive] = useState({});
  const [hoverStation, setHoverStation] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchNetwork()
      .then((data) => {
        if (!mounted) return;
        setNetwork(data);
        const initial = {};
        Object.keys(data.lines).forEach((l) => { initial[l] = true; });
        setActive(initial);
      })
      .catch((e) => mounted && setError(e.message || 'Failed to load network'));
    return () => { mounted = false; };
  }, []);

  const orderedLines = useMemo(() => {
    if (!network) return [];
    return LINE_ORDER.filter((l) => network.lines[l]).concat(
      Object.keys(network.lines).filter((l) => !LINE_ORDER.includes(l))
    );
  }, [network]);

  const geojson = useMemo(() => {
    if (!network) return { type: 'FeatureCollection', features: [] };
    const features = [];
    for (const line of orderedLines) {
      if (!active[line]) continue;
      const conf = getLineConfig(line, network.lines[line].mode);
      network.lines[line].segments.forEach((seg) => {
        features.push({
          type: 'Feature',
          properties: { color: conf.color },
          geometry: { type: 'LineString', coordinates: seg },
        });
      });
    }
    return { type: 'FeatureCollection', features };
  }, [network, active, orderedLines]);

  const stationMarkers = useMemo(() => {
    if (!network) return [];
    const seen = new Map();
    for (const line of orderedLines) {
      if (!active[line]) continue;
      const conf = getLineConfig(line, network.lines[line].mode);
      network.lines[line].stations.forEach((s) => {
        if (!seen.has(s.id)) seen.set(s.id, { ...s, color: conf.color });
      });
    }
    return Array.from(seen.values());
  }, [network, active, orderedLines]);

  useEffect(() => {
    if (!isStyleLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
    try {
      map.fitBounds([[72.78, 18.90], [73.16, 19.47]], { padding: 40, duration: 0, maxZoom: 12 });
    } catch { /* ignore */ }
  }, [isStyleLoaded]);

  // Safety net so the loading veil can never hang if onLoad is missed.
  useEffect(() => {
    if (isStyleLoaded) return;
    const t = setTimeout(() => setIsStyleLoaded(true), 4000);
    return () => clearTimeout(t);
  }, [isStyleLoaded]);

  const toggle = (line) => setActive((p) => ({ ...p, [line]: !p[line] }));

  return (
    <section className="w-full relative z-10 space-y-6 py-8">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#101B28] border border-[#3FCFE0]/30 text-[#3FCFE0] font-mono text-xs shadow-md">
          <NetworkIcon className="w-3.5 h-3.5" />
          <span>THE WHOLE NETWORK</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#F2F5F7] tracking-tight">
          Explore Every Line
        </h2>
        <p className="text-sm text-slate-300 font-sans">
          All 112 stations across 5 corridors on one map. Toggle a line to isolate it.
        </p>
      </div>

      {/* Line toggles */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {orderedLines.map((line) => {
          const conf = getLineConfig(line, network.lines[line].mode);
          const on = active[line];
          return (
            <button
              key={line}
              type="button"
              onClick={() => toggle(line)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono border transition-all cursor-pointer ${
                on ? 'bg-[#101B28] text-[#F2F5F7] border-slate-700' : 'bg-transparent text-slate-500 border-slate-800 opacity-60'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: on ? conf.color : '#475569' }} />
              {line}
            </button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-[0_20px_50px_rgba(7,13,20,0.85)] h-[520px] bg-[#E9E7DF]"
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-mono text-sm bg-[#0B1622]">
            {error}
          </div>
        ) : (
          <MapGL
            ref={mapRef}
            initialViewState={{ longitude: 72.95, latitude: 19.15, zoom: 10.2 }}
            mapStyle={MAP_STYLE_URL}
            style={{ width: '100%', height: '100%' }}
            minZoom={8.5}
            maxZoom={16}
            cooperativeGestures={true}
            onLoad={() => setIsStyleLoaded(true)}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <AttributionControl compact position="bottom-right" />

            <Source id="network-source" type="geojson" data={geojson}>
              <Layer id="network-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': '#0B1622', 'line-width': 6, 'line-opacity': 0.28 }} />
              <Layer id="network-lines" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 0.95 }} />
            </Source>

            {stationMarkers.map((s) => (
              <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center"
                onClick={(e) => { e.originalEvent.stopPropagation(); setHoverStation(s); }}>
                <span
                  className="block rounded-full cursor-pointer hover:scale-150 transition-transform"
                  style={{ width: 7, height: 7, backgroundColor: '#fff', border: `2px solid ${s.color}` }}
                />
              </Marker>
            ))}

            {hoverStation && (
              <Popup longitude={hoverStation.lon} latitude={hoverStation.lat} anchor="bottom" offset={12}
                onClose={() => setHoverStation(null)} closeOnClick={false}>
                <div className="text-sm font-bold text-slate-800 px-0.5">{hoverStation.name}</div>
              </Popup>
            )}
          </MapGL>
        )}

        {!isStyleLoaded && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B1622] text-slate-400 font-mono text-xs gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FCFE0] animate-pulse" /> Loading network…
          </div>
        )}
      </motion.div>
    </section>
  );
}
