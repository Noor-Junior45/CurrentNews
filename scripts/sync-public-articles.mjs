import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const PUBLIC_ARTICLES_DIR = path.join(PUBLIC_DIR, 'articles');
const PUBLIC_FEED_FILE = path.join(PUBLIC_DIR, 'feed.json');

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// (a) Delete all *.json files in public/articles if the directory exists
if (fs.existsSync(PUBLIC_ARTICLES_DIR)) {
  for (const entry of fs.readdirSync(PUBLIC_ARTICLES_DIR)) {
    if (entry.endsWith('.json')) {
      fs.rmSync(path.join(PUBLIC_ARTICLES_DIR, entry), { force: true });
    }
  }
}

// (b) Write public/feed.json as an empty JSON array []
fs.writeFileSync(PUBLIC_FEED_FILE, '[]\n', 'utf8');

console.log('[sync-public-articles] Cleared public/articles/*.json and reset public/feed.json to []');
