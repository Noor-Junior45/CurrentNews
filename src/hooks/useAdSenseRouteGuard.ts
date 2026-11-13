import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { admobManager } from '../utils/admob';

// Non-content / utility screens where ads MUST NEVER run
const UTILITY_OR_NON_CONTENT_ROUTES = [
  '/admin',
  '/profile',
  '/settings',
  '/signin',
  '/login',
  '/liked',
  '/delete-account',
  '/privacy',
  '/terms',
  '/editorial-policy',
  '/about',
  '/contact'
];

const MIN_ARTICLE_ENGAGEMENT_MS = 6000; // Ignore rapid misclick bounces under 6 seconds

export function useAdSenseRouteGuard() {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);
  const articleEnteredAtRef = useRef<number>(0);

  useEffect(() => {
    const currentPath = location.pathname;
    const prevPath = prevPathRef.current;
    prevPathRef.current = currentPath;

    const isUtilityRoute = UTILITY_OR_NON_CONTENT_ROUTES.some(
      (path) => currentPath === path || currentPath.startsWith(path + '/')
    );

    // 1. Native Mobile App Handling (Google AdMob)
    if (admobManager.isNative()) {
      if (isUtilityRoute) {
        // Hide banner on non-content/utility/auth screens so it never covers buttons
        admobManager.hideBanner();
        return;
      }

      // Show native banner on public content feeds and articles
      admobManager.showBanner();

      // Natural Transition Interstitial Placement:
      // Only after leaving an article (/post/...) that the user read for >= 6 seconds,
      // navigating back to Home or switching to another article, with no modal/lightbox active.
      if (
        prevPath &&
        prevPath !== currentPath &&
        prevPath.startsWith('/post/') &&
        (currentPath === '/' || currentPath.startsWith('/post/'))
      ) {
        const engagementMs = articleEnteredAtRef.current > 0 ? Date.now() - articleEnteredAtRef.current : 0;
        const hasOpenOverlay = Boolean(
          document.getElementById('image-lightbox-overlay') ||
          document.getElementById('settings-modal-overlay')
        );

        if (engagementMs >= MIN_ARTICLE_ENGAGEMENT_MS && !hasOpenOverlay) {
          void admobManager.recordArticleTransitionAndMaybeShowInterstitial();
        } else {
          void admobManager.preloadInterstitial();
        }
      } else if (currentPath.startsWith('/post/')) {
        // Silently warm-cache interstitial while reader reads the article
        void admobManager.preloadInterstitial();
      }

      if (currentPath.startsWith('/post/')) {
        articleEnteredAtRef.current = Date.now();
      } else {
        articleEnteredAtRef.current = 0;
      }

      return;
    }

    // 2. Web Browser Handling
    // Google AdSense is hidden per user request. We only maintain robots meta tag for clean SEO.
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }

    if (isUtilityRoute) {
      // Mark utility routes as noindex, nofollow so search bots do not evaluate them as thin screens
      robotsMeta.content = 'noindex, nofollow';
    } else {
      // Allow indexing on legitimate publisher pages (Home, Article, etc.)
      robotsMeta.content = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
    }
  }, [location.pathname]);
}
