import { Pool } from 'pg';
import { cleanImageUrl, getFallbackImageUrl } from '../utils/imageUrl.ts';
import {
  extractPlainExcerpt,
  getArticleFromR2,
  getDeletedArticleIds,
  getFeedFromR2,
  loadLocalFeed,
  registerOnArticleDeletedHook,
} from './r2Articles.ts';

export interface CatalogArticle {
  id: string;
  slug?: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string;
  createdAt: string | number;
  updatedAt: string | number;
  imageUrl: string;
  imageUrlFallback: string;
  imageUrls: string[];
  imageUrlsFallback: string[];
  imagePosition: string;
  galleryPositions: string[];
  youtubeUrl: string;
  facebookUrl: string;
  customLinks: string[];
  hashtags: string[];
  likes: number;
  dislikes: number;
  views: number;
  status: string;
}

let neonPool: Pool | null = null;
let neonArticlesBlockedUntil = 0;
let loggedNeonPermissionNotice = false;

const CATALOG_TTL_MS = 60 * 1000; // 60s fresh TTL for Neon/Worker/R2 feed
const MAX_FULL_CACHE_ENTRIES = 300;

let cachedFeed: CatalogArticle[] = [];
let cachedFeedAt = 0;
let cachedFeedTtl = CATALOG_TTL_MS;
let inFlightFeedPromise: Promise<CatalogArticle[]> | null = null;

const fullArticleCache = new Map<string, { post: CatalogArticle; cachedAt: number }>();

registerOnArticleDeletedHook(() => {
  cachedFeed = [];
  cachedFeedAt = 0;
  fullArticleCache.clear();
});

export function invalidateArticleCatalog(): void {
  cachedFeed = [];
  cachedFeedAt = 0;
  fullArticleCache.clear();
}

function getNeonPool(): Pool | null {
  const connectionString = (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    return null;
  }
  if (!neonPool) {
    neonPool = new Pool({
      connectionString,
      ssl: true,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 4500,
    });
    neonPool.on('error', (err) => {
      console.debug('[ArticleCatalog] Idle PostgreSQL client notice:', err?.message || err);
    });
  }
  return neonPool;
}

function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v || '').trim()).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return [trimmed];
  }
  return [];
}

function normalizeTimestamp(val: unknown): string | number {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString();
  }
  if (typeof val === 'number' && !Number.isNaN(val) && val > 0) {
    return val;
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const asNum = Number(val);
    if (!Number.isNaN(asNum) && asNum > 0) return asNum;
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return val;
  }
  return new Date().toISOString();
}

function toEpochMs(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const asNum = Number(val);
    if (!Number.isNaN(asNum) && asNum > 0) return asNum;
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function sanitizeInlineContentImages(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html.replace(
    /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (_full, prefix: string, rawSrc: string, suffix: string) => {
      const cleaned = cleanImageUrl(rawSrc);
      return `${prefix}${cleaned || rawSrc}${suffix}`;
    }
  );
}

/**
 * Normalizes a database row, Worker payload, or R2 JSON manuscript into a clean public reader article.
 * Never exposes staff PII (`authorEmail` / `authorId` / `author_uid`).
 */
export function normalizeReaderArticle(raw: any): CatalogArticle | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const title = String(raw.title || '').trim();
  if (!id || !title) return null;

  const rawContent = typeof raw.content === 'string' ? sanitizeInlineContentImages(raw.content) : '';
  const imageUrls = parseStringArray(raw.imageUrls ?? raw.image_urls)
    .map(cleanImageUrl)
    .filter(Boolean);
  const imageUrlsFallback = parseStringArray(raw.imageUrlsFallback ?? raw.image_urls_fallback)
    .map(cleanImageUrl)
    .filter(Boolean);

  let primaryImg = cleanImageUrl(raw.imageUrl || raw.image_url || '');
  if (!primaryImg && imageUrls.length > 0) {
    primaryImg = imageUrls[0];
  }
  if (!primaryImg && (raw.imageUrlFallback || raw.image_url_fallback)) {
    primaryImg = cleanImageUrl(raw.imageUrlFallback || raw.image_url_fallback);
  }
  if (!primaryImg && rawContent) {
    const inlineMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (inlineMatch?.[1]) {
      primaryImg = cleanImageUrl(inlineMatch[1]);
    }
  }

  const rawFallback = cleanImageUrl(raw.imageUrlFallback || raw.image_url_fallback || '');
  const resolvedFallback = getFallbackImageUrl(primaryImg, rawFallback);
  const createdAt = normalizeTimestamp(
    raw.published_at ?? raw.publishedAt ?? raw.created_at ?? raw.createdAt
  );
  const updatedAt = normalizeTimestamp(
    raw.updated_at ?? raw.updatedAt ?? createdAt
  );

  return {
    id,
    slug: typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : undefined,
    title,
    excerpt:
      typeof raw.excerpt === 'string' && raw.excerpt.trim()
        ? raw.excerpt.trim()
        : extractPlainExcerpt(rawContent, 200),
    content: rawContent,
    category: String(raw.category || 'General').trim() || 'General',
    authorName: String(raw.authorName || raw.author_name || 'Current News').trim() || 'Current News',
    createdAt,
    updatedAt,
    imageUrl: primaryImg,
    imageUrlFallback: resolvedFallback,
    imageUrls: imageUrls.length > 0 ? imageUrls : primaryImg ? [primaryImg] : [],
    imageUrlsFallback,
    imagePosition: String(raw.imagePosition || raw.image_position || 'top'),
    galleryPositions: parseStringArray(raw.galleryPositions ?? raw.gallery_positions),
    youtubeUrl: String(raw.youtubeUrl || raw.youtube_url || '').trim(),
    facebookUrl: String(raw.facebookUrl || raw.facebook_url || '').trim(),
    customLinks: parseStringArray(raw.customLinks ?? raw.custom_links),
    hashtags: parseStringArray(raw.hashtags),
    likes: Number(raw.likes) || 0,
    dislikes: Number(raw.dislikes) || 0,
    views: Number(raw.views) || 0,
    status: String(raw.status || 'published').toLowerCase(),
  };
}

function storeFullArticleInCache(article: CatalogArticle): void {
  if (!article.id || !article.content) return;
  if (fullArticleCache.size >= MAX_FULL_CACHE_ENTRIES && !fullArticleCache.has(article.id)) {
    const oldestKey = fullArticleCache.keys().next().value;
    if (oldestKey) fullArticleCache.delete(oldestKey);
  }
  fullArticleCache.set(article.id, { post: article, cachedAt: Date.now() });
  if (article.slug) {
    fullArticleCache.set(article.slug, { post: article, cachedAt: Date.now() });
  }
}

/**
 * Tier 1: Queries Neon PostgreSQL (`articles` table) directly for published stories.
 * Automatically backs off if `NEON_DATABASE_URL` is unset or lacks SELECT grants on `articles`.
 */
async function queryPublishedArticlesFromNeon(limit = 200): Promise<CatalogArticle[]> {
  if (Date.now() < neonArticlesBlockedUntil) {
    return [];
  }
  const pool = getNeonPool();
  if (!pool) {
    return [];
  }

  try {
    const safeLimit = Math.max(1, Math.min(250, limit));
    const result = await pool.query(
      `SELECT
         id, slug, title, excerpt, content, category, hashtags,
         youtube_url, facebook_url, custom_links,
         image_url, image_url_fallback, image_urls, image_urls_fallback,
         image_position, gallery_positions, author_name,
         status, created_at, updated_at, published_at
       FROM articles
       WHERE status = 'published'
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC
       LIMIT $1`,
      [safeLimit]
    );

    const deletedIds = getDeletedArticleIds();
    const articles: CatalogArticle[] = [];
    for (const row of result.rows || []) {
      const normalized = normalizeReaderArticle(row);
      if (normalized && normalized.status === 'published' && !deletedIds.has(normalized.id)) {
        storeFullArticleInCache(normalized);
        articles.push(normalized);
      }
    }
    return articles;
  } catch (err: any) {
    const pgCode = err?.code;
    if (pgCode === '42501' || pgCode === '42P01') {
      neonArticlesBlockedUntil = Date.now() + 5 * 60 * 1000;
      if (!loggedNeonPermissionNotice) {
        loggedNeonPermissionNotice = true;
        console.warn(
          `[ArticleCatalog] Neon PostgreSQL articles query skipped (code ${pgCode}). Falling back to Cloudflare R2 / Worker.`
        );
      }
      return [];
    }
    console.debug('[ArticleCatalog] Neon feed query deferred:', err?.message || err);
    return [];
  }
}

async function querySingleArticleFromNeon(idOrSlug: string): Promise<CatalogArticle | null> {
  if (!idOrSlug || idOrSlug.length > 200 || Date.now() < neonArticlesBlockedUntil) {
    return null;
  }
  const pool = getNeonPool();
  if (!pool) {
    return null;
  }

  try {
    const result = await pool.query(
      `SELECT
         id, slug, title, excerpt, content, category, hashtags,
         youtube_url, facebook_url, custom_links,
         image_url, image_url_fallback, image_urls, image_urls_fallback,
         image_position, gallery_positions, author_name,
         status, created_at, updated_at, published_at
       FROM articles
       WHERE status = 'published' AND (id = $1 OR slug = $1)
       LIMIT 1`,
      [idOrSlug]
    );

    const row = result.rows?.[0];
    if (!row) return null;
    const normalized = normalizeReaderArticle(row);
    if (!normalized || normalized.status !== 'published') return null;
    storeFullArticleInCache(normalized);
    return normalized;
  } catch (err: any) {
    const pgCode = err?.code;
    if (pgCode === '42501' || pgCode === '42P01') {
      neonArticlesBlockedUntil = Date.now() + 5 * 60 * 1000;
    }
    return null;
  }
}

/**
 * Tier 2: Queries Cloudflare Worker D1 JSON API (`WORKER_BASE_URL/articles`), following `nextCursor`
 * up to 200 articles and ignoring HTML responses.
 */
async function queryPublishedArticlesFromWorker(): Promise<CatalogArticle[]> {
  const MAX_WORKER_ARTICLES = 200;
  const PAGE_LIMIT = 50;
  const MAX_PAGES = 20;

  try {
    const workerBase = (process.env.WORKER_BASE_URL || 'https://api.currentnews.blog').replace(/\/+$/, '');
    const deletedIds = getDeletedArticleIds();
    const articles: CatalogArticle[] = [];
    const seenIds = new Set<string>();
    const seenCursors = new Set<string>();

    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES && articles.length < MAX_WORKER_ARTICLES; page++) {
      let parsed: any;
      try {
        const url = new URL(`${workerBase}/articles`);
        url.searchParams.set('limit', String(PAGE_LIMIT));
        if (cursor) {
          url.searchParams.set('cursor', cursor);
        }

        const resp = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(4000),
        });
        const contentType = resp.headers.get('content-type') || '';
        if (!resp.ok || !contentType.includes('application/json')) {
          break;
        }
        const rawText = (await resp.text()).trim();
        if (!rawText.startsWith('{') && !rawText.startsWith('[')) {
          break;
        }
        parsed = JSON.parse(rawText);
      } catch {
        break;
      }

      const list = Array.isArray(parsed?.articles)
        ? parsed.articles
        : Array.isArray(parsed)
        ? parsed
        : [];

      if (list.length === 0) {
        break;
      }

      for (const item of list) {
        if (articles.length >= MAX_WORKER_ARTICLES) break;
        const normalized = normalizeReaderArticle(item);
        if (
          normalized &&
          normalized.status === 'published' &&
          !deletedIds.has(normalized.id) &&
          !seenIds.has(normalized.id)
        ) {
          seenIds.add(normalized.id);
          if (normalized.content) storeFullArticleInCache(normalized);
          articles.push(normalized);
        }
      }

      const nextCursor = typeof parsed?.nextCursor === 'string' ? parsed.nextCursor.trim() : '';
      if (!nextCursor || seenCursors.has(nextCursor) || articles.length >= MAX_WORKER_ARTICLES) {
        break;
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    return articles;
  } catch {
    return [];
  }
}

function mergeAndSortCatalog(...lists: CatalogArticle[][]): CatalogArticle[] {
  const deletedIds = getDeletedArticleIds();
  const byId = new Map<string, CatalogArticle>();

  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id || deletedIds.has(item.id) || item.status !== 'published') {
        continue;
      }
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, item);
      } else {
        byId.set(item.id, {
          ...existing,
          content: existing.content || item.content || '',
          excerpt: existing.excerpt || item.excerpt || '',
          imageUrl: existing.imageUrl || item.imageUrl || '',
          imageUrlFallback: existing.imageUrlFallback || item.imageUrlFallback || '',
          imageUrls: existing.imageUrls.length > 0 ? existing.imageUrls : item.imageUrls,
        });
      }
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => toEpochMs(b.createdAt) - toEpochMs(a.createdAt)
  );
}

/**
 * Returns the merged, deduplicated published articles catalog with single-flight stampede protection.
 */
export async function getPublishedFeedCatalog(): Promise<CatalogArticle[]> {
  const now = Date.now();
  const deletedIds = getDeletedArticleIds();

  if (cachedFeed.length > 0 && now - cachedFeedAt < cachedFeedTtl) {
    return cachedFeed.filter((p) => p && p.id && !deletedIds.has(p.id));
  }

  if (inFlightFeedPromise) {
    return inFlightFeedPromise;
  }

  inFlightFeedPromise = (async () => {
    try {
      // Authoritative Neon PostgreSQL + Worker D1 API + R2 feed index in parallel
      const [neonArticles, workerArticles, rawR2Feed] = await Promise.all([
        queryPublishedArticlesFromNeon(200),
        queryPublishedArticlesFromWorker().catch(() => []),
        getFeedFromR2().catch(() => []),
      ]);

      const normalizedR2 = (Array.isArray(rawR2Feed) ? rawR2Feed : [])
        .map(normalizeReaderArticle)
        .filter((p): p is CatalogArticle => Boolean(p && p.status === 'published'));

      const localDisk = loadLocalFeed()
        .map(normalizeReaderArticle)
        .filter((p): p is CatalogArticle => Boolean(p && p.status === 'published'));

      const merged = mergeAndSortCatalog(neonArticles, workerArticles, normalizedR2, localDisk);

      if (merged.length > 0) {
        cachedFeed = merged;
        cachedFeedAt = Date.now();
        cachedFeedTtl = CATALOG_TTL_MS;
      }

      return merged;
    } finally {
      inFlightFeedPromise = null;
    }
  })();

  return inFlightFeedPromise;
}

/**
 * Resolves a single published full article by ID or slug across:
 *   1. Fresh in-memory full-article cache
 *   2. Neon PostgreSQL (`articles` table)
 *   3. Cloudflare Edge Worker (`WORKER_BASE_URL/articles/:id`)
 *   4. Cloudflare R2 (`media.currentnews.blog/articles/:id.json` & local disk)
 */
export async function getPublishedArticleById(idOrSlug: string): Promise<CatalogArticle | null> {
  const cleanId = String(idOrSlug || '').trim();
  if (!cleanId || cleanId.length > 200) return null;

  const deletedIds = getDeletedArticleIds();
  if (deletedIds.has(cleanId)) return null;

  // 1. Check fresh in-memory full-article cache
  const mem = fullArticleCache.get(cleanId);
  if (mem && mem.post.content && Date.now() - mem.cachedAt < CATALOG_TTL_MS) {
    if (!deletedIds.has(mem.post.id) && mem.post.status === 'published') {
      return mem.post;
    }
  }

  // 2. Query Neon PostgreSQL source of truth
  const fromNeon = await querySingleArticleFromNeon(cleanId);
  if (fromNeon && fromNeon.content && !deletedIds.has(fromNeon.id)) {
    return fromNeon;
  }

  // 3. Query Cloudflare Worker D1 endpoint
  try {
    const workerBase = (process.env.WORKER_BASE_URL || 'https://api.currentnews.blog').replace(/\/+$/, '');
    const resp = await fetch(`${workerBase}/articles/${encodeURIComponent(cleanId)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      const rawText = (await resp.text()).trim();
      if (rawText.startsWith('{')) {
        const json = JSON.parse(rawText);
        const norm = normalizeReaderArticle(json?.article || json);
        if (norm && norm.content && norm.status === 'published' && !deletedIds.has(norm.id)) {
          storeFullArticleInCache(norm);
          return norm;
        }
      }
    }
  } catch {
    // Fall through to R2 / disk
  }

  // 4. Query Cloudflare R2 CDN (`media.currentnews.blog/articles/:id.json`) & local disk
  try {
    const r2Raw = await getArticleFromR2(cleanId);
    const norm = normalizeReaderArticle(r2Raw);
    if (norm && norm.content && norm.status === 'published' && !deletedIds.has(norm.id)) {
      storeFullArticleInCache(norm);
      return norm;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Warms the server-side published feed cache on startup so the first reader gets a ~5ms response.
 */
export async function warmupArticleCatalog(): Promise<void> {
  try {
    const feed = await getPublishedFeedCatalog();
    console.log(
      `[ArticleCatalog] Reader catalog primed with ${feed.length} published dispatches ready for instant delivery.`
    );
  } catch (err: any) {
    console.warn('[ArticleCatalog] Startup warmup deferred:', err?.message || err);
  }
}
