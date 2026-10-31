import { useEffect, useState } from 'react';
import { fetchRainForecast } from '../api';

/**
 * Real rain forecast for Mumbai at a given date and time (Open-Meteo, no key).
 * `loading` is derived from which request the stored result belongs to, so the
 * effect only ever sets state from inside the async callback.
 */
export default function useRainForecast(date, time) {
  const hour = Number.parseInt((time || '').slice(0, 2), 10);
  const key = date && Number.isFinite(hour) ? `${date}T${hour}` : null;
  const [result, setResult] = useState({ key: null, data: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    fetchRainForecast(date, hour).then((data) => {
      if (!cancelled) setResult({ key, data });
    });
    return () => { cancelled = true; };
  }, [key, date, hour]);

  const ready = key != null && result.key === key;
  return { forecast: ready ? result.data : null, loading: key != null && !ready };
}
