import React from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Clock, TrainFront, Ticket } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      title: 'Rain-aware routing',
      description: 'Line-specific rain logic separates underground corridors (Aqua Line, immune) from open rail and elevated metro exposed during the monsoon.',
      icon: CloudRain,
      accent: '#3E6491',
    },
    {
      title: 'Predictive crowd forecasting',
      description: 'Every route carries a predicted crowd level from its busiest leg — blending each line\'s character with hour-of-day and weekday/weekend patterns.',
      icon: Clock,
      accent: '#E8A33D',
    },
    {
      title: 'Five rail + metro corridors',
      description: 'One Dijkstra graph across Western (29), Central (26), Yellow 2A (17), Red 7 (14) and Aqua 3 (27) — wired together by real interchanges.',
      icon: TrainFront,
      accent: '#2F6B4F',
    },
    {
      title: 'Fare-pass break-even',
      description: 'Weighs single-journey ticket totals against monthly pass costs to derive the exact number of commuting days a pass takes to pay for itself.',
      icon: Ticket,
      accent: '#8B3A3A',
    },
  ];

  return (
    <section className="w-full space-y-6">
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-ink-muted">System notes</span>
        <h2 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">What the engine does</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 border border-ink-line rounded-sm overflow-hidden divide-x divide-y divide-ink-line bg-card">
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              className="p-6 space-y-3"
            >
              <div
                className="w-9 h-9 flex items-center justify-center rounded-sm"
                style={{ backgroundColor: `${feat.accent}16`, color: feat.accent }}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-lg font-display font-semibold text-ink">{feat.title}</h3>
              <p className="text-sm text-ink-soft leading-relaxed">{feat.description}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
