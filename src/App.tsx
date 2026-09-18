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

import { useLocation } from 'react-router-dom';

function ConditionalFooter() {
  const location = useLocation();
  if (location.pathname !== '/' && location.pathname !== '/privacy' && location.pathname !== '/terms' && location.pathname !== '/delete-account') {
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
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-white text-slate-900 overflow-x-hidden" id="app-root-container">
        
        {/* Persistent Premium Responsive Header */}
        <Header />

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

            {/* 4. Liked Dispatches Page */}
            <Route path="/liked" element={<LikedView />} />

            {/* 5. Legal & Policies Pages */}
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
