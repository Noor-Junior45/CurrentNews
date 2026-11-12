import { Capacitor } from '@capacitor/core';

/**
 * Canonical origin-independent base URL for the Current News reader server.
 */
export const READER_SERVER_BASE_URL = 'https://currentnews.blog';

/**
 * Returns an absolute URL pointing to the primary web origin when running
 * inside the native Capacitor Android shell (where relative paths resolve to https://localhost),
 * or returns the relative path unchanged when running in the browser.
 *
 * @param path Relative path, e.g. '/api/app/version' or '/img/photo.webp'
 */
export function webUrl(path: string): string {
  if (!path) return '';
  if (Capacitor.isNativePlatform()) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    // Use apex domain currentnews.blog which has active verified SSL (avoids www 525 error)
    return `${READER_SERVER_BASE_URL}${cleanPath}`;
  }
  return path;
}
