import { useState, useEffect } from 'react';
import { 
  Sun, 
  MoonStar, 
  Bell, 
  Newspaper, 
  Shield, 
  CheckCircle2, 
  Download, 
  Info 
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import GlassThemeToggle from '../components/ThemeToggle';
import ToggleSwitch from '../components/ToggleSwitch';

export default function SettingsView() {
  const { user } = useAuthState();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subDocId, setSubDocId] = useState<string | null>(null);
  const [adsConsent, setAdsConsent] = useState<'granted' | 'denied'>('granted');
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Handle PWA beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if PWA is already installed or standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone || localStorage.getItem('pwa_app_downloaded') === 'true') {
      setIsPwaInstalled(true);
    }

    // Sync notification and ads preferences
    const handleSync = async () => {
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      } else {
        setNotificationsEnabled(localStorage.getItem('browser_notifications_enabled') === 'true');
      }

      const savedAdsConsent = localStorage.getItem('google_ads_personalized_consent');
      if (savedAdsConsent === 'denied') {
        setAdsConsent('denied');
      } else {
        setAdsConsent('granted');
      }

      // Check newsletter status
      if (user?.email) {
        try {
          const q = query(
            collection(db, 'subscribers'), 
            where('email', '==', user.email.toLowerCase())
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setIsSubscribed(true);
            setSubDocId(snap.docs[0].id);
          } else {
            setIsSubscribed(false);
            setSubDocId(null);
          }
        } catch (err) {
          console.error("Failed to query newsletter status:", err);
        }
      } else {
        setIsSubscribed(localStorage.getItem('newsletter_subscribed') === 'true');
      }
    };

    handleSync();
    window.addEventListener('settings-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('settings-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle Browser notifications
  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      showToast("This browser does not support desktop notifications.");
      return;
    }

    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('browser_notifications_enabled', 'true');
        setNotificationsEnabled(true);
        window.dispatchEvent(new Event('settings-updated'));
        
        new Notification("Current News Alerts Enabled", {
          body: "You will now receive breaking dispatches directly on this device.",
          icon: "https://i.imgur.com/gq2X5nE.jpeg"
        });
        showToast("Notifications enabled successfully!");
      } else {
        showToast("Notification permissions denied in browser settings.");
      }
    } else {
      localStorage.setItem('browser_notifications_enabled', 'false');
      setNotificationsEnabled(false);
      window.dispatchEvent(new Event('settings-updated'));
      showToast("Notifications disabled.");
    }
  };

  // PWA install trigger
  const installPwaApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPwaInstalled(true);
        localStorage.setItem('pwa_app_downloaded', 'true');
        setDeferredPrompt(null);
        window.dispatchEvent(new Event('settings-updated'));
        showToast("App installed to your device!");
      }
    } else {
      showToast("Web app is already added or installable via browser menu.");
    }
  };

  // Toggle Personalized Ads
  const toggleAdsConsent = () => {
    const nextValue = adsConsent === 'granted' ? 'denied' : 'granted';
    localStorage.setItem('google_ads_personalized_consent', nextValue);
    setAdsConsent(nextValue);
    window.dispatchEvent(new Event('settings-updated'));

    if (window.hasOwnProperty('adsbygoogle')) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).requestNonPersonalizedAds = nextValue === 'granted' ? 0 : 1;
      } catch (e) {
        console.warn(e);
      }
    }
    showToast(nextValue === 'granted' ? "Personalized advertisements enabled." : "Non-personalized ads mode activated.");
  };

  // Toggle Newsletter
  const handleToggleNewsletter = async () => {
    if (!user) {
      const confirmSignIn = window.confirm(
        "To manage newsletter alerts, please sign in with your Google account. Would you like to sign in now?"
      );
      if (confirmSignIn) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(auth, provider);
        } catch (err) {
          console.error("Sign in failed", err);
        }
      }
      return;
    }

    setIsSubscribing(true);
    try {
      if (isSubscribed) {
        if (subDocId) {
          await deleteDoc(doc(db, 'subscribers', subDocId));
        } else {
          const q = query(
            collection(db, 'subscribers'), 
            where('email', '==', user.email?.toLowerCase())
          );
          const snap = await getDocs(q);
          for (const docItem of snap.docs) {
            await deleteDoc(doc(db, 'subscribers', docItem.id));
          }
        }
        setIsSubscribed(false);
        setSubDocId(null);
        localStorage.removeItem('newsletter_subscribed');
        window.dispatchEvent(new Event('settings-updated'));
        showToast("Unsubscribed from newsletter alerts.");
      } else {
        const docRef = await addDoc(collection(db, 'subscribers'), {
          email: user.email?.toLowerCase(),
          userId: user.uid,
          source: 'settings_toggle',
          createdAt: serverTimestamp()
        });
        setIsSubscribed(true);
        setSubDocId(docRef.id);
        localStorage.setItem('newsletter_subscribed', 'true');
        window.dispatchEvent(new Event('settings-updated'));
        showToast("Subscribed to breaking news alerts!");
      }
    } catch (err) {
      console.error("Newsletter error:", err);
      showToast("Unable to update newsletter settings. Check connection.");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950" id="settings-page-view">
      {/* Top Header with liquid glass Back button and short heading */}
      <ProfilePageNavbar title="Settings" />

      {/* Main Settings Body */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-3.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
            <span>{toastMessage}</span>
            <button 
              onClick={() => setToastMessage(null)}
              className="ml-3 text-slate-400 hover:text-white dark:hover:text-slate-950"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Section: Appearance */}
          <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex space-x-3.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-100 dark:border-amber-900/60 shrink-0">
                  <Sun className="h-5 w-5 dark:hidden" />
                  <MoonStar className="h-5 w-5 hidden dark:block text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Theme Appearance</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Toggle between clean daylight canvas and dark contrast reading mode.
                  </p>
                </div>
              </div>
              <GlassThemeToggle />
            </div>
          </div>

          {/* Section: Notifications */}
          <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex space-x-3.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 shrink-0">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Push Notifications</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Receive instant system alerts when fresh breaking dispatches are published.
                  </p>
                </div>
              </div>
              <ToggleSwitch 
                checked={notificationsEnabled}
                onChange={toggleNotifications}
                ariaLabel="Toggle Push Notifications"
                id="push-notifications-toggle"
              />
            </div>

            {/* PWA Home Screen Action */}
            {deferredPrompt && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={installPwaApp}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Web App to Home Screen</span>
                </button>
              </div>
            )}

            {isPwaInstalled && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>Installed on device (standalone app active)</span>
              </div>
            )}
          </div>

          {/* Section: Newsletter */}
          <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex space-x-3.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 shrink-0">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Newsletter Alerts</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Subscribe to automated breaking editorial circulars sent directly to your email address.
                  </p>
                  {user?.email && (
                    <span className="inline-block text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                      Account: {user.email}
                    </span>
                  )}
                </div>
              </div>
              <ToggleSwitch 
                checked={isSubscribed}
                onChange={handleToggleNewsletter}
                disabled={isSubscribing}
                ariaLabel="Toggle Newsletter Alerts"
                id="newsletter-toggle"
              />
            </div>
          </div>

          {/* Section: Personalized Ads */}
          <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex space-x-3.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/60 shrink-0">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Personalized Ads Consent</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Allow privacy-compliant cookie preferences to tailor advertisements to your reading interests.
                  </p>
                </div>
              </div>
              <ToggleSwitch 
                checked={adsConsent === 'granted'}
                onChange={toggleAdsConsent}
                ariaLabel="Toggle Personalized Ads"
                id="ads-consent-toggle"
              />
            </div>
          </div>

          {/* Section: App Info */}
          <div className="bg-slate-50/40 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-5 sm:p-6 text-xs text-slate-500 dark:text-slate-400 flex items-start space-x-3">
            <Info className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Current News Live • v2.4 Editorial Suite
              </p>
              <p className="leading-relaxed">
                Adhering to strict international journalistic standards, GDPR compliance, and real-time cloud dispatch synchronization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
