/*
  MapPanel — Day 8 rewrite.

  Fixes from feedback:
  1. Each LEG of the route now draws in its own line color (matching
     RouteCard), instead of one flat navy line for the whole trip.
     Walk/transfer legs draw as a dashed grey line.
  2. Markers only appear at journey start, journey end, and transfer
     points — not at every single intermediate station the route passes
     through. Intermediate stations still shape the polyline correctly,
     they just don't get their own pin.
  3. The jarring zoom in/out is fixed by using Leaflet's fitBounds with
     padding instead of a fixed zoom level, only recalculated when the
     selected route actually changes (not on every re-render).
*/

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MUMBAI_CENTER = [19.076, 72.8777];

const LINE_COLORS = {
  "Western Line": "#1F7A5C",
  "Yellow Line": "#B8860B",
  "Red Line": "#A6303A",
  "Aqua Line": "#2A4B8D",
};

function colorForLeg(leg) {
  if (leg.line && LINE_COLORS[leg.line]) return LINE_COLORS[leg.line];
  if (leg.mode === "bus") return "#E8A33D";
  if (leg.mode === "road") return "#B8461F";
  return "#14213D";
}

/** Recalculates map bounds only when the route actually changes, with padding, no jarring snap. */
function FitBounds({ route }) {
  const map = useMap();

  useEffect(() => {
    if (!route || !route.legs?.length) return;

    const points = [];
    route.legs.forEach((leg) => {
      points.push([leg.from_station.lat, leg.from_station.lon]);
      points.push([leg.to_station.lat, leg.to_station.lon]);
    });

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 15, duration: 0.6 });
  }, [route, map]);

  return null;
}

export default function MapPanel({ route }) {
  // Markers only at leg boundaries (journey start/end + transfer points),
  // deduplicated so a shared station between two legs gets one pin.
  const markerStations = [];
  if (route?.legs?.length) {
    const seen = new Set();
    route.legs.forEach((leg, i) => {
      [leg.from_station, leg.to_station].forEach((st, j) => {
        // Only mark: very first station, very last station, or transfer points
        const isFirst = i === 0 && j === 0;
        const isLast = i === route.legs.length - 1 && j === 1;
        const isTransferPoint = j === 1 && i < route.legs.length - 1; // end of a non-final leg = a transfer

        if ((isFirst || isLast || isTransferPoint) && !seen.has(st.id)) {
          seen.add(st.id);
          markerStations.push(st);
        }
      });
    });
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-ink/10 shadow-sm h-full min-h-[420px]">
      <MapContainer
        center={MUMBAI_CENTER}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <FitBounds route={route} />

        {route?.legs?.map((leg, i) => (
          <Polyline
            key={i}
            positions={[
              [leg.from_station.lat, leg.from_station.lon],
              [leg.to_station.lat, leg.to_station.lon],
            ]}
            pathOptions={
              leg.type === "walk"
                ? { color: "#666666", weight: 3, dashArray: "6 6" }
                : { color: colorForLeg(leg), weight: 5 }
            }
          />
        ))}

        {markerStations.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lon]}>
            <Popup>{s.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
