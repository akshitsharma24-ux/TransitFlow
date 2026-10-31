import { fetchRainForecast } from '../api';

/**
 * Whether to plan for rain: an explicit choice wins, otherwise the real
 * forecast for the planned hour decides (dry if the forecast is unavailable).
 */
export async function resolveRain({ rainMode, date, time }) {
  if (rainMode === 'on') return true;
  if (rainMode === 'off') return false;
  const data = await fetchRainForecast(date, Number.parseInt(time.slice(0, 2), 10));
  return Boolean(data?.rainy);
}
