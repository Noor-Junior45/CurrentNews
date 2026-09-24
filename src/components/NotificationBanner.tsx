import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellRing, X, Check, Loader2 } from 'lucide-react';
import { isPushSupported, subscribeUserToPush } from '../utils/pushManager';

export default function NotificationBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribedSuccess, setSubscribedSuccess] = useState(false);

  useEffect(() => {
    // Only prompt if push is supported and permission is 'default' (not granted, not denied)
    if (!isPushSupported()) return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const dismissed = localStorage.getItem('push_prompt_dismissed');
      if (!dismissed) {
        // Show polite prompt after 5 seconds of browsing
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // Dismiss for 7 days
    localStorage.setItem('push_prompt_dismissed', Date.now().toString());
  };

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    const result = await subscribeUserToPush();
    setIsSubscribing(false);

    if (result.success) {
      setSubscribedSuccess(true);
      setTimeout(() => {
        setIsVisible(false);
      }, 2500);
    } else {
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col gap-3"
        role="region"
        aria-label="Notification Subscription Prompt"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              {subscribedSuccess ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <BellRing className="w-5 h-5 animate-pulse" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {subscribedSuccess ? 'Alerts Activated!' : 'Stay Updated with Breaking Alerts'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {subscribedSuccess
                  ? 'You will now receive automatic notifications on this device even when the app is closed.'
                  : 'Get instant dispatches on your Android phone or PC even when Current News is closed.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Dismiss"
            aria-label="Dismiss notification prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!subscribedSuccess && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
            >
              Not Now
            </button>
            <button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  Turn On Alerts
                </>
              )}
            </button>
          </div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
