import { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import Header from './components/Header';
import Footer from './components/Footer';
import ConsentBanner from './components/ConsentBanner';
import AndroidBackGestureHandler from './components/AndroidBackGestureHandler';
import { initPushNotificationPermissionOnSiteOpen } from './utils/pushManager';
import HomeView from './views/HomeView';
import PostDetailView from './views/PostDetailView';
import LikedView from './views/LikedView';
import PrivacyView from './views/PrivacyView';
import TermsView from './views/TermsView';
import DeleteAccountView from './views/DeleteAccountView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';
import SignInView from './views/SignInView';
import AboutView from './views/AboutView';
import ContactView from './views/ContactView';
import EditorialPolicyView from './views/EditorialPolicyView';
import { useAdSenseRouteGuard } from './hooks/useAdSenseRouteGuard';
import { admobManager } from './utils/admob';

const PROFILE_PAGES = [
  '/profile',
  '/signin',
  '/login',
  '/liked',
  '/settings',
  '/privacy',
  '/terms',
  '/delete-account',
  '/about',
  '/contact',
  '/editorial-policy'
];

function isProfileSection(pathname: string) {
  return PROFILE_PAGES.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function ConditionalHeader() {
  const location = useLocation();
  if (isProfileSection(location.pathname)) {
    return null;
  }
  return <Header />;
}

function ConditionalFooter() {
  const location = useLocation();
  // Hide footer on profile page, all individual profile subpages, and article reading pages
  if (isProfileSection(location.pathname) || location.pathname.startsWith('/post/')) {
    return null;
  }
  return <Footer />;
}

function AdSenseRouteWatcher() {
  useAdSenseRouteGuard();
  return null;
}

function AdminRedirect() {
  useEffect(() => {
    window.location.href = 'https://admin.currentnews.blog/admin';
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Redirecting to Editorial Admin Portal at{' '}
        <a href="https://admin.currentnews.blog/admin" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">
          admin.currentnews.blog
        </a>...
      </p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useLayoutEffect(() => {
    // If returning to home feed with saved return scroll position, let HomeView handle restoration
    if (pathname === '/' && sessionStorage.getItem('current_news_return_scroll')) {
      return;
    }
    // If on homepage changing pagination via search params (?page=), pagination handler smoothly scrolls to grid
    if (pathname === '/' && search.includes('page=')) {
      return;
    }
    // If an anchor hash exists, allow scrolling to hash target
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView();
        return;
      }
    }
    // Otherwise, ensure every route navigation starts at the very top of the window before browser paints
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search, hash]);

  return null;
}

function normalizeNotificationRoutePath(rawUrlOrPath: unknown): string | null {
  if (typeof rawUrlOrPath !== 'string') return null;
  const trimmed = rawUrlOrPath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
  } catch {
    return null;
  }
}

function NativeNotificationNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const goToArticlePath = (candidate: unknown) => {
      const path = normalizeNotificationRoutePath(candidate);
      if (!path) return;
      navigate(path);
    };

    const consumePendingFromNativeBridge = () => {
      try {
        const win = window as unknown as {
          __CN_PENDING_NOTIFICATION_PATH__?: string;
          CurrentNewsNotificationBridge?: { consumePendingPath?: () => string | null };
        };

        if (win.__CN_PENDING_NOTIFICATION_PATH__) {
          const pendingJsPath = win.__CN_PENDING_NOTIFICATION_PATH__;
          delete win.__CN_PENDING_NOTIFICATION_PATH__;
          if (typeof win.CurrentNewsNotificationBridge?.consumePendingPath === 'function') {
            win.CurrentNewsNotificationBridge.consumePendingPath();
          }
          goToArticlePath(pendingJsPath);
          return;
        }

        if (typeof win.CurrentNewsNotificationBridge?.consumePendingPath === 'function') {
          const bridgePath = win.CurrentNewsNotificationBridge.consumePendingPath();
          if (bridgePath) {
            goToArticlePath(bridgePath);
          }
        }
      } catch (err) {
        console.debug('[NativePush] Pending route check failed:', err);
      }
    };

    // 1. Cold-start consumption when app was closed and opened by tapping notification
    consumePendingFromNativeBridge();

    // 2. Warm/foreground consumption when app is already open
    const handleNativeNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ path?: string }>).detail;
      const win = window as unknown as {
        __CN_PENDING_NOTIFICATION_PATH__?: string;
        CurrentNewsNotificationBridge?: { consumePendingPath?: () => string | null };
      };
      delete win.__CN_PENDING_NOTIFICATION_PATH__;
      win.CurrentNewsNotificationBridge?.consumePendingPath?.();
      if (detail?.path) {
        goToArticlePath(detail.path);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        consumePendingFromNativeBridge();
      }
    };

    window.addEventListener('currentnews-native-navigate', handleNativeNavigate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Fallback listener if FCM delivered a system notification action via Capacitor plugin
    const actionListenerPromise = Capacitor.isPluginAvailable('PushNotifications')
      ? PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const data = action.notification?.data as Record<string, unknown> | undefined;
            const rawUrl = data?.url ?? data?.link ?? data?.target_path ?? data?.target_url;
            if (rawUrl) {
              goToArticlePath(rawUrl);
            }
          }
        ).catch(() => null)
      : Promise.resolve(null);

    return () => {
      window.removeEventListener('currentnews-native-navigate', handleNativeNavigate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void actionListenerPromise.then((handle) => handle?.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
}

export default function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Native Android APK uses Capacitor FCM registration (no service worker)
      void initPushNotificationPermissionOnSiteOpen();
    } else {
      // Register PWA service worker for notifications and prompt/sync permissions on site open (omitted on admin host)
      const isAdminHost = typeof window !== 'undefined' && window.location.hostname.startsWith('admin.');
      if (!isAdminHost && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(() => {
          initPushNotificationPermissionOnSiteOpen();
        }).catch((err) => {
          console.debug('Service Worker registration skipped:', err);
          initPushNotificationPermissionOnSiteOpen();
        });
      }
    }

    // Initialize Google AdMob when running inside native phone app
    if (admobManager.isNative()) {
      admobManager.initialize();
    }
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AdSenseRouteWatcher />
      <NativeNotificationNavigator />
      <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden" id="app-root-container">
        
        {/* Dynamic Responsive Header (hidden on profile button pages) */}
        <ConditionalHeader />

        {/* Dynamic Route View Stage */}
        <main className="flex-grow">
          <Routes>
            {/* 1. Public Reader Grid Feed */}
            <Route path="/" element={<HomeView />} />

            {/* 2. Dynamic Article View Page */}
            <Route path="/post/:id" element={<PostDetailView />} />
            <Route path="/post/:id/:slug" element={<PostDetailView />} />

            {/* 3. Redirect /admin to Dedicated External Admin Portal */}
            <Route path="/admin" element={<AdminRedirect />} />
            <Route path="/admin/*" element={<AdminRedirect />} />

            {/* 4. Profile Hub Page */}
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/signin" element={<SignInView />} />
            <Route path="/login" element={<SignInView />} />

            {/* 5. Liked Dispatches Page */}
            <Route path="/liked" element={<LikedView />} />

            {/* 6. Settings Page */}
            <Route path="/settings" element={<SettingsView />} />

            {/* 7. Essential Editorial & E-E-A-T Pages for AdSense Compliance */}
            <Route path="/about" element={<AboutView />} />
            <Route path="/contact" element={<ContactView />} />
            <Route path="/editorial-policy" element={<EditorialPolicyView />} />

            {/* 8. Legal & Policies Pages */}
            <Route path="/privacy" element={<PrivacyView />} />
            <Route path="/terms" element={<TermsView />} />
            <Route path="/delete-account" element={<DeleteAccountView />} />
            
            {/* Fallback route back to home */}
            <Route path="*" element={<HomeView />} />
          </Routes>
        </main>

        {/* Persistent Dynamic Footer (Hidden in Admin Panel) */}
        <ConditionalFooter />

        {/* Dynamic bottom GDPR/Google policy compliant consent banner */}
        <ConsentBanner />

        {/* Native Android Phone Edge-Swipe Back Gesture & Navigation Handler */}
        <AndroidBackGestureHandler />

      </div>
    </BrowserRouter>
  );
}
