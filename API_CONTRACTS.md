# API_CONTRACTS.md — Strict Schema Lock

## 1. Google AdMob Mobile App Integration
- **Application Name:** Current News: News & Feed
- **Publisher ID:** `pub-5865716270182311`
- **Application ID:** `ca-app-pub-5865716270182311~4645476456`

### Active Unit 1: Adaptive Banner
- **Name:** `CurrentNews_Bottom_Banner`
- **Ad Unit ID:** `ca-app-pub-5865716270182311/2031114923`
- **Format:** `BannerAdSize.ADAPTIVE_BANNER`
- **Position:** `BannerAdPosition.BOTTOM_CENTER`
- **Lifecycle:** Active on content feeds and articles; auto-hidden on utility screens.

### Active Unit 2: Native Advanced Ad
- **Name:** `currentnew_native`
- **Ad Unit ID:** `ca-app-pub-5865716270182311/1743128281`
- **Template:** `NativeAdTemplate.Medium`
- **Placements:**
  1. Article Details: Middle paragraph divider (`article-middle`)
  2. Article Details: Bottom of article content (`article-bottom`)
  3. Home View: Between news dispatches in the feed (`feed-card-...`)
- **Compliance:** Contains policy-mandated "Ad" badge and stable container dimensions to prevent layout shifts.

## 2. Monetization Verification Endpoints

### `GET /app-ads.txt` & `GET /ads.txt`
- **Method:** `GET`, `HEAD`
- **Headers:**
  - `Content-Type: text/plain; charset=utf-8`
  - `Cache-Control: public, max-age=3600, s-maxage=86400`
- **Response (200 OK):**
  ```text
  google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0
  ```

## 3. Accelerated Content & Editorial API Endpoints

### `GET /api/posts`
- **Method:** `GET`
- **Query Params:**
  - `limit`: number (default: 10, max: 50)
  - `page`: number (default: 1)
  - `category`: string (optional, e.g. "Tech", "Politics", "Sports")
  - `search`: string (optional)
- **Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=120`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "posts": [/* Post objects with id, title, content, authorName, imageUrl, etc. */],
    "total": 42,
    "page": 1,
    "limit": 10,
    "hasMore": true,
    "fromCache": true
  }
  ```

### `GET /api/posts/:id`
- **Method:** `GET`
- **Params:** `id` (string document ID)
- **Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "post": { "id": "...", "title": "...", "content": "..." },
    "fromCache": true
  }
  ```

### `GET /api/writers`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, max-age=300`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "writers": ["Current News Staff Report", "Investigative Editorial Bureau", "..."]
  }
  ```

## 4. Infrastructure & Health Endpoints

### `GET /healthz`
- **Method:** `GET`
- **Headers:** `Content-Type: text/plain; charset=utf-8`
- **Response (200 OK):** `OK`

### `GET /readyz`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json; charset=utf-8`
- **Response Shape (200 OK):**
  ```json
  {
    "status": "ready",
    "uptimeSec": 120,
    "timestamp": "2026-11-01T17:15:00.000Z",
    "heapUsedMb": 89.5,
    "service": "currentnews-web-applet",
    "platform": "google-cloud-run"
  }
  ```

### `GET /api/lb/status`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json; charset=utf-8`
- **Response Shape (200 OK):**
  ```json
  {
    "status": "healthy",
    "node": "gcp-cloud-run-primary",
    "region": "gcp-serverless",
    "uptime": 120.5,
    "timestamp": 1793553230363
  }
  ```

### `GET /api/app/version`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "latestVersion": "1.0.1",
    "latestVersionCode": 2,
    "minSupportedVersion": "1.0.0",
    "minSupportedVersionCode": 1,
    "title": "New Live Edition Available",
    "releaseNotes": [
      "Ultra-fast article preview loading with zero layout shift.",
      "Integrated multi-origin edge load balancing."
    ],
    "forceUpdate": false,
    "playStoreUrl": "https://play.google.com/store/apps/details?id=blog.currentnews.app",
    "directApkUrl": "https://media.currentnews.blog/app/currentnews-latest.apk",
    "updatedAt": "2026-11-01T19:18:25.878Z"
  }
  ```

### `POST /api/app/version`
- **Method:** `POST`
- **Body:** `{ "latestVersion": "1.0.2", "latestVersionCode": 3, "forceUpdate": false, "releaseNotes": [...] }`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "message": "App version configuration updated successfully",
    "config": { ... }
  }
  ```

## 5. Search Engine Optimization & Google News Endpoints

### `GET /sitemap.xml`
- **Method:** `GET`, `HEAD`
- **Headers:**
  - `Content-Type: application/xml; charset=utf-8`
  - `Cache-Control: public, s-maxage=3600, stale-while-revalidate=59`
- **Namespaces:** `http://www.sitemaps.org/schemas/sitemap/0.9` and `http://www.google.com/schemas/sitemap-news/0.9`
- **Response Shape (200 OK):**
  - Static priority pages (`/`, `/?category=Jharkhand` [0.95 priority], `/about`, `/editorial-policy`, `/contact`, `/privacy`, `/terms`)
  - Dynamic news stories with `<news:news>` schemas including `<news:publication>`, `<news:publication_date>`, `<news:title>`, and `<news:keywords>` (regional classification for Jharkhand/Ranchi queries)

### `GET /robots.txt`
- **Method:** `GET`
- **Headers:** `Content-Type: text/plain; charset=utf-8`
- **Directives:** Explicit `Googlebot`, `Googlebot-News`, `Mediapartners-Google`, and `*` agents with Disallow on `/admin`, `/profile`, `/settings`, `/liked`, `/delete-account`, `/api/` and link to `Sitemap: https://www.currentnews.blog/sitemap.xml`.

### `GET /?category=Jharkhand`
- **Method:** `GET`
- **SEO Title:** `Jharkhand News Live — Breaking Updates, Ranchi & Regional Reports | Current News`
- **Geo Tags:** `geo.region: IN-JH`, `geo.placename: Jharkhand, India`, `geo.position: 23.6102;85.2799`, `ICBM: 23.6102, 85.2799`
- **Target Keywords:** `news near Jharkhand`, `Jharkhand news`, `Jharkhand breaking news`, `Ranchi news live`, `Dhanbad news`, `Jamshedpur news`
- **JSON-LD Schema:** `CollectionPage` with `about: AdministrativeArea (Jharkhand, IN)`

## 6. Cloudflare R2 Article & Zero-Quota Storage Endpoints
### `GET /api/articles/feed`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json; charset=utf-8`
- **Action:** Retrieves aggregated articles feed including `authorEmail`, `authorId`, `imageUrls`, and embed links.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "articles": [ /* Array of Post objects */ ] }
  ```

### `POST /api/articles/save`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:** `{ "post": { "id": "...", "title": "...", "content": "...", "status": "published", ... } }`
- **Action:** Writes document to `articles/${post.id}.json` in Cloudflare R2 bucket `currentnews-media`, mirrors to local disk `data/articles/${post.id}.json`, and rebuilds `articles/feed.json`.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "message": "Article saved and feed updated successfully" }
  ```

### `DELETE /api/articles/:id`
- **Method:** `DELETE`
- **Params:** `id` (string document ID)
- **Action:** Removes `articles/${id}.json` from Cloudflare R2 and removes article from `articles/feed.json`.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "message": "Article deleted and feed updated" }
  ```

### `POST /api/articles/sync`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json` (supported up to 25MB payload)
- **Body:** `{ "posts": [ /* Array of Post objects */ ] }`
- **Action:** Bulk uploads all published articles to Cloudflare R2 and compiles unified `articles/feed.json`.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "message": "Successfully synced 41 of 41 articles to Cloudflare R2", "synced": 41, "total": 41 }
  ```

### `POST /api/articles/migrate-images`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Action:** Scans all articles on disk and Cloudflare R2, extracts inline base64 image data from `imageUrl`, `imageUrlFallback`, `imageUrls`, `imageUrlsFallback` and `<img src="data:...">` in HTML content, decodes and uploads to `img/{postId}-{n}.webp`, updates image references to `https://media.currentnews.blog/img/{postId}-{n}.webp`, rewrites full post JSON files, and recompiles a lightweight 37 KB `articles/feed.json`.
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "message": "Migration complete. Processed 41 articles, migrated 46 base64 images.",
    "articlesProcessed": 41,
    "imagesMigrated": 46,
    "feedSizeKb": 37
  }
  ```

### Direct CDN URL Contracts:
- **Feed CDN (Light Index, ~37 KB):** `https://media.currentnews.blog/articles/feed.json`
  - Shape: Array of `{ id, title, category, authorName, createdAt, status, imageUrl, hashtags, likes, dislikes, views, excerpt }` (No `content`, no base64 images).
  - Cache-Control: `public, max-age=60, s-maxage=300`
- **Individual Story CDN (Full Article Body):** `https://media.currentnews.blog/articles/${id}.json`
  - Shape: Complete Post object including full `content` HTML with external image URLs.
  - Cache-Control: `public, max-age=300, s-maxage=3600`
- **Media Image CDN:** `https://media.currentnews.blog/img/{postId}-{n}.webp`
  - Cache-Control: `public, max-age=31536000, s-maxage=31536000, immutable`

## 4. Cloudflare Worker & D1 Database API (`api.currentnews.blog`)

### `GET /stats?ids=a,b,c`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, s-maxage=30, max-age=15`
- **Response Shape (200 OK):**
  ```json
  {
    "success": true,
    "stats": {
      "postId1": { "likes": 12, "dislikes": 0, "views": 250 },
      "postId2": { "likes": 4, "dislikes": 1, "views": 80 }
    }
  }
  ```

### `POST /view/:postId`
- **Method:** `POST`
- **Deduplication:** Cloudflare Cache API suppresses duplicate counts per IP + postId for 30 minutes.
- **Response Shape (200 OK):** `{ "success": true }` or `{ "success": true, "deduped": true }`

### `GET /reaction/:postId`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Response Shape (200 OK):** `{ "success": true, "type": "like" | "dislike" | null }`

### `POST /reaction/:postId`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`, `Content-Type: application/json`
- **Body:** `{ "type": "like" | "dislike" | null }`
- **Action:** Sets, toggles, or clears reaction and updates `posts_stats` in a single atomic D1 batch.
- **Response Shape (200 OK):** `{ "success": true, "type": "like" | null, "stats": { "likes": 1, "dislikes": 0, "views": 5 } }`

### `GET /my-reactions`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Response Shape (200 OK):** `{ "success": true, "reactions": { "postA": "like", "postB": "dislike" } }`

### `POST /subscribe`
- **Method:** `POST`
- **Body:** `{ "email": "user@example.com" }`
- **Response Shape (200 OK):** `{ "success": true, "message": "Subscribed successfully" }`

### `GET /subscribe/check?email=user@example.com`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>` (must match requested email)
- **Response Shape (200 OK):** `{ "success": true, "subscribed": true | false }`

### `DELETE /subscribe`
- **Method:** `DELETE`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Response Shape (200 OK):** `{ "success": true, "message": "Unsubscribed successfully" }`

### `POST /push/subscribe` & `DELETE /push/subscribe`
- **Methods:** `POST`, `DELETE`
- **Body:** `{ "id": "...", "subscription": "{...}" }` or `{ "id": "..." }`
- **Response Shape (200 OK):** `{ "success": true }`

### `GET /push/count`
- **Method:** `GET`
- **Headers:** `Cache-Control: public, s-maxage=300, max-age=60`
- **Response Shape (200 OK):** `{ "success": true, "count": 142 }`

### `GET /user/pen-name` & `PUT /user/pen-name`
- **Methods:** `GET`, `PUT`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Body (PUT):** `{ "penName": "Jane Doe" }`
- **Response Shape (200 OK):** `{ "success": true, "penName": "Jane Doe" }`

### `GET /subscribers` (Admin Only)
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>` (exact email match in `ADMIN_EMAILS`)
- **Response Shape (200 OK):** `{ "success": true, "subscribers": [ { "email": "...", "created_at": 1700000000000 } ] }`

### `POST /import` (Admin Only)
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`, `Content-Type: application/json`
- **Body:** `{ "posts_stats": [...], "reactions": [...], "subscribers": [...], "push_subscriptions": [...], "users": [...] }`
- **Response Shape (200 OK):** `{ "success": true, "imported": { "posts_stats": 41, "reactions": 10, "subscribers": 5, "push_subscriptions": 2, "users": 1 } }`

### `POST /admin/recount` (Admin Only)
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>` (exact email match in `ADMIN_EMAILS`)
- **Action:** Recomputes aggregate likes and dislikes across the entire `reactions` table in ONE atomic D1 `INSERT ... ON CONFLICT(post_id) DO UPDATE ... GROUP BY post_id` query, reconciling any count drift.
- **Response Shape (200 OK):**
  ```json
  { "success": true, "message": "Reactions recounted and posts_stats updated successfully" }
  ```

## 7. Client Reaction Architecture (`src/utils/reactionStore.ts`)
- **Storage Keys:**
  - `cn_react_${uid}`: Optimistic local reaction per post (`like` | `dislike` | `null`)
  - `cn_confirmed_${uid}`: Last server-confirmed reaction per post
  - `cn_react_queue_${uid}`: Persisted retry queue with exponential backoff
  - `cn_my_reactions_${uid}`: Session cache of user reactions (10-minute TTL)
  - `cn_stats_cache`: 3-minute local cache for `/stats` responses in HomeView
- **Debounce:** 1500 ms trailing debounce after the LAST tap
- **No-op Cancellation:** If final state equals confirmed state, network request is cancelled
- **Count Calculation Formula:**
  - `displayedLikes = serverLikes + (localMine === 'like' ? 1 : 0) - (confirmedMine === 'like' ? 1 : 0)`
  - `displayedDislikes = serverDislikes + (localMine === 'dislike' ? 1 : 0) - (confirmedMine === 'dislike' ? 1 : 0)`
- **Auto-Flush Lifecycle:** Triggers on `visibilitychange`, `pagehide` (with `fetch` `keepalive: true`), `online`, and app start.






