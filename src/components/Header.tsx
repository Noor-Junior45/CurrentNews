import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { api } from '../utils/api';
import { useAuthState } from '../hooks/useAuthState';
import { getCanonicalSiteOrigin } from '../utils/shareUrl';
import UserAvatar from './UserAvatar';
import { 
  LogIn, 
  LogOut, 
  Shield, 
  Newspaper, 
  User, 
  Rss, 
  PlusCircle, 
  Users, 
  Search, 
  ThumbsUp, 
  X, 
  ArrowLeft,
  ChevronLeft,
  CheckCircle2,
  Settings as SettingsIcon, 
  Bell, 
  Loader2,
  Sun,
  MoonStar,
  FileText,
  ShieldCheck,
  Trash2,
  Menu,
  ChevronRight
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import GlassThemeToggle from './ThemeToggle';
import { subscribeUserToPush, unsubscribeUserFromPush, isUserPushSubscribed } from '../utils/pushManager';

// Glassmorphism ToggleSwitch matching the frosted glass theme toggle button
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  checked, 
  onChange, 
  disabled = false, 
  ariaLabel = "Toggle setting",
  id 
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      id={id}
      className={`group relative flex items-center h-7 w-14 p-[3px] rounded-full cursor-pointer select-none transition-all duration-300 outline-hidden shrink-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? 'bg-indigo-600/85 dark:bg-indigo-500/85 border border-white/60 dark:border-white/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),0_2px_8px_rgba(99,102,241,0.35)]'
          : 'bg-slate-300/70 dark:bg-slate-800/70 border border-white/80 dark:border-white/15 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_-1px_2px_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.06)]'
      } backdrop-blur-md`}
    >
      {/* Ambient track ON / OFF labels */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none text-[8.5px] font-bold font-mono tracking-wider">
        <span className={`transition-opacity duration-200 ${checked ? 'opacity-90 text-white' : 'opacity-0'}`}>
          ON
        </span>
        <span className={`transition-opacity duration-200 ${!checked ? 'opacity-50 text-slate-700 dark:text-slate-300' : 'opacity-0'}`}>
          OFF
        </span>
      </div>

      {/* Sliding Frosted Glass Disc Knob */}
      <motion.div
        animate={{ x: checked ? 28 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`relative z-10 flex items-center justify-center w-[22px] h-[22px] rounded-full pointer-events-none transition-colors duration-300 ${
          checked
            ? 'bg-gradient-to-b from-white via-white/95 to-indigo-50/95 border border-white/90 shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,1)]'
            : 'bg-gradient-to-b from-white via-white/95 to-slate-100/90 dark:from-slate-700/90 dark:via-slate-800/95 dark:to-slate-900/95 border border-white/90 dark:border-white/20 shadow-[0_2px_5px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.8)]'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            checked ? 'bg-indigo-600 shadow-[0_0_4px_rgba(79,70,229,0.8)]' : 'bg-slate-400 dark:bg-slate-500'
          }`}
        />
      </motion.div>
    </button>
  );
};

const SIDE_MENU_CATEGORIES = [
  'All',
  'Jharkhand',
  'National',
  'World',
  'Politics',
  'Business',
  'Sports',
  'Tech',
  'Health',
  'Crime',
  'Education',
  'Entertainment',
  'Opinion',
  'General',
];

export default function Header() {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [headerSearch, setHeaderSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Auto-close side menu on route change
  useEffect(() => {
    setIsSideMenuOpen(false);
  }, [location.pathname, location.search]);

  // --- Settings Modal State & Toggles ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Browser notifications preference state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('browser_notifications_enabled') === 'true' && ('Notification' in window && Notification.permission === 'granted');
  });

  // PWA Add to Home Screen states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    return window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('pwa_app_downloaded') === 'true';
  });

  // Newsletter subscription states
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [subDocId, setSubDocId] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);

  // Personalized Ads consent states
  const [adsConsent, setAdsConsent] = useState<'granted' | 'denied' | 'pending'>('pending');

  // Sync search input with URL search param
  useEffect(() => {
    setHeaderSearch(searchParams.get('search') || '');
  }, [searchParams]);

  // Handle escape key to close search pop-up overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to PWA installation prompts
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsPwaInstalled(true);
      localStorage.setItem('pwa_app_downloaded', 'true');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Sync newsletter state from Firestore subscribers database with local caching
  const checkSubscription = async () => {
    if (!user || !user.email) {
      setIsSubscribed(false);
      setSubDocId(null);
      return;
    }

    const emailKey = 'cn_sub_' + user.email.toLowerCase();
    const cachedSub = localStorage.getItem(emailKey);
    if (cachedSub) {
      setIsSubscribed(true);
      setSubDocId(cachedSub !== 'true' ? cachedSub : null);
    }

    try {
      const subscribed = await api.checkEmailSubscription(user.email.toLowerCase());
      if (subscribed) {
        setIsSubscribed(true);
        setSubDocId('subscribed');
        localStorage.setItem(emailKey, 'true');
      } else {
        setIsSubscribed(false);
        setSubDocId(null);
        localStorage.removeItem(emailKey);
      }
    } catch (err: any) {
      console.debug('Failed to check newsletter subscription from server:', err);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user?.email]);

  // Synchronized storage change listener for instantly updating values between header & footer
  useEffect(() => {
    const handleSync = () => {
      const val = localStorage.getItem('google_ads_personalized_consent');
      setAdsConsent((val as 'granted' | 'denied') || 'pending');
      const isGranted = 'Notification' in window && Notification.permission === 'granted';
      setNotificationsEnabled(
        isGranted && localStorage.getItem('browser_notifications_enabled') !== 'false'
      );
      if (user?.email) {
        const cached = localStorage.getItem('cn_sub_' + user.email.toLowerCase());
        if (cached) {
          setIsSubscribed(true);
          setSubDocId(cached !== 'true' ? cached : null);
        }
      }
    };
    
    handleSync();
    window.addEventListener('settings-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('settings-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user?.email]);

  // Lock body scroll on mobile when profile page dropdown is open
  useEffect(() => {
    if (isDropdownOpen && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDropdownOpen]);

  // Toggle Browser notifications and PWA alert settings
  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support push notifications.");
      return;
    }

    if (!notificationsEnabled) {
      const res = await subscribeUserToPush();
      if (res.success) {
        setNotificationsEnabled(true);
      } else {
        alert(res.message || "Notification permissions denied. Please enable notifications in your browser settings to activate this feature.");
      }
    } else {
      await unsubscribeUserFromPush();
      setNotificationsEnabled(false);
    }
  };

  // Download Web App / Add to Home screen trigger
  const installPwaApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPwaInstalled(true);
        localStorage.setItem('pwa_app_downloaded', 'true');
        setDeferredPrompt(null);
        window.dispatchEvent(new Event('settings-updated'));
        
        if ('Notification' in window && Notification.permission === 'granted') {
          setTimeout(() => {
            new Notification("Welcome to Home Screen App!", {
              body: "Installation choice accepted. Autonomous shortcut registered successfully.",
              icon: "https://i.imgur.com/gq2X5nE.jpeg"
            });
          }, 1500);
        }
      }
    } else {
      alert("App is already downloaded or direct installation is complete. You can add it to your Home Screen from your browser settings if on mobile.");
    }
  };

  // Handle setting Ads consent
  const handleSetAdsConsent = (value: 'granted' | 'denied') => {
    localStorage.setItem('google_ads_personalized_consent', value);
    setAdsConsent(value);
    window.dispatchEvent(new Event('settings-updated'));
    
    if (window.hasOwnProperty('adsbygoogle')) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).requestNonPersonalizedAds = value === 'granted' ? 0 : 1;
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const toggleAdsConsent = () => {
    const nextValue = adsConsent === 'granted' ? 'denied' : 'granted';
    handleSetAdsConsent(nextValue);
  };

  // Handle newsletter subscribing from the settings panel
  const handleNewsletterAction = async (target: 'subscribe' | 'unsubscribe') => {
    if (!user) {
      const confirmSignIn = window.confirm(
        "To subscribe or unsubscribe from newsletter alerts, you must be logged in. Would you like to sign in with your Google account now?"
      );
      if (confirmSignIn) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(auth, provider);
        } catch (err) {
          console.error("Popup sign in failed", err);
        }
      }
      return;
    }

    setIsSubscribing(true);
    try {
      if (target === 'unsubscribe') {
        await api.unsubscribeEmail();
        setIsSubscribed(false);
        setSubDocId(null);
        localStorage.removeItem('cn_sub_' + user.email.toLowerCase());
        localStorage.removeItem('newsletter_subscribed');
        window.dispatchEvent(new Event('settings-updated'));
      } else {
        await api.subscribeEmail(user.email.toLowerCase());
        setIsSubscribed(true);
        setSubDocId('subscribed');
        localStorage.setItem('cn_sub_' + user.email.toLowerCase(), 'true');
        localStorage.setItem('newsletter_subscribed', 'true');
        window.dispatchEvent(new Event('settings-updated'));
      }
    } catch (err) {
      console.error('Newsletter settings sync failed:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleToggleNewsletter = () => {
    if (isSubscribed) {
      handleNewsletterAction('unsubscribe');
    } else {
      handleNewsletterAction('subscribe');
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setIsDropdownOpen(false);
    } catch (e) {
      console.error('Login error', e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsDropdownOpen(false);
      navigate('/');
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const isHome = location.pathname === '/' || location.pathname === '';
  const [isScrolledPastLine2, setIsScrolledPastLine2] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsScrolledPastLine2(scrollPos > 45);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
    };
  }, []);

  const isLine2Hidden = !isHome || isScrolledPastLine2;

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 w-full z-50 bg-[#fbf1e5] ${isLine2Hidden ? 'rounded-b-2xl sm:rounded-b-3xl border-b border-slate-300/70 dark:border-slate-800/80 shadow-xs' : 'border-b-0 shadow-none rounded-none'} transition-all duration-200 adsbygoogle-noablate`} id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand Name & Newsroom Navigation */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0">
          {/* 3 horizontal line menu trigger: hidden when 2nd line navbar is visible; visible when 2nd line navbar is hidden or scrolled */}
          {isLine2Hidden && (
            <button
              type="button"
              onClick={() => setIsSideMenuOpen(true)}
              className="h-10 w-10 -ml-1 sm:-ml-2 p-2 rounded-xl text-slate-800 hover:text-black hover:bg-black/5 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 group focus:outline-hidden animate-in fade-in duration-200"
              aria-label="Open categories side menu"
              title="Categories & Sections"
              id="header-side-menu-trigger"
            >
              <Menu className="h-5 w-5 text-slate-900" />
            </button>
          )}

          <Link 
            to="/" 
            onClick={() => {
              sessionStorage.removeItem('current_news_return_scroll');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            className="flex items-center text-slate-900 hover:opacity-90 transition-opacity min-w-0" 
            id="header-brand-link"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-playfair font-black text-lg sm:text-xl md:text-2xl tracking-tight leading-none uppercase text-slate-950">
                Current News
              </span>
              <span className="font-lora text-[10px] sm:text-[11px] text-slate-700 font-semibold tracking-wider uppercase truncate mt-0.5">
                Independent Ledger
              </span>
            </div>
          </Link>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          
          {/* Elegant Magnifying Glass Button triggers overlay like YouTube */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="h-11 w-11 rounded-full text-slate-700 hover:text-slate-950 dark:text-slate-700 dark:hover:text-slate-950 hover:bg-black/5 dark:hover:bg-black/5 transition-colors cursor-pointer flex items-center justify-center"
            id="header-search-trigger"
            title="Open dispatch search panel"
          >
            <Search className="h-5 w-5" />
          </button>
          
          <div className="relative" id="header-profile-dropdown-container">
            {/* Click catcher overlay when dropdown is open on desktop */}
            {isDropdownOpen && (
              <div 
                className="hidden sm:block fixed inset-0 z-45 bg-transparent cursor-default" 
                onClick={() => setIsDropdownOpen(false)}
              />
            )}

            {loading ? (
              <div className="h-11 w-11 rounded-full bg-slate-200/60 dark:bg-slate-200/60 animate-pulse border border-slate-300" />
            ) : (
              /* The trigger circle button - navigates directly to dedicated Profile page */
              <button 
                onClick={() => navigate('/profile')}
                className="h-11 w-11 rounded-full bg-white/80 hover:bg-white dark:bg-white/80 dark:hover:bg-white border-2 border-slate-300 dark:border-slate-300 hover:border-slate-500 dark:hover:border-slate-500 overflow-hidden text-slate-700 hover:text-slate-900 shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer relative z-50 focus:outline-hidden"
                id="header-profile-trigger"
                title={user ? `Account: ${user.displayName || user.email}` : "Editorial Portal Access"}
              >
                <UserAvatar user={user} size="md" />
              </button>
            )}

            {/* Gmail-Style Dropdown Menu / Full-screen mobile profile page */}
            {isDropdownOpen && (
              <div 
                className="fixed inset-0 z-[100] w-full h-full min-h-screen bg-white dark:bg-slate-950 overflow-y-auto sm:inset-auto sm:absolute sm:right-0 sm:mt-3 sm:w-88 sm:h-auto sm:min-h-0 sm:rounded-[28px] sm:bg-white sm:dark:bg-slate-950 sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xl sm:p-0 sm:z-55 sm:max-h-[85vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-in fade-in duration-200 origin-top-right font-sans flex flex-col"
                id="gmail-style-account-dropdown"
              >
                {/* Profile Header Details on seamless white / dark background */}
                <div className="w-full px-5 pt-5 pb-0 sm:px-6 sm:pt-6 relative shrink-0">
                  {/* Top Bar: Back button (phone only) and Close button (larger screens) */}
                  <div className="flex items-center justify-between w-full mb-3">
                    {/* Back Button (Phone screen shows Back button with tailless arrow and no background, hidden on larger screens) */}
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      className="sm:hidden h-10 w-10 -ml-2 bg-transparent hover:bg-transparent border-0 shadow-none text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white transition-colors cursor-pointer active:scale-90 inline-flex items-center justify-center z-10 shrink-0 select-none group focus-visible:outline-none"
                      id="profile-back-button"
                      aria-label="Go back"
                      title="Go back"
                    >
                      <ChevronLeft className="h-6 w-6 stroke-[2.2] shrink-0 transition-transform group-hover:-translate-x-0.5" />
                    </button>

                    {/* Desktop Close Button (Only on larger screens, hidden on phone screens) */}
                    <div className="ml-auto flex items-center z-10">
                      <button
                        onClick={() => setIsDropdownOpen(false)}
                        className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                        title="Close menu"
                        id="close-dropdown-button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {user ? (
                    /* User Info: Avatar, Name, and Email all centered in the middle of this page */
                    <div className="flex flex-col items-center justify-center text-center w-full pt-1 pb-1">
                      {/* Avatar with single Golden Ring in middle */}
                      <UserAvatar
                        user={user}
                        size="lg"
                        showBorder={true}
                        ringColor="border-amber-400"
                        className="mb-3 shadow-md"
                      />

                      {/* User Name below avatar */}
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-wide uppercase leading-tight truncate max-w-[280px]">
                        {user.displayName || 'Chronicle Reader'}
                      </h4>

                      {/* Email address below name */}
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mt-1.5 max-w-[280px]">
                        <span className="truncate">{user.email}</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 fill-sky-500 text-white shrink-0" />
                      </div>
                    </div>
                  ) : (
                    /* Guest View in Middle */
                    <div className="flex flex-col items-center justify-center text-center w-full pt-1 pb-1">
                      <div className="h-16 w-16 rounded-full border-2 border-amber-400 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-md mb-2.5">
                        <User className="h-7 w-7 text-slate-600 dark:text-slate-300" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                        Chronicle Portal
                      </h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        Guest Reader
                      </span>
                    </div>
                  )}

                  {/* Grey / subtle liquid glass horizontal line below email distinguishing profile details and buttons */}
                  <div className="w-full border-t border-slate-200/90 dark:border-slate-800/90 mt-4 mb-2" />
                </div>

                {/* Content Card for Navigation Buttons */}
                <div className="px-5 pb-5 pt-1 sm:px-6 sm:pb-6 flex-1 bg-white dark:bg-slate-950 sm:rounded-b-[28px]">
                  {user ? (
                    <div className="w-full max-w-sm mx-auto flex flex-col">
                      {/* Navigation Actions List */}
                      <div className="w-full space-y-2 align-left text-left">
                        {/* Liked Button */}
                        <Link
                          to="/liked"
                          onClick={() => setIsDropdownOpen(false)}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                          id="liked-dispatches-button"
                        >
                          <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Liked</span>
                        </Link>

                        {isAdmin && (
                          <button
                            onClick={() => { setIsDropdownOpen(false); navigate('/admin'); }}
                            className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                            id="admin-dashboard-button"
                          >
                            <Shield className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Admin</span>
                          </button>
                        )}

                        {/* Setting Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="settings-trigger-button"
                        >
                          <SettingsIcon className="h-4 w-4 text-purple-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Setting</span>
                        </button>

                        {/* Privacy Policy Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/privacy');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="privacy-policy-button"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Privacy Policy</span>
                        </button>

                        {/* Terms of Service Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/terms');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="terms-of-service-button"
                        >
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Terms of Service</span>
                        </button>

                        {/* Account Delete Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/delete-account');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-rose-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="account-delete-button"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-rose-400">Account Delete</span>
                        </button>
                      </div>

                      {/* In last: Sign Out Button */}
                      <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-3">
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 dark:hover:bg-transparent dark:hover:border-red-500 text-white dark:hover:text-red-400 text-xs font-bold rounded-full cursor-pointer transition-all shadow-xs hover:shadow-md border border-red-700"
                          id="signout-button"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span className="font-bold">Sign Out</span>
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center py-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                        Log in with your authorized editor account to compose, edit, or publish live dispatches.
                      </p>

                      <button 
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-950 dark:bg-slate-900 text-white hover:bg-slate-800 dark:hover:bg-transparent dark:hover:border-indigo-500/60 dark:hover:text-white text-xs font-semibold rounded-full cursor-pointer transition-all border border-transparent dark:border-slate-700/80 shadow-xs mb-3"
                      >
                        <LogIn className="h-3.5 w-3.5 text-white" />
                        <span className="font-bold text-white">Sign In</span>
                      </button>

                      <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2" id="guest-links-container">
                        <Link
                          to="/liked"
                          onClick={() => setIsDropdownOpen(false)}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                          id="liked-dispatches-guest-button"
                        >
                          <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Liked</span>
                        </Link>

                        {/* Setting Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-settings-trigger-button"
                        >
                          <SettingsIcon className="h-4 w-4 text-purple-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Setting</span>
                        </button>

                        {/* Privacy Policy Button (appears for everyone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/privacy');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-privacy-policy-button"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Privacy Policy</span>
                        </button>

                        {/* Terms of Service Button (appears for everyone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/terms');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-white bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-terms-of-service-button"
                        >
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Terms of Service</span>
                        </button>

                        {/* Account Delete Button (appears for everyone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/delete-account');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 dark:hover:border-rose-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-account-delete-button"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-rose-400">Account Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Preferences & Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fade-in" id="settings-modal-overlay">
          {/* Click outside to close */}
          <div className="absolute inset-0" onClick={() => setIsSettingsOpen(false)} />
          
          <div className="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-8 z-10 animate-scale-up" id="settings-modal-card">
            {/* Close Button */}
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors cursor-pointer z-10"
              title="Close Setting"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 text-left">
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-purple-500" />
                <span>Setting</span>
              </h3>
              <div className="mt-4 border-b border-slate-100 dark:border-slate-800" />
            </div>

            {/* List of Toggles - BORDERLESS */}
            <div className="space-y-6 text-left">

              {/* Theme Mode (Light / Dark) with custom glassmorphism toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <Sun className="h-4.5 w-4.5 text-amber-500 shrink-0 dark:hidden" />
                  <MoonStar className="h-4.5 w-4.5 text-indigo-400 shrink-0 hidden dark:block" />
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Theme Appearance</h4>
                </div>
                <GlassThemeToggle />
              </div>
              
              {/* 1. Browser Notifications & App Alerts */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <Bell className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Notifications</h4>
                  </div>
                  <ToggleSwitch 
                    checked={notificationsEnabled}
                    onChange={toggleNotifications}
                    ariaLabel="Toggle Notifications"
                    id="browser-notifications-toggle"
                  />
                </div>
                
                {/* Home Screen App trigger notification if PWA is supported/installed */}
                {deferredPrompt && (
                  <div className="pl-7.5 mt-1">
                    <button
                      type="button"
                      onClick={installPwaApp}
                      className="inline-flex items-center space-x-1 py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-lg text-[9px] font-bold tracking-wide transition-colors cursor-pointer"
                    >
                      <span>📥 Download Web App to Home Screen</span>
                    </button>
                  </div>
                )}
                {isPwaInstalled && (
                  <div className="pl-7.5 text-[9px] text-emerald-500 font-mono flex items-center gap-1">
                    <span>✓ Installed on Device (Home Screen alerts active)</span>
                  </div>
                )}
              </div>

              {/* 2. Newsletter Alerts */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <Newspaper className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Newsletter Alerts</h4>
                </div>
                <ToggleSwitch 
                  checked={isSubscribed}
                  onChange={handleToggleNewsletter}
                  disabled={isSubscribing}
                  ariaLabel="Toggle Newsletter Alerts"
                  id="newsletter-alerts-toggle"
                />
              </div>

              {/* 3. Personalized Ads Consent */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Personalized Ads</h4>
                </div>
                <ToggleSwitch 
                  checked={adsConsent === 'granted'}
                  onChange={toggleAdsConsent}
                  ariaLabel="Toggle Personalized Ads"
                  id="personalized-ads-toggle"
                />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* YouTube-style Search Overlay Pop-up Modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 z-55 bg-[#faf8f2]/98 dark:bg-[#121211]/98 backdrop-blur-md flex flex-col pt-3 sm:pt-5 px-3 sm:px-6 transition-all duration-300"
          id="search-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSearchOpen(false);
            }
          }}
        >
          {/* Top Header of Search Page holding the Search Bar */}
          <div className="max-w-2xl w-full mx-auto" id="search-modal-box">
            <div className="flex items-center gap-2.5 sm:gap-3 w-full mb-6 pb-2" id="search-header-bar">
              {/* Back / Close button */}
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-2 sm:p-2.5 rounded-full text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Back / Close search"
                id="search-back-arrow-button"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {/* Top Search Bar */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/?search=${encodeURIComponent(headerSearch)}`);
                  if (location.pathname === '/' || location.pathname === '') {
                    const nextParams = new URLSearchParams(searchParams);
                    if (!headerSearch) {
                      nextParams.delete('search');
                    } else {
                      nextParams.set('search', headerSearch);
                    }
                    setSearchParams(nextParams);
                  }
                  setIsSearchOpen(false);
                }}
                className="relative flex-1"
                id="search-form-top"
              >
                <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search report titles, tags, or topics..."
                  autoFocus
                  value={headerSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHeaderSearch(val);
                    if (location.pathname === '/' || location.pathname === '') {
                      const nextParams = new URLSearchParams(searchParams);
                      if (!val) {
                        nextParams.delete('search');
                      } else {
                        nextParams.set('search', val);
                      }
                      setSearchParams(nextParams);
                    }
                  }}
                  className="w-full pl-11 sm:pl-12 pr-11 sm:pr-12 py-3 text-base sm:text-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 dark:focus:ring-indigo-500/30 transition-all placeholder-slate-400 font-medium shadow-2xs"
                  id="overlay-search-input"
                />

                {/* Cross button inside search bar to clear text & search results */}
                {headerSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderSearch('');
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete('search');
                      setSearchParams(nextParams);
                      if (location.pathname !== '/' && location.pathname !== '') {
                        navigate('/');
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Clear text and search results"
                    id="search-clear-cross-button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>
            </div>

            {/* Suggested Popular Topics */}
            <div>
              <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-500 dark:text-slate-450 uppercase mb-4">
                Popular Search Terms
              </h4>
              <div className="flex flex-wrap gap-2.5" id="search-suggested-topics">
                {[
                  'Politics',
                  'Finance',
                  'Technology',
                  'Artificial Intelligence',
                  'Climate Emergency',
                  'Global Affairs',
                  'Elections',
                  'Sports Dispatches',
                  'Wall Street'
                ].map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setHeaderSearch(topic);
                      navigate(`/?search=${encodeURIComponent(topic)}`);
                      if (location.pathname === '/' || location.pathname === '') {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set('search', topic);
                        setSearchParams(nextParams);
                      }
                      setIsSearchOpen(false);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl border border-slate-205 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-3xs cursor-pointer transition-all active:scale-98"
                  >
                    <span className="text-amber-600 dark:text-amber-500 font-bold mr-1">#</span>{topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
      {/* Fixed navbar height spacer keeping page content aligned directly under the header */}
      <div className="h-18 w-full shrink-0 pointer-events-none" aria-hidden="true" id="header-fixed-spacer" />

      {/* Beige Side Drawer Menu (active when user is inside articles and Line 2 is hidden) */}
      <AnimatePresence>
        {isSideMenuOpen && (
          <div className="fixed inset-0 z-[100] flex" id="article-side-menu-overlay">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsSideMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
              aria-label="Close menu"
            />

            {/* Left-Side Drawer: Compact proportional scaling to fit all device length ratios without scrolling */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative z-10 w-[72vw] max-w-[270px] sm:w-76 h-full bg-[#fbf1e5] border-r border-[#e8dbcc] dark:border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              id="article-side-menu-panel"
            >
              {/* Drawer Header with Brand Title & Close Button */}
              <div className="px-3.5 py-2 sm:py-2.5 border-b border-[#e8dbcc]/80 flex items-center justify-between shrink-0 bg-[#fbf1e5]/95 backdrop-blur-xs sticky top-0 z-10">
                <div className="flex flex-col">
                  <span className="font-playfair font-black text-sm sm:text-base text-slate-950 uppercase leading-none tracking-tight">
                    Current News
                  </span>
                  <span className="font-lora text-[8.5px] sm:text-[9.5px] text-slate-600 uppercase tracking-wider font-semibold mt-0.5">
                    Newsroom Sections
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSideMenuOpen(false)}
                  className="h-7 w-7 rounded-full text-slate-600 hover:text-slate-900 hover:bg-black/5 transition-colors cursor-pointer flex items-center justify-center active:scale-90"
                  title="Close categories menu"
                  id="side-menu-close-button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* All Categories Navigation List: Compact sizing without large min-height so all categories fit cleanly across any device height */}
              <div className="px-2 py-1 sm:px-2.5 sm:py-1.5 flex-1 flex flex-col justify-evenly gap-0.5" id="side-menu-categories-list">
                <div className="text-[8.5px] font-mono font-bold tracking-widest text-slate-500 uppercase px-2 py-0.5 shrink-0">
                  Browse by Category
                </div>
                {SIDE_MENU_CATEGORIES.map((cat) => {
                  const currentCategoryParam = searchParams.get('category') || 'All';
                  const isCurrent = currentCategoryParam.toLowerCase() === cat.toLowerCase();

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setIsSideMenuOpen(false);
                        sessionStorage.removeItem('current_news_return_scroll');
                        sessionStorage.removeItem('current_news_return_search');
                        if (cat === 'All') {
                          navigate('/');
                        } else {
                          navigate(`/?category=${encodeURIComponent(cat)}`);
                        }
                        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                      }}
                      className={`w-full py-1 sm:py-1.2 px-2.5 text-[10.5px] sm:text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer rounded-lg flex items-center justify-between text-left group active:scale-98 shrink-0 ${
                        isCurrent
                          ? 'bg-amber-100/95 text-black border border-amber-400/50 shadow-2xs font-extrabold'
                          : 'bg-transparent text-slate-900 hover:bg-black/5 border border-transparent'
                      }`}
                      id={`side-menu-cat-tab-${cat.toLowerCase()}`}
                    >
                      <span className="font-bold text-slate-900 group-hover:text-black">
                        {cat}
                      </span>
                      <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>

              {/* Bottom Return to Home Top Feed Action */}
              <div className="p-2.5 sm:p-3 border-t border-[#e8dbcc]/80 bg-[#fbf1e5] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsSideMenuOpen(false);
                    sessionStorage.removeItem('current_news_return_scroll');
                    sessionStorage.removeItem('current_news_return_search');
                    navigate('/');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  className="w-full py-1.5 sm:py-2 px-2.5 rounded-lg sm:rounded-xl bg-slate-900 text-white hover:bg-black text-[10.5px] sm:text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  id="side-menu-return-home-button"
                >
                  <Newspaper className="h-3.5 w-3.5" />
                  <span>Return to Home Feed</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
