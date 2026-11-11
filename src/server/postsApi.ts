import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { cleanImageUrl, getFallbackImageUrl } from '../utils/imageUrl.ts';
import { getFeedFromR2, getArticleFromR2, getDeletedArticleIds, registerOnArticleDeletedHook } from './r2Articles.ts';

interface CachedPost {
  id: string;
  title: string;
  content: string;
  category?: string;
  authorName?: string;
  authorEmail?: string;
  authorId?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
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
  excerpt?: string;
  slug?: string;
}

function parseJsonArray(val: any): string[] {
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
}

function mapD1ArticleToPost(a: any): CachedPost {
  if (!a) return {} as CachedPost;
  return {
    ...a,
    id: a.id,
    slug: a.slug,
    title: a.title || '',
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
    createdAt: a.createdAt ?? a.created_at ?? a.publishedAt ?? a.published_at ?? Date.now(),
    updatedAt: a.updatedAt ?? a.updated_at ?? Date.now(),
    status: 'published',
    views: Number(a.views) || 0,
    likes: Number(a.likes) || 0,
    dislikes: Number(a.dislikes) || 0,
  };
}

// In-memory server cache to maximize phone loading speed and avoid redundant R2 reads
let inMemoryPostsCache: CachedPost[] = [];
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache TTL

// Register observer hook to invalidate cache when an article is deleted
registerOnArticleDeletedHook(() => {
  inMemoryPostsCache = [];
  lastCacheTimestamp = 0;
});

export function invalidatePostsCache(): void {
  inMemoryPostsCache = [];
  lastCacheTimestamp = 0;
}

function getDiskFeed(): CachedPost[] {
  try {
    const feedFile = path.join(process.cwd(), 'data', 'feed.json');
    if (fs.existsSync(feedFile)) {
      const data = JSON.parse(fs.readFileSync(feedFile, 'utf-8'));
      if (Array.isArray(data)) {
        const deletedIds = getDeletedArticleIds();
        return data.filter(p => p && p.id && !deletedIds.has(p.id) && (p.status || 'published').toLowerCase() === 'published');
      }
    }
  } catch (e) {
    console.warn('[Posts API] Failed to read disk feed fallback:', e);
  }
  return [];
}

function getDiskArticle(id: string): CachedPost | null {
  try {
    const postFile = path.join(process.cwd(), 'data', 'articles', `${id}.json`);
    if (fs.existsSync(postFile)) {
      const data = JSON.parse(fs.readFileSync(postFile, 'utf-8'));
      if (data && (data.status || 'published').toLowerCase() === 'published') {
        return data;
      }
    }
  } catch (e) {
    console.warn(`[Posts API] Failed to read disk article ${id}:`, e);
  }
  return null;
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
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    const now = Date.now();
    if (inMemoryPostsCache.length === 0 || now - lastCacheTimestamp > CACHE_TTL_MS) {
      let loadedPosts: CachedPost[] = [];

      try {
        const r2Posts = await getFeedFromR2();
        if (r2Posts && Array.isArray(r2Posts) && r2Posts.length > 0) {
          loadedPosts = r2Posts;
        }
      } catch (r2Err) {
        console.debug('[Posts API] R2 read deferred:', r2Err);
      }

      if (loadedPosts.length === 0) {
        const diskPosts = getDiskFeed();
        if (diskPosts && diskPosts.length > 0) {
          loadedPosts = diskPosts;
        }
      }

      // If R2 and disk return no articles, fall back to the Worker's GET /articles list
      if (loadedPosts.length === 0) {
        try {
          const workerBase = (process.env.WORKER_BASE_URL || 'https://api.currentnews.blog').replace(/\/+$/, '');
          const resp = await fetch(`${workerBase}/articles?limit=100`, {
            signal: AbortSignal.timeout(4000),
          });
          if (resp.ok) {
            const json = await resp.json() as any;
            const rawArticles = Array.isArray(json?.articles)
              ? json.articles
              : (Array.isArray(json) ? json : []);
            const mapped = rawArticles
              .map(mapD1ArticleToPost)
              .filter((p: CachedPost) => p && p.id && (p.status || 'published').toLowerCase() === 'published');
            if (mapped.length > 0) {
              loadedPosts = mapped;
            }
          }
        } catch (workerErr) {
          console.debug('[Posts API] Worker feed fallback deferred:', workerErr);
        }
      }

      if (loadedPosts.length > 0) {
        inMemoryPostsCache = loadedPosts;
        lastCacheTimestamp = now;
      }
    }

    const deletedIds = getDeletedArticleIds();
    let posts = inMemoryPostsCache.filter(p => p && p.id && !deletedIds.has(p.id) && (p.status || 'published').toLowerCase() === 'published');

  // Apply category filtering with smart Devanagari and regional keyword recognition
  const category = (req.query.category as string || '').trim().toLowerCase();
  if (category && category !== 'all') {
    if (category === 'jharkhand') {
      const jhRegex = /jharkhand|ranchi|dhanbad|jamshedpur|bokaro|godda|deoghar|dumka|basantrai|hanwara|mahagama|झारखंड|गोड्डा|रांची|धनबाद|जमशेदपुर|बोकारो|देवघर|दुमका|बसंतराय|हनवारा|महागामा|पथरगामा|साहिबगंज|पाकुड़|हजारीबाग|पलामू|गढ़वा|चतरा|कोडरमा|गिरिडीह|लातेहार|लोहरदगा|गुमला|सिमडेगा|खूंटी|सरायकेला|चाईबासा|चेंगाई|लायथा|पचरुखी|गोपीचक|कपेटा|नौरत्तमपुर|जामनीकोला|बेलडीहा|फूलवड़िया|सुराइकिट्टा|भुयांसी|बाघाकोल/i;
      posts = posts.filter(p => {
        const cat = (p.category || 'General').toLowerCase();
        if (cat === 'jharkhand') return true;
        const str = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.excerpt || '') + ' ' + (p.hashtags || []).join(' ')).toLowerCase();
        return jhRegex.test(str);
      });
    } else if (category === 'world') {
      const worldRegex = /world|international|विदेश|सऊदी|रियाद|हूती|बांग्लादेश|ग्लोबल|अंतरराष्ट्रीय/i;
      posts = posts.filter(p => {
        const cat = (p.category || 'General').toLowerCase();
        if (cat === 'world') return true;
        const str = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.excerpt || '') + ' ' + (p.hashtags || []).join(' ')).toLowerCase();
        return worldRegex.test(str);
      });
    } else if (category === 'national') {
      const nationalRegex = /national|india|delhi|bharat|देश|राष्ट्रीय|भारत|दिल्ली|सुप्रीम कोर्ट|संसद|विपक्ष/i;
      posts = posts.filter(p => {
        const cat = (p.category || 'General').toLowerCase();
        if (cat === 'national') return true;
        const str = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.excerpt || '') + ' ' + (p.hashtags || []).join(' ')).toLowerCase();
        return nationalRegex.test(str);
      });
    } else if (category === 'crime') {
      const crimeRegex = /crime|police|arrest|murder|fir|चोरी|पुलिस|हत्या|हादसा|गिरफ्तार|मौत|सड़क हादसा|आग|अगलगी|बवाल|डूबने|अपहरण/i;
      posts = posts.filter(p => {
        const cat = (p.category || 'General').toLowerCase();
        if (cat === 'crime') return true;
        const str = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.excerpt || '') + ' ' + (p.hashtags || []).join(' ')).toLowerCase();
        return crimeRegex.test(str);
      });
    } else if (category === 'education') {
      const eduRegex = /education|school|college|exam|physics|smart class|पढ़ाई|स्कूल|कॉलेज|परीक्षा|कक्षा|विद्यार्थी|छात्र|क्लास/i;
      posts = posts.filter(p => {
        const cat = (p.category || 'General').toLowerCase();
        if (cat === 'education') return true;
        const str = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.excerpt || '') + ' ' + (p.hashtags || []).join(' ')).toLowerCase();
        return eduRegex.test(str);
      });
    } else if (category === 'entertainment') {
      const entRegex = /entertainment|cinema|movie|actor|film|tiger shroff|टाइगर श्रॉफ|अभिनेता|फिल्म|सिनेमा/i;
      posts = posts.filter(p => {
        const cat = (p.category || 'General').toLowerCase();
        if (cat === 'entertainment') return true;
        const str = ((p.title || '') + ' ' + (p.content || '') + ' ' + (p.excerpt || '') + ' ' + (p.hashtags || []).join(' ')).toLowerCase();
        return entRegex.test(str);
      });
    } else {
      posts = posts.filter(p => (p.category || 'General').toLowerCase() === category);
    }
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
  const limitParam = req.query.limit as string;
  const limit = limitParam === 'all'
    ? (posts.length || 100)
    : Math.max(1, Math.min(200, parseInt(limitParam, 10) || 100));
  const offset = (page - 1) * limit;

  const chunk = posts.slice(offset, offset + limit).map(p => {
    const cleanImg = cleanImageUrl(p.imageUrl);
    return {
      ...p,
      imageUrl: cleanImg,
      imageUrlFallback: getFallbackImageUrl(cleanImg, p.imageUrlFallback),
      imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls.map(cleanImageUrl) : []
    };
  });
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
  } catch (err) {
    console.warn('[Posts API] Error in handleGetPosts:', err);
    return res.status(200).json({
      success: true,
      posts: [],
      total: 0,
      page: 1,
      limit: 100,
      hasMore: false,
      fromCache: false
    });
  }
}

/**
 * GET /api/posts/:id
 * Fast single article endpoint with:
 * (a) in-memory cache
 * (b) Cloudflare Worker at WORKER_BASE_URL or https://api.currentnews.blog (4s timeout)
 * (c) Cloudflare R2 and disk as last fallback
 * Only returns articles with status "published". Never returns 500 for missing articles.
 */
export async function handleGetPostById(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    const deletedIds = getDeletedArticleIds();
    if (deletedIds.has(id)) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

    let post: CachedPost | undefined;

    // (a) In-memory cache
    const cached = inMemoryPostsCache.find(p => p.id === id);
    if (cached && cached.content && (cached.status || 'published').toLowerCase() === 'published') {
      post = cached;
    }

    // (b) The Worker at WORKER_BASE_URL or https://api.currentnews.blog, using GET /articles/:id with a 4 second timeout
    if (!post) {
      try {
        const workerBase = (process.env.WORKER_BASE_URL || 'https://api.currentnews.blog').replace(/\/+$/, '');
        const resp = await fetch(`${workerBase}/articles/${encodeURIComponent(id)}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          const json = await resp.json() as any;
          const rawArticle = json?.article || json;
          if (rawArticle && rawArticle.id && !deletedIds.has(rawArticle.id)) {
            const rawStatus = (rawArticle.status || 'published').toLowerCase();
            if (rawStatus === 'published') {
              post = mapD1ArticleToPost(rawArticle);
            }
          }
        }
      } catch (workerErr) {
        console.debug('[Posts API] Worker article fetch deferred/failed:', workerErr);
      }
    }

    // (c) R2/disk as the last fallback
    if (!post) {
      try {
        const r2Post = await getArticleFromR2(id);
        if (r2Post && !deletedIds.has(r2Post.id)) {
          const rawStatus = (r2Post.status || 'published').toLowerCase();
          if (rawStatus === 'published' && r2Post.content) {
            post = r2Post;
          }
        }
      } catch (e) {
        console.debug('[Posts API] R2 single article fetch deferred:', e);
      }
    }

    if (!post) {
      const diskPost = getDiskArticle(id);
      if (diskPost && !deletedIds.has(diskPost.id)) {
        const rawStatus = (diskPost.status || 'published').toLowerCase();
        if (rawStatus === 'published' && diskPost.content) {
          post = diskPost;
        }
      }
    }

    if (!post || deletedIds.has(post.id) || (post.status && post.status.toLowerCase() !== 'published')) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Ensure image URLs are clean
    post.imageUrl = cleanImageUrl(post.imageUrl);
    post.imageUrlFallback = getFallbackImageUrl(post.imageUrl, post.imageUrlFallback);

    return res.status(200).json({
      success: true,
      post
    });
  } catch (error) {
    console.warn('[Posts API] Error in handleGetPostById:', error);
    return res.status(404).json({ success: false, error: 'Article not found' });
  }
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
