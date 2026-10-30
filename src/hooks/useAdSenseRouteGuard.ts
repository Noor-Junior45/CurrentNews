import { useEffect } from 'react';
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

export function useAdSenseRouteGuard() {
  const location = useLocation();

  useEffect(() => {
    const isUtilityRoute = UTILITY_OR_NON_CONTENT_ROUTES.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + '/')
    );

    // 1. Native Mobile App Handling (Google AdMob)
    if (admobManager.isNative()) {
      if (isUtilityRoute) {
        // Hide banner on non-content/utility/auth screens so it never covers buttons
        admobManager.hideBanner();
      } else {
        // Show native banner on public content feeds and articles
        admobManager.showBanner();
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
