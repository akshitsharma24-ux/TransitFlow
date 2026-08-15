import React from 'react';
import { motion } from 'framer-motion';
import { Building2, TrainTrack, Layers, GitFork } from 'lucide-react';

export default function StatsStrip() {
  const stats = [
    { label: 'Stations', value: '112', unit: 'loaded', icon: Building2 },
    { label: 'Modes', value: '4', unit: 'types', icon: TrainTrack },
    { label: 'Corridors', value: '5', unit: 'lines', icon: Layers },
    { label: 'Interchanges', value: '19', unit: 'hubs', icon: GitFork },
  ];

  return (
    <section className="w-full grid grid-cols-2 lg:grid-cols-4 border border-ink-line rounded-sm overflow-hidden divide-x divide-y lg:divide-y-0 divide-ink-line bg-card">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: idx * 0.06 }}
            className="p-5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium text-ink-muted uppercase tracking-wider">{stat.label}</span>
              <Icon className="w-3.5 h-3.5 text-amber-dim" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-display font-bold text-ink tracking-tight tnum">{stat.value}</span>
              <span className="text-[11px] font-mono text-ink-muted">{stat.unit}</span>
            </div>
          </motion.div>
        );
      })}
    </section>
  );
}
