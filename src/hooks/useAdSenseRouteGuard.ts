import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ADSENSE_CLIENT_ID } from '../components/AdSpace';

// Non-content / utility screens where Google ads MUST NEVER run under AdSense Program Policies
const UTILITY_OR_NON_CONTENT_ROUTES = [
  '/admin',
  '/profile',
  '/settings',
  '/liked',
  '/delete-account',
  '/privacy',
  '/terms'
];

export function useAdSenseRouteGuard() {
  const location = useLocation();

  useEffect(() => {
    const isUtilityRoute = UTILITY_OR_NON_CONTENT_ROUTES.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + '/')
    );

    // Update robots meta tag dynamically
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }

    if (isUtilityRoute) {
      // 1. Mark utility routes as noindex, nofollow so search bots and ad reviewers do not evaluate them as thin screens
      robotsMeta.content = 'noindex, nofollow';

      // 2. Hide any lingering Google Auto-Ad full screen vignettes or floating anchor ads
      const floatingAds = document.querySelectorAll(
        '.google-auto-placed, ins.adsbygoogle[data-anchor-status], .adsbygoogle-noablate-auto'
      );
      floatingAds.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    } else {
      // Allow indexing on legitimate publisher pages (Home, Article, About, Editorial Policy)
      robotsMeta.content = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

      // Ensure AdSense script is present for public publisher views
      const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
    }
  }, [location.pathname]);
}
