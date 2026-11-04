import { useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ConsentBanner from './components/ConsentBanner';
import AndroidBackGestureHandler from './components/AndroidBackGestureHandler';
import { syncPushSubscriptionOnAppBoot } from './utils/pushManager';
import HomeView from './views/HomeView';
import PostDetailView from './views/PostDetailView';
import AdminView from './views/AdminView';
import DraftPublicationView from './views/DraftPublicationView';
import CurrentPublicationsView from './views/CurrentPublicationsView';
import AudienceRegistryView from './views/AudienceRegistryView';
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

import { useLocation } from 'react-router-dom';

const PROFILE_PAGES = [
  '/profile',
  '/signin',
  '/login',
  '/liked',
  '/admin',
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

export default function App() {
  useEffect(() => {
    // Register PWA service worker for notifications and offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        syncPushSubscriptionOnAppBoot();
      }).catch((err) => {
        console.debug('Service Worker registration skipped:', err);
      });
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

            {/* 3. Secure Admin Panel & Dedicated Editorial Views */}
            <Route path="/admin" element={<AdminView />} />
            <Route path="/admin/draft" element={<DraftPublicationView />} />
            <Route path="/admin/publications" element={<CurrentPublicationsView />} />
            <Route path="/admin/audience" element={<AudienceRegistryView />} />

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
