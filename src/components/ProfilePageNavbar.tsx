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

  // Intercept browser back button / Android back swipe gesture
  // When on any profile subpage (where fallbackUrl is '/profile'), ensuring "back" always goes to the profile page
  useEffect(() => {
    if (fallbackUrl === '/profile') {
      window.history.pushState({ isProfileSubpage: true }, '');

      const handlePopState = () => {
        navigate('/profile', { replace: true });
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [fallbackUrl, navigate]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(fallbackUrl);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Small pill shape liquid glass Back button */}
        <div className="flex items-center min-w-[72px]">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-850/80 dark:hover:bg-slate-800/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            id="page-liquid-glass-back-btn"
            title="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            <span>Back</span>
          </button>
        </div>

        {/* Short page heading */}
        <div className="flex-1 text-center px-2">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display truncate">
            {title}
          </h1>
        </div>

        {/* Right side spacer or custom action */}
        <div className="min-w-[72px] flex items-center justify-end">
          {rightAction || null}
        </div>
      </div>
    </header>
  );
}
