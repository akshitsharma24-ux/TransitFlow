import React from 'react';
import { motion } from 'framer-motion';
import { Network, GitBranch, SlidersHorizontal, CloudRain } from 'lucide-react';

const STEPS = [
  {
    icon: Network,
    tag: 'STEP 1 — GRAPH MODEL',
    title: 'Every station becomes several graph nodes',
    body: 'Each station is layered by mode — (andheri, train), (andheri, metro) — wired by real edges across 112 stations spanning the Western Line, Central Line, and all 3 metro lines, plus walking transfers between physically distinct interchange stations.',
    code: 'G.add_edge((u, mode), (v, mode), time=…, cost=…, comfort=…)',
  },
  {
    icon: GitBranch,
    tag: 'STEP 2 — PATHFINDING',
    title: "Dijkstra runs — repeatedly, via Yen's algorithm",
    body: "A single shortest-path search only ever returns one winner. TransitFlow instead runs Yen's k-shortest-paths, which calls Dijkstra again and again with the previous route's edges excluded — surfacing genuine alternatives instead of discarding the runner-up.",
    code: 'nx.shortest_simple_paths(G, src, dst, weight="weight")',
  },
  {
    icon: SlidersHorizontal,
    tag: 'STEP 3 — MULTI-OBJECTIVE SCORING',
    title: 'Time, cost, and comfort — blended by what you asked for',
    body: 'Every candidate route is scored on a weighted blend of normalized time, cost, and comfort. Picking "Cheapest" leads the ordering by fare; "Comfortable" leads by comfort.',
    code: 'score = w_time·time + w_cost·cost + w_comfort·comfort',
  },
  {
    icon: CloudRain,
    tag: 'STEP 4 — CONTEXT PENALTIES',
    title: 'Rain and rush-hour crowding adjust comfort live',
    body: 'Rain penalties are line-aware — the underground Aqua Line is untouched, elevated Yellow/Red lines take a small hit, open rail platforms take the worst. Crowding keys off hour and weekday/weekend from a rules table.',
    code: 'comfort_penalty = base + rain[line] + crowd[mode, hour, day]',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="w-full space-y-6">
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-ink-muted">Under the hood</span>
        <h2 className="text-3xl font-display font-semibold uppercase tracking-wide text-ink">How this gets computed</h2>
      </div>

      <div className="border border-ink-line rounded-sm overflow-hidden divide-y divide-ink-line bg-card">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 p-6"
            >
              <div className="flex sm:flex-col items-center sm:items-start gap-3">
                <span className="w-9 h-9 rounded-sm bg-board text-amber flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <span className="text-[10px] font-mono font-bold tracking-wider text-amber-dim">{step.tag}</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-display font-semibold text-ink">{step.title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{step.body}</p>
                <div className="text-[11px] font-mono text-amber bg-board rounded-sm px-3.5 py-2.5 overflow-x-auto">
                  {step.code}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
