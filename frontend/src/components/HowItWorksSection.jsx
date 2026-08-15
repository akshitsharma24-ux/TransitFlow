import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Network, GitBranch, SlidersHorizontal, CloudRain, Terminal } from 'lucide-react';

const STEPS = [
  {
    icon: Network,
    tag: 'STEP 1 — GRAPH MODEL',
    title: 'Every station becomes several graph nodes',
    body: 'Each station is layered by mode — (andheri, train), (andheri, metro) — wired together by real edges across 112 stations spanning the Western Line, Central Line, and all 3 metro lines, plus walking transfers between physically distinct interchange stations.',
    code: 'G.add_edge((u, mode), (v, mode), time=…, cost=…, comfort=…)',
  },
  {
    icon: GitBranch,
    tag: 'STEP 2 — PATHFINDING',
    title: "Dijkstra runs — repeatedly, via Yen's algorithm",
    body: "A single shortest-path search only ever returns one winner. TransitFlow instead runs Yen's k-shortest-paths, which calls Dijkstra again and again with the previous route's edges temporarily excluded — surfacing genuine alternatives (transfer at Andheri vs. Malad) instead of discarding the runner-up.",
    code: 'nx.shortest_simple_paths(G, src, dst, weight="weight")',
  },
  {
    icon: SlidersHorizontal,
    tag: 'STEP 3 — MULTI-OBJECTIVE SCORING',
    title: 'Time, cost, and comfort — blended by what you asked for',
    body: 'Every candidate route is scored on a weighted blend of normalized time, cost, and comfort. Picking "Cheapest" shifts weight toward cost; "Comfortable" shifts toward comfort — same candidate routes, different ranking.',
    code: 'score = w_time·time + w_cost·cost + w_comfort·comfort',
  },
  {
    icon: CloudRain,
    tag: 'STEP 4 — CONTEXT PENALTIES',
    title: 'Rain and rush-hour crowding adjust comfort live',
    body: 'Rain penalties are line-aware — the underground Aqua Line is untouched, elevated Yellow/Red lines take a small hit, open rail platforms take the worst. Crowding penalties key off the hour and weekday/weekend from a rules table, not a hardcoded guess.',
    code: 'comfort_penalty = base + rain[line] + crowd[mode, hour, day]',
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.8', 'end 0.5'],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section ref={sectionRef} className="w-full relative z-10 space-y-10 py-8">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#101B28] border border-[#3FCFE0]/30 text-[#3FCFE0] font-mono text-xs shadow-md">
          <Terminal className="w-3.5 h-3.5" />
          <span>UNDER THE HOOD</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#F2F5F7] tracking-tight">
          How This Actually Gets Computed
        </h2>
        <p className="text-sm text-slate-300 font-sans">
          No black box — this is the exact pipeline that turns two station names into a ranked, comfort-and-rain-aware itinerary.
        </p>
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Connecting spine — fills as you scroll through the steps */}
        <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-slate-800 hidden sm:block overflow-hidden rounded-full">
          <motion.div
            className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-[#3FCFE0] to-[#E8A94D] origin-top"
            style={{ scaleY: lineScale }}
          />
        </div>

        <div className="space-y-8">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative sm:pl-[70px]"
              >
                <div className="hidden sm:flex absolute left-0 top-0 w-14 h-14 rounded-2xl bg-[#101B28] border-2 border-[#3FCFE0]/40 items-center justify-center shadow-[0_0_20px_rgba(63,207,224,0.15)] z-10">
                  <Icon className="w-6 h-6 text-[#3FCFE0]" />
                </div>

                <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-slate-800/90 bg-[#101B28]/85 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon className="w-4 h-4 text-[#3FCFE0] sm:hidden" />
                    <span className="text-[10px] font-mono font-bold tracking-wider text-[#E8A94D]">{step.tag}</span>
                  </div>
                  <h3 className="text-lg font-bold font-display text-[#F2F5F7]">{step.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed font-sans">{step.body}</p>
                  <div className="text-[11px] font-mono text-[#3FCFE0]/90 bg-[#0B1622] border border-slate-800 rounded-xl px-3.5 py-2.5 overflow-x-auto">
                    {step.code}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
