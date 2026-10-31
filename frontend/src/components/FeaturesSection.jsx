import React from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Clock, TrainFront, Ticket, Route, CalendarRange, Radio, Bot } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      title: 'Rain-Aware Route Penalties',
      badge: 'Weather Aware',
      description:
        'Line-specific rain logic differentiates between underground corridors (Aqua Line 3, immune to rain) and open rail/elevated lines exposed during monsoons.',
      icon: CloudRain,
      accentColor: 'text-[#3FCFE0]',
      borderColor: 'border-[#3FCFE0]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(63,207,224,0.15)]',
    },
    {
      title: 'Predictive Crowd Forecasting',
      badge: 'Comfortable → Packed',
      description:
        'Crowd is modelled to the minute, by direction and by position along the line: towards the city in the morning, away from it in the evening, heaviest around Dadar. Each leg is scored at the moment it is ridden, with rain and a per-line character on top.',
      icon: Clock,
      accentColor: 'text-[#E8A94D]',
      borderColor: 'border-[#D99A3D]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(217,154,61,0.15)]',
    },
    {
      title: 'Multi-Line Rail + Metro Integration',
      badge: '7 Lines',
      description:
        'One shortest-path graph across Western (29 stations), Central (26), Harbour (25), Metro Yellow 2A (17), Red 7 (14), Aqua 3 (27) and Blue / Metro 1 (12): 149 stations wired by 28 interchanges, reaching Navi Mumbai.',
      icon: TrainFront,
      accentColor: 'text-[#4DD9E8]',
      borderColor: 'border-[#4DD9E8]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(77,217,232,0.15)]',
    },
    {
      title: 'Fare-Pass Break-Even Math',
      badge: 'Cost Analysis',
      description:
        'Automated monthly transit pass calculation evaluating single-journey ticket totals against monthly suburban rail pass costs to derive exact breakeven days.',
      icon: Ticket,
      accentColor: 'text-[#F2BE6B]',
      borderColor: 'border-[#F2BE6B]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(242,190,107,0.15)]',
    },
    {
      title: 'Trip Planner with Departure Advisor',
      badge: 'New',
      description:
        'Pick any day and time (leave at, or arrive by) and get an itinerary on the clock: waiting, riding and changing, with crowd on every leg and a chart showing when the same trip is calmer.',
      icon: Route,
      accentColor: 'text-[#3FCFE0]',
      borderColor: 'border-[#3FCFE0]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(63,207,224,0.15)]',
    },
    {
      title: 'Whole-Day Planner',
      badge: 'New',
      description:
        'Chain home, office, gym and back into one timed schedule. Each trip is forecast for the minute it happens, with the day\'s fares, time in busy trains and a monthly-pass verdict.',
      icon: CalendarRange,
      accentColor: 'text-[#E8A94D]',
      borderColor: 'border-[#D99A3D]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(217,154,61,0.15)]',
    },
    {
      title: 'Live Crowd Pulse',
      badge: 'Rider reports',
      description:
        'A network-wide view of crowd by line, direction and station, adjusted by reports from riders. Fluctuations and service alerts are simulated and labelled as such.',
      icon: Radio,
      accentColor: 'text-[#4DD9E8]',
      borderColor: 'border-[#4DD9E8]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(77,217,232,0.15)]',
    },
    {
      title: 'TransitBot Assistant',
      badge: 'Rule-based',
      description:
        'Ask in plain language: "Borivali to Churchgate tomorrow 8:45", "how crowded is Dadar". Typos are tolerated by edit-distance matching, follow-ups keep context, and no external AI service is involved.',
      icon: Bot,
      accentColor: 'text-[#F2BE6B]',
      borderColor: 'border-[#F2BE6B]/30',
      bgGlow: 'hover:shadow-[0_0_30px_rgba(242,190,107,0.15)]',
    },
  ];

  return (
    <section className="w-full relative z-10 space-y-6 pt-4 pb-8">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#101B28] border border-[#3FCFE0]/30 text-[#3FCFE0] font-mono text-xs shadow-md">
          <span className="w-2 h-2 rounded-full bg-[#3FCFE0] animate-pulse" />
          <span>ENGINEERED FOR MUMBAI TRANSIT</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#F2F5F7] tracking-tight">
          Real Algorithmic Capabilities
        </h2>
        <p className="text-sm text-slate-300 font-sans">
          Every recommendation is calculated strictly by our backend Dijkstra engine using real network topologies, distance matrices, and fare structures.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className={`glass-panel p-6 rounded-3xl border ${feat.borderColor} ${feat.bgGlow} bg-[#101B28]/90 backdrop-blur-xl transition-all duration-300 space-y-4`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-2xl bg-[#0B1622] border ${feat.borderColor}`}>
                  <Icon className={`w-6 h-6 ${feat.accentColor}`} />
                </div>
                <span className="text-xs font-mono font-medium px-3 py-1 rounded-full bg-[#0B1622] text-slate-300 border border-slate-800">
                  {feat.badge}
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold font-display text-[#F2F5F7]">
                  {feat.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                  {feat.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
