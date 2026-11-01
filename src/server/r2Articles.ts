import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { cleanImageUrl } from '../utils/imageUrl.js';

let s3Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      },
    });
  }
  return s3Client;
}

function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || 'currentnews-media';
}

function getLocalDataDir(): string {
  const dir = path.join(process.cwd(), 'data', 'articles');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Graceful fallback
  }
  return dir;
}

// In-memory feed cache for instantaneous (0ms) responses
let inMemoryFeedCache: any[] = [];
let inMemoryFeedTimestamp = 0;
const FEED_CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Load feed from local backup disk cache on startup
 */
function loadLocalFeed(): any[] {
  try {
    const feedFile = path.join(process.cwd(), 'data', 'feed.json');
    if (fs.existsSync(feedFile)) {
      const content = fs.readFileSync(feedFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.debug('[R2 Articles] Local feed cache read error:', err);
  }
  return [];
}

/**
 * Save article JSON directly to Cloudflare R2 and local mirror
 */
export async function saveArticleToR2(post: any): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!post || !post.id) {
    return { success: false, error: 'Invalid post object' };
  }

  // Ensure default author name is Current News
  if (!post.authorName || !post.authorName.trim()) {
    post.authorName = 'Current News';
  }

  // 1. Save to local disk cache for instant fallback
  try {
    const localDir = getLocalDataDir();
    const filePath = path.join(localDir, `${post.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(post, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[R2 Articles] Failed to save local article backup:', err);
  }

  // 2. Upload article JSON to Cloudflare R2
  const client = getR2Client();
  const bucket = getR2BucketName();
  const r2Key = `articles/${post.id}.json`;

  if (client) {
    try {
      const bodyBuffer = Buffer.from(JSON.stringify(post), 'utf-8');
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: bodyBuffer,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      }));
      console.log(`[R2 Articles] Successfully saved article ${post.id} to Cloudflare R2`);
    } catch (r2Err: any) {
      console.warn(`[R2 Articles] S3 PutObject failed for ${post.id}, fallback will serve local mirror:`, r2Err?.message || r2Err);
    }
  }

  // 3. Update the aggregated feed.json in R2
  await updateFeedIndexInR2(post);

  const customDomain = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
  const publicUrl = `https://${customDomain}/${r2Key}`;

  return { success: true, url: publicUrl };
}

/**
 * Update the public aggregated feed in Cloudflare R2 and memory
 */
async function updateFeedIndexInR2(updatedPost: any): Promise<void> {
  try {
    let feed = inMemoryFeedCache.length > 0 ? [...inMemoryFeedCache] : loadLocalFeed();
    
    // Upsert or remove if draft
    const existingIndex = feed.findIndex(p => p.id === updatedPost.id);
    if (updatedPost.status === 'draft') {
      if (existingIndex >= 0) {
        feed.splice(existingIndex, 1);
      }
    } else {
      if (existingIndex >= 0) {
        feed[existingIndex] = updatedPost;
      } else {
        feed.unshift(updatedPost);
      }
    }

    // Sort by createdAt descending
    feed.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    inMemoryFeedCache = feed;
    inMemoryFeedTimestamp = Date.now();

    // Save local feed copy
    try {
      const feedFile = path.join(process.cwd(), 'data', 'feed.json');
      fs.writeFileSync(feedFile, JSON.stringify(feed), 'utf-8');
    } catch (e) {}

    // Upload feed.json to Cloudflare R2
    const client = getR2Client();
    const bucket = getR2BucketName();
    if (client) {
      try {
        await client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: 'articles/feed.json',
          Body: Buffer.from(JSON.stringify(feed)),
          ContentType: 'application/json; charset=utf-8',
          CacheControl: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        }));
      } catch (err) {
        console.warn('[R2 Articles] Failed to update articles/feed.json on R2:', err);
      }
    }
  } catch (err) {
    console.error('[R2 Articles] Error updating feed index:', err);
  }
}

/**
 * Delete article from Cloudflare R2 and feed index
 */
export async function deleteArticleFromR2(postId: string): Promise<boolean> {
  if (!postId) return false;

  // 1. Delete from local mirror
  try {
    const localDir = getLocalDataDir();
    const filePath = path.join(localDir, `${postId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('[R2 Articles] Error unlinking local file:', err);
  }

  // 2. Delete from R2
  const client = getR2Client();
  const bucket = getR2BucketName();
  if (client) {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: `articles/${postId}.json`,
      }));
    } catch (err) {
      console.warn('[R2 Articles] Error deleting S3 object from R2:', err);
    }
  }

  // 3. Remove from in-memory and R2 feed
  inMemoryFeedCache = inMemoryFeedCache.filter(p => p.id !== postId);
  try {
    const feedFile = path.join(process.cwd(), 'data', 'feed.json');
    fs.writeFileSync(feedFile, JSON.stringify(inMemoryFeedCache), 'utf-8');
  } catch (e) {}

  if (client) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: 'articles/feed.json',
        Body: Buffer.from(JSON.stringify(inMemoryFeedCache)),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=30, s-maxage=60',
      }));
    } catch (e) {}
  }

  return true;
}

/**
 * Retrieve article JSON from R2 with local fallback
 */
export async function getArticleFromR2(postId: string): Promise<any | null> {
  if (!postId) return null;

  // 1. Check in-memory feed first
  const inMemory = inMemoryFeedCache.find(p => p.id === postId);
  if (inMemory) return inMemory;

  // 2. Check local disk mirror
  try {
    const localDir = getLocalDataDir();
    const filePath = path.join(localDir, `${postId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {}

  // 3. Check S3 R2 GetObject
  const client = getR2Client();
  const bucket = getR2BucketName();
  if (client) {
    try {
      const resp = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: `articles/${postId}.json`
      }));
      if (resp.Body) {
        const str = await resp.Body.transformToString();
        const parsed = JSON.parse(str);
        return parsed;
      }
    } catch (err) {
      // Key may not exist in R2 yet
    }
  }

  // 4. Check Public R2 CDN HTTP URL
  const customDomain = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
  const devDomain = process.env.R2_DEV_DOMAIN || 'pub-03dd1274c4824531a1478f20e0485d75.r2.dev';

  for (const domain of [customDomain, devDomain]) {
    try {
      const cdnUrl = `https://${domain}/articles/${postId}.json`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Retrieve all published articles from Cloudflare R2 (feed.json)
 */
export async function getFeedFromR2(): Promise<any[]> {
  const now = Date.now();
  if (inMemoryFeedCache.length > 0 && now - inMemoryFeedTimestamp < FEED_CACHE_TTL) {
    return inMemoryFeedCache;
  }

  // 1. Try S3 client GetObject
  const client = getR2Client();
  const bucket = getR2BucketName();
  if (client) {
    try {
      const resp = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: 'articles/feed.json'
      }));
      if (resp.Body) {
        const str = await resp.Body.transformToString();
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryFeedCache = parsed;
          inMemoryFeedTimestamp = now;
          return parsed;
        }
      }
    } catch (err) {
      // Fall through to public CDN or local cache
    }
  }

  // 2. Try Public R2 CDN
  const customDomain = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
  const devDomain = process.env.R2_DEV_DOMAIN || 'pub-03dd1274c4824531a1478f20e0485d75.r2.dev';

  for (const domain of [customDomain, devDomain]) {
    try {
      const cdnUrl = `https://${domain}/articles/feed.json`;
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          inMemoryFeedCache = data;
          inMemoryFeedTimestamp = now;
          return data;
        }
      }
    } catch (e) {}
  }

  // 3. Fallback to local disk feed
  const localFeed = loadLocalFeed();
  if (localFeed.length > 0) {
    inMemoryFeedCache = localFeed;
    inMemoryFeedTimestamp = now;
    return localFeed;
  }

  return inMemoryFeedCache;
}

/**
 * Bulk sync an array of articles into Cloudflare R2
 */
export async function syncArticlesToR2(posts: any[]): Promise<{ synced: number; total: number }> {
  if (!Array.isArray(posts) || posts.length === 0) {
    return { synced: 0, total: 0 };
  }

  let count = 0;
  for (const post of posts) {
    try {
      await saveArticleToR2(post);
      count++;
    } catch (err) {
      console.warn(`[R2 Sync] Failed to sync post ${post.id}:`, err);
    }
  }

  // Update in-memory feed
  inMemoryFeedCache = posts.filter(p => p.status !== 'draft');
  inMemoryFeedTimestamp = Date.now();

  return { synced: count, total: posts.length };
}

/**
 * Express handler for POST /api/articles/save
 */
export async function handleSaveArticle(req: Request, res: Response) {
  try {
    const post = req.body;
    if (!post || !post.title) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    if (!post.id) {
      post.id = 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
    if (!post.createdAt) {
      post.createdAt = new Date().toISOString();
    }
    post.updatedAt = new Date().toISOString();

    const result = await saveArticleToR2(post);
    return res.status(200).json({
      success: true,
      post,
      url: result.url
    });
  } catch (error: any) {
    console.error('[API /api/articles/save Error]:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save article to Cloudflare R2' });
  }
}

/**
 * Express handler for DELETE /api/articles/:id
 */
export async function handleDeleteArticle(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Article ID is required' });
    }
    await deleteArticleFromR2(id);
    return res.status(200).json({ success: true, message: 'Article deleted from Cloudflare R2' });
  } catch (error: any) {
    console.error('[API /api/articles/:id Delete Error]:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to delete article from Cloudflare R2' });
  }
}

/**
 * Express handler for POST /api/articles/sync
 * Bulk-syncs existing articles to Cloudflare R2
 */
export async function handleSyncArticles(req: Request, res: Response) {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of posts required' });
    }
    const result = await syncArticlesToR2(posts);
    return res.status(200).json({
      success: true,
      message: `Successfully synced ${result.synced} of ${result.total} articles to Cloudflare R2`,
      ...result
    });
  } catch (error: any) {
    console.error('[API /api/articles/sync Error]:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to sync articles to Cloudflare R2' });
  }
}

/**
 * Startup bootloader to ensure Cloudflare R2 articles feed is warm and all dispatches are available.
 */
export async function ensureR2ArticlesWarmup(): Promise<void> {
  try {
    const feed = await getFeedFromR2();
    console.log(`[R2 Bootloader] Cloudflare R2 feed active with ${feed.length} published articles ready for instant delivery.`);
  } catch (err) {
    console.warn('[R2 Bootloader] Warmup check deferred:', err);
  }
}

