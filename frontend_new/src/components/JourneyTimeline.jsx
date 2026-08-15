import React from 'react';
import { motion } from 'framer-motion';
import { Route, Flag, Footprints } from 'lucide-react';
import { getLineConfig, getCrowdConfig } from '../utils/lineColors';

function Node({ label, name, role, color, isFlag }) {
  return (
    <li className="relative flex gap-4 items-start">
      <span
        className="w-7 h-7 rounded-sm flex items-center justify-center text-xs font-bold text-white z-10 shrink-0"
        style={{ backgroundColor: color }}
      >
        {isFlag ? <Flag className="w-3.5 h-3.5" /> : label}
      </span>
      <div className="pt-0.5">
        <div className="text-sm font-semibold text-ink leading-tight">{name}</div>
        <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{role}</div>
      </div>
    </li>
  );
}

export default function JourneyTimeline({ option }) {
  if (!option || !option.legs?.length) return null;
  const legs = option.legs;
  const origin = legs[0].from_station?.name || 'Origin';
  const dest = legs[legs.length - 1].to_station?.name || 'Destination';
  const crowd = option.crowd_forecast ? getCrowdConfig(option.crowd_forecast.level) : null;

  return (
    <div className="rounded-sm border border-ink-line bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Route className="w-4 h-4 text-amber-dim" />
        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-ink-muted">Journey timeline</h3>
        <span className="ml-auto text-[10px] font-mono text-ink-muted tnum">
          {option.time_minutes}m · ₹{option.cost_rupees}
        </span>
      </div>

      <ol className="relative space-y-0">
        <Node label="A" name={origin} role="Depart" color="#2F6B4F" />
        {legs.map((leg, i) => {
          const isWalk = leg.type === 'walk';
          const conf = getLineConfig(leg.line, leg.mode);
          const Icon = isWalk ? Footprints : conf.icon;
          const color = isWalk ? '#848175' : conf.color;
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="relative flex gap-4"
            >
              <span className="w-7 shrink-0 flex justify-center">
                <span
                  className="w-[3px] my-1 min-h-[36px]"
                  style={
                    isWalk
                      ? { backgroundImage: `repeating-linear-gradient(${color} 0 4px, transparent 4px 8px)` }
                      : { backgroundColor: color }
                  }
                />
              </span>
              <div className="flex-1 py-2.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                  <span className="font-mono font-semibold" style={{ color }}>
                    {isWalk ? 'Walk transfer' : leg.line || leg.mode}
                  </span>
                  <span className="text-ink-muted">·</span>
                  <span className="text-ink-soft font-mono tnum">{leg.time_minutes}m</span>
                  {!isWalk && (
                    <>
                      <span className="text-ink-muted">·</span>
                      <span className="text-amber-dim font-mono tnum">₹{leg.cost_rupees}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-ink-muted font-sans mt-0.5 truncate">
                  {leg.from_station?.name} → {leg.to_station?.name}
                </div>
              </div>
            </motion.li>
          );
        })}
        <Node label="B" name={dest} role="Arrive" color="#AF3A32" isFlag />
      </ol>

      {crowd && (
        <div className="mt-5 flex items-center gap-2 text-xs font-mono px-3.5 py-2.5 rounded-sm border" style={{ borderColor: `${crowd.color}55`, backgroundColor: `${crowd.color}14` }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: crowd.color }} />
          <span>Expect a <strong style={{ color: crowd.color }}>{crowd.label.toLowerCase()}</strong> ride on {option.crowd_forecast.driver} around {option.crowd_forecast.hour}:00.</span>
        </div>
      )}
    </div>
  );
}
