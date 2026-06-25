import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, CircleDot } from 'lucide-react';

export default function ScrollHelper() {
  const [scrollPercent, setScrollPercent] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track scroll activity
  useEffect(() => {
    const handleScroll = () => {
      // Calculate scroll progress percentage
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = height > 0 ? (winScroll / height) * 100 : 0;
      setScrollPercent(Math.round(pct));

      // Show the helper immediately when scrolling
      setIsVisible(true);

      // Auto-hide unless hovered/expanded
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Hide after 2 seconds of inactivity
      hideTimeoutRef.current = setTimeout(() => {
        if (!isExpanded) {
          setIsVisible(false);
        }
      }, 2000);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isExpanded]);

  // Keep visible on expansion/hover
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    // Start fading out shortly after mouse leave
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setIsExpanded(false);
    }, 1500);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed right-4 md:right-6 top-1/2 -translate-y-1/2 z-[99]"
          id="samsung-scroll-companion"
        >
          {/* Main vertical tactile control panel */}
          <div 
            className={`flex flex-col items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-lg border border-white/50 dark:border-white/10 rounded-full transition-all duration-300 shadow-xl shadow-slate-200/40 dark:shadow-black/20 p-1.5 ${
              isExpanded ? 'h-52 w-11' : 'h-36 w-8'
            }`}
          >
            {/* Scroll Indicator Percentage Top */}
            <div className="text-[9px] font-mono font-bold text-slate-800 dark:text-white mb-2 leading-none cursor-default select-none pr-px pt-0.5">
              {scrollPercent}%
            </div>

            {/* Micro Dynamic Track Indicator */}
            <div className="relative flex-1 w-1 bg-slate-200 dark:bg-white/20 rounded-full mb-2 overflow-hidden">
              <motion.div 
                className="absolute top-0 left-0 right-0 bg-indigo-500 dark:bg-indigo-400 rounded-full"
                style={{ height: `${scrollPercent}%` }}
                layoutId="vertical-scroll-bar"
              />
            </div>

            {/* Trigger Circle Companion Button - expanding with animation */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center justify-center rounded-full border border-slate-200 dark:border-white/5 shadow-inner cursor-pointer transition-all duration-200 ${
                isExpanded ? 'h-8 w-8 mb-3 bg-indigo-600 text-white' : 'h-5 w-5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white/80'
              }`}
              title={isExpanded ? "Collapse jump shortcuts" : "Expand quick scroll shortcuts"}
            >
              {isExpanded ? (
                <CircleDot className="h-4 w-4 animate-pulse" />
              ) : (
                <div className="flex flex-col space-y-[1.5px] items-center">
                  <div className="h-0.5 w-2 bg-slate-600 dark:bg-white/90 rounded-full" />
                  <div className="h-0.5 w-2.5 bg-slate-600 dark:bg-white/90 rounded-full" />
                  <div className="h-0.5 w-2 bg-slate-600 dark:bg-white/90 rounded-full" />
                </div>
              )}
            </button>

            {/* Quick action controls, staggered entry on expand */}
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-2 pb-1"
              >
                <button
                  onClick={scrollToTop}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-all cursor-pointer shadow-md hover:scale-110"
                  title="Scroll to main top"
                >
                  <ChevronUp className="h-4 w-4 text-indigo-600 dark:text-indigo-200" />
                </button>
                <button
                  onClick={scrollToBottom}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-all cursor-pointer shadow-md hover:scale-110"
                  title="Scroll to footer bottom"
                >
                  <ChevronDown className="h-4 w-4 text-indigo-600 dark:text-indigo-200" />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
