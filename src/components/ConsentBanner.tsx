import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Info, Check } from 'lucide-react';

export default function ConsentBanner() {
  const [consent, setConsent] = useState<'granted' | 'denied' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const autoDismissRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check local storage for consent status
    const storedConsent = localStorage.getItem('google_ads_personalized_consent');
    if (storedConsent === 'granted' || storedConsent === 'denied') {
      setConsent(storedConsent as 'granted' | 'denied');
    } else {
      // If no consent has been made, start the 1-second auto-dismiss countdown
      // This will automatically choose non-personalized "basic" ads as requested by the user
      autoDismissRef.current = setTimeout(() => {
        handlePersonalizedConsent(false);
      }, 1000);
    }

    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
      }
    };
  }, []);

  const handlePersonalizedConsent = (granted: boolean) => {
    // Clear any pending auto-dismiss timer
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
    const value = granted ? 'granted' : 'denied';
    localStorage.setItem('google_ads_personalized_consent', value);
    setConsent(value);

    // Apply basic updates to Google AdSense if defined globally
    if (window.hasOwnProperty('adsbygoogle')) {
      try {
        const adsby = (window as any).adsbygoogle || [];
        adsby.requestNonPersonalizedAds = granted ? 0 : 1;
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Pause auto-dismiss if user interacts or hovers over the block to read
  const handleInteraction = () => {
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  };

  // If consent is already chosen, do not render the banner
  if (consent !== null) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed bottom-4 right-4 left-4 sm:left-auto md:right-5 md:bottom-5 z-[200] max-w-sm bg-transparent pointer-events-none" 
        id="consent-banner-wrapper"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onMouseEnter={handleInteraction}
          onClick={handleInteraction}
          className="bg-slate-950/75 dark:bg-slate-900/75 border border-slate-800/60 backdrop-blur-md text-slate-100 rounded-xl shadow-xl p-3 pointer-events-auto flex flex-col gap-2.5 transition-all w-full"
          id="google-consent-banner"
        >
          {/* Main small description bar */}
          <div className="flex items-start gap-2">
            <div className="p-1 px-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0 mt-0.5 border border-indigo-500/20">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[11px] font-bold tracking-tight text-white flex items-center gap-1 font-display">
                <span>AdSense Personalization Policy</span>
                <span className="text-[8px] font-mono uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1 rounded-sm py-0.5 font-bold tracking-wider shrink-0">
                  Auto-Basic Active
                </span>
              </h5>
              <p className="text-[10px] text-slate-300 leading-normal mt-0.5 font-sans">
                We utilize non-tracking user analytical telemetry by default. We request your prompt consent to deliver highly personalized ads.
              </p>
              
              {/* Extra context in details panel */}
              {showDetails && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 pt-2 border-t border-slate-800/80 text-[9px] text-slate-400 space-y-1 leading-normal"
                >
                  <p>
                    <strong>Basic Ads:</strong> Relies only on page content relevancy.
                  </p>
                  <p>
                    <strong>Personalized Ads:</strong> Integrates Google publisher cookies.
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Micro Action Bar */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-[10px]">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[9px] font-mono text-slate-400 hover:text-white px-1.5 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-0.5 select-none font-bold"
              title="More details"
            >
              <Info className="h-2.5 w-2.5" />
              <span>{showDetails ? 'LESS' : 'INFO'}</span>
            </button>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePersonalizedConsent(false)}
                className="text-[9px] font-bold bg-slate-800/60 hover:bg-slate-800 text-slate-300 px-2 py-1 rounded transition-colors cursor-pointer"
                title="Only receive generic context-relevant ads"
              >
                Basic
              </button>
              <button
                onClick={() => handlePersonalizedConsent(true)}
                className="text-[9px] font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-0.5 shadow-sm"
                title="Agree to Google cookie placement"
              >
                <Check className="h-2.5 w-2.5" />
                <span>Personalize</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
