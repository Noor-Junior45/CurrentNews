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


