import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { api } from '../utils/api';
import { useAuthState } from '../hooks/useAuthState';
import { getCanonicalSiteOrigin } from '../utils/shareUrl';
import UserAvatar from './UserAvatar';
import { getCompressedStories } from '../utils/compressedStorage';
import { Post } from '../types';
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
  ArrowUpLeft,
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
import { Capacitor } from '@capacitor/core';
import { isPushSupported, subscribeUserToPush, unsubscribeUserFromPush, isUserPushSubscribed } from '../utils/pushManager';

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

interface SearchSuggestion {
  text: string;
  kind: 'section' | 'topic' | 'article';
}

const SEARCH_SUGGESTION_SECTIONS = [
  'Jharkhand', 'Politics', 'World', 'National', 'Tech', 'Sports',
  'Business', 'Health', 'Crime', 'Education', 'Entertainment', 'Opinion', 'General'
];

const SEARCH_SUGGESTION_TOPICS = [
  'Ranchi', 'Dhanbad', 'Jamshedpur', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Godda',
  'Jharkhand News', 'Breaking News', 'Live Updates', 'India News', 'World Affairs',
  'Elections', 'Artificial Intelligence', 'Finance', 'Stock Market', 'Climate',
  'Supreme Court', 'Budget', 'Space', 'Defense', 'झारखंड समाचार', 'रांची', 'ताजा खबर'
];

function renderSuggestionHighlight(text: string, query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return <span className="font-normal text-slate-800">{text}</span>;
  const idx = text.toLowerCase().indexOf(cleanQuery.toLowerCase());
  if (idx === -1) return <span className="font-medium text-slate-800">{text}</span>;
  const before = text.substring(0, idx);
  const match = text.substring(idx, idx + cleanQuery.length);
  const after = text.substring(idx + cleanQuery.length);
  return (
    <>
      <span className="font-normal text-slate-700">{before}</span>
      <span className="font-bold text-slate-950">{match}</span>
      <span className="font-bold text-slate-950">{after}</span>
    </>
  );
}

export default function Header() {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Search Bar Redesign State (Line 2 Pill Search Bar)
  const activeSearchFromUrl = searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(activeSearchFromUrl);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(() => {
    return Boolean(activeSearchFromUrl || (typeof window !== 'undefined' && (window as any).__cnSearchOpen));
  });
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [pillOriginOffset, setPillOriginOffset] = useState<{ x: number; y: number }>({ x: 140, y: -56 });
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const fallbackCatalogRef = useRef<Post[]>([]);

  // Broadcast search bar open/close state so HomeView hides/shows category buttons in sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__cnSearchOpen = isSearchOpen;
      window.dispatchEvent(new CustomEvent('currentnews-search-toggled', { detail: { open: isSearchOpen } }));
    }
  }, [isSearchOpen]);

  // Measure magnifying glass coordinates so the pill animates from/to the exact magnifying glass spot
  const measureMagnifyingGlassOrigin = useCallback(() => {
    if (typeof window === 'undefined' || !searchTriggerRef.current) return;
    const rect = searchTriggerRef.current.getBoundingClientRect();
    const triggerCenterX = rect.left + rect.width / 2;
    const triggerCenterY = rect.top + rect.height / 2;
    const pillCenterX = window.innerWidth / 2;
    const pillCenterY = 98; // Vertical center of Line 2 pill inside fixed navbar
    setPillOriginOffset({
      x: Math.round(triggerCenterX - pillCenterX),
      y: Math.round(triggerCenterY - pillCenterY),
    });
  }, []);

  useEffect(() => {
    measureMagnifyingGlassOrigin();
    window.addEventListener('resize', measureMagnifyingGlassOrigin, { passive: true });
    return () => window.removeEventListener('resize', measureMagnifyingGlassOrigin);
  }, [measureMagnifyingGlassOrigin]);

  // Warm fallback article catalog if local compressed cache is cold when search opens
  useEffect(() => {
    if (!isSearchOpen) return;
    const cached = getCompressedStories();
    if (cached && cached.length > 0) {
      fallbackCatalogRef.current = cached;
      return;
    }
    if (fallbackCatalogRef.current.length > 0) return;

    const controller = new AbortController();
    fetch('/feed.json', { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const text = await res.text();
        if (!text.trim().startsWith('[') && !text.trim().startsWith('{')) return;
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.articles) ? parsed.articles : [];
        if (list.length > 0) {
          fallbackCatalogRef.current = list;
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [isSearchOpen]);

  // Synchronize searchQuery with URL searchParam changes
  useEffect(() => {
    const fromUrl = searchParams.get('search') || '';
    setSearchQuery(fromUrl);
    if (fromUrl) {
      setIsSearchOpen(true);
    }
  }, [searchParams]);

  // Click outside listener for suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Google-style suggested & similar search results while typing
  const generateSuggestions = useCallback((rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedSuggestionIndex(-1);
      return;
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: { item: SearchSuggestion; score: number }[] = [];
    const seen = new Set<string>();

    const pushCandidate = (text: string, kind: SearchSuggestion['kind'], boost = 0) => {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;

      let score = 0;
      if (key === q) score = 120;
      else if (key.startsWith(q)) score = 100;
      else if (key.split(/[\s,#-]+/).some(w => w.startsWith(q))) score = 85;
      else if (key.includes(q)) score = 70;
      else if (tokens.length > 1 && tokens.every(t => key.includes(t))) score = 60;
      else if (tokens.some(t => t.length >= 3 && key.includes(t))) score = 40;

      if (score > 0) {
        seen.add(key);
        scored.push({ item: { text: clean, kind }, score: score + boost });
      }
    };

    // 1. Newsroom sections
    for (const sec of SEARCH_SUGGESTION_SECTIONS) {
      pushCandidate(sec, 'section', 10);
      pushCandidate(`${sec} News`, 'topic', 4);
    }

    // 2. Curated & regional search topics
    for (const top of SEARCH_SUGGESTION_TOPICS) {
      pushCandidate(top, 'topic', 6);
    }

    // 3. Live published article headlines & hashtags
    const articles = getCompressedStories() || fallbackCatalogRef.current || [];
    for (const post of articles) {
      if (!post || post.status === 'draft') continue;
      if (Array.isArray(post.hashtags)) {
        for (const tag of post.hashtags) {
          const cleanTag = String(tag || '').replace(/^#+/, '').trim();
          if (cleanTag) pushCandidate(cleanTag, 'topic', 5);
        }
      }
      if (post.title) {
        pushCandidate(post.title, 'article', 2);
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 7).map(s => s.item);

    // Ensure typed query appears as direct search option if no close matches exist
    if (results.length === 0) {
      results.push({ text: rawQuery.trim(), kind: 'topic' });
    }

    setSuggestions(results);
    setHighlightedSuggestionIndex(-1);
    setShowSuggestions(true);
  }, []);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    generateSuggestions(val);
  };

  const executeSearch = (rawText: string) => {
    const text = rawText.trim();
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedSuggestionIndex(-1);

    if (text) {
      setSearchQuery(text);
      if (location.pathname !== '/' && location.pathname !== '') {
        navigate(`/?search=${encodeURIComponent(text)}`);
      } else {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('search', text);
        nextParams.delete('category');
        nextParams.delete('page');
        setSearchParams(nextParams);
      }
      window.dispatchEvent(new CustomEvent('search-query-changed', { detail: { query: text } }));
    } else {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('search');
      setSearchParams(nextParams);
      window.dispatchEvent(new CustomEvent('search-query-changed', { detail: { query: '' } }));
    }
  };

  const handleSelectSuggestion = (text: string) => {
    executeSearch(text);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setShowSuggestions(true);
        setHighlightedSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedSuggestionIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedSuggestionIndex >= 0 && suggestions[highlightedSuggestionIndex]) {
        executeSearch(suggestions[highlightedSuggestionIndex].text);
      } else {
        executeSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (showSuggestions) {
        setShowSuggestions(false);
      } else {
        handleCloseSearch();
      }
    }
  };

  const handleCloseSearch = () => {
    measureMagnifyingGlassOrigin();
    setIsSearchOpen(false);
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedSuggestionIndex(-1);
    setTimeout(() => {
      searchTriggerRef.current?.focus({ preventScroll: true });
    }, 180);
  };

  const handleToggleSearch = () => {
    measureMagnifyingGlassOrigin();
    if (isSearchOpen) {
      if (!searchQuery.trim() && !searchParams.has('search')) {
        handleCloseSearch();
      } else {
        searchInputRef.current?.focus();
      }
    } else {
      setIsSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
        if (searchQuery.trim().length > 0) {
          generateSuggestions(searchQuery);
        }
      }, 50);
    }
  };

  // Multi-purpose right-side cross button [x] (no background):
  // 1. Clears half-written text when typing
  // 2. Clears search result when user already searched anything
  // 3. Closes search bar and animates back to magnifying glass spot when empty
  const handleMultiPurposeCrossClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentActiveSearch = (searchParams.get('search') || '').trim();
    const currentTyped = searchQuery.trim();

    // 1. Clear half-written text (unsubmitted text or edited text)
    if (currentTyped.length > 0 && currentTyped !== currentActiveSearch) {
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedSuggestionIndex(-1);
      searchInputRef.current?.focus();
      return;
    }

    // 2. Clear active search result when user already searched anything
    if (currentActiveSearch.length > 0) {
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedSuggestionIndex(-1);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('search');
      nextParams.delete('page');
      setSearchParams(nextParams);
      window.dispatchEvent(new CustomEvent('search-query-changed', { detail: { query: '' } }));
      searchInputRef.current?.focus();
      return;
    }

    // 3. Empty search bar with pointer on and no text -> close search bar to magnifying glass spot
    handleCloseSearch();
  };

  // Auto-close side menu on route change
  useEffect(() => {
    setIsSideMenuOpen(false);
  }, [location.pathname, location.search]);

  // --- Settings Modal State & Toggles ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Browser & native Android notifications preference state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (Capacitor.isNativePlatform()) {
      return localStorage.getItem('browser_notifications_enabled') === 'true';
    }
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
  const [newsletterErrorToast, setNewsletterErrorToast] = useState<string | null>(null);
  const newsletterToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNewsletterErrorToast = useCallback((message = 'Could not update newsletter. Please try again.') => {
    setNewsletterErrorToast(message);
    if (newsletterToastTimerRef.current) {
      clearTimeout(newsletterToastTimerRef.current);
    }
    newsletterToastTimerRef.current = setTimeout(() => {
      setNewsletterErrorToast(null);
      newsletterToastTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (newsletterToastTimerRef.current) {
        clearTimeout(newsletterToastTimerRef.current);
      }
    };
  }, []);

  // Personalized Ads consent states
  const [adsConsent, setAdsConsent] = useState<'granted' | 'denied' | 'pending'>('pending');

  // Handle global Escape key when search bar is open and input is not focused
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else {
          setIsSearchOpen(false);
          setSuggestions([]);
          setHighlightedSuggestionIndex(-1);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalEscape);
    return () => window.removeEventListener('keydown', handleGlobalEscape);
  }, [isSearchOpen, showSuggestions]);

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
      if (Capacitor.isNativePlatform()) {
        void isUserPushSubscribed().then((subbed) => setNotificationsEnabled(subbed));
      } else {
        const isGranted = 'Notification' in window && Notification.permission === 'granted';
        setNotificationsEnabled(
          isGranted && localStorage.getItem('browser_notifications_enabled') !== 'false'
        );
      }
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

  // Toggle Browser notifications and native Android push settings
  const toggleNotifications = async () => {
    if (!isPushSupported()) {
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

    if (!user.email) {
      showNewsletterErrorToast('Could not update newsletter. Please try again.');
      return;
    }

    const normalizedEmail = user.email.toLowerCase();
    setIsSubscribing(true);
    try {
      if (target === 'unsubscribe') {
        const result = await api.unsubscribeEmail();
        if (result !== true) {
          showNewsletterErrorToast('Could not update newsletter. Please try again.');
          return;
        }
        setIsSubscribed(false);
        setSubDocId(null);
        localStorage.removeItem('cn_sub_' + normalizedEmail);
        localStorage.removeItem('newsletter_subscribed');
        window.dispatchEvent(new Event('settings-updated'));
      } else {
        const result = await api.subscribeEmail(normalizedEmail);
        if (result !== true) {
          showNewsletterErrorToast('Could not update newsletter. Please try again.');
          return;
        }
        setIsSubscribed(true);
        setSubDocId('subscribed');
        localStorage.setItem('cn_sub_' + normalizedEmail, 'true');
        localStorage.setItem('newsletter_subscribed', 'true');
        window.dispatchEvent(new Event('settings-updated'));
      }
    } catch (err) {
      console.error('Newsletter settings sync failed:', err);
      showNewsletterErrorToast('Could not update newsletter. Please try again.');
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
    let rafId: number | null = null;
    const syncScrollState = () => {
      rafId = null;
      const scrollPos = window.scrollY || document.documentElement.scrollTop || 0;
      const next = scrollPos > 45;
      setIsScrolledPastLine2((prev) => (prev === next ? prev : next));
    };
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(syncScrollState);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    syncScrollState();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const isLine2Hidden = (!isHome || isScrolledPastLine2) && !isSearchOpen;

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 w-full z-50 bg-[#fbf1e5] ${isSearchOpen || isLine2Hidden ? 'rounded-b-2xl sm:rounded-b-3xl border-b border-slate-300/70 shadow-xs' : 'border-b-0 shadow-none rounded-none'} transition-[border-radius,border-color,box-shadow] duration-200 adsbygoogle-noablate`} id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand Name & Newsroom Navigation */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 min-w-0">
          {/* 3 horizontal line menu trigger: hidden when 2nd line navbar is visible or search is active; visible when 2nd line navbar is hidden or scrolled */}
          {isLine2Hidden && !isSearchOpen && (
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
          
          {/* Google-style Search Bar Trigger in Navbar */}
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={handleToggleSearch}
            className={`h-11 w-11 rounded-full text-slate-700 hover:text-slate-950 dark:text-slate-700 dark:hover:text-slate-950 hover:bg-black/5 dark:hover:bg-black/5 transition-colors cursor-pointer flex items-center justify-center ${
              isSearchOpen ? 'bg-black/10 text-slate-950 ring-2 ring-amber-500/30' : ''
            }`}
            id="header-search-trigger"
            title={isSearchOpen ? "Close search bar" : "Open search bar"}
            aria-expanded={isSearchOpen}
            aria-controls="navbar-search-line-2"
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

        {/* Line 2: Google-style Pill Search Bar in Navbar (replaces Category Bar when open) */}
        <AnimatePresence initial={false}>
          {isSearchOpen && (
            <motion.div
              key="navbar-search-line-2"
              id="navbar-search-line-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="w-full bg-[#fbf1e5] relative overflow-visible will-change-transform"
            >
              <div className="pt-1 pb-3.5 px-3.5 sm:px-6">
                <motion.div
                  ref={searchContainerRef}
                  id="header-search-container"
                  initial={{
                    opacity: 0,
                    scaleX: 0.16,
                    scaleY: 0.78,
                    x: pillOriginOffset.x,
                    y: pillOriginOffset.y,
                  }}
                  animate={{
                    opacity: 1,
                    scaleX: 1,
                    scaleY: 1,
                    x: 0,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    scaleX: 0.14,
                    scaleY: 0.72,
                    x: pillOriginOffset.x,
                    y: pillOriginOffset.y,
                  }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full sm:max-w-[420px] md:max-w-[460px] lg:max-w-[480px] mx-auto relative will-change-transform"
                >
                  {/* Google-style Pill Search Bar with pure white interior */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      executeSearch(searchQuery);
                    }}
                    className="relative flex items-center w-full h-11 bg-white rounded-full border border-slate-300/85 shadow-[0_1px_6px_rgba(32,33,36,0.10)] hover:shadow-[0_2px_8px_rgba(32,33,36,0.15)] focus-within:shadow-[0_2px_10px_rgba(32,33,36,0.18)] focus-within:border-slate-400 transition-shadow duration-200 pl-4 pr-2.5"
                    id="navbar-search-pill-form"
                  >
                    <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2.5 pointer-events-none" />

                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchInputChange}
                      onKeyDown={handleSearchKeyDown}
                      onFocus={() => {
                        if (searchQuery.trim().length > 0) {
                          generateSuggestions(searchQuery);
                        }
                      }}
                      placeholder="Search news, topics, or regions..."
                      className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 text-[13.5px] sm:text-sm font-normal focus:outline-hidden min-w-0"
                      id="navbar-search-input"
                      autoComplete="off"
                      spellCheck={false}
                    />

                    {/* Multi-Purpose Right Cross Button [x] with strictly NO background */}
                    <button
                      type="button"
                      onClick={handleMultiPurposeCrossClick}
                      className="h-9 w-9 bg-transparent hover:bg-transparent active:bg-transparent border-0 shadow-none text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0 ml-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400/50 rounded-full active:scale-90 flex items-center justify-center"
                      title={
                        searchQuery.trim().length > 0 && searchQuery.trim() !== (searchParams.get('search') || '').trim()
                          ? "Clear typed text"
                          : searchParams.has('search')
                          ? "Clear search results"
                          : "Close search bar"
                      }
                      id="navbar-search-clear-cross-button"
                      aria-label={
                        searchQuery.trim().length > 0 && searchQuery.trim() !== (searchParams.get('search') || '').trim()
                          ? "Clear typed text"
                          : searchParams.has('search')
                          ? "Clear search results"
                          : "Close search bar"
                      }
                    >
                      <X className="h-4.5 w-4.5 stroke-[2]" />
                    </button>
                  </form>

                  {/* Google-style Suggested / Similar Search Results Dropdown */}
                  <AnimatePresence>
                    {showSuggestions && suggestions.length > 0 && (
                      <motion.div
                        id="header-search-suggestions-dropdown"
                        role="listbox"
                        aria-label="Search suggestions"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                        className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-[0_10px_28px_rgba(32,33,36,0.16)] border border-slate-200/90 overflow-hidden z-[70] py-1.5 font-sans will-change-transform"
                      >
                        {suggestions.map((item, idx) => (
                          <button
                            key={`${item.kind}-${item.text}-${idx}`}
                            type="button"
                            role="option"
                            aria-selected={highlightedSuggestionIndex === idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectSuggestion(item.text);
                            }}
                            onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                            className={`w-full min-h-[42px] px-4 py-2 text-left text-[13px] sm:text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              highlightedSuggestionIndex === idx ? 'bg-slate-100 text-slate-950' : 'bg-white hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Search className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {renderSuggestionHighlight(item.text, searchQuery)}
                              </span>
                            </div>
                            <ArrowUpLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      {/* Fixed navbar height spacer keeping page content aligned directly under the header */}
      <div 
        className={`w-full shrink-0 pointer-events-none transition-[height] duration-200 ${isHome && isSearchOpen ? 'h-[134px]' : 'h-18'}`} 
        aria-hidden="true" 
        id="header-fixed-spacer" 
      />

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

            {/* Left-Side Drawer: Vertically aligned with main navbar h-18 and smoothly scrollable categories list */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative z-10 w-[78vw] max-w-[290px] sm:w-80 h-full bg-[#fbf1e5] border-r border-[#e8dbcc] shadow-2xl flex flex-col justify-between overflow-hidden will-change-transform"
              id="article-side-menu-panel"
            >
              {/* Drawer Header: Exactly equal to main navbar vertical height (h-18 / 72px) */}
              <div className="h-18 px-4 border-b border-[#e8dbcc]/80 flex items-center justify-between shrink-0 bg-[#fbf1e5] sticky top-0 z-10 box-border">
                <div className="flex flex-col justify-center min-w-0">
                  <span className="font-playfair font-black text-base sm:text-lg text-slate-950 uppercase leading-none tracking-tight truncate">
                    Current News
                  </span>
                  <span className="font-lora text-[9px] sm:text-[10px] text-slate-600 uppercase tracking-wider font-semibold mt-1 truncate">
                    Newsroom Sections
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSideMenuOpen(false)}
                  className="h-9 w-9 rounded-full text-slate-600 hover:text-slate-900 hover:bg-black/5 transition-colors cursor-pointer flex items-center justify-center active:scale-90 shrink-0"
                  title="Close categories menu"
                  id="side-menu-close-button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* All Categories Navigation List: Increased vertical button height with smooth scroll function */}
              <div className="px-3 py-3 flex-1 overflow-y-auto space-y-1.5 scroll-smooth overscroll-contain no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" id="side-menu-categories-list">
                <div className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase px-2.5 py-1 shrink-0">
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
                      className={`w-full min-h-[46px] py-3 px-3.5 text-xs sm:text-[13px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer rounded-xl flex items-center justify-between text-left group active:scale-[0.99] shrink-0 ${
                        isCurrent
                          ? 'bg-amber-100/95 text-black border border-amber-400/60 shadow-xs font-extrabold'
                          : 'bg-white/60 text-slate-900 hover:bg-white border border-black/5'
                      }`}
                      id={`side-menu-cat-tab-${cat.toLowerCase()}`}
                    >
                      <span className="font-bold text-slate-900 group-hover:text-black">
                        {cat}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Bottom Return to Home Top Feed Action: Equal vertical height (h-18) to top header box & category-button sizing */}
              <div className="h-18 px-3 border-t border-[#e8dbcc]/80 bg-[#fbf1e5] flex items-center shrink-0 box-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsSideMenuOpen(false);
                    sessionStorage.removeItem('current_news_return_scroll');
                    sessionStorage.removeItem('current_news_return_search');
                    navigate('/');
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  className="w-full min-h-[46px] py-3 px-3.5 rounded-xl bg-slate-900 text-white hover:bg-black text-xs sm:text-[13px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
                  id="side-menu-return-home-button"
                >
                  <Newspaper className="h-4 w-4 shrink-0" />
                  <span>Return to Home Feed</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Newsletter error toast */}
      {newsletterErrorToast && (
        <div
          role="alert"
          id="newsletter-error-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] max-w-[90vw] px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <span>{newsletterErrorToast}</span>
          <button
            type="button"
            onClick={() => setNewsletterErrorToast(null)}
            className="text-white/80 hover:text-white cursor-pointer shrink-0"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
