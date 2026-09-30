import { useEffect, useState, useRef } from 'react';

interface AdSpaceProps {
  type: 'in-article' | 'article-bottom' | 'in-feed' | 'leaderboard' | 'sidebar' | 'footer';
  className?: string;
  slot?: string;
}

export const ADSENSE_CLIENT_ID = 'ca-pub-5865716270182311';

export default function AdSpace({ type, className = '', slot }: AdSpaceProps) {
  const [adFailed, setAdFailed] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const adRef = useRef<HTMLModElement | null>(null);

  const adsenseClient = (import.meta as any).env?.VITE_ADSENSE_CLIENT || ADSENSE_CLIENT_ID;
  
  // Custom slot mappings for the ads based on their placements
  let adSlot = slot || '';
  if (!adSlot) {
    switch (type) {
      case 'in-article':
        adSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT_IN_ARTICLE || '';
        break;
      case 'article-bottom':
        adSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT_ARTICLE_BOTTOM || '';
        break;
      case 'in-feed':
        adSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT_IN_FEED || '';
        break;
      case 'leaderboard':
        adSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT_LEADERBOARD || '';
        break;
      case 'sidebar':
        adSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT_SIDEBAR || '';
        break;
      case 'footer':
        adSlot = (import.meta as any).env?.VITE_ADSENSE_SLOT_FOOTER || '';
        break;
    }
  }

  useEffect(() => {
    // Only attempt push if client is configured and element is attached
    if (adsenseClient && adRef.current) {
      try {
        // Only push once per ins element
        const isFilled = adRef.current.getAttribute('data-adsbygoogle-status');
        if (!isFilled) {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          setAdLoaded(true);
        }
      } catch (err) {
        console.debug('Google AdSense element push deferred or handled:', err);
        setAdFailed(true);
      }
    }
  }, [adsenseClient, adSlot]);

  // If adblocker active or push failed, collapse cleanly without leaving an empty box
  if (adFailed) {
    return null;
  }

  // Format configurations compliant with AdSense
  let format = 'auto';
  let layout = '';
  if (type === 'in-article') {
    format = 'fluid';
    layout = 'in-article';
  }

  return (
    <aside 
      aria-label="Advertisement" 
      className={`my-6 mx-auto w-full max-w-4xl overflow-hidden flex flex-col items-center justify-center clear-both adsbygoogle-ad-container ${className}`}
      id={`ad-container-${type}`}
    >
      {/* Google Policy Mandated Label: Must be clearly labeled "Advertisement" or "Sponsored" */}
      <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 select-none font-semibold">
        ADVERTISEMENT
      </span>

      <div className="w-full flex justify-center items-center min-h-[90px] bg-slate-50/50 dark:bg-slate-900/30 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800/60 p-2">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', minWidth: '250px' }}
          data-ad-client={adsenseClient}
          {...(adSlot ? { 'data-ad-slot': adSlot } : {})}
          data-ad-format={format}
          {...(layout ? { 'data-ad-layout': layout } : {})}
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
