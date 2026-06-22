import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getDocFromServer, doc } from 'firebase/firestore';
import { db } from './firebase';
import Header from './components/Header';
import Footer from './components/Footer';
import ThemeToggle from './components/ThemeToggle';
import ScrollHelper from './components/ScrollHelper';
import NewsletterPopup from './components/NewsletterPopup';
import HomeView from './views/HomeView';
import PostDetailView from './views/PostDetailView';
import AdminView from './views/AdminView';

import { useLocation } from 'react-router-dom';

function ConditionalFooter() {
  const location = useLocation();
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
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900" id="app-root-container">
        
        {/* Persistent Premium Responsive Header */}
        <Header />

        {/* Dynamic Route View Stage */}
        <main className="flex-grow">
          <Routes>
            {/* 1. Public Reader Grid Feed */}
            <Route path="/" element={<HomeView />} />

            {/* 2. Dynamic Article View Page */}
            <Route path="/post/:id" element={<PostDetailView />} />

            {/* 3. Secure Admin Panel */}
            <Route path="/admin" element={<AdminView />} />
            
            {/* Fallback route back to home */}
            <Route path="*" element={<HomeView />} />
          </Routes>
        </main>

        {/* Persistent Dynamic Footer (Hidden in Admin Panel) */}
        <ConditionalFooter />

        {/* Floating Light/Dark Mode Switcher */}
        <ThemeToggle />

        {/* Dynamic Samsung-style Scroll Controller */}
        <ScrollHelper />

        {/* Floating pop-up modal newsletter invite for first-time visitors */}
        <NewsletterPopup />

      </div>
    </BrowserRouter>
  );
}
