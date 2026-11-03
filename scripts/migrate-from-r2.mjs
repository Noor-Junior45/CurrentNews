#!/usr/bin/env node

/**
 * scripts/migrate-from-r2.mjs
 *
 * Cloudflare R2 Article & Image Migration Tool
 *
 * Requirements:
 * 1. Reads R2_* credentials from .env via dotenv.
 * 2. Lists every articles/*.json in the bucket (ignoring articles/feed.json).
 * 3. Downloads each article, finds base64 images in imageUrl, imageUrlFallback,
 *    imageUrls, imageUrlsFallback, and <img src="data:..."> inside content.
 * 4. Uploads each decoded image to R2 as img/{postId}-{n}.webp with
 *    Cache-Control: public, max-age=31536000, immutable.
 * 5. Sends a HEAD request to https://media.currentnews.blog/img/... and aborts if not 200.
 * 6. Writes the cleaned full article back to articles/{id}.json.
 * 7. Rebuilds articles/feed.json as a light index (id, title, category, authorName,
 *    createdAt, status, imageUrl, hashtags, likes, dislikes, views, excerpt)
 *    with no content and no base64.
 * 8. Supports --dry-run that prints what would change and the final feed.json size.
 * 9. Prints summary at the end: articles processed, images uploaded, feed.json size in KB.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

// Load .env from project root
dotenv.config();
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const isDryRun = process.argv.includes('--dry-run');

// Parse arguments
console.log('='.repeat(65));
console.log(' CURRENT NEWS - Cloudflare R2 Article & Image Migration');
console.log(' Mode:', isDryRun ? 'DRY-RUN (No writes will be made)' : 'LIVE EXECUTION');
console.log('='.repeat(65));

// 1. Validate R2 credentials
const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const bucketName = (process.env.R2_BUCKET_NAME || 'currentnews-media').trim();
const customDomain = (process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog').trim();

function getPublicBase() {
  const raw = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
  let host = raw.trim().replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].split('?')[0].split('#')[0].trim();
  return `https://${host || 'media.currentnews.blog'}`;
}

const publicBaseUrl = getPublicBase();

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('\n[ERROR] Missing required R2 credentials in environment or .env:');
  console.error('  - R2_ACCOUNT_ID:', accountId ? 'OK' : 'MISSING');
  console.error('  - R2_ACCESS_KEY_ID:', accessKeyId ? 'OK' : 'MISSING');
  console.error('  - R2_SECRET_ACCESS_KEY:', secretAccessKey ? 'OK' : 'MISSING');
  console.error('\nPlease define these variables in .env before running this script.');
  process.exit(1);
}

const endpoint = process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Strips HTML tags and base64 strings to generate ~200-char plain text excerpt
 */
function extractPlainExcerpt(htmlOrText, maxLength = 200) {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  const stripped = htmlOrText
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxLength ? stripped.slice(0, maxLength).trim() + '...' : stripped;
}

/**
 * Sanitizes image URL: fixes double protocols, accidental /uploads/.../img/ paths, and trailing base64
 */
function cleanImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const cleaned = url.trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('data:image/') || cleaned.startsWith('blob:')) return cleaned;

  let formatted = cleaned.replace(/^(?:https?[:/]*)+/i, 'https://');
  formatted = formatted.replace(/\/uploads\/[^/]+\.(?:jpe?g|png|webp|gif|svg)\/uploads\//gi, '/uploads/');
  formatted = formatted.replace(/\/uploads\/[^/]+\.(?:jpe?g|png|webp|gif|svg)\/img\//gi, '/img/');
  formatted = formatted.replace(/\/uploads\/uploads\//gi, '/uploads/');
  formatted = formatted.replace(/(https?:\/\/)|(\/+)/g, (match, protocol) => protocol ? protocol : '/');
  return formatted;
}

/**
 * Transforms article to light feed index entry
 */
function toLightArticle(post) {
  if (!post || !post.id) return null;
  return {
    id: post.id,
    title: post.title || '',
    category: post.category || 'General',
    authorName: post.authorName || 'Current News',
    createdAt: post.createdAt || new Date().toISOString(),
    status: post.status || 'published',
    imageUrl: cleanImageUrl(post.imageUrl),
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    likes: typeof post.likes === 'number' ? post.likes : 0,
    dislikes: typeof post.dislikes === 'number' ? post.dislikes : 0,
    views: typeof post.views === 'number' ? post.views : 0,
    excerpt: post.excerpt || extractPlainExcerpt(post.content || ''),
  };
}

/**
 * Decodes and uploads base64 image to R2, then verifies with a public HEAD request
 */
async function uploadAndVerifyImage(key, base64DataUrl) {
  const match = base64DataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    return cleanImageUrl(base64DataUrl);
  }

  const rawFormat = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const contentType = key.endsWith('.webp') ? 'image/webp' : (rawFormat === 'png' ? 'image/png' : 'image/jpeg');
  const publicUrl = `${publicBaseUrl}/${key}`;

  if (isDryRun) {
    console.log(`    [DRY-RUN] Would upload ${key} (${Math.round(buffer.length / 1024)} KB) -> ${publicUrl}`);
    return publicUrl;
  }

  // 1. Upload to Cloudflare R2 with immutable cache headers
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  // Also save to local mirror in data/img
  try {
    const localImgDir = path.join(process.cwd(), 'data', 'img');
    if (!fs.existsSync(localImgDir)) fs.mkdirSync(localImgDir, { recursive: true });
    fs.writeFileSync(path.join(localImgDir, path.basename(key)), buffer);
  } catch (e) {}

  // 2. Perform HEAD check to guarantee image is live on R2 CDN
  console.log(`    Checking HEAD ${publicUrl}...`);
  try {
    const res = await fetch(publicUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    if (res.status !== 200) {
      throw new Error(`Public HEAD returned status ${res.status} (${res.statusText})`);
    }
    console.log(`    ✓ HEAD 200 OK verified for ${publicUrl}`);
  } catch (headErr) {
    console.error(`\n[FATAL ABORT] Image uploaded to R2 as '${key}' failed public verification at '${publicUrl}'.`);
    console.error(`Error: ${headErr.message}`);
    console.error('Aborting migration to prevent article from pointing to non-live image URL.\n');
    throw headErr;
  }

  return publicUrl;
}

/**
 * Scan all article fields for base64 images, decode and upload each, repair corrupted URLs
 */
async function processArticleImages(post) {
  const postId = String(post.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  let migratedCount = 0;
  let counter = 1;
  let modified = false;

  // Repair corrupted /uploads/.../img/ paths in post fields
  if (typeof post.imageUrl === 'string' && post.imageUrl.includes('/uploads/') && post.imageUrl.includes('/img/')) {
    post.imageUrl = cleanImageUrl(post.imageUrl);
    modified = true;
  }
  if (typeof post.imageUrlFallback === 'string' && post.imageUrlFallback.includes('/uploads/') && post.imageUrlFallback.includes('/img/')) {
    post.imageUrlFallback = cleanImageUrl(post.imageUrlFallback);
    modified = true;
  }

  // 1. Scan imageUrl
  if (typeof post.imageUrl === 'string' && post.imageUrl.includes('data:image/')) {
    const match = post.imageUrl.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
    if (match) {
      const key = `img/${postId}-${counter++}.webp`;
      post.imageUrl = await uploadAndVerifyImage(key, match[0]);
      migratedCount++;
      modified = true;
    }
  }

  // 2. Scan imageUrlFallback
  if (typeof post.imageUrlFallback === 'string' && post.imageUrlFallback.includes('data:image/')) {
    const match = post.imageUrlFallback.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
    if (match) {
      const key = `img/${postId}-${counter++}.webp`;
      post.imageUrlFallback = await uploadAndVerifyImage(key, match[0]);
      migratedCount++;
      modified = true;
    }
  }

  // 3. Scan imageUrls array
  if (Array.isArray(post.imageUrls)) {
    const updated = [];
    for (let u of post.imageUrls) {
      if (typeof u === 'string') {
        if (u.includes('/uploads/') && u.includes('/img/')) {
          u = cleanImageUrl(u);
          modified = true;
        }
        if (u.includes('data:image/')) {
          const match = u.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
          if (match) {
            const key = `img/${postId}-${counter++}.webp`;
            u = await uploadAndVerifyImage(key, match[0]);
            migratedCount++;
            modified = true;
          }
        }
        updated.push(cleanImageUrl(u));
      }
    }
    post.imageUrls = updated;
  }

  // 4. Scan imageUrlsFallback array
  if (Array.isArray(post.imageUrlsFallback)) {
    const updated = [];
    for (let u of post.imageUrlsFallback) {
      if (typeof u === 'string') {
        if (u.includes('/uploads/') && u.includes('/img/')) {
          u = cleanImageUrl(u);
          modified = true;
        }
        if (u.includes('data:image/')) {
          const match = u.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/);
          if (match) {
            const key = `img/${postId}-${counter++}.webp`;
            u = await uploadAndVerifyImage(key, match[0]);
            migratedCount++;
            modified = true;
          }
        }
        updated.push(cleanImageUrl(u));
      }
    }
    post.imageUrlsFallback = updated;
  }

  // 5. Scan <img src="data:..."> inside content
  if (typeof post.content === 'string') {
    // Repair corrupted /uploads/.../img/ in content
    if (post.content.includes('/uploads/') && post.content.includes('/img/')) {
      post.content = post.content.replace(
        /https:\/\/(?:https\/\/)?media\.currentnews\.blog\/uploads\/[^"'\s]+\/img\//gi,
        `${publicBaseUrl}/img/`
      );
      modified = true;
    }

    if (post.content.includes('data:image/')) {
      const regex = /src=["'](data:image\/[a-zA-Z0-9+.-]+;base64,[^"']+)["']/g;
      let m;
      const matches = [];
      while ((m = regex.exec(post.content)) !== null) {
        matches.push(m[1]);
      }

      for (const dataUrl of matches) {
        const key = `img/${postId}-${counter++}.webp`;
        const uploadedUrl = await uploadAndVerifyImage(key, dataUrl);
        post.content = post.content.split(dataUrl).join(uploadedUrl);
        migratedCount++;
        modified = true;
      }
    }
  }

  // Extract excerpt if missing
  if (!post.excerpt) {
    post.excerpt = extractPlainExcerpt(post.content || '');
    modified = true;
  }

  return { post, migratedCount, modified };
}

/**
 * Main migration executor
 */
async function main() {
  console.log(`Connecting to Cloudflare R2 bucket: '${bucketName}' at '${endpoint}'...`);
  console.log(`Public media domain: ${publicBaseUrl}`);

  // List all articles in bucket under articles/
  let continuationToken = undefined;
  const articleKeys = [];

  try {
    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'articles/',
        ContinuationToken: continuationToken,
      });

      const listRes = await s3Client.send(listCmd);
      if (listRes.Contents) {
        for (const item of listRes.Contents) {
          if (!item.Key) continue;
          // Ignore articles/feed.json
          if (item.Key === 'articles/feed.json') continue;
          if (item.Key.endsWith('.json')) {
            articleKeys.push(item.Key);
          }
        }
      }
      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);
    console.log(`Found ${articleKeys.length} article objects in R2 bucket.`);
  } catch (listErr) {
    if (isDryRun) {
      console.warn(`[DRY-RUN NOTICE] Could not connect to R2 bucket '${bucketName}' (${listErr.message}). Checking local data/articles for dry-run analysis.`);
    } else {
      throw listErr;
    }
  }

  // Also check local data/articles mirror for any articles not yet in R2
  const localDir = path.join(process.cwd(), 'data', 'articles');
  if (fs.existsSync(localDir)) {
    const localFiles = fs.readdirSync(localDir).filter(f => f.endsWith('.json'));
    for (const file of localFiles) {
      const key = `articles/${file}`;
      if (!articleKeys.includes(key)) {
        articleKeys.push(key);
      }
    }
  }

  console.log(`Total unique articles to process: ${articleKeys.length}`);

  let totalImagesUploaded = 0;
  let articlesProcessed = 0;
  const cleanedArticles = [];

  for (let i = 0; i < articleKeys.length; i++) {
    const key = articleKeys[i];
    console.log(`\n[${i + 1}/${articleKeys.length}] Processing ${key}...`);

    let articleJson = null;

    // Fetch from R2
    try {
      const getRes = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));
      if (getRes.Body) {
        const bodyStr = await getRes.Body.transformToString();
        articleJson = JSON.parse(bodyStr);
      }
    } catch (r2Err) {
      // Fallback to local disk if not yet in R2
      const filename = path.basename(key);
      const localFilePath = path.join(localDir, filename);
      if (fs.existsSync(localFilePath)) {
        try {
          articleJson = JSON.parse(fs.readFileSync(localFilePath, 'utf-8'));
        } catch (e) {}
      }
    }

    if (!articleJson || !articleJson.id) {
      console.warn(`  [SKIP] Could not load valid JSON for ${key}`);
      continue;
    }

    // Process article images
    const { post: cleanedPost, migratedCount, modified } = await processArticleImages(articleJson);
    totalImagesUploaded += migratedCount;
    articlesProcessed++;

    if (migratedCount > 0) {
      console.log(`  ✓ Extracted & migrated ${migratedCount} base64 image(s) to R2`);
    } else {
      console.log(`  ✓ No base64 images found (clean)`);
    }

    // Write cleaned article back to R2 and local mirror
    if (!isDryRun) {
      const bodyBuffer = Buffer.from(JSON.stringify(cleanedPost, null, 2), 'utf-8');

      // Upload cleaned article to R2
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: `articles/${cleanedPost.id}.json`,
        Body: bodyBuffer,
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      }));

      // Write to local disk
      try {
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, `${cleanedPost.id}.json`), JSON.stringify(cleanedPost, null, 2), 'utf-8');
      } catch (e) {}
    } else if (modified) {
      console.log(`  [DRY-RUN] Would update articles/${cleanedPost.id}.json in R2`);
    }

    cleanedArticles.push(cleanedPost);
  }

  // Rebuild articles/feed.json as light index
  console.log('\nRebuilding light feed index articles/feed.json...');
  const lightFeed = cleanedArticles
    .filter(p => p.status !== 'draft')
    .map(toLightArticle)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const feedJsonString = JSON.stringify(lightFeed);
  const feedSizeBytes = Buffer.byteLength(feedJsonString, 'utf-8');
  const feedSizeKb = (feedSizeBytes / 1024).toFixed(2);

  if (!isDryRun) {
    // Upload light feed.json to R2
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: 'articles/feed.json',
      Body: Buffer.from(feedJsonString, 'utf-8'),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    }));

    // Save locally
    try {
      const localFeedPath = path.join(process.cwd(), 'data', 'feed.json');
      fs.writeFileSync(localFeedPath, feedJsonString, 'utf-8');
    } catch (e) {}
    console.log(`✓ Light articles/feed.json uploaded to R2 (${feedSizeKb} KB, ${lightFeed.length} articles)`);
  } else {
    console.log(`[DRY-RUN] Final articles/feed.json size would be ${feedSizeKb} KB (${lightFeed.length} articles)`);
  }

  console.log('\n' + '='.repeat(65));
  console.log(' MIGRATION SUMMARY');
  console.log('='.repeat(65));
  console.log(`  Articles Processed: ${articlesProcessed}`);
  console.log(`  Images Uploaded:    ${totalImagesUploaded}`);
  console.log(`  feed.json Size:     ${feedSizeKb} KB`);
  console.log(`  Mode:               ${isDryRun ? 'DRY-RUN (No changes applied)' : 'LIVE (All changes applied to R2)'}`);
  console.log('='.repeat(65) + '\n');
}

main().catch(err => {
  console.error('\n[MIGRATION FAILED]:', err);
  process.exit(1);
});
