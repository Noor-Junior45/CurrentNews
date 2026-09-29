import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    __handleAndroidBackButton?: () => boolean;
  }
}

/**
 * AndroidBackGestureHandler
 * Intercepts phone back gesture and hardware/software back button in the Android App:
 * 1. Closes active photo lightboxes or modal dialogs first.
 * 2. When reading an article (/post/:id or /post/:id/:slug):
 *    Directly navigates back to the Home feed at the EXACT SAME page index and category
 *    where the user left off, without closing the app!
 * 3. When on secondary screens (Settings, Liked, Policies, Profile):
 *    Navigates back cleanly to earlier screens without infinite loops.
 * 4. On Home feed ('/'):
 *    First press shows a gentle toast "Press back again to exit Current News".
 *    Second press within 2.5 seconds cleanly exits the application.
 */
export default function AndroidBackGestureHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPressTime = useRef<number>(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Core handler that returns true if event was consumed in-app, or false if app should exit
  const handleBackAction = useCallback((): boolean => {
    // 1. Check if an image lightbox is currently open
    const lightboxOverlay = document.getElementById('image-lightbox-overlay');
    if (lightboxOverlay) {
      const closeBtn = lightboxOverlay.querySelector<HTMLElement>('button');
      if (closeBtn) {
        closeBtn.click();
        return true;
      }
    }

    // 2. Check if newsletter modal, consent banner dialog, or active overlay is present
    const activePopup = document.querySelector<HTMLElement>('#newsletter-slideout-popup, [role="dialog"], #newsletter-popup-modal');
    if (activePopup) {
      const dismissBtn = activePopup.querySelector<HTMLElement>('button[aria-label*="Close"], button[aria-label*="Dismiss"], #newsletter-popup-dismiss');
      if (dismissBtn) {
        dismissBtn.click();
        return true;
      }
    }

    const currentPath = location.pathname;

    // 3. User is reading an article (/post/:id or /post/:id/:slug)
    // ALWAYS return to Home at the same page index and scroll position! NEVER close app!
    if (currentPath.startsWith('/post/')) {
      const returnSearch = sessionStorage.getItem('current_news_return_search');
      const returnPage = sessionStorage.getItem('current_news_return_page');
      
      if (returnSearch && returnSearch.trim().length > 0) {
        navigate('/' + (returnSearch.startsWith('?') ? returnSearch : '?' + returnSearch));
      } else if (returnPage && returnPage !== '1') {
        navigate(`/?page=${returnPage}`);
      } else {
        navigate('/');
      }
      return true;
    }

    // 4. Secondary profile sub-screens -> return to Profile
    const subPages = ['/settings', '/liked', '/privacy', '/terms', '/delete-account', '/admin'];
    if (subPages.some(p => currentPath === p || currentPath.startsWith(p + '/'))) {
      navigate('/profile');
      return true;
    }

    // 5. Profile screen -> return to Home feed preserving search/page
    if (currentPath === '/profile') {
      const returnSearch = sessionStorage.getItem('current_news_return_search');
      if (returnSearch && returnSearch.trim().length > 0) {
        navigate('/' + (returnSearch.startsWith('?') ? returnSearch : '?' + returnSearch));
      } else {
        navigate('/');
      }
      return true;
    }

    // 6. User is on Home feed or other root screen
    // If user is on an unknown path, redirect to home
    if (currentPath !== '/') {
      navigate('/');
      return true;
    }

    // 7. On Home feed ('/') - Double back press to exit
    const now = Date.now();
    if (now - lastBackPressTime.current < 2500) {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      setShowExitToast(false);
      try {
        App.exitApp();
      } catch (err) {
        console.debug('Exit app triggered', err);
      }
      return false; // Allowed to exit
    } else {
      lastBackPressTime.current = now;
      setShowExitToast(true);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        setShowExitToast(false);
      }, 2500);
      return true; // Consumed (toast shown)
    }
  }, [location.pathname, navigate]);

  // Expose to window so Native Android MainActivity can call via evaluateJavascript
  useEffect(() => {
    window.__handleAndroidBackButton = handleBackAction;
    return () => {
      delete window.__handleAndroidBackButton;
    };
  }, [handleBackAction]);

  // Register Capacitor App backButton listener
  useEffect(() => {
    let listenerHandle: any = null;

    try {
      const promise = App.addListener('backButton', () => {
        handleBackAction();
      });
      promise.then((handle) => {
        listenerHandle = handle;
      }).catch(() => {});
    } catch (e) {
      console.debug('Capacitor App listener skipped in non-native environment');
    }

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [handleBackAction]);

  return (
    <AnimatePresence>
      {showExitToast && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
        >
          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border border-slate-700/60 flex items-center gap-2">
            <span>Press back again to exit Current News</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
