const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

/**
 * FastAPI returns `detail` as a string for HTTPException (400/404) but as a
 * list of {loc, msg} objects for request-validation errors (422).
 */
function errorMessage(errorData, fallback) {
  const { detail } = errorData || {};
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ') || fallback;
  }
  return detail || fallback;
}

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
    throw new Error(errorMessage(errorData, `Error ${response.status}: Failed to calculate route.`));
  }

  return response.json();
}

// --- Planner, live crowd and assistant -----------------------------------

async function postJson(path, body, fallback) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorMessage(errorData, `${fallback} (${response.status})`));
  }
  return response.json();
}

async function getJson(path, fallback) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorMessage(errorData, `${fallback} (${response.status})`));
  }
  return response.json();
}

/** One journey placed on the clock, with per-leg crowd and a departure advisor. */
export const planTrip = (body) => postJson('/plan', body, 'Could not plan this journey');

/** A multi-stop day: trips chained with the time spent at each stop. */
export const planDay = (body) => postJson('/plan/day', body, 'Could not plan this day');

export const fetchLive = (rain = false) => getJson(`/live?rain=${rain}`, 'Could not load live crowd data');
export const fetchLineRibbon = (line, rain = false) =>
  getJson(`/live/line/${encodeURIComponent(line)}?rain=${rain}`, 'Could not load this line');
export const fetchAtlas = (dayType, direction) =>
  getJson(`/crowd/atlas?day_type=${dayType}&direction=${direction}`, 'Could not load the crowd atlas');
export const reportCrowd = (station, level) => postJson('/crowd/report', { station, level }, 'Could not send the report');

/** Ask the rule-based assistant; pass the previous reply's `context` for follow-ups. */
export const sendChat = (message, context) => postJson('/chat', { message, context }, 'Assistant unavailable');

/**
 * Rain forecast for Mumbai from Open-Meteo (free, no key). Returns
 * { probability, millimetres, rainy } for the given date and hour, or null if
 * the forecast is unavailable (offline, or a date beyond the forecast range).
 */
const rainCache = new Map();

export function fetchRainForecast(date, hour) {
  const key = `${date}T${hour}`;
  const cached = rainCache.get(key);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.promise;
  const promise = loadRainForecast(date, hour);
  rainCache.set(key, { at: Date.now(), promise });
  return promise;
}

async function loadRainForecast(date, hour) {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=19.076&longitude=72.8777'
      + `&hourly=precipitation_probability,precipitation&timezone=Asia%2FKolkata&start_date=${date}&end_date=${date}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const i = data.hourly?.time?.findIndex((t) => t.endsWith(`T${String(hour).padStart(2, '0')}:00`));
    if (i == null || i < 0) return null;
    const probability = data.hourly.precipitation_probability[i];
    const millimetres = data.hourly.precipitation[i];
    if (probability == null && millimetres == null) return null;
    return { probability: probability ?? 0, millimetres: millimetres ?? 0, rainy: (probability ?? 0) >= 50 || (millimetres ?? 0) >= 0.4 };
  } catch {
    return null;
  }
}
