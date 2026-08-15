import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const TOTAL_FRAMES = 270;
const FRAME_BASE_PATH = '/ezgif-jpg/ezgif-frame-';

function getFrameUrl(index) {
  const paddedNumber = String(index + 1).padStart(3, '0');
  return `${FRAME_BASE_PATH}${paddedNumber}.jpg`;
}

export default function HeroCanvasAnimation({ children }) {
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);

  const [loadedCount, setLoadedCount] = useState(0);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const currentFrameRef = useRef(0);
  const lastDrawnFrameRef = useRef(-1);
  const userScrolledRef = useRef(false);
  const startTimeRef = useRef(null);
  const animLoopIdRef = useRef(null);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Preload standard compressed JPEGs
  useEffect(() => {
    let isCancelled = false;
    const images = [];
    let count = 0;

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();

      const handleLoad = () => {
        if (isCancelled) return;
        count++;
        setLoadedCount(count);
        if (count === TOTAL_FRAMES) {
          setIsFullyLoaded(true);
        }
      };

      img.onload = handleLoad;
      img.onerror = handleLoad;
      img.src = getFrameUrl(i);

      images.push(img);
    }

    imagesRef.current = images;

    return () => {
      isCancelled = true;
    };
  }, []);

  // Sync Canvas Resolution to Window Size
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, []);

  // Ultra-Fast Canvas Frame Renderer
  const renderFrame = useCallback((frameIdx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIdx));
    let img = imagesRef.current[targetIdx];

    // Fallback to nearest loaded JPEG if target frame is buffering
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = imagesRef.current[targetIdx - offset];
        if (prev && prev.complete && prev.naturalWidth > 0) {
          img = prev;
          break;
        }
        const next = imagesRef.current[targetIdx + offset];
        if (next && next.complete && next.naturalWidth > 0) {
          img = next;
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cW = canvas.width;
    const cH = canvas.height;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    const imgRatio = imgW / imgH;
    const canvasRatio = cW / cH;

    let renderW, renderH, x, y;

    if (canvasRatio > imgRatio) {
      renderW = cW;
      renderH = cW / imgRatio;
      x = 0;
      y = (cH - renderH) / 2;
    } else {
      renderH = cH;
      renderW = cH * imgRatio;
      x = (cW - renderW) / 2;
      y = 0;
    }

    ctx.drawImage(img, x, y, renderW, renderH);
    lastDrawnFrameRef.current = targetIdx;
  }, []);

  // Track window scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      if (scrollY > 5) {
        userScrolledRef.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', syncCanvasSize, { passive: true });

    syncCanvasSize();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, [syncCanvasSize]);

  // SINGLE UNIFIED 60 FPS ANIMATION LOOP
  useEffect(() => {
    if (prefersReducedMotion) return;

    let isRunning = true;
    startTimeRef.current = performance.now();

    const loop = (now) => {
      if (!isRunning) return;

      syncCanvasSize();

      let targetFrame = 0;

      if (!userScrolledRef.current) {
        // Autoplay intro: 0 -> 175 frames over 3.2 seconds
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(1, elapsed / 3200);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        targetFrame = easeProgress * 175;
      } else {
        // Scroll-driven scrubbing over page scrolling
        const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        const progress = Math.max(0, Math.min(1, scrollY / 850));
        targetFrame = progress * (TOTAL_FRAMES - 1);
      }

      // Smooth Lerp Physics
      const diff = targetFrame - currentFrameRef.current;
      if (Math.abs(diff) > 0.005) {
        currentFrameRef.current += diff * 0.15;
      } else {
        currentFrameRef.current = targetFrame;
      }

      const frameToDraw = Math.round(currentFrameRef.current);

      if (frameToDraw !== lastDrawnFrameRef.current) {
        renderFrame(frameToDraw);
      }

      animLoopIdRef.current = requestAnimationFrame(loop);
    };

    animLoopIdRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animLoopIdRef.current) cancelAnimationFrame(animLoopIdRef.current);
    };
  }, [renderFrame, syncCanvasSize, prefersReducedMotion]);

  // Initial draw once first images load
  useEffect(() => {
    syncCanvasSize();
    renderFrame(0);
  }, [syncCanvasSize, renderFrame, loadedCount]);

  const loadPercentage = Math.round((loadedCount / TOTAL_FRAMES) * 100);

  return (
    <section className="relative min-h-[90vh] flex flex-col justify-center items-center py-8 md:py-12 overflow-visible">
      {/* Full-Screen Fixed Background Canvas */}
      {!prefersReducedMotion && (
        <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover block"
          />
          {/* Dark Vignette & Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1622]/75 via-[#0B1622]/85 to-[#0B1622] pointer-events-none" />
        </div>
      )}

      {/* Hero Header Wordmark & Tagline */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center space-y-5 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#101B28]/90 backdrop-blur-md border border-[#3FCFE0]/40 text-[#3FCFE0] font-mono text-xs shadow-2xl"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>MUMBAI MULTIMODAL ROUTING ENGINE — LIVE</span>
        </motion.div>

        <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-[#F2F5F7] tracking-tight leading-none drop-shadow-2xl">
          <motion.span
            initial={{ opacity: 0, y: '0.5em' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
            className="inline-block"
          >
            Transit
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: '0.5em' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: EASE }}
            className="animate-gradient-text bg-gradient-to-r from-[#3FCFE0] via-[#E8A94D] to-[#7D5BA6] bg-clip-text text-transparent inline-block"
          >
            Flow
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.38, ease: EASE }}
          className="text-base sm:text-lg text-slate-200 font-sans max-w-2xl mx-auto leading-relaxed drop-shadow"
        >
          Algorithmic route planning across Western &amp; Central rail and the Yellow, Red &amp; Aqua metros —
          ranked by time, cost, comfort and predicted crowd.
        </motion.p>

        {!isFullyLoaded && (
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-[#101B28]/90 backdrop-blur-md border border-[#D99A3D]/40 text-[#E8A94D] font-mono text-xs shadow-xl">
            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D99A3D] to-[#3FCFE0] transition-all duration-200"
                style={{ width: `${loadPercentage}%` }}
              />
            </div>
            <span>PRELOADING CANVAS {loadPercentage}%</span>
          </div>
        )}
      </div>

      {/* Hero Embedded Search Card (The Hero Moment) */}
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
        className="relative z-10 w-full max-w-4xl mx-auto"
      >
        {children}
      </motion.div>
    </section>
  );
}
