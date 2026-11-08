import { slugify } from '../types';

/**
 * Returns the canonical public web URL for an article.
 * 
 * In Android Capacitor native apps, local dev environments, or local webviews,
 * window.location.origin is "http://localhost" (or "capacitor://localhost").
 * A link containing "localhost" is completely unusable when sent over WhatsApp,
 * Twitter, Telegram, SMS, or email because recipients cannot reach localhost.
 * 
 * This helper guarantees that:
 * 1. Android APK / Capacitor app shares ALWAYS use the live production website:
 *    https://www.currentnews.blog/post/:id/:slug
 * 2. Web browser shares on currentnews.blog use the canonical production URL.
 * 3. Non-routable origins (localhost, 127.0.0.1, capacitor://) always resolve to https://www.currentnews.blog.
 * 4. Development web previews (*.run.app) use their live accessible URL.
 */
export function getCanonicalPostUrl(postId: string, title?: string): string {
  if (!postId) return 'https://www.currentnews.blog';
  const postSlug = title ? slugify(title) : '';
  const path = postSlug ? `/post/${postId}/${postSlug}` : `/post/${postId}`;

  // Always share with the live canonical production domain so recipients on WhatsApp, Twitter, etc. can open it
  return `https://www.currentnews.blog${path}`;
}

/**
 * Returns the canonical public web origin (base URL).
 * In Android Capacitor native apps, local dev, or webviews,
 * strictly returns "https://www.currentnews.blog".
 */
export function getCanonicalSiteOrigin(): string {
  return 'https://www.currentnews.blog';
}

