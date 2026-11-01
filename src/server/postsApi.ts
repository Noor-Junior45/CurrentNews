import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { cleanImageUrl, getFallbackImageUrl } from '../utils/imageUrl.js';
import { getFeedFromR2, getArticleFromR2 } from './r2Articles.js';

interface CachedPost {
  id: string;
  title: string;
  content: string;
  category?: string;
  authorName?: string;
  authorEmail?: string;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string;
  imageUrlFallback?: string;
  imageUrls?: string[];
  imageUrlsFallback?: string[];
  imagePosition?: string;
  galleryPositions?: string[];
  youtubeUrl?: string;
  facebookUrl?: string;
  customLinks?: string[];
  hashtags?: string[];
  likes?: number;
  dislikes?: number;
  views?: number;
  status?: string;
}

// In-memory server cache to maximize phone loading speed and prevent Firestore read quota exhaustion
let inMemoryPostsCache: CachedPost[] = [];
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache TTL

function getFirestoreConfig() {
  let fbConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('[Posts API] Failed to parse firebase-applet-config.json:', e);
  }

  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || fbConfig.projectId || 'gen-lang-client-0638643565',
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || fbConfig.firestoreDatabaseId || 'ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4',
    apiKey: process.env.VITE_FIREBASE_API_KEY || fbConfig.apiKey || ''
  };
}

function parseFirestoreField(field: any): any {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return parseInt(field.integerValue, 10);
  if (field.doubleValue !== undefined) return parseFloat(field.doubleValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.arrayValue !== undefined) {
    return (field.arrayValue.values || []).map(parseFirestoreField);
  }
  if (field.mapValue !== undefined) {
    const obj: any = {};
    const fields = field.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      obj[key] = parseFirestoreField(fields[key]);
    }
    return obj;
  }
  return null;
}

function parseFirestoreDoc(doc: any): CachedPost | null {
  if (!doc || !doc.fields) return null;
  const nameParts = (doc.name || '').split('/');
  const id = nameParts[nameParts.length - 1] || '';
  if (!id) return null;

  const fields = doc.fields;
  const post: CachedPost = {
    id,
    title: parseFirestoreField(fields.title) || 'Untitled Dispatch',
    content: parseFirestoreField(fields.content) || '',
    category: parseFirestoreField(fields.category) || 'General',
    authorName: parseFirestoreField(fields.authorName) || 'Current News',
    authorEmail: parseFirestoreField(fields.authorEmail) || '',
    authorId: parseFirestoreField(fields.authorId) || '',
    createdAt: parseFirestoreField(fields.createdAt) || new Date().toISOString(),
    updatedAt: parseFirestoreField(fields.updatedAt) || undefined,
    imageUrl: parseFirestoreField(fields.imageUrl) || '',
    imageUrlFallback: parseFirestoreField(fields.imageUrlFallback) || '',
    imageUrls: parseFirestoreField(fields.imageUrls) || [],
    imageUrlsFallback: parseFirestoreField(fields.imageUrlsFallback) || [],
    imagePosition: parseFirestoreField(fields.imagePosition) || 'top',
    galleryPositions: parseFirestoreField(fields.galleryPositions) || [],
    youtubeUrl: parseFirestoreField(fields.youtubeUrl) || '',
    facebookUrl: parseFirestoreField(fields.facebookUrl) || '',
    customLinks: parseFirestoreField(fields.customLinks) || [],
    hashtags: parseFirestoreField(fields.hashtags) || [],
    likes: parseFirestoreField(fields.likes) || 0,
    dislikes: parseFirestoreField(fields.dislikes) || 0,
    views: parseFirestoreField(fields.views) || 0,
    status: parseFirestoreField(fields.status) || 'published'
  };

  post.imageUrl = cleanImageUrl(post.imageUrl);
  post.imageUrlFallback = getFallbackImageUrl(post.imageUrl, post.imageUrlFallback);

  return post;
}

async function fetchAllPostsFromFirestore(): Promise<CachedPost[]> {
  const config = getFirestoreConfig();
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery?key=${config.apiKey}`;

  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'posts' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'published' }
        }
      },
      orderBy: [
        {
          field: { fieldPath: 'createdAt' },
          direction: 'DESCENDING'
        }
      ],
      limit: 100
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[Posts API] Firestore returned non-OK status:', response.status, errText);
      return inMemoryPostsCache; // Fallback to stale cache if quota or network issue
    }

    const data = await response.json();
    const parsedPosts: CachedPost[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.document) {
          const p = parseFirestoreDoc(item.document);
          if (p) parsedPosts.push(p);
        }
      }
    }

    if (parsedPosts.length > 0) {
      inMemoryPostsCache = parsedPosts;
      lastCacheTimestamp = Date.now();
    }

    return inMemoryPostsCache;
  } catch (err) {
    clearTimeout(timeout);
    console.warn('[Posts API] Network fetch error, serving memory cache:', err);
    return inMemoryPostsCache;
  }
}

/**
 * GET /api/posts
 * Fast chunked articles API for mobile phones and web.
 * Supports:
 * - limit: Number of articles per chunk (e.g. 10 on phones)
 * - page: 1-indexed page number
 * - category: Optional category filter
 * - search: Optional search text
 */
export async function handleGetPosts(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  // Check if cache needs refreshing from Cloudflare R2 first
  const now = Date.now();
  try {
    const r2Posts = await getFeedFromR2();
    if (r2Posts && Array.isArray(r2Posts) && r2Posts.length > 0) {
      inMemoryPostsCache = r2Posts;
      lastCacheTimestamp = now;
    } else if (inMemoryPostsCache.length === 0 || now - lastCacheTimestamp > CACHE_TTL_MS) {
      // Fallback to Firestore only if R2 is completely empty
      await fetchAllPostsFromFirestore();
    }
  } catch (r2Err) {
    console.debug('[Posts API] R2 read deferred:', r2Err);
    if (inMemoryPostsCache.length === 0 || now - lastCacheTimestamp > CACHE_TTL_MS) {
      await fetchAllPostsFromFirestore();
    }
  }

  let posts = [...inMemoryPostsCache];

  // Apply category filtering
  const category = (req.query.category as string || '').trim().toLowerCase();
  if (category && category !== 'all') {
    posts = posts.filter(p => (p.category || 'General').toLowerCase() === category);
  }

  // Apply search filtering
  const search = (req.query.search as string || '').trim().toLowerCase();
  if (search) {
    posts = posts.filter(p => {
      const titleMatch = (p.title || '').toLowerCase().includes(search);
      const tagMatch = (p.hashtags || []).some(t => t.toLowerCase().includes(search));
      const contentMatch = (p.content || '').toLowerCase().includes(search);
      return titleMatch || tagMatch || contentMatch;
    });
  }

  // Parse chunk / pagination parameters
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string, 10) || 10)); // Default 10 per chunk on mobile
  const offset = (page - 1) * limit;

  const chunk = posts.slice(offset, offset + limit);
  const hasMore = offset + limit < posts.length;

  return res.status(200).json({
    success: true,
    posts: chunk,
    total: posts.length,
    page,
    limit,
    hasMore,
    fromCache: now - lastCacheTimestamp < CACHE_TTL_MS
  });
}

/**
 * GET /api/posts/:id
 * Fast single article endpoint with Cloudflare R2 and in-memory caching.
 */
export async function handleGetPostById(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  // 1. Check in-memory cache first
  let post = inMemoryPostsCache.find(p => p.id === id);

  // 2. Check Cloudflare R2
  if (!post) {
    try {
      post = await getArticleFromR2(id);
    } catch (e) {}
  }

  // 3. Fallback to Firestore only if missing from R2
  if (!post) {
    await fetchAllPostsFromFirestore();
    post = inMemoryPostsCache.find(p => p.id === id);
  }

  if (!post) {
    return res.status(404).json({ error: 'Article not found' });
  }

  return res.status(200).json({
    success: true,
    post
  });
}

/**
 * GET /api/writers
 * Returns the configurable editorial writer bylines from environment variables.
 */
export async function handleGetWriters(_req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const envVal = process.env.VITE_WRITERS || process.env.WRITERS || '';
  let writers: string[] = [];

  if (envVal.trim().length > 0) {
    writers = envVal
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);
  }

  if (writers.length === 0) {
    writers = [
      'Current News',
      'Current News Staff Report',
      'Investigative Editorial Bureau',
      'Chief Political Correspondent',
      'Technology & Science Desk',
      'Global Affairs Dispatch',
      'Chronicle Desk'
    ];
  }

  return res.status(200).json({
    success: true,
    writers
  });
}
