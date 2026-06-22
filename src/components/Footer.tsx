import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Mail, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [adsConsent, setAdsConsent] = useState<'granted' | 'denied' | 'pending'>('pending');

  React.useEffect(() => {
    const checkConsent = () => {
      const val = localStorage.getItem('google_ads_personalized_consent');
      setAdsConsent((val as 'granted' | 'denied') || 'pending');
    };
    checkConsent();
    window.addEventListener('storage', checkConsent);
    // Periodically sync in case of same-page state modifications
    const interval = setInterval(checkConsent, 1000);
    return () => {
      window.removeEventListener('storage', checkConsent);
      clearInterval(interval);
    };
  }, []);

  const toggleAdsConsent = () => {
    const nextValue = adsConsent === 'granted' ? 'denied' : 'granted';
    localStorage.setItem('google_ads_personalized_consent', nextValue);
    setAdsConsent(nextValue);
    
    if (window.hasOwnProperty('adsbygoogle')) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).requestNonPersonalizedAds = nextValue === 'granted' ? 0 : 1;
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const resetAdsConsent = () => {
    localStorage.removeItem('google_ads_personalized_consent');
    setAdsConsent('pending');
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setStatus('error');
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'subscribers'), {
        email: email.trim().toLowerCase(),
        createdAt: serverTimestamp()
      });
      setStatus('success');
      setEmail('');
    } catch (err) {
      console.error('Subscription registry error', err);
      setStatus('error');
      setErrorMsg('Subscription service temporarily congested.');
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 text-xs" id="main-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          
          {/* Brand & Mission Column */}
          <div className="flex flex-col space-y-2.5">
            <Link to="/" className="flex items-center space-x-2 text-white">
              <img 
                src="https://i.imgur.com/gFgShoZ.jpeg" 
                alt="Current News Live Logo" 
                className="h-6 w-6 rounded-md object-cover border border-slate-700"
                referrerPolicy="no-referrer"
              />
              <span className="font-display font-bold text-sm tracking-tight uppercase">Current News</span>
            </Link>
            <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
              Serving the public interest with transparent, accurate, and autonomous journalism. Delivering updates directly to readers.
            </p>
          </div>

          {/* New Email Subscribers Capture Form Column */}
          <div className="flex flex-col space-y-2.5" id="footer-subscriber-column">
            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              <span>Newsletter Alerts</span>
            </h4>
            <form onSubmit={handleSubscribe} className="space-y-1.5 max-w-xs">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder="name@example.com"
                  disabled={status === 'submitting'}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg py-1.5 pl-2.5 pr-8 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans block"
                  id="subscriber-email-input"
                  required
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="absolute right-1 top-1 bottom-1 px-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-md transition-colors flex items-center justify-center cursor-pointer"
                  title="Subscribe"
                  id="subscriber-submit-btn"
                >
                  {status === 'submitting' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : status === 'success' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <ArrowRight className="h-3 w-3" />
                  )}
                </button>
              </div>

              {/* Status Notifications */}
              {status === 'success' && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium font-sans animate-in fade-in duration-200">
                  <Check className="h-3 w-3 shrink-0" />
                  <span>Subscribed!</span>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-1 text-[10px] text-rose-400 font-medium font-sans animate-in fade-in duration-200">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          </div>

          {/* Dedicated Data & Ads Policy column */}
          <div className="space-y-2">
            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-white">Data & Ads Policy</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              We use advanced analytics protocols to evaluate dispatch popularity and perform audience telemetry. To fund our journalism, personalized advertising options are displayed in complete alignment with Google's Publisher Policy.
            </p>
            
            {/* Interactive preference controller */}
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 space-y-1.5 mt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Personalized Ads:</span>
                <span className={`font-mono font-bold uppercase ${adsConsent === 'granted' ? 'text-emerald-400' : adsConsent === 'denied' ? 'text-amber-400' : 'text-indigo-400'}`}>
                  {adsConsent === 'granted' ? 'Allowed' : adsConsent === 'denied' ? 'Declined' : 'Pending'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={toggleAdsConsent}
                  className="w-full text-center py-1 bg-slate-900 hover:bg-slate-850 hover:text-white rounded text-[9px] font-semibold border border-slate-800 cursor-pointer transition-all"
                  title="Toggle personalized ads consent"
                >
                  Toggle Consent
                </button>
                <button
                  type="button"
                  onClick={resetAdsConsent}
                  className="py-1 px-2 bg-slate-900 hover:bg-slate-850 hover:text-white rounded text-[9px] font-semibold border border-slate-800 cursor-pointer transition-all shrink-0"
                  title="Reset and prompt banner again"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Useful Reader Information & Nav */}
          <div className="space-y-1.5">
            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-white">Resources</h4>
            <div className="flex items-center space-x-3 text-[11px]">
              <Link to="/" className="text-slate-400 hover:text-white transition-colors">Reader Feed</Link>
              <span className="text-slate-700">|</span>
              <Link to="/admin" className="text-slate-400 hover:text-white transition-colors">Editorial Portal</Link>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal max-w-xs border-t border-slate-800 pt-1.5">
              Use the live search filter at the top of the homepage to trace dispatches instantly.
            </p>
          </div>

        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
          <p>© {currentYear} Current News. All Rights Reserved.</p>
          <span className="mt-1 sm:mt-0">Autonomous Press Alliance</span>
        </div>
      </div>
    </footer>
  );
}
