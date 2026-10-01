import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

declare global {
  interface Window {
    __handleAndroidBackButton?: () => boolean;
  }
}

/**
 * AndroidBackGestureHandler
 * Native Android phone back gesture & mobile edge-swipe navigation handler:
 * 1. Closes active photo lightboxes or modal dialogs first.
 * 2. When reading an article (/post/:id or /post/:id/:slug):
 *    Directly navigates back to the Home feed at the EXACT SAME page index and category.
 * 3. When on secondary screens (Settings, Liked, Policies, Sign-in, Profile sub-pages):
 *    Navigates back cleanly to /profile without infinite loops or duplicate history.
 * 4. On Profile screen (/profile):
 *    Directly returns to Home feed on the VERY FIRST back press or gesture.
 * 5. On Home feed ('/'):
 *    First press shows a gentle toast "Press back again to exit Current News".
 *    Second press within 2.5 seconds cleanly exits the application.
 * 6. Mobile Edge-Swipe Gesture:
 *    Full touch edge-swipe gesture support (left & right edge) with native Android-style indicator.
 */
export default function AndroidBackGestureHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastBackPressTime = useRef<number>(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Edge-swipe touch gesture states
  const [gestureActive, setGestureActive] = useState(false);
  const [gestureSide, setGestureSide] = useState<'left' | 'right'>('left');
  const [gestureProgress, setGestureProgress] = useState(0);
  const [gestureY, setGestureY] = useState(0);
  const gestureProgressRef = useRef(0);

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
        navigate('/' + (returnSearch.startsWith('?') ? returnSearch : '?' + returnSearch), { replace: true });
      } else if (returnPage && returnPage !== '1') {
        navigate(`/?page=${returnPage}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      return true;
    }

    // 4. Secondary profile sub-screens -> return to Profile cleanly
    const subPages = [
      '/settings', 
      '/liked', 
      '/privacy', 
      '/terms', 
      '/delete-account', 
      '/admin', 
      '/signin', 
      '/login',
      '/about',
      '/contact',
      '/editorial-policy'
    ];
    if (subPages.some(p => currentPath === p || currentPath.startsWith(p + '/'))) {
      navigate('/profile', { replace: true });
      return true;
    }

    // 5. Profile screen -> return directly to Home feed on the first press/gesture!
    if (currentPath === '/profile') {
      const returnSearch = sessionStorage.getItem('current_news_return_search');
      const returnPage = sessionStorage.getItem('current_news_return_page');
      if (returnSearch && returnSearch.trim().length > 0) {
        navigate('/' + (returnSearch.startsWith('?') ? returnSearch : '?' + returnSearch), { replace: true });
      } else if (returnPage && returnPage !== '1') {
        navigate(`/?page=${returnPage}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
      return true;
    }

    // 6. User is on other non-root screens -> redirect to home
    if (currentPath !== '/') {
      navigate('/', { replace: true });
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

  // Mobile edge-swipe touch gesture handler (Android & iOS native back gesture simulation)
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let side: 'left' | 'right' | null = null;
    let isSwiping = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const width = window.innerWidth;
      
      // Only capture touches originating within 32px of the left or right screen edge
      if (touch.clientX <= 32) {
        side = 'left';
        startX = touch.clientX;
        startY = touch.clientY;
        isSwiping = false;
      } else if (touch.clientX >= width - 32) {
        side = 'right';
        startX = touch.clientX;
        startY = touch.clientY;
        isSwiping = false;
      } else {
        side = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!side || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!isSwiping) {
        // If vertical movement dominates, cancel edge swipe so normal scroll works
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          side = null;
          setGestureActive(false);
          return;
        }
        // Inward swipe detection
        if ((side === 'left' && deltaX > 10) || (side === 'right' && deltaX < -10)) {
          isSwiping = true;
        }
      }

      if (isSwiping) {
        const distance = side === 'left' ? deltaX : -deltaX;
        const progress = Math.min(Math.max(distance / 65, 0), 1);
        gestureProgressRef.current = progress;
        setGestureSide(side);
        setGestureProgress(progress);
        setGestureY(touch.clientY);
        setGestureActive(true);
      }
    };

    const handleTouchEnd = () => {
      if (isSwiping && side) {
        // If gesture reached threshold, trigger back action with haptic feedback
        if (gestureProgressRef.current >= 0.8) {
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(15);
            }
          } catch (_) {}
          handleBackAction();
        }
      }
      side = null;
      isSwiping = false;
      setGestureActive(false);
      setGestureProgress(0);
      gestureProgressRef.current = 0;
    };

    const handleTouchCancel = () => {
      side = null;
      isSwiping = false;
      setGestureActive(false);
      setGestureProgress(0);
      gestureProgressRef.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [handleBackAction]);

  return (
    <>
      {/* Native Mobile Edge Back Gesture Indicator */}
      <AnimatePresence>
        {gestureActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: gestureProgress > 0.15 ? Math.min(gestureProgress * 1.2, 1) : 0,
              scale: 0.8 + gestureProgress * 0.35,
              x: gestureSide === 'left' ? Math.min(gestureProgress * 24, 24) : -Math.min(gestureProgress * 24, 24)
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.08 }}
            style={{
              top: Math.max(Math.min(gestureY, window.innerHeight - 80), 80)
            }}
            className={`fixed z-[99999] pointer-events-none ${
              gestureSide === 'left' ? 'left-1' : 'right-1'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-md border transition-colors ${
              gestureProgress >= 0.8
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-700 dark:border-white shadow-emerald-500/20'
                : 'bg-slate-800/80 text-white/90 dark:bg-slate-900/90 dark:text-slate-200 border-slate-700/60'
            }`}>
              <ChevronLeft className={`w-5 h-5 stroke-[2.5] transition-transform ${
                gestureSide === 'right' ? 'rotate-180' : ''
              } ${gestureProgress >= 0.8 ? '-translate-x-0.5' : ''}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double back press exit toast */}
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
    </>
  );
}
