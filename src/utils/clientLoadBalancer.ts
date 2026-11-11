/**
 * clientLoadBalancer.ts — Multi-Origin Resilient Client Load Balancer
 * 
 * Provides dynamic traffic distribution, latency-scored health probing,
 * circuit breaker failover, and speculative prefetching across:
 *   1. Cloudflare Global Edge CDN (media.currentnews.blog)
 *   2. Origin Cloud Run Express API (/api/posts)
 *   3. Secondary Cloudflare R2 Mirror (r2.dev)
 */

import { Post } from '../types';
import { sanitizePostImages } from './imageUrl';
import { getCompressedStory, saveCompressedStory, getCompressedStories, saveCompressedStories, getDeletedStoryIds } from './compressedStorage';

export interface OriginNode {
  id: string;
  name: string;
  baseUrl: string;
  type: 'edge-cdn' | 'origin-api' | 'r2-mirror' | 'edge-d1';
  healthy: boolean;
  consecutiveFailures: number;
  lastFailureTime: number;
  latencyMs: number;
  weight: number;
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
    createdAt: Number(a.createdAt ?? a.created_at ?? a.publishedAt ?? a.published_at) || Date.now(),
    updatedAt: Number(a.updatedAt ?? a.updated_at) || Date.now(),
    status: 'published',
    views: Number(a.views) || 0,
    likes: Number(a.likes) || 0,
    dislikes: Number(a.dislikes) || 0,
  };
}

const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 seconds before retesting failed origin
const REQUEST_TIMEOUT_MS = 4500; // 4.5s max per attempt before failover

class ClientLoadBalancer {
  private nodes: OriginNode[] = [
    {
      id: 'cloudflare-d1',
      name: 'Cloudflare Edge Worker & D1',
      baseUrl: 'https://api.currentnews.blog',
      type: 'edge-d1',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 25,
      weight: 10, // Primary source: Cloudflare Edge Worker & D1 Database
    },
    {
      id: 'cloudflare-cdn',
      name: 'Cloudflare Global Edge CDN',
      baseUrl: 'https://media.currentnews.blog',
      type: 'edge-cdn',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 35,
      weight: 3, // Fallback: distributed static caching
    },
    {
      id: 'cloud-run-origin',
      name: 'Google Cloud Run Express API',
      baseUrl: '/api',
      type: 'origin-api',
      healthy: true,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      latencyMs: 80,
      weight: 2, // Secondary origin with dynamic search and category filters
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
      weight: 1, // Tertiary emergency backup
    },
  ];

  private prefetchedIds = new Set<string>();
  private prefetchInFlight = new Map<string, Promise<Post | null>>();

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
    this.nodes.forEach(node => {
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
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
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
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.healthy = true;
    node.consecutiveFailures = 0;
    // Exponential moving average for latency
    node.latencyMs = Math.round(node.latencyMs * 0.7 + durationMs * 0.3);
  }

  /**
   * Background latency probe to keep origin health scores fresh without blocking UI.
   */
  public async probeLatencies(): Promise<void> {
    for (const node of this.nodes) {
      if (!node.healthy && Date.now() - node.lastFailureTime < CIRCUIT_BREAKER_COOLDOWN_MS) {
        continue;
      }
      const testUrl = node.type === 'origin-api'
        ? '/healthz'
        : (node.type === 'edge-d1' ? `${node.baseUrl}/health` : `${node.baseUrl}/articles/feed.json`);

      const start = performance.now();
      try {
        const resp = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
          cache: 'no-cache',
        });
        if (resp.ok) {
          const duration = performance.now() - start;
          this.recordSuccess(node.id, duration);
        } else {
          this.recordFailure(node.id);
        }
      } catch {
        this.recordFailure(node.id);
      }
    }
  }

  /**
   * Fetches public articles feed with transparent load balancing,
   * automated origin failover, and local cache write-through.
   */
  public async fetchArticlesFeed(params?: {
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<{ posts: Post[]; source: string }> {
    const hasActiveFilters = Boolean(
      (params?.category && params.category !== 'All') ||
      (params?.search && params.search.trim().length > 0)
    );

    const orderedNodes = this.getOrderedNodes(hasActiveFilters);

    for (const node of orderedNodes) {
      const startTime = performance.now();
      try {
        let requestUrl = '';
        if (node.type === 'edge-d1') {
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
          // Cloudflare CDN or Mirror feed JSON
          requestUrl = `${node.baseUrl}/articles/feed.json`;
        }

        const resp = await fetch(requestUrl, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { 'Accept': 'application/json' },
        });

        const contentType = resp.headers.get('content-type') || '';
        if (resp.ok && contentType.includes('application/json')) {
          const rawText = await resp.text();
          const trimmed = rawText.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            this.recordFailure(node.id);
            continue;
          }
          const json = JSON.parse(trimmed);
          let rawPosts: any[] = [];

          if (node.type === 'edge-d1') {
            rawPosts = (json?.articles || []).map(mapD1ArticleToPost);
          } else if (node.type === 'origin-api') {
            rawPosts = json?.posts || [];
          } else if (Array.isArray(json)) {
            rawPosts = json;
          }

          if (rawPosts.length > 0) {
            const deletedIds = getDeletedStoryIds();
            let sanitized = rawPosts
              .filter(p => p && p.id && !deletedIds.has(p.id))
              .map(sanitizePostImages);

            // If retrieved from static CDN but client has filters, apply client-side filtering
            if (node.type !== 'origin-api' && hasActiveFilters) {
              if (params?.category && params.category !== 'All') {
                sanitized = sanitized.filter(p => (p.category || '').toLowerCase() === params.category!.toLowerCase());
              }
              if (params?.search) {
                const term = params.search.toLowerCase();
                sanitized = sanitized.filter(p =>
                  (p.title || '').toLowerCase().includes(term) ||
                  (p.excerpt || '').toLowerCase().includes(term) ||
                  (p.content || '').toLowerCase().includes(term) ||
                  (p.authorName || '').toLowerCase().includes(term)
                );
              }
            }

            this.recordSuccess(node.id, performance.now() - startTime);
            saveCompressedStories(sanitized);

            return {
              posts: sanitized,
              source: `${node.name} (${Math.round(performance.now() - startTime)}ms)`,
            };
          }
        } else {
          this.recordFailure(node.id);
        }
      } catch (err) {
        this.recordFailure(node.id);
      }
    }

    // Fallback: Local compressed storage
    const cached = getCompressedStories();
    if (cached && cached.length > 0) {
      let filtered = cached.map(sanitizePostImages);
      if (params?.category && params.category !== 'All') {
        filtered = filtered.filter(p => (p.category || '').toLowerCase() === params.category!.toLowerCase());
      }
      if (params?.search) {
        const term = params.search.toLowerCase();
        filtered = filtered.filter(p =>
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
   * Fetches single article with multi-origin load balancing and fallback.
   */
  public async fetchArticleById(id: string): Promise<{ post: Post | null; source: string }> {
    if (!id) return { post: null, source: 'Invalid ID' };
    if (getDeletedStoryIds().has(id)) {
      return { post: null, source: 'Deleted (Tombstoned)' };
    }

    // Check if a prefetch is already resolving
    if (this.prefetchInFlight.has(id)) {
      const prefetched = await this.prefetchInFlight.get(id);
      if (prefetched) {
        return { post: prefetched, source: 'Speculative Prefetch Cache (0ms)' };
      }
    }

    // Check local compressed memory
    const local = getCompressedStory(id);
    if (local && local.content && local.content.length > 200) {
      return { post: sanitizePostImages(local), source: 'Instant User Cache (0ms)' };
    }

    const orderedNodes = this.getOrderedNodes(false);

    for (const node of orderedNodes) {
      const startTime = performance.now();
      try {
        const url = node.type === 'edge-d1'
          ? `${node.baseUrl}/articles/${encodeURIComponent(id)}`
          : (node.type === 'origin-api'
            ? `${node.baseUrl}/posts/${id}`
            : `${node.baseUrl}/articles/${id}.json`);

        const resp = await fetch(url, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { 'Accept': 'application/json' },
        });
        const contentType = resp.headers.get('content-type') || '';
        if (resp.ok && contentType.includes('application/json')) {
          const rawText = await resp.text();
          const trimmed = rawText.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            this.recordFailure(node.id);
            continue;
          }
          const json = JSON.parse(trimmed);
          const target = node.type === 'edge-d1'
            ? mapD1ArticleToPost(json?.article)
            : (node.type === 'origin-api' ? json?.post : json);
          if (target && target.title) {
            const sanitized = sanitizePostImages(target);
            this.recordSuccess(node.id, performance.now() - startTime);
            saveCompressedStory(sanitized);
            this.prefetchedIds.add(id);
            return {
              post: sanitized,
              source: `${node.name} (${Math.round(performance.now() - startTime)}ms)`,
            };
          }
        } else {
          this.recordFailure(node.id);
        }
      } catch (err) {
        this.recordFailure(node.id);
      }
    }

    // Final fallback to local cached preview if available
    if (local) {
      return { post: sanitizePostImages(local), source: 'Partial Preview Cache' };
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

    // Low priority background fetch
    const promise = (async () => {
      try {
        const { post } = await this.fetchArticleById(id);
        if (post) {
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
      nodes: this.nodes.map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        healthy: n.healthy,
        latencyMs: n.latencyMs,
        failures: n.consecutiveFailures,
      })),
      prefetchedCount: this.prefetchedIds.size,
      activeLoadBalancer: 'Weighted-Latency Multi-Origin Failover',
    };
  }
}

export const clientLoadBalancer = new ClientLoadBalancer();
