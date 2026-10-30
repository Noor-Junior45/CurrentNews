/**
 * AdSpace Component
 * Note: Google AdSense is disabled/hidden per user request to prioritize native AdMob on mobile.
 * Returns null to eliminate all web ad placeholders and maintain zero layout shift.
 */
export default function AdSpace(_props?: {
  type?: 'in-article' | 'article-bottom' | 'in-feed' | 'leaderboard' | 'sidebar' | 'footer';
  className?: string;
  slot?: string;
}) {
  return null;
}
