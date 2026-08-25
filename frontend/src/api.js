const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

/**
 * Fetch list of all transit stations
 * @returns {Promise<Record<string, {name: string, lat: number, lon: number, serves: Array<{mode: string, line?: string}>}>>}
 */
export async function fetchStations() {
  const response = await fetch(`${BASE_URL}/stations`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch stations' }));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch the full network topology (every line's segments + stations) for the
 * system overview map.
 * @returns {Promise<{lines: Record<string, {mode: string, segments: number[][][], stations: Array<{id:string,name:string,lat:number,lon:number}>}>}>}
 */
export async function fetchNetwork() {
  const response = await fetch(`${BASE_URL}/network`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch network' }));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }
  return response.json();
}

/**
 * Request route optimization from backend engine
 * @param {{
 *   origin: string,
 *   destination: string,
 *   priority: 'fastest' | 'cheapest' | 'comfortable',
 *   is_raining: boolean,
 *   hour: number,
 *   day_type: 'weekday' | 'weekend'
 * }} requestBody
 * @returns {Promise<{
 *   origin: string,
 *   destination: string,
 *   priority: string,
 *   is_raining: boolean,
 *   hour: number,
 *   day_type: string,
 *   options: Array<any>
 * }>}
 */
export async function calculateRoute(requestBody) {
  const response = await fetch(`${BASE_URL}/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An unexpected error occurred while calculating route.' }));
    throw new Error(errorData.detail || `Error ${response.status}: Failed to calculate route.`);
  }

  return response.json();
}
