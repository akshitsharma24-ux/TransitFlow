import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Radio } from 'lucide-react';

const HEADLINE = 'TRANSITFLOW';

function FlickerChar({ char, index }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.5, 0.08, 0.85, 0.25, 1] }}
      transition={{ duration: 0.42, delay: 0.25 + index * 0.045, times: [0, 0.15, 0.3, 0.5, 0.7, 1] }}
      className="inline-block"
    >
      {char === ' ' ? ' ' : char}
    </motion.span>
  );
}

export default function HeroSection({ onPlan }) {
  return (
    <section className="w-full pt-6 pb-4">
      <div className="relative bg-board rounded-sm border border-board-line overflow-hidden">
        {/* Rivets */}
        <span className="rivet" style={{ top: 10, left: 10 }} />
        <span className="rivet" style={{ top: 10, right: 10 }} />
        <span className="rivet" style={{ bottom: 10, left: 10 }} />
        <span className="rivet" style={{ bottom: 10, right: 10 }} />

        {/* Unlit dot-matrix texture across the whole board */}
        <div className="absolute inset-0 dot-grid opacity-70 pointer-events-none" />

        <div className="relative px-6 sm:px-12 py-16 sm:py-24 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.32em] uppercase text-amber/80 mb-8 led-text"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Central Indicator · Mumbai Suburban &amp; Metro</span>
          </motion.div>

          <h1 className="font-display font-bold uppercase text-[3.6rem] sm:text-8xl md:text-9xl leading-[0.9] tracking-tight led-text">
            {HEADLINE.split('').map((c, i) => (
              <FlickerChar key={i} char={c} index={i} />
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="mt-7 max-w-lg text-sm sm:text-base text-[#B7B29E] leading-relaxed font-mono"
          >
            112 stations · 5 lines · live-ranked by time, cost, comfort and predicted crowd
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            onClick={onPlan}
            className="mt-9 inline-flex items-center gap-2.5 bg-amber hover:bg-[#F2B355] text-board font-display font-semibold uppercase tracking-wide text-base px-7 py-3 rounded-sm transition-colors cursor-pointer"
          >
            Check departures
            <ArrowDown className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Bottom status strip — like a real board's system line */}
        <div className="relative border-t border-board-line px-6 sm:px-12 py-2.5 flex items-center justify-between font-mono text-[10px] tracking-wider text-[#6B6656]">
          <span>SYS: DIJKSTRA / YEN&apos;S K-SHORTEST</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
            LIVE
          </span>
        </div>
      </div>
    </section>
  );
}
