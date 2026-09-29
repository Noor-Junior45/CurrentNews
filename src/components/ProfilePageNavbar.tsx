import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface ProfilePageNavbarProps {
  title: string;
  onBack?: () => void;
  fallbackUrl?: string;
  rightAction?: React.ReactNode;
}

export default function ProfilePageNavbar({ 
  title, 
  onBack, 
  fallbackUrl = '/profile',
  rightAction 
}: ProfilePageNavbarProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(fallbackUrl);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Small pill shape liquid glass Back button */}
        <div className="flex items-center shrink-0 min-w-[64px] sm:min-w-[72px]">
          <button
            type="button"
            onClick={handleBack}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-900/80 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 dark:hover:border-indigo-500/60 text-slate-700 dark:text-slate-100 dark:hover:text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 select-none group"
            id="page-liquid-glass-back-btn"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white shrink-0 transition-colors" />
            <span className="whitespace-nowrap font-bold text-slate-800 dark:text-slate-100 dark:group-hover:text-white transition-colors">Back</span>
          </button>
        </div>

        {/* Page heading */}
        <div className="flex-1 text-center px-1 sm:px-2 min-w-0">
          <h1 className="text-[11px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight sm:tracking-wider font-display truncate whitespace-nowrap">
            {title}
          </h1>
        </div>

        {/* Right side spacer or custom action */}
        <div className="min-w-[64px] sm:min-w-[72px] flex items-center justify-end shrink-0">
          {rightAction || null}
        </div>
      </div>
    </header>
  );
}
