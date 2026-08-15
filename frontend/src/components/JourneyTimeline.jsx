import React from 'react';
import { motion } from 'framer-motion';
import { Route, Flag, Footprints } from 'lucide-react';
import { getLineConfig, getCrowdConfig } from '../utils/lineColors';

function Node({ label, name, role, color, isFlag }) {
  return (
    <li className="relative flex gap-4 items-start">
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white z-10 ring-4 ring-[#101B28] shrink-0"
        style={{ backgroundColor: color }}
      >
        {isFlag ? <Flag className="w-4 h-4" /> : label}
      </span>
      <div className="pt-1">
        <div className="text-sm font-bold text-[#F2F5F7] leading-tight">{name}</div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{role}</div>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-slate-800/90 bg-[#101B28]/85 backdrop-blur-xl p-5 sm:p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <Route className="w-4 h-4 text-[#3FCFE0]" />
        <h3 className="text-sm font-bold font-display text-[#F2F5F7]">Journey Timeline</h3>
        <span className="ml-auto text-[10px] font-mono text-slate-500">
          {option.time_minutes} min · ₹{option.cost_rupees}
        </span>
      </div>

      <ol className="relative space-y-0">
        <Node label="A" name={origin} role="Depart" color="#0F9B6E" />

        {legs.map((leg, i) => {
          const isWalk = leg.type === 'walk';
          const conf = getLineConfig(leg.line, leg.mode);
          const Icon = isWalk ? Footprints : conf.icon;
          const color = isWalk ? '#64748b' : conf.color;
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="relative flex gap-4"
            >
              {/* Rail segment aligned under the node dots (w-8, centered) */}
              <span className="w-8 shrink-0 flex justify-center">
                <span
                  className="w-1 rounded-full my-1 min-h-[38px]"
                  style={
                    isWalk
                      ? { backgroundImage: `repeating-linear-gradient(${color} 0 5px, transparent 5px 10px)` }
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
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400 font-mono">{leg.time_minutes} min</span>
                  {!isWalk && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-[#3FCFE0] font-mono">₹{leg.cost_rupees}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-sans mt-0.5 truncate">
                  {leg.from_station?.name} → {leg.to_station?.name}
                </div>
              </div>
            </motion.li>
          );
        })}

        <Node label="B" name={dest} role="Arrive" color="#C0263B" isFlag />
      </ol>

      {crowd && (
        <div className={`mt-5 flex items-center gap-2 text-xs font-mono px-3.5 py-2.5 rounded-2xl border ${crowd.bgClass}`}>
          <span>Expect a <strong>{crowd.label.toLowerCase()}</strong> ride on {option.crowd_forecast.driver} around {option.crowd_forecast.hour}:00.</span>
        </div>
      )}
    </motion.div>
  );
}
