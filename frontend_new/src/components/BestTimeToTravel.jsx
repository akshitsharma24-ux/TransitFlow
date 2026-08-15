import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, TrendingDown } from 'lucide-react';
import { getCrowdConfig } from '../utils/lineColors';

function fmtHour(h) {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${h < 12 || h === 24 ? 'am' : 'pm'}`;
}
function contiguousRanges(hours) {
  const ranges = [];
  for (const h of hours) {
    const last = ranges[ranges.length - 1];
    if (last && h === last[1]) last[1] = h + 1;
    else ranges.push([h, h + 1]);
  }
  return ranges;
}

export default function BestTimeToTravel({ option }) {
  const [hovered, setHovered] = useState(null);
  const forecast = option?.crowd_forecast;
  if (!forecast?.hourly?.length) return null;

  const hourly = forecast.hourly;
  const currentHour = forecast.hour;
  const maxScore = Math.max(...hourly.map((h) => h.score));
  const minScore = Math.min(...hourly.map((h) => h.score));
  const hasSpike = maxScore - minScore > 0.05;
  const peakHours = hourly.filter((h) => h.score >= maxScore - 0.01).map((h) => h.hour);
  const peakRanges = contiguousRanges(peakHours);
  const quietHours = hourly.filter((h) => h.score <= minScore + 0.01).map((h) => h.hour);

  return (
    <div className="rounded-sm border border-ink-line bg-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Clock3 className="w-4 h-4 text-amber-dim" />
        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-ink-muted">Best time to travel</h3>
        <span className="ml-auto text-[10px] font-mono text-ink-muted">{forecast.driver} · {forecast.day_type}</span>
      </div>

      <div className="flex items-start gap-2 text-xs font-mono px-3.5 py-2.5 rounded-sm border border-signal-green/25 bg-signal-green-wash text-[#215A39]">
        <TrendingDown className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        {hasSpike ? (
          <span>
            Busiest around <strong className="text-ink">{peakRanges.map(([a, b]) => `${fmtHour(a)}–${fmtHour(b)}`).join(' & ')}</strong>.
            {' '}Travel outside those windows for a noticeably calmer ride.
          </span>
        ) : (
          <span>Crowd stays steady across the day on {forecast.day_type}s — no sharp rush-hour spike on this line.</span>
        )}
      </div>

      <div>
        <div className="flex items-end gap-[3px] h-24">
          {hourly.map((h) => {
            const conf = getCrowdConfig(h.level);
            const isCurrent = h.hour === currentHour;
            const isQuiet = quietHours.includes(h.hour);
            const emphasized = isCurrent || isQuiet || hovered === h.hour;
            return (
              <div
                key={h.hour}
                className="relative flex-1 h-full flex flex-col justify-end items-center"
                onMouseEnter={() => setHovered(h.hour)}
                onMouseLeave={() => setHovered(null)}
              >
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(6, h.score * 100)}%` }}
                  transition={{ duration: 0.4, delay: h.hour * 0.01, ease: 'easeOut' }}
                  className="w-full cursor-pointer"
                  style={{
                    backgroundColor: conf.color,
                    opacity: emphasized ? 1 : 0.4,
                    outline: isCurrent ? '2px solid #E8A33D' : 'none',
                  }}
                />
                {hovered === h.hour && (
                  <div className="absolute -top-8 z-10 whitespace-nowrap text-[10px] font-mono bg-board text-amber px-2 py-1 rounded-sm">
                    {fmtHour(h.hour)} · {h.level}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] font-mono text-ink-muted">
          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-ink-muted">
        {['Comfortable', 'Moderate', 'Busy', 'Packed'].map((l) => {
          const c = getCrowdConfig(l);
          return (
            <span key={l} className="flex items-center gap-1">
              <span className="w-2 h-2" style={{ backgroundColor: c.color }} />
              {l}
            </span>
          );
        })}
        <span className="flex items-center gap-1 ml-auto">
          <span className="w-2.5 h-2.5 ring-2 ring-amber" />
          Your time
        </span>
      </div>
    </div>
  );
}
