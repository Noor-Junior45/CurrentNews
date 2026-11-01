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

### Direct CDN URL Contracts:
- **Feed CDN:** `https://media.currentnews.blog/articles/feed.json`
- **Individual Story CDN:** `https://media.currentnews.blog/articles/${id}.json`
- **Cache-Control:** `public, max-age=60, s-maxage=300`



