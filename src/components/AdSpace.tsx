import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';

interface AdSpaceProps {
  type: 'leaderboard' | 'sidebar' | 'footer';
}

export default function AdSpace({ type }: AdSpaceProps) {
  const [adFailed, setAdFailed] = useState(false);
  const adsenseClient = (import.meta as any).env.VITE_ADSENSE_CLIENT || '';
  
  // Custom slot mappings for the ads based on their placements
  let adSlot = '';
  switch (type) {
    case 'leaderboard':
      adSlot = (import.meta as any).env.VITE_ADSENSE_SLOT_LEADERBOARD || '';
      break;
    case 'sidebar':
      adSlot = (import.meta as any).env.VITE_ADSENSE_SLOT_SIDEBAR || '';
      break;
    case 'footer':
      adSlot = (import.meta as any).env.VITE_ADSENSE_SLOT_FOOTER || '';
      break;
  }

  useEffect(() => {
    if (adsenseClient && adSlot) {
      try {
        // Push ad unit to AdSense pool
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (err) {
        console.warn('Google AdSense pushed error or blocked by adblocker', err);
        setAdFailed(true);
      }
    }
  }, [adsenseClient, adSlot]);

  let containerClasses = '';
  let label = '';
  let dimensions = '';

  switch (type) {
    case 'leaderboard':
      containerClasses = 'ad-leaderboard w-full h-[90px] bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 rounded-lg flex flex-col justify-center items-center text-slate-400 p-2 my-6 transition-all select-none';
      label = 'Leaderboard Advertisement Space';
      dimensions = '728 × 90 px (Standard Billboard)';
      break;
    case 'sidebar':
      containerClasses = 'ad-sidebar w-full min-h-[300px] h-full bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 rounded-lg flex flex-col justify-center items-center text-slate-400 p-4 transition-all select-none';
      label = 'Sidebar Advertisement Space';
      dimensions = '300 × 250 px / 300 × 600 px';
      break;
    case 'footer':
      containerClasses = 'ad-footer w-full h-[120px] bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 rounded-lg flex flex-col justify-center items-center text-slate-400 p-3 my-8 transition-all select-none';
      label = 'Footer Advertisement Space';
      dimensions = '970 × 90 px / 728 × 90 px';
      break;
  }

  // If client ID and slot are provided, try to render real AdSense tag
  if (adsenseClient && adSlot && !adFailed) {
    return (
      <div className="w-full overflow-hidden flex justify-center my-6" id={`real-ad-${type}`}>
        <ins 
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={adsenseClient}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // Hide placeholder boxes as requested by the user
  return null;
}

