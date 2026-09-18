import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from '../hooks/useAuthState';
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
  CheckCircle2,
  Settings as SettingsIcon, 
  Bell, 
  Loader2,
  Sun,
  MoonStar,
  FileText,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { motion } from 'motion/react';
import GlassThemeToggle from './ThemeToggle';

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

export default function Header() {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [headerSearch, setHeaderSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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

  // Sync newsletter state from Firestore subscribers database
  const checkSubscription = async () => {
    if (!user || !user.email) {
      setIsSubscribed(false);
      setSubDocId(null);
      return;
    }

    try {
      const q = query(
        collection(db, 'subscribers'),
        where('email', '==', user.email.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setIsSubscribed(true);
        setSubDocId(querySnapshot.docs[0].id);
      } else {
        setIsSubscribed(false);
        setSubDocId(null);
      }
    } catch (err) {
      console.error('Error checking newsletter subscription', err);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  // Synchronized storage change listener for instantly updating values between header & footer
  useEffect(() => {
    const handleSync = () => {
      checkSubscription();
      const val = localStorage.getItem('google_ads_personalized_consent');
      setAdsConsent((val as 'granted' | 'denied') || 'pending');
      setNotificationsEnabled(
        localStorage.getItem('browser_notifications_enabled') === 'true' && 
        ('Notification' in window && Notification.permission === 'granted')
      );
    };
    
    handleSync();
    window.addEventListener('settings-updated', handleSync);
    window.addEventListener('storage', handleSync);
    const interval = setInterval(handleSync, 1500);

    return () => {
      window.removeEventListener('settings-updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, [user]);

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
      alert("This browser does not support desktop notifications.");
      return;
    }

    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('browser_notifications_enabled', 'true');
        setNotificationsEnabled(true);
        window.dispatchEvent(new Event('settings-updated'));
        
        // Push-style notification to trigger immediately
        new Notification("Current News Alerts Enabled!", {
          body: "You will now receive automated dispatches directly on this device.",
          icon: "https://i.imgur.com/gq2X5nE.jpeg"
        });

        // Simulating push/alerts to those who have downloaded browser app
        if (isPwaInstalled) {
          setTimeout(() => {
            new Notification("PWA App Connected!", {
              body: "Simulated alert sent to your downloaded browser app.",
              icon: "https://i.imgur.com/gq2X5nE.jpeg"
            });
          }, 1000);
        }
      } else {
        alert("Notification permissions denied. Please enable notifications in your browser settings to activate this feature.");
      }
    } else {
      localStorage.setItem('browser_notifications_enabled', 'false');
      setNotificationsEnabled(false);
      window.dispatchEvent(new Event('settings-updated'));
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
        if (subDocId) {
          await deleteDoc(doc(db, 'subscribers', subDocId));
        } else {
          const q = query(
            collection(db, 'subscribers'), 
            where('email', '==', user.email.toLowerCase())
          );
          const snap = await getDocs(q);
          for (const docItem of snap.docs) {
            await deleteDoc(doc(db, 'subscribers', docItem.id));
          }
        }
        setIsSubscribed(false);
        setSubDocId(null);
        window.dispatchEvent(new Event('settings-updated'));
      } else {
        const q = query(
          collection(db, 'subscribers'), 
          where('email', '==', user.email.toLowerCase())
        );
        const snap = await getDocs(q);
        
        let newDocId = null;
        if (snap.empty) {
          const newDocRef = await addDoc(collection(db, 'subscribers'), {
            email: user.email.toLowerCase(),
            createdAt: serverTimestamp()
          });
          newDocId = newDocRef.id;
        } else {
          newDocId = snap.docs[0].id;
        }
        
        setIsSubscribed(true);
        setSubDocId(newDocId);
        window.dispatchEvent(new Event('settings-updated'));

        // Send backend simulated welcome email
        try {
          await fetch('/api/mail/send-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              title: "Welcome to Current News Alerts!",
              link: window.location.origin
            })
          });
        } catch (err) {
          console.warn('Backend mail API offline:', err);
        }
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

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs" id="main-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand Name */}
        <Link to="/" className="flex items-center text-slate-900 hover:opacity-90 transition-opacity min-w-0" id="header-brand-link">
          <div className="flex flex-col min-w-0">
            <span className="font-display font-bold text-base sm:text-lg md:text-xl tracking-tight leading-none uppercase text-slate-950">
              Current News
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold font-mono uppercase tracking-wider truncate">
              Independent Ledger
            </span>
          </div>
        </Link>

        {/* Global Action Controls */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          
          {/* Elegant Magnifying Glass Button triggers overlay like YouTube */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 sm:p-2.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            id="header-search-trigger"
            title="Open dispatch search panel"
          >
            <Search className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
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
              <div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse border border-slate-200" />
            ) : (
              /* The trigger circle button - always a round thumbnail like Gmail without outer ring */
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 hover:border-indigo-500 overflow-hidden text-slate-600 hover:text-slate-900 shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer relative z-50 focus:outline-hidden"
                id="header-profile-trigger"
                title={user ? `Account: ${user.displayName || user.email}` : "Editorial Portal Access"}
              >
                {user ? (
                  user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile Avatar" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full bg-indigo-650 text-white flex items-center justify-center font-bold text-sm">
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )
                ) : (
                  <User className="h-5 w-5 text-slate-500" />
                )}
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
                    {/* Back Button (Phone screen shows liquid glass Back button, hidden on larger screens) */}
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      className="sm:hidden inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer z-10"
                      id="profile-back-button"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" />
                      <span>Back</span>
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
                      <div className="h-20 w-20 sm:h-20 sm:w-20 rounded-full border-2 border-amber-400 overflow-hidden shrink-0 shadow-md bg-slate-100 dark:bg-slate-800 mb-3">
                        {user.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt="Profile Avatar" 
                            className="h-full w-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-full w-full bg-indigo-700 text-white flex items-center justify-center font-bold text-2xl">
                            {user.displayName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>

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
                        <button
                          onClick={() => { setIsDropdownOpen(false); navigate('/'); }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                          id="public-news-feed-button"
                        >
                          <Newspaper className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>Public News Feed</span>
                        </button>

                        {/* Liked Button (placed between News Feed and Setting) */}
                        <Link
                          to="/liked"
                          onClick={() => setIsDropdownOpen(false)}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                          id="liked-dispatches-button"
                        >
                          <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                          <span>Liked</span>
                        </Link>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=dashboard'); }}
                              className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                            >
                              <Shield className="h-4 w-4 text-indigo-500 shrink-0" />
                              <span>Admin Dashboard</span>
                            </button>

                            <button
                              onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=draft'); }}
                              className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                            >
                              <PlusCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                              <span>Draft New Publication</span>
                            </button>

                            <button
                              onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=publications'); }}
                              className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                            >
                              <Newspaper className="h-4 w-4 text-blue-500 shrink-0" />
                              <span>Current Publications</span>
                            </button>

                            <button
                              onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=audience'); }}
                              className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                            >
                              <Users className="h-4 w-4 text-purple-500 shrink-0" />
                              <span>Audience Registry</span>
                            </button>
                          </>
                        )}

                        {/* Setting Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setIsSettingsOpen(true);
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="settings-trigger-button"
                        >
                          <SettingsIcon className="h-4 w-4 text-purple-500 shrink-0" />
                          <span>Setting</span>
                        </button>

                        {/* Privacy Policy Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/privacy');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="privacy-policy-button"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Privacy Policy</span>
                        </button>

                        {/* Terms of Service Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/terms');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="terms-of-service-button"
                        >
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span>Terms of Service</span>
                        </button>

                        {/* Account Delete Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/delete-account');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-rose-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="account-delete-button"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                          <span>Account Delete</span>
                        </button>
                      </div>

                      {/* In last: Sign Out Button */}
                      <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3.5 mt-3">
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-full cursor-pointer transition-all shadow-xs hover:shadow-md border border-red-700"
                          id="signout-button"
                        >
                          <LogOut className="h-3.5 w-3.5 text-white" />
                          <span>Sign Out</span>
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
                        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-950 text-white hover:bg-slate-800 text-xs font-semibold rounded-full cursor-pointer transition-colors shadow-xs mb-3"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Sign In</span>
                      </button>

                      <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2" id="guest-links-container">
                        <Link
                          to="/liked"
                          onClick={() => setIsDropdownOpen(false)}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                          id="liked-dispatches-guest-button"
                        >
                          <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                          <span>Liked</span>
                        </Link>

                        {/* Setting Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setIsSettingsOpen(true);
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-settings-trigger-button"
                        >
                          <SettingsIcon className="h-4 w-4 text-purple-500 shrink-0" />
                          <span>Setting</span>
                        </button>

                        {/* Privacy Policy Button (appears for everyone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/privacy');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-privacy-policy-button"
                        >
                          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span>Privacy Policy</span>
                        </button>

                        {/* Terms of Service Button (appears for everyone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/terms');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-indigo-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-terms-of-service-button"
                        >
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span>Terms of Service</span>
                        </button>

                        {/* Account Delete Button (appears for everyone) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            navigate('/delete-account');
                          }}
                          className="w-full flex items-center space-x-3 py-2.5 px-3.5 rounded-full text-slate-700 hover:text-rose-600 bg-slate-50/80 hover:bg-slate-150/80 dark:bg-slate-900/60 dark:hover:bg-slate-850/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer text-left"
                          id="guest-account-delete-button"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                          <span>Account Delete</span>
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex space-x-3">
                  <Sun className="h-4.5 w-4.5 text-amber-500 mt-0.5 shrink-0 dark:hidden" />
                  <MoonStar className="h-4.5 w-4.5 text-indigo-400 mt-0.5 shrink-0 hidden dark:block" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Theme Appearance</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                      Toggle between daylight brightness and night mode.
                    </p>
                  </div>
                </div>
                <GlassThemeToggle />
              </div>
              
              {/* 1. Browser Notifications & App Alerts */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex space-x-3">
                    <Bell className="h-4.5 w-4.5 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Notifications</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                        Receive instant push updates when fresh world dispatches are published.
                      </p>
                    </div>
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex space-x-3">
                  <Newspaper className="h-4.5 w-4.5 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Newsletter Alerts</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                      Subscribe to automated breaking news alerts on your registered Google email.
                    </p>
                  </div>
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex space-x-3">
                  <Shield className="h-4.5 w-4.5 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Personalized Ads</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
                      Allow cookie tracking to tailor personalized advertisements.
                    </p>
                  </div>
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
  );
}
