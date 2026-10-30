import { useEffect, useRef } from 'react';
import { admobManager } from '../utils/admob';

interface AdMobNativeAdProps {
  slotKey: string;
  className?: string;
}

/**
 * AdMobNativeAd Component
 * Renders an official Google AdMob Native Advanced ad unit inside native mobile apps.
 * In compliance with Google AdMob policies, it is clearly designated with an "Ad" badge
 * and maintains stable container dimensions to prevent layout shifts.
 * On web browsers, it returns null to respect the user's preference to hide web ads.
 */
export default function AdMobNativeAd({ slotKey, className = '' }: AdMobNativeAdProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!admobManager.isNative() || !containerRef.current) return;

    const el = containerRef.current;
    admobManager.attachNativeAd(slotKey, el);

    return () => {
      admobManager.detachNativeAd(el);
    };
  }, [slotKey]);

  // If not running inside the native phone app, collapse cleanly
  if (!admobManager.isNative()) {
    return null;
  }

  return (
    <div 
      className={`my-6 mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-900/40 p-3 min-h-[140px] flex flex-col justify-center items-center relative ${className}`}
      id={`admob-native-slot-${slotKey}`}
      ref={containerRef}
      aria-label="Sponsored advertisement"
    >
      {/* Official Google AdMob Policy Requirement: Ad badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
        <span className="bg-amber-500/90 text-white font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-3xs tracking-wider">
          Ad
        </span>
        <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-widest font-mono">
          Sponsored
        </span>
      </div>
      
      {/* Native Ad overlay target container populated by Google Mobile Ads SDK */}
      <div className="w-full flex items-center justify-center min-h-[110px]" />
    </div>
  );
}
