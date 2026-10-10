/**
 * SEO & Canonical URL Management Utility
 * 
 * Guarantees that every page in Current News Live maintains a strictly
 * self-referencing canonical URL, correct document title, meta descriptions,
 * Open Graph tags, and Twitter Card URLs.
 * 
 * Prevents Google Search Console's "Alternative page with proper canonical tag"
 * error by ensuring subpages (e.g. /privacy, /terms, /about, /contact, /post/:id)
 * never default back to the homepage canonical URL.
 */

export interface PageSEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
}

export const CANONICAL_ORIGIN = 'https://www.currentnews.blog';

export function updateDocumentSEO({
  title,
  description,
  canonicalPath,
  canonicalUrl,
  ogType = 'website',
  ogImage
}: PageSEOProps) {
  if (typeof document === 'undefined') return;

  // 1. Resolve exact canonical URL
  let resolvedCanonical = canonicalUrl;
  if (!resolvedCanonical) {
    if (canonicalPath) {
      const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
      resolvedCanonical = cleanPath === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${cleanPath.replace(/\/+$/, '')}`;
    } else if (typeof window !== 'undefined' && window.location) {
      const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
      resolvedCanonical = cleanPath === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${cleanPath}`;
    } else {
      resolvedCanonical = `${CANONICAL_ORIGIN}/`;
    }
  }

  // 2. Set document title
  if (title) {
    document.title = title;
  }

  // 3. Update or create Canonical link tag
  let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', resolvedCanonical);

  // 4. Update Meta Description
  if (description) {
    let descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute('content', description);
  }

  // 5. Update Open Graph Tags
  const setMeta = (attr: 'name' | 'property', attrValue: string, contentValue: string) => {
    let meta = document.querySelector<HTMLMetaElement>(`meta[${attr}="${attrValue}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, attrValue);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', contentValue);
  };

  setMeta('property', 'og:url', resolvedCanonical);
  setMeta('name', 'twitter:url', resolvedCanonical);
  setMeta('property', 'og:type', ogType);

  if (title) {
    setMeta('property', 'og:title', title);
    setMeta('name', 'twitter:title', title);
  }

  if (description) {
    setMeta('property', 'og:description', description);
    setMeta('name', 'twitter:description', description);
  }

  if (ogImage) {
    setMeta('property', 'og:image', ogImage);
    setMeta('name', 'twitter:image', ogImage);
  }
}
