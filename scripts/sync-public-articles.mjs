import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_ARTICLES_DIR = path.join(ROOT, 'data', 'articles');
const DELETED_FILE = path.join(ROOT, 'data', 'deleted_articles.json');
const PUBLIC_ARTICLES_DIR = path.join(ROOT, 'public', 'articles');
const PUBLIC_FEED_FILE = path.join(ROOT, 'public', 'feed.json');

const SEED_DELETED = new Set([
  'post_1793731462909_88he4y',
  'post_1793979188690_fibeqk',
  'post_1794056976447_h5095f',
]);

if (fs.existsSync(DELETED_FILE)) {
  try {
    const arr = JSON.parse(fs.readFileSync(DELETED_FILE, 'utf8'));
    if (Array.isArray(arr)) {
      arr.filter(Boolean).forEach((id) => SEED_DELETED.add(id));
    }
  } catch {
    // Ignore malformed deleted_articles.json
  }
}

fs.mkdirSync(PUBLIC_ARTICLES_DIR, { recursive: true });

// Remove any stale or deleted article files in public/articles
for (const existing of fs.readdirSync(PUBLIC_ARTICLES_DIR)) {
  if (existing.endsWith('.json')) {
    const id = existing.replace(/\.json$/, '');
    if (SEED_DELETED.has(id) || !fs.existsSync(path.join(SRC_ARTICLES_DIR, existing))) {
      fs.unlinkSync(path.join(PUBLIC_ARTICLES_DIR, existing));
    }
  }
}

const feedItems = [];

if (fs.existsSync(SRC_ARTICLES_DIR)) {
  const files = fs.readdirSync(SRC_ARTICLES_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(SRC_ARTICLES_DIR, file), 'utf8'));
      if (!raw || !raw.id || SEED_DELETED.has(raw.id)) continue;
      if ((raw.status || 'published').toLowerCase() !== 'published') continue;

      // Strip internal PII fields before writing public static asset
      const { authorEmail: _ae, authorId: _ai, ...publicPost } = raw;

      fs.writeFileSync(
        path.join(PUBLIC_ARTICLES_DIR, `${raw.id}.json`),
        JSON.stringify(publicPost),
        'utf8'
      );

      const createdMs =
        typeof raw.createdAt === 'number'
          ? raw.createdAt
          : Date.parse(raw.createdAt || '') || Date.now();

      feedItems.push({
        id: raw.id,
        slug: raw.slug || '',
        title: raw.title || '',
        excerpt: raw.excerpt || '',
        category: raw.category || 'General',
        hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
        imageUrl: raw.imageUrl || '',
        imageUrlFallback: raw.imageUrlFallback || '',
        image_url: raw.imageUrl || '',
        image_url_fallback: raw.imageUrlFallback || '',
        authorName: raw.authorName || 'Current News',
        author_name: raw.authorName || 'Current News',
        createdAt: createdMs,
        published_at: createdMs,
        youtubeUrl: raw.youtubeUrl || '',
        facebookUrl: raw.facebookUrl || '',
        likes: Number(raw.likes) || 0,
        dislikes: Number(raw.dislikes) || 0,
        views: Number(raw.views) || 0,
        status: 'published',
      });
    } catch (err) {
      console.warn(`[sync-public-articles] Skipped ${file}:`, err?.message || err);
    }
  }
}

feedItems.sort((a, b) => b.createdAt - a.createdAt);

if (feedItems.length > 0) {
  fs.writeFileSync(PUBLIC_FEED_FILE, JSON.stringify(feedItems, null, 2), 'utf8');
}

console.log(`[sync-public-articles] Synced ${feedItems.length} published articles to public/articles & public/feed.json`);
