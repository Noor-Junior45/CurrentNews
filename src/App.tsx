import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getDocFromServer, doc } from 'firebase/firestore';
import { db } from './firebase';
import Header from './components/Header';
import Footer from './components/Footer';
import NewsletterPopup from './components/NewsletterPopup';
import ConsentBanner from './components/ConsentBanner';
import HomeView from './views/HomeView';
import PostDetailView from './views/PostDetailView';
import AdminView from './views/AdminView';
import LikedView from './views/LikedView';
import PrivacyView from './views/PrivacyView';
import TermsView from './views/TermsView';
import DeleteAccountView from './views/DeleteAccountView';
import SettingsView from './views/SettingsView';
import ProfileView from './views/ProfileView';

import { useLocation } from 'react-router-dom';

function ConditionalHeader() {
  const location = useLocation();
  const isProfilePage = [
    '/profile',
    '/liked',
    '/admin',
    '/settings',
    '/privacy',
    '/terms',
    '/delete-account'
  ].some(path => location.pathname === path || location.pathname.startsWith(path + '/'));

  if (isProfilePage) {
    return null;
  }
  return <Header />;
}

function ConditionalFooter() {
  const location = useLocation();
  // Hide footer on /privacy, /terms, /delete-account and profile/admin pages
  if (location.pathname !== '/') {
    return null;
  }
  return <Footer />;
}

export default function App() {
  
  // CRITICAL CONSTRAINT: When the application initially boots, validate connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log('Firestore connection verified successfully on application startup.');
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        } else {
          // Standard other errors are logged but shouldn't halt execution or crash client experience
          console.log('Firestore initialization complete.');
        }
      }
    }
    testConnection();

    // Register PWA service worker for notifications and offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.debug('Service Worker registration skipped:', err);
      });
    }
  }, []);

  return (
    <BrowserRouter>
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

            {/* 3. Secure Admin Panel */}
            <Route path="/admin" element={<AdminView />} />

            {/* 4. Profile Hub Page */}
            <Route path="/profile" element={<ProfileView />} />

            {/* 5. Liked Dispatches Page */}
            <Route path="/liked" element={<LikedView />} />

            {/* 6. Settings Page */}
            <Route path="/settings" element={<SettingsView />} />

            {/* 7. Legal & Policies Pages */}
            <Route path="/privacy" element={<PrivacyView />} />
            <Route path="/terms" element={<TermsView />} />
            <Route path="/delete-account" element={<DeleteAccountView />} />
            
            {/* Fallback route back to home */}
            <Route path="*" element={<HomeView />} />
          </Routes>
        </main>

        {/* Persistent Dynamic Footer (Hidden in Admin Panel) */}
        <ConditionalFooter />

        {/* Floating pop-up modal newsletter invite for first-time visitors */}
        <NewsletterPopup />

        {/* Dynamic bottom GDPR/Google policy compliant consent banner */}
        <ConsentBanner />

      </div>
    </BrowserRouter>
  );
}
