# CHAOS_TESTS.md — Edge-Case & cURL Test Suite

## 1. Monetization Verification cURL Suite

```bash
# 1. Test app-ads.txt content
curl -s http://localhost:3000/app-ads.txt

# Expected Output:
# google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0

# 2. Test app-ads.txt HTTP Headers
curl -sI http://localhost:3000/app-ads.txt

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/plain; charset=utf-8
# Cache-Control: public, max-age=3600, s-maxage=86400

# 3. Test ads.txt content & headers
curl -s http://localhost:3000/ads.txt
curl -sI http://localhost:3000/ads.txt

# 4. Test method not allowed handling (POST to app-ads.txt)
curl -sI -X POST http://localhost:3000/app-ads.txt
# Expected: 405 Method Not Allowed or intercepted

# 5. Test health check endpoint for Cloud Run
curl -sI http://localhost:3000/healthz
# Expected: HTTP/1.1 200 OK
```

## 2. Ad Component Chaos Tests

- **Test A: AdBlocker Extension Enabled:**
  - Launch browser with uBlock Origin or Brave Shields enabled.
  - Navigate to Home Feed and Article reading views.
  - Verify `<AdSpace />` cleanly unmounts and returns `null`. No blank whitespace, gray boxes, or broken layout grids appear.

- **Test B: Native App Route Transitions:**
  - Launch native Android APK on device.
  - Verify AdMob banner anchors at bottom on Home Feed (`/`).
  - Open `/admin`, `/settings`, or `/signin`.
  - Verify `admobManager.hideBanner()` immediately dismisses native banner so it never covers form inputs or action buttons.
  - Return to Home or Article reading view; verify banner re-appears cleanly.

## 3. SEO & Crawler Simulation cURL Suite

```bash
# 1. Test robots.txt contains Googlebot & Googlebot-News rules
curl -s http://localhost:3000/robots.txt

# 2. Test sitemap.xml returns application/xml with Google News schema
curl -s http://localhost:3000/sitemap.xml | head -n 30

# 3. Simulate Googlebot user-agent crawling an article
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:3000/ | grep -i "Current News Live"

# 4. Verify noindex header/meta on /admin route
curl -s http://localhost:3000/admin | grep -i "noindex"

# 5. Verify Jharkhand Regional Geo Meta Tags
curl -s http://localhost:3000/ | grep -iE "geo.region|geo.placename|news near Jharkhand"

# 6. Verify Googlebot pre-rendering on /?category=Jharkhand
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "http://localhost:3000/?category=Jharkhand" | grep -i "Jharkhand News"
```

## 4. Cloudflare R2 & Zero-Quota Article cURL Suite

```bash
# 1. Fetch public articles feed backed by R2
curl -s http://localhost:3000/api/posts?limit=3 | jq '{ total: .total, postsCount: (.posts | length), fromCache: .fromCache }'

# 2. Fetch single article directly via API
curl -s http://localhost:3000/api/posts/Mb0SKs2bF11I7JvCu2HJ | jq '{ id: .post.id, title: .post.title }'

# 3. Verify Cloudflare R2 direct public CDN access
curl -sI https://media.currentnews.blog/articles/feed.json
# Expected: HTTP/2 200 OK, Content-Type: application/json

# 4. Verify R2 article sync endpoint (dry test)
curl -s -X POST http://localhost:3000/api/articles/sync \
  -H "Content-Type: application/json" \
  -d '{"posts":[]}' | jq .
# Expected: { "success": true, "synced": 0, "total": 0 }
```

## 5. Load Balancer, Ingress & Health Probe Test Suite

```bash
# 1. Test Cloud Run liveness probe
curl -sI http://localhost:3000/healthz
# Expected: HTTP/1.1 200 OK, Content-Type: text/plain

# 2. Test Google Cloud Load Balancer readiness probe (RAM & Uptime telemetry)
curl -s http://localhost:3000/readyz
# Expected: { "status": "ready", "uptimeSec": ..., "heapUsedMb": ..., "platform": "google-cloud-run" }

# 3. Test multi-origin cluster health probe
curl -s http://localhost:3000/api/lb/status
# Expected: { "status": "healthy", "node": "gcp-cloud-run-primary", ... }

# 4. Test proxy header preservation (X-Forwarded-For & X-Forwarded-Proto)
curl -s -H "X-Forwarded-For: 203.0.113.195" -H "X-Forwarded-Proto: https" http://localhost:3000/api/lb/status
```

## 6. Server-Driven In-App Update Test Suite (Option B)

```bash
# 1. Fetch current required app version configuration
curl -s http://localhost:3000/api/app/version | jq .
# Expected: { "success": true, "latestVersion": "...", "latestVersionCode": ..., "forceUpdate": false }

# 2. Test updating app version requirement via POST (Simulate publishing new release)
curl -s -X POST http://localhost:3000/api/app/version \
  -H "Content-Type: application/json" \
  -d '{
    "latestVersion": "1.0.2",
    "latestVersionCode": 3,
    "title": "New Live Edition Available",
    "releaseNotes": ["Security upgrades and faster offline dispatches"],
    "forceUpdate": false
  }' | jq .
# Expected: { "success": true, "message": "App version configuration updated successfully" }
## 7. Web Push Notifications & Persistence Test Suite

```bash
# 1. Fetch active VAPID public key
curl -s http://localhost:3000/api/push/public-key | jq .
# Expected: { "success": true, "publicKey": "..." }
# If VAPID_PUBLIC_KEY is not set: HTTP 503 { "success": false, "error": "VAPID public key is not configured" }

# 2. Reject unapproved push endpoint domain (SSRF guard)
curl -s -i -X POST http://localhost:3000/api/push/subscribe \
  -H "Content-Type: application/json" \
  -d '{"subscription":{"endpoint":"https://evil.attacker.com/sink","keys":{"p256dh":"BNcRdreALRFXTkOOUHK18PeW5p","auth":"tBHItJI5svbQcxE5a5-42A"}}}'
# Expected: HTTP/1.1 400 Bad Request
# {"success":false,"error":"Invalid subscription endpoint: must be https and hosted by an authorized push gateway (fcm.googleapis.com, push.apple.com, notify.windows.com, or updates.push.services.mozilla.com) under 500 characters"}

# 3. Reject non-base64url key characters
curl -s -i -X POST http://localhost:3000/api/push/subscribe \
  -H "Content-Type: application/json" \
  -d '{"subscription":{"endpoint":"https://fcm.googleapis.com/fcm/send/token","keys":{"p256dh":"bad key!#$","auth":"tBHItJI5svbQcxE5a5-42A"}}}'
# Expected: HTTP/1.1 400 Bad Request
# {"success":false,"error":"Invalid subscription keys: p256dh must be base64url <= 200 chars and auth must be base64url <= 50 chars"}

# 4. Push rate limit check (10 requests per hour per IP)
curl -s -I -X POST http://localhost:3000/api/push/subscribe \
  -H "Content-Type: application/json" \
  -d '{"subscription":{"endpoint":"https://fcm.googleapis.com/fcm/send/token","keys":{"p256dh":"BNcRdreALRFXTkOOUHK18PeW5p","auth":"tBHItJI5svbQcxE5a5-42A"}}}' | grep -i 'ratelimit'
# Expected:
# RateLimit-Policy: 10;w=3600
# RateLimit: limit=10, remaining=..., reset=...

# 5. Verify admin routes /api/push/subscribers-count return 404 (moved to admin repo)
curl -s -i http://localhost:3000/api/push/subscribers-count
# Expected: HTTP/1.1 404 Not Found
```




## 6. Role Authorization & Host Segregation Chaos Tests

```bash
# 1. Verify 401 Unauthorized when calling /api/admin/articles without Bearer token
curl -s -i -X POST http://localhost:3000/api/admin/articles \
  -H "Content-Type: application/json" \
  -d '{"title": "Unauthorized Test"}'
# Expected: HTTP/1.1 401 Unauthorized {"success":false,"error":"Unauthorized: Missing or invalid Authorization header"}

# 2. Verify 401 Unauthorized when Bearer token is invalid or expired
curl -s -i -X GET http://localhost:3000/api/admin/articles \
  -H "Authorization: Bearer invalid-token-12345"
# Expected: HTTP/1.1 401 Unauthorized {"success":false,"error":"Unauthorized: Invalid authentication credentials"}

# 3. Verify 401 Unauthorized on write endpoint (/api/upload) without Bearer token
curl -s -i -X POST http://localhost:3000/api/upload
# Expected: HTTP/1.1 401 Unauthorized

# 4. Verify host redirection on production reader host
curl -s -I -H "Host: currentnews.blog" http://localhost:3000/admin
# (In production behind GCLB):
# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://admin.currentnews.blog/admin

# 5. Verify admin API returns 404 on reader domain
curl -s -i -H "Host: currentnews.blog" http://localhost:3000/api/admin/articles
# Expected: HTTP/1.1 404 Not Found {"success":false,"error":"Not found"}

# 6. Verify X-Robots-Tag on admin host
curl -s -I -H "Host: admin.currentnews.blog" http://localhost:3000/admin
# Expected: X-Robots-Tag: noindex, nofollow
```

## 8. Security Headers, CSP & Rate Limiting Chaos Tests

```bash
# 1. Verify Helmet CSP and HSTS headers on public reader endpoints
curl -s -I http://localhost:3000/healthz | grep -iE 'content-security-policy|strict-transport-security|x-content-type-options'
# Expected:
# Content-Security-Policy: default-src 'self'; ...
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Content-Type-Options: nosniff

# 2. Verify RateLimit headers on /api/* (300 requests / 15 minutes)
curl -s -I http://localhost:3000/api/posts | grep -i 'ratelimit'
# Expected:
# RateLimit-Policy: 300;w=900
# RateLimit: limit=300, remaining=..., reset=...

# 3. Verify Alert Mail rate limit (5 requests / hour)
curl -s -I -X POST http://localhost:3000/api/mail/send-alert \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","title":"Test"}' | grep -i 'ratelimit'
# Expected:
# RateLimit-Policy: 5;w=3600
# RateLimit: limit=5, remaining=..., reset=...

# 4. Verify Alert Mail rejects malformed recipient email with 400 Bad Request
curl -s -X POST http://localhost:3000/api/mail/send-alert \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","title":"Breaking News"}'
# Expected: {"success":false,"message":"Invalid recipient email address format."}

# 5. Verify Alert Mail rejects external phishing URLs and defaults safely
curl -s -X POST http://localhost:3000/api/mail/send-alert \
  -H "Content-Type: application/json" \
  -d '{"email":"reader@example.com","title":"Breaking News\r\nBcc: evil@phish.com","link":"https://phishing-site.com/steal"}'
# Expected: URL falls back strictly to https://currentnews.blog; title newlines stripped and HTML-escaped.
```

## 9. Media Assets, Facebook & Video Player CSP Tests

```bash
# 1. Verify Facebook iframe & script allowances in Helmet CSP
curl -s -I http://localhost:3000/healthz | grep -i 'content-security-policy' | grep -o 'https://\*\.facebook\.com'
# Expected: https://*.facebook.com

# 2. Verify Facebook SDK script domain allowance
curl -s -I http://localhost:3000/healthz | grep -i 'content-security-policy' | grep -o 'https://connect\.facebook\.net'
# Expected: https://connect.facebook.net

# 3. Verify static brand logo serves HTTP 200 with PNG Content-Type
curl -s -I http://localhost:3000/CurrentNews.png | grep -iE 'http/1.1|content-type'
# Expected:
# HTTP/1.1 200 OK
# content-type: image/png

# 4. Verify feed API outputs clean sanitized image paths (no malformed /uploads/photo.jpg/ fragments)
curl -s http://localhost:3000/api/posts?limit=5 | grep -o '/uploads/photo.jpg/img/'
# Expected: (empty - 0 matches)
```

## 10. Line 2 Pill Search Bar & Multi-Purpose Cross `[x]` Chaos Tests

- **Test A: 3-Stage Multi-Purpose `[x]` Button Flow:**
  1. Click `#header-search-trigger` (magnifying glass) -> Verify `#category-filter-header` hides and `#navbar-search-line-2` pill opens with white background inside `#fbf1e5` navbar.
  2. Type `"Ranchi"` without pressing Enter -> Verify `#header-search-suggestions-dropdown` displays matching suggestions. Click `#navbar-search-clear-cross-button` (`[x]`) -> Verify half-written text clears (`""`), dropdown closes, and cursor remains focused inside `#navbar-search-input`.
  3. Type `"Ranchi"` and press `Enter` -> Verify URL updates to `/?search=Ranchi` and feed filters to matching stories. Edit input to `"Ranchi live"` (half-written edit) and click `[x]` -> Verify half-written text clears first; click `[x]` second time -> Verify active search result clears (`/?search` removed, full feed restored) and cursor stays focused in empty search bar; click `[x]` third time -> Verify empty search bar smoothly animates back into `#header-search-trigger` and category buttons reappear.

- **Test B: Adversarial Payloads & Rapid Toggling:**
  - Paste `"><img src=x onerror=alert(1)>` or `[[[***+++` into `#navbar-search-input` -> Verify zero console errors, zero XSS execution, and clean literal text handling in suggestion highlights and `#empty-feed`.
  - Rapidly double-click `#header-search-trigger` and `[x]` on 360px mobile and 1440px laptop viewports -> Verify pill preserves `px-3.5` left/right phone margins and `max-w-[480px]` laptop cap with zero layout shift.

## 11. Android APK Article Reader, CORS Allowlist & Offline Bundle Tests

```bash
# 1. Verify Capacitor Android Origin (https://localhost) receives allowlisted CORS header on /api/posts/:id
curl -s -I -H "Origin: https://localhost" http://localhost:3000/api/posts/Z9qSPadOxSBhn2Wjyoet | grep -iE 'access-control-allow-origin|vary'
# Expected:
# Access-Control-Allow-Origin: https://localhost
# Vary: Origin

# 2. Verify untrusted external Origin does NOT receive Access-Control-Allow-Origin
curl -s -I -H "Origin: https://evil-attacker.example" http://localhost:3000/api/posts/Z9qSPadOxSBhn2Wjyoet | grep -i 'access-control-allow-origin'
# Expected: (empty - 0 matches)

# 3. Verify bundled public/articles/:id.json exists for APK offline failover and contains zero PII (authorEmail/authorId)
grep -rnE 'authorEmail|authorId' public/articles
# Expected: (empty - 0 matches)

# 4. Verify LZW UTF-16 compression/decompression lossless roundtrip on Devanagari + English JSON
npx tsx -e 'import fs from "fs"; import { compressToUTF16, decompressFromUTF16 } from "./src/utils/compressedStorage.ts"; const raw = JSON.stringify({ id: "test", title: "झारखंड समाचार", content: "<p>Live</p>" }); console.log("Lossless:", decompressFromUTF16(compressToUTF16(raw)) === raw);'
# Expected: Lossless: true
```

## 12. Cloud Build, Deterministic Lockfile & Production Cold-Start Smoke Suite

```bash
# 1. Verify package.json and package-lock.json are 100% synchronized for Stage 1 & Stage 2 Docker builds
npm ci --dry-run && npm ci --omit=dev --dry-run
# Expected: Exit code 0 (zero EUSAGE errors)

# 2. Verify production server.cjs bundle contains zero top-level require("vite") calls
npm run build && grep -c 'require("vite")' server.cjs || true
# Expected: 0

# 3. Verify production bundle boots on dynamic PORT (8080 default) and passes /healthz + /readyz probes
NODE_ENV=production PORT=8099 node server.cjs &
SERVER_PID=$!
sleep 2
curl -fsS http://127.0.0.1:8099/healthz
curl -fsS http://127.0.0.1:8099/readyz
kill $SERVER_PID
# Expected: OK and {"status":"ready",...}
```

