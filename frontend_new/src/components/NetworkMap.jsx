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
        features.push({ type: 'Feature', properties: { color: conf.color }, geometry: { type: 'LineString', coordinates: seg } });
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

  useEffect(() => {
    if (isStyleLoaded) return;
    const t = setTimeout(() => setIsStyleLoaded(true), 4000);
    return () => clearTimeout(t);
  }, [isStyleLoaded]);

  const toggle = (line) => setActive((p) => ({ ...p, [line]: !p[line] }));

  return (
    <section className="w-full relative space-y-6 py-4">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-sm bg-board text-amber font-mono text-xs">
          <NetworkIcon className="w-3.5 h-3.5" />
          <span>THE WHOLE NETWORK</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-semibold uppercase tracking-wide text-ink">Explore every line</h2>
        <p className="text-base text-ink-soft">
          All 112 stations across 5 corridors on one map. Toggle a line to isolate it.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {orderedLines.map((line) => {
          const conf = getLineConfig(line, network.lines[line].mode);
          const on = active[line];
          return (
            <button
              key={line}
              type="button"
              onClick={() => toggle(line)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-xs font-mono border transition-all cursor-pointer ${
                on ? 'bg-surface text-ink border-ink-line' : 'bg-transparent text-ink-muted border-ink-line opacity-55'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: on ? conf.color : '#C7BCA8' }} />
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
        className="relative rounded-sm overflow-hidden border border-ink-line h-[520px] bg-[#EAE3D6]"
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-ink-muted font-mono text-sm bg-surface">{error}</div>
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
                paint={{ 'line-color': '#3B342A', 'line-width': 6, 'line-opacity': 0.22 }} />
              <Layer id="network-lines" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-opacity': 0.95 }} />
            </Source>

            {stationMarkers.map((s) => (
              <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="center"
                onClick={(e) => { e.originalEvent.stopPropagation(); setHoverStation(s); }}>
                <span className="block rounded-full cursor-pointer hover:scale-150 transition-transform"
                  style={{ width: 7, height: 7, backgroundColor: '#FBF7EF', border: `2px solid ${s.color}` }} />
              </Marker>
            ))}

            {hoverStation && (
              <Popup longitude={hoverStation.lon} latitude={hoverStation.lat} anchor="bottom" offset={12}
                onClose={() => setHoverStation(null)} closeOnClick={false}>
                <div className="text-sm font-bold text-ink px-0.5">{hoverStation.name}</div>
              </Popup>
            )}
          </MapGL>
        )}

        {!isStyleLoaded && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-board text-[#B7B29E] font-mono text-xs gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /> Loading network…
          </div>
        )}
      </motion.div>
    </section>
  );
}
