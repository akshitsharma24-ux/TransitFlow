import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MUMBAI_CENTER = [19.076, 72.8777];

export default function MapPanel({ route }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-ink/10 shadow-sm h-full min-h-[420px]">
      <MapContainer center={MUMBAI_CENTER} zoom={11} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {route && (
          <>
            <Polyline
              positions={route.path.map((p) => [p.lat, p.lon])}
              pathOptions={{ color: "#14213D", weight: 4 }}
            />
            {route.path.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lon]}>
                <Popup>{p.name}</Popup>
              </Marker>
            ))}
          </>
        )}
      </MapContainer>
    </div>
  );
}
