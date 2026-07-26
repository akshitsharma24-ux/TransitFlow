import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Train, Heart } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Session check: only play once per session
    const hasSeenSplash = sessionStorage.getItem('transitflow_splash_shown');
    if (hasSeenSplash) {
      setIsVisible(false);
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      sessionStorage.setItem('transitflow_splash_shown', 'true');
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 400); // allow exit animation to finish
    }, 1600);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B1622] text-[#F2F5F7] p-6 select-none overflow-hidden"
        >
          {/* Subtle Background Radial & Grid */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(63, 207, 224, 0.15) 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative flex flex-col items-center text-center space-y-6 max-w-md mx-auto">
            {/* Animated Logo Container */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative flex items-center justify-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#3FCFE0] via-[#4DD9E8] to-[#D99A3D] p-0.5 shadow-[0_0_30px_rgba(63,207,224,0.4)]">
                <div className="w-full h-full bg-[#0B1622] rounded-[22px] flex items-center justify-center text-[#3FCFE0]">
                  <Train className="w-8 h-8" />
                </div>
              </div>

              {/* Animated Transit Line Pulse */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '120px' }}
                transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                className="absolute top-1/2 -left-16 h-0.5 bg-gradient-to-r from-transparent via-[#3FCFE0] to-transparent -translate-y-1/2 pointer-events-none"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '120px' }}
                transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                className="absolute top-1/2 -right-16 h-0.5 bg-gradient-to-r from-transparent via-[#D99A3D] to-transparent -translate-y-1/2 pointer-events-none"
              />
            </motion.div>

            {/* Wordmark Assembly */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="space-y-1.5"
            >
              <h1 className="text-3xl font-bold font-display tracking-tight text-[#F2F5F7] flex items-center justify-center gap-2">
                <span>TransitFlow</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-[#3FCFE0]/20 text-[#3FCFE0] border border-[#3FCFE0]/40">
                  Mumbai 2026
                </span>
              </h1>
              <p className="text-xs font-mono text-slate-300 tracking-wider">
                WESTERN LINE • METRO YELLOW, RED & AQUA
              </p>
            </motion.div>

            {/* Slogan Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#101B28] border border-[#3FCFE0]/30 text-xs font-mono text-slate-300 shadow-md"
            >
              <Heart className="w-3.5 h-3.5 text-[#B33A44] animate-pulse" />
              <span>By the people, for the people of Mumbai</span>
            </motion.div>

            {/* Departure Board Dots Animation */}
            <div className="flex items-center gap-2 pt-2">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0.2 }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-2 h-2 rounded-full bg-[#3FCFE0]"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
