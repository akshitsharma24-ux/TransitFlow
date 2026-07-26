import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLineConfig } from '../utils/lineColors';

// Fix default Leaflet icon paths in React environment
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom HTML Pin icon creator
function createCustomPin(color, labelText, isOriginOrDest = false) {
  const size = isOriginOrDest ? 32 : 24;
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid #0f172a;
        box-shadow: 0 0 12px ${color}80;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0f172a;
        font-weight: bold;
        font-family: 'IBM Plex Mono', monospace;
        font-size: ${isOriginOrDest ? '12px' : '10px'};
      ">
        ${labelText || ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Map Controller component to handle smooth flyTo / fitBounds & resize invalidation
function MapFlyController({ bounds }) {
  const map = useMap();

  useEffect(() => {
    // Invalidate map size to fix zero-dimension initialization in Framer Motion / flex containers
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        animate: true,
        duration: 1.2,
      });
    }
    return () => clearTimeout(resizeTimer);
  }, [bounds, map]);

  return null;
}

export default function MapPanel({ selectedOption, stationsMap = {} }) {
  // Default bounds around Mumbai center (Andheri / BKC)
  const defaultCenter = [19.076, 72.8777];

  const legs = selectedOption?.legs || [];

  // Prepare polylines & key station markers
  const { polylineLegs, markers, bounds } = useMemo(() => {
    const polyLegs = [];
    const keyMarkersMap = new Map(); // key -> { lat, lon, name, line, isStart, isEnd }
    const allCoords = [];

    if (!legs || legs.length === 0) {
      return { polylineLegs: [], markers: [], bounds: [] };
    }

    legs.forEach((leg, idx) => {
      const fromSt = leg.from_station;
      const toSt = leg.to_station;

      if (fromSt && toSt) {
        const p1 = [fromSt.lat, fromSt.lon];
        const p2 = [toSt.lat, toSt.lon];
        allCoords.push(p1, p2);

        const config = getLineConfig(leg.line, leg.mode);

        polyLegs.push({
          positions: [p1, p2],
          color: config.color,
          isWalk: leg.type === 'walk',
          legInfo: leg,
        });

        // Add start marker for leg
        if (idx === 0) {
          keyMarkersMap.set(fromSt.id || fromSt.name, {
            ...fromSt,
            label: 'A',
            role: 'Origin',
            color: '#10b981',
            isOriginOrDest: true,
          });
        } else {
          // Transfer station
          if (!keyMarkersMap.has(fromSt.id || fromSt.name)) {
            keyMarkersMap.set(fromSt.id || fromSt.name, {
              ...fromSt,
              label: '⇄',
              role: 'Transfer',
              color: '#f59e0b',
              isOriginOrDest: false,
            });
          }
        }

        // Add destination marker for last leg
        if (idx === legs.length - 1) {
          keyMarkersMap.set(toSt.id || toSt.name, {
            ...toSt,
            label: 'B',
            role: 'Destination',
            color: '#ef4444',
            isOriginOrDest: true,
          });
        }
      }
    });

    return {
      polylineLegs: polyLegs,
      markers: Array.from(keyMarkersMap.values()),
      bounds: allCoords.length > 0 ? L.latLngBounds(allCoords) : null,
    };
  }, [legs]);

  return (
    <div className="relative w-full h-[380px] lg:h-full min-h-[380px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="dark-tiles w-full h-full"
        style={{ height: '100%', width: '100%', minHeight: '380px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Polylines for each leg */}
        {polylineLegs.map((leg, i) => (
          <Polyline
            key={i}
            positions={leg.positions}
            pathOptions={{
              color: leg.color,
              weight: leg.isWalk ? 4 : 6,
              opacity: 0.9,
              dashArray: leg.isWalk ? '6, 10' : undefined,
              lineCap: 'round',
            }}
          />
        ))}

        {/* Markers for Key Stations (Start, Transfer, End) */}
        {markers.map((m, i) => (
          <Marker
            key={i}
            position={[m.lat, m.lon]}
            icon={createCustomPin(m.color, m.label, m.isOriginOrDest)}
          >
            <Popup>
              <div className="font-sans space-y-1 p-1">
                <div className="text-xs font-mono font-bold uppercase text-slate-400">
                  {m.role}
                </div>
                <div className="text-sm font-bold text-slate-100">{m.name}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {m.lat.toFixed(4)}, {m.lon.toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Fly to bounds controller */}
        {bounds && <MapFlyController bounds={bounds} />}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] glass-panel px-3 py-2 rounded-xl text-xs font-mono text-slate-300 border border-slate-700/80 shadow-lg space-y-1">
        <div className="text-[10px] text-slate-400 uppercase font-semibold">Line Legend</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Western</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Yellow</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Red</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Aqua</span>
        </div>
      </div>
    </div>
  );
}
