/**
 * Calculates haversine distance between two sets of GPS coordinates in kilometers
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest station key from a map of station objects
 * @param {number} userLat 
 * @param {number} userLon 
 * @param {Record<string, {name: string, lat: number, lon: number}>} stationsMap 
 * @returns {string|null} Station key ID
 */
export function findNearestStationKey(userLat, userLon, stationsMap) {
  if (!stationsMap || Object.keys(stationsMap).length === 0) return null;

  let nearestKey = null;
  let minDistance = Infinity;

  for (const [key, station] of Object.entries(stationsMap)) {
    if (station && typeof station.lat === 'number' && typeof station.lon === 'number') {
      const dist = haversineDistance(userLat, userLon, station.lat, station.lon);
      if (dist < minDistance) {
        minDistance = dist;
        nearestKey = key;
      }
    }
  }

  return nearestKey;
}
