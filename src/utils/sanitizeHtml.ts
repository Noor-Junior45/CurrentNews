import DOMPurify from 'dompurify';
import { cleanImageUrl } from './imageUrl';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'a', 'ul', 'ol', 'li', 'blockquote',
  'img', 'figure', 'figcaption',
  'div', 'span', 'pre', 'code',
  'table', 'tbody', 'tr', 'td', 'th',
  'iframe'
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class',
  'src', 'alt', 'title', 'width', 'height',
  'loading', 'frameborder', 'allow', 'allowfullscreen'
];

const ALLOWED_IFRAME_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com'
]);

let hooksConfigured = false;

function ensureHooks() {
  if (hooksConfigured) return;
  hooksConfigured = true;

  // Validate iframes (allow only YouTube over https) and enforce link security
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IFRAME') {
      const src = node.getAttribute('src');
      let valid = false;
      if (src) {
        try {
          const parsed = new URL(src);
          if (parsed.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.has(parsed.hostname.toLowerCase())) {
            valid = true;
          }
        } catch {}
      }
      if (!valid) {
        node.remove();
      }
    }

    // Normalize and self-heal image src attributes
    if (node.tagName === 'IMG') {
      const rawSrc = node.getAttribute('src');
      if (rawSrc) {
        const cleanedSrc = cleanImageUrl(rawSrc);
        if (cleanedSrc) {
          node.setAttribute('src', cleanedSrc);
        }
      }
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
    }

    // Enforce URL scheme restrictions (only http and https allowed)
    for (const attrName of ['href', 'src']) {
      if (node.hasAttribute(attrName)) {
        const val = (node.getAttribute(attrName) || '').trim();
        if (val.includes(':')) {
          const scheme = val.split(':')[0].toLowerCase();
          if (scheme !== 'http' && scheme !== 'https') {
            node.removeAttribute(attrName);
          }
        }
      }
    }

    // Force rel="noopener noreferrer nofollow" on every <a>, and target="_blank" for external links
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
      const href = node.getAttribute('href');
      if (href) {
        try {
          const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://www.currentnews.blog';
          const parsed = new URL(href, currentOrigin);
          if (parsed.origin !== currentOrigin) {
            node.setAttribute('target', '_blank');
          }
        } catch {}
      }
    }
  });
}

/**
 * Browser-side article HTML sanitization utility.
 * Cleans user or external article HTML with DOMPurify:
 * - Allowed tags: h1-h6, p, br, strong, b, em, i, u, s, a, ul, ol, li, blockquote, img, figure, figcaption, div, span, pre, code, table, tbody, tr, td, th, iframe
 * - Iframe strictly restricted to YouTube hostnames over https
 * - Allowed attributes: href, target, rel, class, src, alt, title, width, height, loading, frameborder, allow, allowfullscreen
 * - Strips all on* event handlers, style attributes, script, object, embed, form, and svg
 * - Enforces rel="noopener noreferrer nofollow" on every <a>, and target="_blank" for external links
 * - Preserves Quill ql-* classes and article styling
 */
export function sanitizeArticleHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
  ensureHooks();

  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|\/|\.\/|#)/i,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'svg'],
    FORBID_ATTR: ['style'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel']
  });
}

export default sanitizeArticleHtml;
