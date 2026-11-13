/**
 * clientLoadBalancer.ts — Multi-Origin Resilient Client Load Balancer
 *
 * Provides dynamic traffic distribution, latency-scored health probing,
 * native CapacitorHttp CORS-free transport for Android/iOS APKs,
 * bundled offline `/articles/:id.json` failover, and speculative prefetching across:
 *   1. Pre-Packaged Bundled Assets (`/feed.json` & `/articles/:id.json`)
 *   2. Origin Cloud Run Express API (`/api/posts`)
 *   3. Cloudflare Global Edge CDN (`media.currentnews.blog`)
 *   4. Secondary Cloudflare R2 Mirror (`r2.dev`)
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Post } from '../types';
import { sanitizePostImages } from './imageUrl';
import {
  getCompressedStory,
  saveCompressedStory,
  getCompressedStories,
  saveCompressedStories,
  getDeletedStoryIds,
} from './compressedStorage';

export interface OriginNode {
  id: string;
  name: string;
  baseUrl: string;
  type: 'edge-cdn' | 'origin-api' | 'r2-mirror' | 'edge-d1' | 'bundled';
  healthy: boolean;
  consecutiveFailures: number;
  lastFailureTime: number;
  latencyMs: number;
  weight: number;
}

const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Executes a JSON GET request safely across both Web browsers and Native Capacitor APKs.
 * - For local relative paths (`/feed.json`, `/articles/:id.json`), uses WebView's local `fetch` (0-5ms, same-origin).
 * - For external `https://` URLs inside a native APK (`Origin: https://localhost`), uses native `CapacitorHttp.get()`
 *   on Android's Java HttpURLConnection stack so cross-origin responses from Cloud Run & Cloudflare R2
 *   are NEVER blocked by WebView CORS restrictions.
 */
async function smartFetchJson(
  url: string,
  timeoutMs: number
): Promise<{ ok: boolean; json: any | null }> {
  const isRemoteHttp = /^https?:\/\//i.test(url);

  if (isRemoteHttp && isNativeApp()) {
    try {
      const resp = await CapacitorHttp.get({
        url,
        headers: { Accept: 'application/json' },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });

      if (resp.status >= 200 && resp.status < 300 && resp.data != null) {
        if (typeof resp.data === 'object') {
          return { ok: true, json: resp.data };
        }
        if (typeof resp.data === 'string') {
          const trimmed = resp.data.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return { ok: true, json: JSON.parse(trimmed) };
          }
        }
      }
      return { ok: false, json: null };
    } catch {
      // Fall through to standard fetch as secondary attempt if CORS headers exist
    }
  }

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });

  if (!resp.ok) {
    return { ok: false, json: null };
  }

  const rawText = await resp.text();
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { ok: false, json: null };
  }

  return { ok: true, json: JSON.parse(trimmed) };
}

function mapD1ArticleToPost(a: any): any {
  if (!a || typeof a !== 'object') return a;
  const parseJsonArray = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const parseTimestamp = (val: any): any => {
    if (typeof val === 'number' && !Number.isNaN(val) && val > 0) return val;
    if (typeof val === 'string' && val.trim().length > 0) {
      const asNum = Number(val);
      if (!Number.isNaN(asNum) && asNum > 0) return asNum;
      const parsed = Date.parse(val);
      if (!Number.isNaN(parsed)) return parsed;
      return val;
    }
    return Date.now();
  };

  return {
    ...a,
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt || '',
    content: a.content || '',
    category: a.category || 'General',
    hashtags: parseJsonArray(a.hashtags),
    imageUrl: a.imageUrl || a.image_url || '',
    imageUrlFallback: a.imageUrlFallback || a.image_url_fallback || '',
    imageUrls: parseJsonArray(a.imageUrls ?? a.image_urls),
    imageUrlsFallback: parseJsonArray(a.imageUrlsFallback ?? a.image_urls_fallback),
    imagePosition: a.imagePosition || a.image_position || 'top',
    galleryPositions: parseJsonArray(a.galleryPositions ?? a.gallery_positions),
    youtubeUrl: a.youtubeUrl || a.youtube_url || '',
    facebookUrl: a.facebookUrl || a.facebook_url || '',
    authorName: a.authorName || a.author_name || 'Current News',
    createdAt: parseTimestamp(a.createdAt ?? a.created_at ?? a.publishedAt ?? a.published_at),
    updatedAt: parseTimestamp(a.updatedAt ?? a.updated_at ?? a.createdAt ?? a.published_at),
    status: 'published',
    views: Number(a.views) || 0,
    likes: Number(a.likes) || 0,
    dislikes: Number(a.dislikes) || 0,
  };
}

const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 seconds before retesting failed origin
const REQUEST_TIMEOUT_MS = 4500; // 4.5s max for edge/CDN mirrors
const ORIGIN_TIMEOUT_MS = 9000; // 9.0s max for Cloud Run origin to survive cold starts on mobile networks

const JHARKHAND_FILTER_REGEX = /jharkhand|ranchi|dhanbad|jamshedpur|bokaro|godda|deoghar|dumka|basantrai|hanwara|mahagama|झारखंड|गोड्डा|रांची|धनबाद|जमशेदपुर|बोकारो|देवघर|दुमका|बसंतराय|हनवारा|महागामा|पथरगामा|साहिबगंज|पाकुड़|हजारीबाग|पलामू|गढ़वा|चतरा|कोडरमा|गिरिडीह|लातेहार|लोहरदगा|गुमला|सिमडेगा|खूंटी|सरायकेला|चाईबासा|चेंगाई|लायथा|पचरुखी|गोपीचक|कपेटा|नौरत्तमपुर|जामनीकोला|बेलडीहा|फूलवड़िया|सुराइकिट्टा|भुयांसी|बाघाकोल/i;
const WORLD_FILTER_REGEX = /world|international|विदेश|सऊदी|रियाद|हूती|बांग्लादेश|ग्लोबल|अंतरराष्ट्रीय/i;
const NATIONAL_FILTER_REGEX = /national|india|delhi|bharat|देश|राष्ट्रीय|भारत|दिल्ली|सुप्रीम कोर्ट|संसद|विपक्ष/i;
const CRIME_FILTER_REGEX = /crime|police|arrest|murder|fir|चोरी|पुलिस|हत्या|हादसा|गिरफ्तार|मौत|सड़क हादसा|आग|अगलगी|बवाल|डूबने|अपहरण/i;
const EDUCATION_FILTER_REGEX = /education|school|college|exam|physics|smart class|पढ़ाई|स्कूल|कॉलेज|परीक्षा|कक्षा|विद्यार्थी|छात्र|क्लास/i;
const ENTERTAINMENT_FILTER_REGEX = /entertainment|cinema|movie|actor|film|tiger shroff|टाइगर श्रॉफ|अभिनेता|फिल्म|सिनेमा/i;

function matchesCategoryFilter(post: Post, targetCategory?: string): boolean {
  if (!targetCategory || targetCategory === 'All') return true;
  const cat = targetCategory.trim().toLowerCase();
  if (!cat || cat === 'all') return true;
  const postCat = (post.category || 'General').toLowerCase();
  if (postCat === cat) return true;
  const haystack = `${post.title || ''} ${post.excerpt || ''} ${post.content || ''} ${(post.hashtags || []).join(' ')}`;
  if (cat === 'jharkhand') return JHARKHAND_FILTER_REGEX.test(haystack);
  if (cat === 'world') return WORLD_FILTER_REGEX.test(haystack);
  if (cat === 'national') return NATIONAL_FILTER_REGEX.test(haystack);
  if (cat === 'crime') return CRIME_FILTER_REGEX.test(haystack);
  if (cat === 'education') return EDUCATION_FILTER_REGEX.test(haystack);
  if (cat === 'entertainment') return ENTERTAINMENT_FILTER_REGEX.test(haystack);
  return false;
}

class ClientLoadBalancer {
  private nodes: OriginNode[] = [
    {
      id: 'bundled-asset',
      name: 'Pre-Packaged Offline Articles',
      baseUrl: '',
      type: 'bundled',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 5,
      weight: 15, // Packaged directly inside APK and web build for 0ms guaranteed load
    },
    {
      id: 'cloud-run-origin',
      name: 'Google Cloud Run Express API',
      baseUrl: isNativeApp() ? 'https://currentnews.blog/api' : '/api',
      type: 'origin-api',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 50,
      weight: 10, // Full dynamic reader API with all published dispatches
    },
    {
      id: 'cloudflare-cdn',
      name: 'Cloudflare Global Edge CDN',
      baseUrl: 'https://media.currentnews.blog',
      type: 'edge-cdn',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 80,
      weight: 6, // Direct R2 custom domain JSON objects (/articles/:id.json)
    },
    {
      id: 'r2-mirror',
      name: 'Cloudflare R2 Secondary Mirror',
      baseUrl: 'https://pub-03dd1274c4824531a1478f20e0485d75.r2.dev',
      type: 'r2-mirror',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 120,
      weight: 3,
    },
    {
      id: 'cloudflare-d1',
      name: 'Cloudflare Edge Worker & D1',
      baseUrl: 'https://api.currentnews.blog',
      type: 'edge-d1',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 160,
      weight: 1,
    },
  ];

  private prefetchedIds = new Set<string>();
  private prefetchInFlight = new Map<string, Promise<Post | null>>();
  private feedInFlight = new Map<string, Promise<{ posts: Post[]; source: string }>>();
  private bundledFeedEmpty = false;

  constructor() {
    // Run an initial non-blocking background latency probe
    if (typeof window !== 'undefined') {
      setTimeout(() => this.probeLatencies(), 1500);
    }
  }

  /**
   * Sorts candidate origins by health, failure cooldown, and latency score.
   */
  private getOrderedNodes(preferOriginForFilter = false): OriginNode[] {
    const now = Date.now();

    // Check circuit breaker cooldowns
    this.nodes.forEach((node) => {
      if (!node.healthy && now - node.lastFailureTime > CIRCUIT_BREAKER_COOLDOWN_MS) {
        node.healthy = true;
        node.consecutiveFailures = 0;
      }
    });

    return [...this.nodes].sort((a, b) => {
      // 1. Healthy nodes first
      if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;

      // 2. If filtering or searching is active, prefer Origin API because it computes query filters
      if (preferOriginForFilter) {
        if (a.type === 'origin-api') return -1;
        if (b.type === 'origin-api') return 1;
      }

      // 3. Lowest latency + highest weight score
      const scoreA = a.latencyMs / a.weight;
      const scoreB = b.latencyMs / b.weight;
      return scoreA - scoreB;
    });
  }

  /**
   * Records failure and trips the circuit breaker after 2 consecutive errors.
   */
  private recordFailure(nodeId: string) {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node || node.type === 'bundled') return;
    node.consecutiveFailures += 1;
    node.lastFailureTime = Date.now();
    if (node.consecutiveFailures >= 2) {
      node.healthy = false;
      console.warn(`[ClientLB] Circuit breaker tripped for node: ${node.name}. Routing to alternate origin.`);
    }
  }

  /**
   * Records success and resets failure counter.
   */
  private recordSuccess(nodeId: string, durationMs: number) {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    node.healthy = true;
    node.consecutiveFailures = 0;
    node.latencyMs = Math.round(node.latencyMs * 0.7 + durationMs * 0.3);
  }

  /**
   * Background latency probe for nodes that expose dedicated health endpoints.
   */
  public async probeLatencies(): Promise<void> {
    for (const node of this.nodes) {
      if (node.type === 'edge-cdn' || node.type === 'r2-mirror') {
        continue;
      }
      if (!node.healthy && Date.now() - node.lastFailureTime < CIRCUIT_BREAKER_COOLDOWN_MS) {
        continue;
      }

      const start = performance.now();
      try {
        if (node.type === 'bundled') {
          if (this.bundledFeedEmpty) continue;
          const { ok, json } = await smartFetchJson('/feed.json', 2000);
          if (ok && Array.isArray(json) && json.length > 0) {
            this.recordSuccess(node.id, performance.now() - start);
          } else if (ok && Array.isArray(json) && json.length === 0) {
            this.bundledFeedEmpty = true;
          }
          continue;
        }

        if (node.type === 'origin-api') {
          const healthUrl = isNativeApp() ? 'https://currentnews.blog/healthz' : '/healthz';
          if (isNativeApp()) {
            const resp = await CapacitorHttp.get({ url: healthUrl, connectTimeout: 2500, readTimeout: 2500 });
            if (resp.status >= 200 && resp.status < 300) {
              this.recordSuccess(node.id, performance.now() - start);
            } else {
              this.recordFailure(node.id);
            }
          } else {
            const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(2000), cache: 'no-cache' });
            if (resp.ok) this.recordSuccess(node.id, performance.now() - start);
            else this.recordFailure(node.id);
          }
          continue;
        }

        if (node.type === 'edge-d1') {
          const { ok } = await smartFetchJson(`${node.baseUrl}/health`, 2000);
          if (ok) this.recordSuccess(node.id, performance.now() - start);
          else this.recordFailure(node.id);
        }
      } catch {
        this.recordFailure(node.id);
      }
    }
  }

  /**
   * Fetches public articles feed with transparent load balancing,
   * automated origin failover, single-flight deduplication, and local cache write-through.
   */
  public async fetchArticlesFeed(params?: {
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<{ posts: Post[]; source: string }> {
    const flightKey = `${params?.category || 'All'}::${params?.search || ''}::${params?.limit || 100}`;
    const existingFlight = this.feedInFlight.get(flightKey);
    if (existingFlight) {
      return existingFlight;
    }

    const promise = this.executeFetchArticlesFeed(params).finally(() => {
      this.feedInFlight.delete(flightKey);
    });
    this.feedInFlight.set(flightKey, promise);
    return promise;
  }

  private async executeFetchArticlesFeed(params?: {
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<{ posts: Post[]; source: string }> {
    const hasActiveFilters = Boolean(
      (params?.category && params.category !== 'All') ||
      (params?.search && params.search.trim().length > 0)
    );

    const nativeMode = isNativeApp();
    const orderedNodes = this.getOrderedNodes(hasActiveFilters);

    for (const node of orderedNodes) {
      if (node.type === 'bundled' && this.bundledFeedEmpty) {
        continue;
      }
      // On Web browsers, R2 static buckets do not emit Access-Control-Allow-Origin headers;
      // route Web feed reads through same-origin `/api/posts` while keeping native CapacitorHttp active on APK.
      if (!nativeMode && (node.type === 'edge-cdn' || node.type === 'r2-mirror')) {
        continue;
      }

      const startTime = performance.now();
      const timeoutMs = node.type === 'origin-api' ? ORIGIN_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
      try {
        let requestUrl = '';
        if (node.type === 'bundled') {
          requestUrl = '/feed.json';
        } else if (node.type === 'edge-d1') {
          const queryParams = new URLSearchParams();
          if (params?.category && params.category !== 'All') queryParams.set('category', params.category);
          queryParams.set('limit', String(params?.limit || 100));
          requestUrl = `${node.baseUrl}/articles?${queryParams.toString()}`;
        } else if (node.type === 'origin-api') {
          const queryParams = new URLSearchParams();
          if (params?.category && params.category !== 'All') queryParams.set('category', params.category);
          if (params?.search) queryParams.set('search', params.search);
          queryParams.set('limit', String(params?.limit || 100));
          requestUrl = `${node.baseUrl}/posts?${queryParams.toString()}`;
        } else {
          // Cloudflare Edge CDN or R2 Secondary Mirror feed JSON
          requestUrl = `${node.baseUrl}/articles/feed.json`;
        }

        const { ok, json } = await smartFetchJson(requestUrl, timeoutMs);
        if (ok && json !== null && json !== undefined) {
          if (node.type === 'bundled' && Array.isArray(json) && json.length === 0) {
            // Empty static feed.json ([]): cleanly skip without error and move on to the next source
            this.bundledFeedEmpty = true;
            continue;
          }

          let rawPosts: any[] = [];

          if (node.type === 'edge-d1') {
            rawPosts = (json?.articles || []).map(mapD1ArticleToPost);
          } else if (node.type === 'origin-api') {
            rawPosts = (json?.posts || []).map(mapD1ArticleToPost);
          } else if (Array.isArray(json)) {
            rawPosts = json.map(mapD1ArticleToPost);
          }

          if (rawPosts.length > 0) {
            const deletedIds = getDeletedStoryIds();
            let sanitized = rawPosts
              .filter((p) => p && p.id && !deletedIds.has(p.id))
              .map(sanitizePostImages);

            // Cache the unfiltered feed when retrieved from non-filtered sources
            if (!hasActiveFilters) {
              saveCompressedStories(sanitized);
            }

            // If retrieved from static bundle/edge but client has filters, apply client-side filtering
            if (node.type !== 'origin-api' && hasActiveFilters) {
              if (params?.category && params.category !== 'All') {
                sanitized = sanitized.filter((p) => matchesCategoryFilter(p, params.category));
              }
              if (params?.search) {
                const term = params.search.toLowerCase();
                sanitized = sanitized.filter(
                  (p) =>
                    (p.title || '').toLowerCase().includes(term) ||
                    (p.excerpt || '').toLowerCase().includes(term) ||
                    (p.content || '').toLowerCase().includes(term) ||
                    (p.authorName || '').toLowerCase().includes(term) ||
                    (p.hashtags || []).some((h: string) => h.toLowerCase().includes(term))
                );
              }
            }

            this.recordSuccess(node.id, performance.now() - startTime);
            if (hasActiveFilters && sanitized.length > 0 && !getCompressedStories()?.length) {
              saveCompressedStories(sanitized);
            }

            return {
              posts: sanitized,
              source: `${node.name} (${Math.round(performance.now() - startTime)}ms)`,
            };
          }
          // Valid empty response from this node — move cleanly to the next source without error
          continue;
        } else if (node.type !== 'edge-cdn' && node.type !== 'r2-mirror') {
          // Do not mark R2 CDN unhealthy if only /articles/feed.json is absent;
          // single-article /articles/:id.json objects remain live and healthy for APK reads.
          this.recordFailure(node.id);
        }
      } catch {
        if (node.type !== 'edge-cdn' && node.type !== 'r2-mirror') {
          this.recordFailure(node.id);
        }
      }
    }

    // Fallback 1: Local compressed storage
    const cached = getCompressedStories();
    if (cached && cached.length > 0) {
      const deletedIds = getDeletedStoryIds();
      let filtered = cached
        .filter((p) => p && p.id && !deletedIds.has(p.id))
        .map(mapD1ArticleToPost)
        .map(sanitizePostImages);
      if (params?.category && params.category !== 'All') {
        filtered = filtered.filter((p) => matchesCategoryFilter(p, params.category));
      }
      if (params?.search) {
        const term = params.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            (p.title || '').toLowerCase().includes(term) ||
            (p.excerpt || '').toLowerCase().includes(term) ||
            (p.content || '').toLowerCase().includes(term) ||
            (p.authorName || '').toLowerCase().includes(term)
        );
      }
      return { posts: filtered, source: 'Local LZW Cache (Offline)' };
    }

    return { posts: [], source: 'Empty / Offline' };
  }

  /**
   * Loads an individual bundled full article from `/articles/:id.json` if packaged in `public/articles/`.
   * Safely skips when static bundle is empty (`[]`).
   */
  private async fetchBundledArticleById(id: string): Promise<Post | null> {
    if (this.bundledFeedEmpty) return null;
    try {
      const { ok, json } = await smartFetchJson(`/articles/${encodeURIComponent(id)}.json`, 1500);
      if (ok && json && json.title && json.content) {
        const mapped = sanitizePostImages(mapD1ArticleToPost(json));
        saveCompressedStory(mapped);
        this.prefetchedIds.add(id);
        return mapped;
      }
    } catch {
      // Not present in pre-packaged bundle
    }
    return null;
  }

  /**
   * Fetches single article with multi-origin load balancing, native CapacitorHttp CORS bypass,
   * and bundled APK `/articles/:id.json` offline failover.
   */
  public async fetchArticleById(id: string): Promise<{ post: Post | null; source: string }> {
    if (!id) return { post: null, source: 'Invalid ID' };
    if (getDeletedStoryIds().has(id)) {
      return { post: null, source: 'Deleted (Tombstoned)' };
    }

    // 1. Check if a speculative prefetch is already resolving
    if (this.prefetchInFlight.has(id)) {
      const prefetched = await this.prefetchInFlight.get(id);
      if (prefetched && prefetched.content) {
        return { post: prefetched, source: 'Speculative Prefetch Cache (0ms)' };
      }
    }

    // 2. Check local compressed memory for full article body
    const local = getCompressedStory(id);
    if (local && local.content && local.content.length > 200) {
      return { post: sanitizePostImages(mapD1ArticleToPost(local)), source: 'Instant User Cache (0ms)' };
    }

    // 3. If device is offline, serve directly from APK/PWA pre-packaged bundle in ~2ms
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const bundledOffline = await this.fetchBundledArticleById(id);
      if (bundledOffline) {
        return { post: bundledOffline, source: 'Pre-Packaged APK Bundle (Offline 0ms)' };
      }
    }

    const nativeMode = isNativeApp();
    const orderedNodes = this.getOrderedNodes(false);

    for (const node of orderedNodes) {
      if (node.type === 'bundled') {
        continue; // Checked immediately after live nodes (or first when offline) so live edits stay fresh
      }
      if (!nativeMode && (node.type === 'edge-cdn' || node.type === 'r2-mirror')) {
        continue; // Avoid browser CORS errors on R2 bucket URLs; Web uses same-origin /api/posts/:id
      }

      const startTime = performance.now();
      const timeoutMs = node.type === 'origin-api' ? ORIGIN_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
      try {
        const encodedId = encodeURIComponent(id);
        const url =
          node.type === 'edge-d1'
            ? `${node.baseUrl}/articles/${encodedId}`
            : node.type === 'origin-api'
            ? `${node.baseUrl}/posts/${encodedId}`
            : `${node.baseUrl}/articles/${encodedId}.json`;

        const { ok, json } = await smartFetchJson(url, timeoutMs);
        if (ok && json) {
          const rawTarget =
            node.type === 'edge-d1'
              ? json?.article
              : node.type === 'origin-api'
              ? json?.post
              : json;

          const target = rawTarget ? mapD1ArticleToPost(rawTarget) : null;
          if (target && target.title && target.content) {
            const sanitized = sanitizePostImages(target);
            this.recordSuccess(node.id, performance.now() - startTime);
            saveCompressedStory(sanitized);
            this.prefetchedIds.add(id);
            return {
              post: sanitized,
              source: `${node.name} (${Math.round(performance.now() - startTime)}ms)`,
            };
          }
        }
        this.recordFailure(node.id);
      } catch {
        this.recordFailure(node.id);
      }
    }

    // 5. Instant local APK/PWA bundled full-article JSON fallback (`/articles/:id.json`)
    const bundled = await this.fetchBundledArticleById(id);
    if (bundled) {
      return { post: bundled, source: 'Pre-Packaged APK Bundle' };
    }

    // 6. Final fallback to local cached preview or feed entry if available
    if (local && local.title) {
      return { post: sanitizePostImages(mapD1ArticleToPost(local)), source: 'Partial Preview Cache' };
    }

    const compressedFeed = getCompressedStories();
    const inFeed = compressedFeed?.find((p) => p && p.id === id);
    if (inFeed && (inFeed.title || inFeed.content)) {
      return { post: sanitizePostImages(mapD1ArticleToPost(inFeed)), source: 'Bundled Story Feed' };
    }

    return { post: null, source: 'Not Found' };
  }

  /**
   * Speculatively prefetches an article when user hovers or taps on a card.
   * Eliminates 100% of read wait-time on click.
   */
  public prefetchArticle(id: string): void {
    if (!id || this.prefetchedIds.has(id) || this.prefetchInFlight.has(id)) {
      return;
    }

    const promise = (async () => {
      try {
        const { post } = await this.fetchArticleById(id);
        if (post && post.content) {
          this.prefetchedIds.add(id);
        }
        return post;
      } catch {
        return null;
      } finally {
        this.prefetchInFlight.delete(id);
      }
    })();

    this.prefetchInFlight.set(id, promise);
  }

  /**
   * Diagnostic health report for load balancing telemetry.
   */
  public getStatus() {
    return {
      nodes: this.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        healthy: n.healthy,
        latencyMs: n.latencyMs,
        failures: n.consecutiveFailures,
      })),
      prefetchedCount: this.prefetchedIds.size,
      activeLoadBalancer: 'Weighted-Latency Multi-Origin Failover + CapacitorHttp Native Bridge',
    };
  }
}

export const clientLoadBalancer = new ClientLoadBalancer();
