import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, Mail, Check, AlertCircle, Loader2, Send, Download, Smartphone, Share2 } from 'lucide-react';

// Store the beforeinstallprompt event in a module-scoped variable so it is preserved across mounts
let deferredPrompt: any = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export default function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS devices for PWA guide
    if (typeof navigator !== 'undefined') {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(isIOSDevice);
    }

    // Check if user has already subscribed or dismissed the newsletter prompt
    const hasInteractedNewsletter = localStorage.getItem('news_popup_interacted');
    const hasInteractedInstall = localStorage.getItem('pwa_install_popup_interacted');

    if (!hasInteractedNewsletter) {
      // Show newsletter popup after 3 seconds
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (!hasInteractedInstall) {
      // If they already interacted with newsletter but not install, show install popup after 3 seconds
      const timer = setTimeout(() => {
        setIsInstallOpen(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const triggerInstallPopup = () => {
    const hasInteractedInstall = localStorage.getItem('pwa_install_popup_interacted');
    if (!hasInteractedInstall) {
      setTimeout(() => {
        setIsInstallOpen(true);
      }, 500); // Smooth fluid transition delay
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem('news_popup_interacted', 'dismissed');
    triggerInstallPopup();
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
      const subscriberEmail = email.trim().toLowerCase();
      await addDoc(collection(db, 'subscribers'), {
        email: subscriberEmail,
        createdAt: serverTimestamp()
      });
      
      // Dispatch welcome email via SMTP
      try {
        await fetch('/api/mail/send-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: subscriberEmail,
            title: "Welcome to Current News Alerts!",
            link: window.location.origin
          })
        });
      } catch (mailErr) {
        console.warn('Welcome email dispatch failed:', mailErr);
      }

      setStatus('success');
      setEmail('');
      localStorage.setItem('news_popup_interacted', 'subscribed');
      
      // Auto-close after 2.5 seconds on success and trigger install popup
      setTimeout(() => {
        setIsOpen(false);
        triggerInstallPopup();
      }, 2500);
    } catch (err) {
      console.error('Popup subscription error', err);
      setStatus('error');
      setErrorMsg('Subscription failed. Please try again.');
    }
  };

  const handleDismissInstall = () => {
    setIsInstallOpen(false);
    localStorage.setItem('pwa_install_popup_interacted', 'dismissed');
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA Install User Choice: ${outcome}`);
        localStorage.setItem('pwa_install_popup_interacted', 'installed');
        setIsInstallOpen(false);
      } catch (err) {
        console.warn('PWA prompt execution error:', err);
      }
      deferredPrompt = null;
    } else {
      // Fallback instruction triggers / download info
      localStorage.setItem('pwa_install_popup_interacted', 'guided');
      // If we are on mobile, we can let user know how to add it, or trigger default browser prompt.
      // We keep the modal open or close it with a graceful instruction.
      alert(
        isIOS 
          ? "To install: Tap the Share button in Safari and select 'Add to Home Screen' from the options."
          : "To install: Click your browser menu (the three vertical dots in the top right corner) and select 'Add to Home Screen' or 'Install App'."
      );
      setIsInstallOpen(false);
    }
  };

  // Render PWA Install prompt if active
  if (isInstallOpen) {
    return (
      <div 
        className="fixed bottom-6 right-6 z-50 max-w-sm w-[90%] sm:w-96 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 mb-safe animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
        id="pwa-install-slideout-popup"
      >
        <button 
          onClick={handleDismissInstall}
          className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-all cursor-pointer"
          aria-label="Close download prompt"
          id="pwa-popup-dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start space-x-3.5">
          <div className="bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            <Smartphone className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0 pr-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white font-display flex items-center gap-1.5">
              Download Our Web App
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed mt-1">
              Add Current News Live directly to your home screen for high-performance full-screen layout and offline ledger reading.
            </p>

            {isIOS && (
              <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-850/40 text-[10px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                <Share2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span className="leading-normal">
                  Tap Safari's <span className="font-semibold">Share icon</span> then select <span className="font-semibold">"Add to Home Screen"</span>.
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-semibold text-xs py-2 px-4 rounded-full shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                id="pwa-install-confirm-btn"
              >
                <Download className="h-3.5 w-3.5" />
                {deferredPrompt ? 'Download Now' : 'Add to Home Screen'}
              </button>
              <button
                onClick={handleDismissInstall}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-2 px-3 rounded-full hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors font-medium cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Newsletter signup if active
  if (!isOpen) return null;

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 max-w-sm w-[90%] sm:w-96 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 mb-safe animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      id="newsletter-slideout-popup"
    >
      {/* Absolute Close Header Button */}
      <button 
        onClick={handleDismiss}
        className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-all cursor-pointer"
        aria-label="Close newsletter prompt"
        id="newsletter-popup-dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start space-x-3.5">
        <div className="bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
          <Mail className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0 pr-4">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            Never Miss a Critical Dispatch
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed mt-1">
            Join our independent reader circle for real-time editorial feeds & breaking world announcements.
          </p>

          {status === 'success' ? (
            <div className="mt-3.5 flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 animate-in fade-in zoom-in-95 duration-200">
              <Check className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-semibold font-sans">You are successfully subscribed!</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="mt-3.5 space-y-2">
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder="Enter email address"
                  disabled={status === 'submitting'}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl py-2 px-3 pr-10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans"
                  id="popup-subscriber-email"
                  required
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="absolute right-1 top-1 bottom-1 px-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                  id="popup-subscriber-submit"
                  title="Subscribe Now"
                >
                  {status === 'submitting' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                </button>
              </div>

              {status === 'error' && (
                <div className="flex items-center space-x-1.5 text-red-500 text-[10px] sm:text-[11px] mt-1.5 animate-in slide-in-from-top-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium truncate">{errorMsg}</span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
