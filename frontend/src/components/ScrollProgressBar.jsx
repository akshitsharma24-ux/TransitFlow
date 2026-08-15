import React from 'react';
import { motion, useScroll } from 'framer-motion';

export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] z-[100] origin-left bg-gradient-to-r from-[#3FCFE0] via-[#4DD9E8] to-[#E8A94D] pointer-events-none"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
