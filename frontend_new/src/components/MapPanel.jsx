import React, { useEffect, useRef, useMemo, useState } from 'react';
import MapGL, { Marker, Popup, Source, Layer, NavigationControl, ScaleControl, AttributionControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Locate } from 'lucide-react';
import { getLineConfig } from '../utils/lineColors';

// CARTO Voyager: free, keyless vector basemap. Chosen over a dark style
// because a near-black map on this app's near-black chrome made routes
// unreadable — a light basemap gives the colored transit lines and
// markers real contrast to pop against, plus visible street/area labels
// for orientation (the "is this actually accurate" test).
const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

export default function MapPanel({ selectedOption, stationsMap = {} }) {
  const mapRef = useRef(null);
  const [activePopupMarker, setActivePopupMarker] = useState(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Belt-and-suspenders: if `onLoad` is ever missed (a hot-reloaded map
  // instance whose 'load' event already fired before this handler existed,
  // a slow tile host, etc.) the veil should never be able to hang forever —
  // fall back to revealing the map after a few seconds regardless.
  useEffect(() => {
    if (isStyleLoaded) return;
    const fallback = setTimeout(() => setIsStyleLoaded(true), 4000);
    return () => clearTimeout(fallback);
  }, [isStyleLoaded]);

  const legs = selectedOption?.legs || [];

  const { geojson, markers, bounds } = useMemo(() => {
    if (!legs || legs.length === 0) {
      return {
        geojson: { type: 'FeatureCollection', features: [] },
        markers: [],
        bounds: null,
      };
    }

    const features = [];
    const keyMarkersMap = new Map();
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;

    const extendBounds = (lon, lat) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };

    legs.forEach((leg, idx) => {
      const fromSt = leg.from_station;
      const toSt = leg.to_station;

      if (fromSt && toSt && fromSt.lon != null && fromSt.lat != null && toSt.lon != null && toSt.lat != null) {
        extendBounds(fromSt.lon, fromSt.lat);
        extendBounds(toSt.lon, toSt.lat);

        const config = getLineConfig(leg.line, leg.mode);
        const isWalk = leg.type === 'walk';

        features.push({
          type: 'Feature',
          properties: {
            id: idx,
            line: leg.line || 'Transit',
            color: config.color,
            isWalk: isWalk,
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromSt.lon, fromSt.lat],
              [toSt.lon, toSt.lat],
            ],
          },
        });

        // Origin marker (first leg start)
        if (idx === 0) {
          keyMarkersMap.set(fromSt.id || fromSt.name, {
            ...fromSt,
            label: 'A',
            role: 'Origin',
            color: '#2F6B4F',
            isOriginOrDest: true,
          });
        } else {
          // Transfer marker (intermediate leg start)
          if (!keyMarkersMap.has(fromSt.id || fromSt.name)) {
            keyMarkersMap.set(fromSt.id || fromSt.name, {
              ...fromSt,
              label: '⇄',
              role: 'Transfer',
              color: '#E8A33D',
              isOriginOrDest: false,
            });
          }
        }

        // Destination marker (final leg end)
        if (idx === legs.length - 1) {
          keyMarkersMap.set(toSt.id || toSt.name, {
            ...toSt,
            label: 'B',
            role: 'Destination',
            color: '#AF3A32',
            isOriginOrDest: true,
          });
        }
      }
    });

    const hasValidBounds = minLon <= maxLon && minLat <= maxLat && minLon !== 180;

    return {
      geojson: {
        type: 'FeatureCollection',
        features,
      },
      markers: Array.from(keyMarkersMap.values()),
      bounds: hasValidBounds ? [[minLon, minLat], [maxLon, maxLat]] : null,
    };
  }, [legs]);

  const fitToBounds = () => {
    if (!bounds || !mapRef.current) return;
    try {
      const map = mapRef.current.getMap ? mapRef.current.getMap() : mapRef.current;
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 15.5,
        duration: 1100,
        essential: true,
      });
    } catch (err) {
      console.warn('Map fitBounds error:', err);
    }
  };

  // Smooth fitBounds transition when route option changes
  useEffect(() => {
    if (isStyleLoaded) fitToBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, isStyleLoaded]);

  const defaultCenter = { longitude: 72.8777, latitude: 19.076, zoom: 11 };

  return (
    <div className="relative w-full h-[460px] lg:h-[580px] rounded-sm overflow-hidden bg-[#EAE3D6] border border-ink-line">
      <MapGL
        ref={mapRef}
        initialViewState={defaultCenter}
        mapStyle={MAP_STYLE_URL}
        style={{ width: '100%', height: '100%' }}
        minZoom={8.5}
        maxZoom={17}
        // Requires Ctrl/Cmd + scroll to zoom, so the map never traps normal
        // page-scroll — that was reading as "zooming is broken" before.
        cooperativeGestures={true}
        onLoad={() => setIsStyleLoaded(true)}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />
        <AttributionControl compact position="bottom-right" />

        {/* Polylines via MapLibre Vector Source & Layers */}
        <Source id="route-source" type="geojson" data={geojson}>
          {/* Dark casing beneath the colored line so it reads clearly against the light basemap */}
          <Layer
            id="route-casing-layer"
            type="line"
            filter={['!=', ['get', 'isWalk'], true]}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': '#3B342A',
              'line-width': 9.5,
              'line-opacity': 0.28,
            }}
          />
          {/* Solid line layer for transit legs */}
          <Layer
            id="route-solid-layer"
            type="line"
            filter={['!=', ['get', 'isWalk'], true]}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 6,
              'line-opacity': 1,
            }}
          />
          {/* Dashed line layer for walk legs */}
          <Layer
            id="route-walk-layer"
            type="line"
            filter={['==', ['get', 'isWalk'], true]}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
            paint={{
              'line-color': '#8B8477',
              'line-width': 4,
              'line-dasharray': [1.4, 1.6],
              'line-opacity': 0.95,
            }}
          />
        </Source>

        {/* Start, End & Transfer Station Markers */}
        {markers.map((m, i) => (
          <Marker
            key={m.id || i}
            longitude={m.lon}
            latitude={m.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActivePopupMarker(m);
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22, delay: i * 0.05 }}
              whileHover={{ scale: 1.15 }}
              className="cursor-pointer relative flex items-center justify-center"
              style={{
                width: m.isOriginOrDest ? '36px' : '28px',
                height: m.isOriginOrDest ? '36px' : '28px',
              }}
            >
              {m.isOriginOrDest && (
                <span
                  className="absolute inset-0 rounded-full animate-ping opacity-40"
                  style={{ backgroundColor: m.color }}
                />
              )}
              <div
                className="relative flex items-center justify-center w-full h-full rounded-full"
                style={{
                  backgroundColor: m.color,
                  border: '3px solid #FBF7EF',
                  boxShadow: `0 3px 10px rgba(35,32,26,0.28)`,
                  color: '#FBF7EF',
                  fontWeight: 700,
                  fontFamily: "'Spline Sans Mono', monospace",
                  fontSize: m.isOriginOrDest ? '13px' : '11px',
                }}
              >
                {m.label}
              </div>
            </motion.div>
          </Marker>
        ))}

        {/* Station Detail Popup */}
        {activePopupMarker && (
          <Popup
            longitude={activePopupMarker.lon}
            latitude={activePopupMarker.lat}
            onClose={() => setActivePopupMarker(null)}
            closeOnClick={false}
            anchor="bottom"
            offset={20}
          >
            <div className="font-sans space-y-0.5 p-0.5 min-w-[120px]">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: activePopupMarker.color }}>
                {activePopupMarker.role}
              </div>
              <div className="text-sm font-bold text-ink">{activePopupMarker.name}</div>
              <div className="text-[11px] text-ink-muted font-mono tnum">
                {activePopupMarker.lat?.toFixed(4)}, {activePopupMarker.lon?.toFixed(4)}
              </div>
            </div>
          </Popup>
        )}
      </MapGL>

      {/* Style loading veil — avoids a flash of empty grey while the vector style fetches */}
      <AnimatePresence>
        {!isStyleLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-board"
          >
            <div className="flex items-center gap-2.5 text-[#B7B29E] font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
              <span>Loading map…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recenter Button */}
      <button
        type="button"
        onClick={fitToBounds}
        title="Recenter on route"
        className="absolute top-[52px] right-2.5 z-10 w-[29px] h-[29px] flex items-center justify-center rounded-sm bg-card border border-ink-line text-ink-soft hover:text-amber-dim transition-colors cursor-pointer"
      >
        <Locate className="w-3.5 h-3.5" />
      </button>

      {/* Floating Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-10 px-4 py-3 rounded-sm text-xs font-mono text-ink-soft border border-ink-line space-y-1.5 bg-card/95 backdrop-blur-sm">
        <div className="text-[10px] text-ink-muted uppercase font-semibold tracking-wider">Line legend</div>
        <div className="flex items-center gap-3 flex-wrap max-w-[240px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2F6B4F]" /> Western</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8B3A3A]" /> Central</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#C4941F]" /> Yellow</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#AF3A32]" /> Red</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3E6491]" /> Aqua</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#C08A3E]" /> Bus</span>
        </div>
      </div>
    </div>
  );
}
