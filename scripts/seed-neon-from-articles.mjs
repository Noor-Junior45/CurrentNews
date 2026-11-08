#!/usr/bin/env node
/**
 * scripts/seed-neon-from-articles.mjs
 * 
 * Reads all 41 articles from local disk (data/articles/*.json and data/feed.json)
 * and seeds them into Neon PostgreSQL database as the editorial source of truth.
 * 
 * Usage:
 *   node scripts/seed-neon-from-articles.mjs
 * 
 * Environment variables:
 *   NEON_DATABASE_URL or DATABASE_URL
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;

// Load environment variables
dotenv.config();
const envLocal = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}

const connectionString = (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '').trim();

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function parseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p.map(String).filter(Boolean);
    } catch (_) {}
    return [val];
  }
  return [];
}

async function seedNeon() {
  console.log('\n======================================================');
  console.log(' CURRENT NEWS - Seed Neon PostgreSQL From Articles');
  console.log('======================================================\n');

  if (!connectionString) {
    console.error('[ERROR] NEON_DATABASE_URL (or DATABASE_URL) is not set.');
    console.error('Please run with:');
    console.error('  NEON_DATABASE_URL="postgresql://..." node scripts/seed-neon-from-articles.mjs\n');
    process.exit(1);
  }

  const articlesDir = path.resolve(process.cwd(), 'data', 'articles');
  if (!fs.existsSync(articlesDir)) {
    console.error(`[ERROR] Articles directory not found at ${articlesDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} article file(s) in data/articles/\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[OK] Connected to Neon PostgreSQL.');

    let seededCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const filePath = path.join(articlesDir, file);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (err) {
        console.warn(`[WARN] Skipping unparseable file ${file}:`, err.message);
        skippedCount++;
        continue;
      }

      const id = data.id || file.replace(/\.json$/, '');
      const title = data.title || 'Untitled Article';
      const rawSlug = slugify(title) || id;
      const slug = `${rawSlug}-${id.slice(-6)}`;
      const content = data.content || '';
      const excerpt = data.excerpt || (content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
      const category = data.category || 'General';
      const hashtags = parseArray(data.hashtags);
      const youtubeUrl = data.youtubeUrl || '';
      const facebookUrl = data.facebookUrl || '';
      const customLinks = parseArray(data.customLinks);
      const imageUrl = data.imageUrl || '';
      const imageUrlFallback = data.imageUrlFallback || '';
      const imageUrls = parseArray(data.imageUrls);
      const imageUrlsFallback = parseArray(data.imageUrlsFallback);
      const imagePosition = data.imagePosition || 'top';
      const galleryPositions = parseArray(data.galleryPositions);
      const authorUid = data.authorId || data.author_uid || 'system_author';
      const authorName = data.authorName || 'Current News';
      const authorEmail = data.authorEmail || '';
      const status = data.status || 'published';
      const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
      const publishedAt = status === 'published' ? (data.publishedAt ? new Date(data.publishedAt) : createdAt) : null;
      const version = typeof data.version === 'number' ? data.version : 1;

      const upsertSql = `
        INSERT INTO articles (
          id, slug, title, excerpt, content, category, hashtags,
          youtube_url, facebook_url, custom_links,
          image_url, image_url_fallback, image_urls, image_urls_fallback,
          image_position, gallery_positions,
          author_uid, author_name, author_email,
          status, version, sync_pending, created_at, updated_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16,
          $17, $18, $19,
          $20, $21, true, $22, now(), $23
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          content = EXCLUDED.content,
          category = EXCLUDED.category,
          hashtags = EXCLUDED.hashtags,
          youtube_url = EXCLUDED.youtube_url,
          facebook_url = EXCLUDED.facebook_url,
          custom_links = EXCLUDED.custom_links,
          image_url = EXCLUDED.image_url,
          image_url_fallback = EXCLUDED.image_url_fallback,
          image_urls = EXCLUDED.image_urls,
          image_urls_fallback = EXCLUDED.image_urls_fallback,
          image_position = EXCLUDED.image_position,
          gallery_positions = EXCLUDED.gallery_positions,
          author_name = EXCLUDED.author_name,
          status = EXCLUDED.status,
          sync_pending = true,
          updated_at = now(),
          published_at = COALESCE(articles.published_at, EXCLUDED.published_at);
      `;

      const values = [
        id,
        slug,
        title,
        excerpt,
        content,
        category,
        hashtags,
        youtubeUrl,
        facebookUrl,
        customLinks,
        imageUrl,
        imageUrlFallback,
        imageUrls,
        imageUrlsFallback,
        imagePosition,
        galleryPositions,
        authorUid,
        authorName,
        authorEmail,
        status,
        version,
        createdAt,
        publishedAt
      ];

      await client.query(upsertSql, values);
      seededCount++;
      process.stdout.write(`  [${seededCount}/${files.length}] Seeded: ${title.slice(0, 40)}...\n`);
    }

    console.log(`\n------------------------------------------------------`);
    console.log(` SUCCESS! ${seededCount} articles migrated to Neon.`);
    if (skippedCount > 0) console.log(` Skipped: ${skippedCount} file(s).`);
    console.log(`------------------------------------------------------\n`);
    console.log('Next step: To sync all newly seeded articles from Neon to Cloudflare D1, run:');
    console.log('  node scripts/resync-d1.mjs\n');

  } catch (err) {
    console.error('\n[DATABASE ERROR]:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedNeon();
