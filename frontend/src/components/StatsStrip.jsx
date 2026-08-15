import React from 'react';
import { motion } from 'framer-motion';
import { Building2, TrainTrack, Layers, GitFork } from 'lucide-react';

export default function StatsStrip() {
  const stats = [
    {
      label: 'Stations Loaded',
      value: '112',
      unit: 'stations',
      description: 'Western, Central & 3 Metro lines',
      icon: Building2,
      color: 'text-[#3FCFE0]',
      border: 'border-[#3FCFE0]/25',
      glow: 'shadow-[0_0_20px_rgba(63,207,224,0.15)]',
    },
    {
      label: 'Transit Modes',
      value: '4',
      unit: 'modes',
      description: 'Train, Metro, Bus & Road',
      icon: TrainTrack,
      color: 'text-[#E8A94D]',
      border: 'border-[#D99A3D]/25',
      glow: 'shadow-[0_0_20px_rgba(217,154,61,0.15)]',
    },
    {
      label: 'Rail + Metro Lines',
      value: '5',
      unit: 'lines',
      description: 'Western, Central + Yellow, Red, Aqua',
      icon: Layers,
      color: 'text-[#4DD9E8]',
      border: 'border-[#4DD9E8]/25',
      glow: 'shadow-[0_0_20px_rgba(77,217,232,0.15)]',
    },
    {
      label: 'Interchange Hubs',
      value: '19',
      unit: 'hubs',
      description: 'Cross-mode walking transfers',
      icon: GitFork,
      color: 'text-[#F2BE6B]',
      border: 'border-[#F2BE6B]/25',
      glow: 'shadow-[0_0_20px_rgba(242,190,107,0.15)]',
    },
  ];

  return (
    <section className="w-full relative z-10 py-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className={`glass-panel p-4 md:p-5 rounded-3xl border ${stat.border} ${stat.glow} bg-[#101B28]/85 backdrop-blur-xl space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-slate-400 uppercase tracking-wider">
                  {stat.label}
                </span>
                <div className={`p-2 rounded-xl bg-[#0B1622] border ${stat.border}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono text-[#F2F5F7] tracking-tight">
                  {stat.value}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {stat.unit}
                </span>
              </div>

              <p className="text-xs text-slate-400 font-sans truncate">
                {stat.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
