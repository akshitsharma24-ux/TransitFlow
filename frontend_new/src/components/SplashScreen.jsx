import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrainFront } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('transitflow_splash_shown');
    if (hasSeenSplash) {
      setIsVisible(false);
      onComplete();
      return;
    }
    const timer = setTimeout(() => {
      sessionStorage.setItem('transitflow_splash_shown', 'true');
      setIsVisible(false);
      setTimeout(() => onComplete(), 350);
    }, 1300);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-board dot-grid p-6 select-none"
        >
          <div className="relative flex flex-col items-center text-center gap-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0.1, 1] }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 rounded-sm bg-board border border-board-line flex items-center justify-center led-text"
            >
              <TrainFront className="w-6 h-6" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-2xl font-display font-bold uppercase tracking-wide led-text"
            >
              TransitFlow
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-[10px] font-mono text-[#6B6656] tracking-[0.25em] uppercase"
            >
              Central Indicator · Mumbai
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
