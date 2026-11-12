# SECURITY_AND_HACK_LOG.md — Adversarial Red-Team Checklist

## Red-Team Audit & Exploit Mitigations

1. **Vulnerability: Hardcoded Credentials & Production Ad IDs in Source Code**
   - **Exploit Vector:** Public git repositories or leaked frontend source bundles exposing ad client IDs or relying on fixed unit IDs across environments, risking unauthorized ad scraping or invalid traffic strikes.
   - **Defense:** Extracted all AdSense client IDs, AdSense ad slots, AdMob App IDs, and AdMob banner/interstitial units into environment variables (`.env`). If environment variables are absent, ad components collapse to `null` with zero DOM footprint, completely preventing broken ad requests or unauthorized scraping.

2. **Vulnerability: Cloud Run Host & Port Hijacking / Cold Start Failures**
   - **Exploit Vector:** Cloud Run container failing liveness probes due to listening on `localhost`/`127.0.0.1` or a static port rather than `0.0.0.0:$PORT`.
   - **Defense:** Hardcoded host `0.0.0.0` in `server.ts` and set dynamic port binding `const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;`. Added `/healthz` endpoint returning HTTP 200 with minimal overhead for instant Google Cloud container health checks.

3. **Vulnerability: Dual-Engine Ad Collision between AdSense & AdMob**
   - **Exploit Vector:** Web ad units firing inside native Android WebViews violating Google AdSense terms while AdMob simultaneously renders native banners.
   - **Defense:** Enforced strict platform boundary in `AdSpace.tsx` and `useAdSenseRouteGuard.ts`: on native platforms (`Capacitor.isNativePlatform()`), all web AdSense DOM rendering and script tags are suppressed, leaving AdMob as the authoritative ad provider on mobile devices.

4. **Vulnerability: Firestore Daily Read Quota Denial of Service (Client Flooding)**
   - **Exploit Vector:** Every client rendering the app issued direct unbounded Firestore reads (`getDocs(collection(db, 'posts'))`), exhausting the 50,000 free daily read quota and causing HTTP 429 quota errors across all users.
   - **Defense:** Implemented an in-memory 60-second caching proxy at `/api/posts` on Express. A thousand mobile phone requests per minute only trigger at most 1 Firestore read on the backend, reducing database read load by over 98%. Additionally wrapped client-side Firestore handlers with resilient offline cache fallbacks (`localStorage`).

5. **Vulnerability: Byline Spoofing & Empty Reporter Submissions**
   - **Exploit Vector:** Malicious or malformed inputs submitting empty author fields, disrupting RSS/Sitemap/Schema.org structures.
   - **Defense:** Validated in `AdminView.tsx` with hierarchical resolution: `(selectedWriter === 'custom' ? authorName.trim() : selectedWriter) || globalPenName.trim() || 'Current News Staff Report'`. Backend `/api/writers` provides sanitized server-authoritative lists.

6. **Vulnerability: Denial of Wallet via Rapid Client-Side Polling Loops**
   - **Exploit Vector:** A short `setInterval` timer (1,500ms) repeatedly issuing `getDocs` against the database per connected user, causing massive read amplification, high billing/quota consumption, and service outage.
   - **Defense:** Completely removed `setInterval` from `Header.tsx`. Replaced polling with event-driven synchronization (`settings-updated` and `storage` events) and added local storage caching (`cn_sub_${email}`), ensuring zero ongoing database reads while maintaining instant UI synchronization across views.

7. **Vulnerability: Crawl Budget Exhaustion & Thin-Content Duplicate Indexing**
   - **Exploit Vector:** Search crawlers getting trapped indexing arbitrary internal search strings (`/?search=...`) or private editorial/utility views (`/admin`, `/settings`, `/profile`, `/liked`, `/delete-account`), diluting Google PageRank and risking thin-content search penalties.
   - **Defense:** Injected dynamic `noindex, follow` on internal search results and reader profile pages so discovered links are crawled without indexing thin parameter permutations. Injected `noindex, nofollow` on `/admin` to keep the editorial desk private. Configured explicit `robots.txt` disallows for `/admin`, `/profile`, `/settings`, `/liked`, `/delete-account`, and `/api/` while giving `Googlebot` and `Googlebot-News` unrestricted crawling on verified public news dispatches.

8. **Vulnerability: Geolocation Spoofing & Local Search Intent Mismatch**
   - **Exploit Vector:** Missing or conflicting local geographic metadata causing Google search algorithms to classify the domain as a generic global portal, losing top SERP rankings on high-volume regional queries like "news near Jharkhand", "Jharkhand news", or "Ranchi news live".
   - **Defense:** Implemented authoritative W3C Geo & ICBM coordinates (`geo.region: IN-JH`, `geo.placename: Jharkhand, India`, `geo.position: 23.6102;85.2799`, `ICBM: 23.6102, 85.2799`, `coverage: Jharkhand, Ranchi, Jamshedpur, Dhanbad, Bokaro, India`) and Schema.org `areaServed` mapping for Jharkhand and major municipal districts. Also injected dedicated Google News keywords (`<news:keywords>`) inside `sitemap.xml` for all stories covering Jharkhand.

9. **Vulnerability: Public Reader Traffic Exhausting Firestore Free Quota (DoS)**
   - **Exploit Vector:** Public readers querying Firestore collections directly on page loads easily exceed Google Cloud's 50,000 free daily read quota, causing total application downtime for readers and authors alike.
   - **Defense:** Decoupled data architectures: Cloudflare R2 serves all public reads via global CDN edge caches (`media.currentnews.blog/articles/feed.json` and `${id}.json`) with 0 Firestore read consumption. Firebase Authentication and Firestore writes are isolated exclusively to authenticated admin/editor desks, guaranteeing 100% reader availability with zero risk of quota-induced blackouts.

10. **Vulnerability: Ingress Proxy Spoofing & TCP Race-Condition Failures under Load Balancers**
   - **Exploit Vector:** Attackers forging client IP headers (`X-Forwarded-For`, `CF-Connecting-IP`) to bypass security rate limits, or upstream load balancers (Google Cloud Load Balancer / Cloudflare) dropping requests with `502 Bad Gateway` when backend servers close idle TCP connections prematurely during traffic spikes.
   - **Defense:** Configured `app.set('trust proxy', true)` in `server.ts` to allow verified upstream proxies to correctly populate client IPs and protocols. Aligned Node's TCP socket settings with `server.keepAliveTimeout = 650000ms` (650s) and `server.headersTimeout = 660000ms` (660s) to exceed GCLB's 600s timeout. Created frontend multi-origin load balancer (`clientLoadBalancer.ts`) with automated circuit breaking and failover to ensure readers never encounter dead ends or frozen screens.

11. **Vulnerability: Prompt Fatigue & Intrusive Interstitial SEO Penalties**
   - **Exploit Vector:** Aggressive floating subscription prompts (push notification sheets, newsletter modals) triggering high bounce rates and risking Google Search Core Web Vitals penalties for intrusive interstitials.
   - **Defense:** Permanently removed `NotificationBanner.tsx` and `NewsletterPopup.tsx` from the codebase and DOM, guaranteeing a distraction-free, zero-interruption reading environment.

12. **Vulnerability: Stateless Container Disk Evaporation & Cache Invalidation Race on Cloud Run**
   - **Exploit Vector / Failure Mode:** In Google Cloud Run, container filesystems are ephemeral. If an application stores writes only on local disk (`data/articles/`), those files vanish whenever the container scales down or restarts. Furthermore, an external CDN polling mechanism fetching from an un-synced bucket overwrote server RAM cache with stale data, causing user articles to disappear 30 seconds after publishing.
   - **Defense:**
     - Enforced Dual-Persistence: Published articles are immediately committed to Cloud Firestore (`posts/{postId}`) via client SDK with Firebase Auth and server-side REST API sync.
     - Implemented `mergeFeedWithLocalAndCache()`: Whenever the server queries remote CDN or S3, it merges the remote list with all local disk and memory articles. CDN polls are mathematically forbidden from overwriting or deleting articles present in local storage.
     - Added 0ms Client Cache: In `DraftPublicationView.tsx`, articles are saved to `compressedStorage` (`cn_compressed_stories_v2` and single-article keys) and dispatched via `stories-updated` events, guaranteeing articles are immediately and permanently visible to the author.

13. **Vulnerability: Insecure Client-Side Admin Elevation & Missing Authorization on Write Endpoints**
    - **Exploit Vector:** Relying on client-side hardcoded email arrays (`AUTHORIZED_ADMIN_EMAILS`, `VITE_ADMIN_EMAILS`) allowed attackers to tamper with local storage, forge environment variables, or invoke backend write routes directly without token verification.
    - **Defense:** Replaced all hardcoded email lists with server-side Firebase Custom Claims (`admin`, `writer`, `none`). Implemented `requireRole` middleware validating tokens with `checkRevoked: true`, requiring `email_verified === true`, and checking claims. Protected all admin and write endpoints (`/api/admin/*`, `/api/articles/save`, `/api/upload`, `/api/mail/send-alert`, `/api/push/broadcast`). In `src/hooks/useAuthState.ts`, roles are extracted exclusively from the cryptographically verified ID token claims.

14. **Vulnerability: Admin Surface Exposure, Search Indexing & IDOR on Public Reader Host**
    - **Exploit Vector:** Public readers visiting `/admin` on the main domain (`currentnews.blog`) or search crawlers indexing administrative panels, alongside malicious writers modifying articles authored by other newsroom reporters.
    - **Defense:** Enforced host segregation in `server.ts`: `admin.currentnews.blog` serves exclusively `/admin`, `/api/admin`, and static assets, and automatically injects `X-Robots-Tag: noindex, nofollow` on every response. Public hosts (`currentnews.blog` and `www`) issue 301 redirects for `/admin` and return HTTP 404 JSON for `/api/admin/*`. In `handleAdminCreateOrUpdateArticle` and `handleAdminDeleteArticle`, ownership is strictly checked (`author_uid === req.user.uid` for writers; only admins can modify or archive other reporters' work).

15. **Vulnerability: Cloudflare Edge Worker Role Forgery & Hardcoded Email Desync**
    - **Exploit Vector:** Edge worker previously maintained static email lists and bypassed checks on `@currentnews.blog` email suffixes, allowing unverified or spoofed Google accounts to access `/subscribers` and trigger D1 imports.
    - **Defense:** Upgraded `verifyFirebaseIdToken` with Web Crypto API to strictly extract `payload.role` and `payload.email_verified`. Enforced that `iat` cannot be in the future and `auth_time` must be present and valid. Defined `isAdmin(user) = user.role === 'admin' && user.emailVerified === true`. Purged all hardcoded email lists, environment variables (`ADMIN_EMAILS`), and suffix wildcards. Admin endpoints return 401 on missing tokens and 403 on non-admin roles.

16. **Vulnerability: Input Fuzzing, Unbounded D1 Row Injection & Memory Buffer Exhaustion**
    - **Exploit Vector:** Malicious callers generating arbitrary `postId` parameters on `/reaction/:postId` or `/view/:postId` to inject millions of junk rows into D1 `posts_stats`, or sending megabyte-scale JSON payloads to crash worker isolates.
    - **Defense:** Enforced strict regex `/^[A-Za-z0-9_-]{6,64}$/` on `postId` and `/^[A-Za-z0-9_-]{16,128}$/` on push subscription `id`. Enforced strict RFC email regex and 254-character bounds on `/subscribe`. Added global `parseJsonBody` capping incoming request payloads at 16 KB (allowing up to 5 MB exclusively on admin-authenticated `POST /import`). Enforced `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` on all authenticated routes.

17. **Vulnerability: Android App Relative Fetch Black Hole & Sensitive Server Code in APK Bundle**
    - **Exploit Vector:** In Capacitor Android builds, relative network calls (e.g. `fetch('/api/...')`) resolve against local WebView `http://localhost/api/...`, resulting in failed requests and app dead-ends. Furthermore, bundling `dist/server.cjs` and sourcemaps into `dist/` caused server source code and secrets to be copied directly into `android/app/src/main/assets/public/` during `cap sync`.
    - **Defense:** Created `src/utils/webBase.ts` exporting `webUrl(path)` which dynamically prefixes reader-facing routes with `https://www.currentnews.blog` on native platforms (`Capacitor.isNativePlatform()`). Reconfigured `vite.config.ts` (`sourcemap: false`) and `package.json` build scripts so that `server.cjs` is compiled directly in the root workspace outside `dist/` with no `.map` files generated, completely isolating server bundles from the client and Android distribution assets.

18. **Vulnerability: Sensitive Credential Leakage in Auth Failure Logs & Silent Token Dropping**
    - **Exploit Vector:** Unsanitized server logs printing raw Authorization headers, user emails, or database connection strings during authentication exceptions, exposing credentials in container log aggregators.
    - **Defense:** Strict sanitization in `requireRole.ts`: console warnings strictly emit `[auth] <code> <method> <path> hasHeader=<bool> projectId=<value> firebaseErrorCode=<error.code>`. Tokens, full emails, and database URLs are never logged.

19. **Vulnerability: Email Header Injection, Open Redirect & Outbound Mail Flooding on `/api/mail/send-alert`**
    - **Exploit Vector:** Attackers passing newline characters (`\r\n`) in `title` to inject arbitrary SMTP/Resend headers (BCC/CC), passing external phishing URLs in `link` to turn official emails into phishing lures, or rapidly spamming the endpoint to exhaust email quota and blacklist sending reputation.
    - **Defense:** In `api/mail/send-alert.ts`, stripped all newlines and carriage returns from `title` (`replace(/[\r\n]+/g, ' ')`) and HTML-escaped it for both email subject, HTML template, and plain text body. Enforced strict URL parsing via `new URL()`, requiring `hostname` to be `currentnews.blog` or `www.currentnews.blog` (defaulting to safe root domain on mismatch). Attached a dedicated `express-rate-limit` limiter capping requests to 5 per hour per client IP.

20. **Vulnerability: API Resource Exhaustion, Client IP Spoofing & Insecure Database TLS Verification**
    - **Exploit Vector:** Attackers flooding public `/api/*` reader routes to cause CPU starvation, spoofing `X-Forwarded-For` headers to bypass rate limits when `trust proxy` was blindly set to `true`, and potential TLS Man-in-the-Middle on database connections configured with `rejectUnauthorized: false`.
    - **Defense:** Mounted `express-rate-limit` with 300 requests per 15 minutes across `/api/*`. Replaced `app.set('trust proxy', true)` with `app.set('trust proxy', 2)` in `server.ts` to strictly trust the 2 rightmost reverse proxy hops (GFE / Cloudflare) and resolve authentic client IPs. Removed all instances of `rejectUnauthorized: false` across database connection scripts, requiring valid CA TLS verification. Added `helmet` with comprehensive CSP directives and HSTS enabled.

21. **Vulnerability: Web Push SSRF, Key Forgery, Subscriber Table Flooding & Ephemeral Disk Loss**
    - **Exploit Vector:** Attackers submitting arbitrary `endpoint` URLs on `/api/push/subscribe` pointing to internal AWS/GCP metadata services (`http://169.254.169.254/`), rogue webhooks, or massive payloads to flood database storage; generating rogue VAPID keys on server restart causing lost subscriber delivery; or storing push subscriptions on ephemeral container disk files (`data/push_subscriptions.json`) that vanish on Cloud Run instance recycling.
    - **Defense:**
      - Persistent Neon Postgres storage: Migrated push subscription storage to shared Neon table `push_subscriptions` (`id bigserial`, `endpoint unique`, `p256dh`, `auth`, `user_agent`, `created_at`). Subscribe uses `INSERT ... ON CONFLICT (endpoint) DO NOTHING` and unsubscribe uses `DELETE WHERE endpoint = $1`. Completely eliminated ephemeral JSON disk storage.
      - Push Gateway SSRF Prevention: Enforced strict URL parsing on `endpoint`, requiring protocol `https:` and restricting hostnames exclusively to approved push delivery services: `fcm.googleapis.com`, `*.fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`, and `updates.push.services.mozilla.com` / `*.updates.push.services.mozilla.com` with a 500-character ceiling.
      - Cryptographic Key Sanitization: Validated `p256dh` (max 200 chars) and `auth` (max 50 chars) strictly against base64url regex (`^[A-Za-z0-9_-]+$`).
      - Rate Limiting: Mounted a dedicated `pushLimiter` on `/api/push/subscribe` and `/api/push/unsubscribe` capping requests to 10 per hour per IP.
      - VAPID Key Integrity: Public key is read strictly from `process.env.VAPID_PUBLIC_KEY`. Dynamic runtime key generation was eliminated, returning HTTP 503 if unconfigured. Broadcast and subscriber count routes were removed from the public reader application.

22. **Vulnerability: CSP Video Player & Social Plugin Blocking / Uncontrolled Wildcard Leakage**
    - **Exploit Vector:** Overly restrictive Content Security Policy (`frame-src 'self' https://*.youtube.com`) breaking third-party news media video embeds (Facebook reels/videos, Facebook Social Plugins SDK) or developers attempting to fix broken media embeds by using wildcards (`frame-src *` or `script-src *`) which introduces severe XSS and clickjacking vulnerabilities.
    - **Defense:** Avoided wildcard directives. Whitelisted only verified vendor hostnames in `server.ts` Helmet CSP:
      - `frame-src`: `https://www.facebook.com`, `https://facebook.com`, `https://*.facebook.com`, `https://www.youtube.com`, `https://youtube.com`, `https://www.youtube-nocookie.com`.
      - `script-src`: `https://connect.facebook.net`, `https://*.facebook.net`, `https://*.facebook.com` alongside existing Google AdSense and analytics scripts.
      - `connect-src`: `https://*.facebook.com`, `https://*.facebook.net`, `https://*.fbcdn.net`.
      - Auto-Prompt Notification Guard: `initPushNotificationPermissionOnSiteOpen()` gracefully checks for native browser capability (`'Notification' in window`) and default permission state, preventing permission prompt hijacking and automatically syncing reader settings upon user grant without UI degradation.

23. **Vulnerability: Search Input Regex DoS (ReDoS), XSS Reflection & Unaborted Cold-Cache Races**
    - **Exploit Vector:** Users pasting regex metacharacters (`[.*+?^${}()|[\]\\]`), `<script>` XSS payloads, or rapidly toggling the Line 2 search bar while `/feed.json` warms in the background, causing `SyntaxError` in regex matchers, reflected DOM injection in highlight renderers, or stale state updates on unmounted inputs.
    - **Defense:** Avoided dynamic `new RegExp(userInput)` construction entirely in `renderSuggestionHighlight`, `generateSuggestions`, and `HomeView` filtering—using pure `String.prototype.indexOf` / `includes` substring matching and React JSX text nodes (auto-escaped by React). Guarded the cold-cache `/feed.json` warm-up fetch with `AbortController` cleanup, `Accept: application/json`, and strict JSON prefix verification before `JSON.parse`.

24. **Vulnerability: Over-Permissive Wildcard CORS, Static Bundle PII Leakage & Global `fetch` Monkey-Patching in APK**
    - **Exploit Vector:** (a) Fixing mobile APK CORS errors by setting `Access-Control-Allow-Origin: *` across authenticated API routes exposes user endpoints to arbitrary malicious websites; (b) copying raw `data/articles/*.json` directly into `public/articles/*.json` leaks internal staff `authorEmail` and `authorId` PII in static APK/web assets; (c) enabling global `CapacitorHttp: { enabled: true }` monkey-patches `window.fetch` and breaks Firebase Auth / WebChannel streams.
    - **Defense:** (a) Implemented an explicit origin allowlist (`https://currentnews.blog`, `https://www.currentnews.blog`, `https://localhost`, `http://localhost`, `capacitor://localhost`) with `Vary: Origin` in `server.ts`; (b) `scripts/sync-public-articles.mjs` clears `public/articles/*.json` and writes empty `[]` to `public/feed.json`; (c) invoked `CapacitorHttp.get` / `CapacitorHttp.request` selectively only for external `https://` API/CDN calls on native platforms while leaving global `window.fetch` untouched.

25. **Vulnerability: Public Exposure of Cloud Build Logs in Static `public/` Assets & Unpinned Container Dependency Fallback**
    - **Exploit Vector:** (a) Uploading Cloud Build JSON logs into workspace `public/assets/aistudio/*downloaded-logs*.json` without `.dockerignore` exclusions allows Vite and `COPY --from=builder /app/public ./public` to expose internal GCP Project IDs, Cloud Build IDs, service account numbers, and commit metadata on public static URLs; (b) `package-lock.json` drift (`Missing: @capacitor/push-notifications@8.1.3`) forces Docker builds out of deterministic `npm ci` into unpinned `npm install`, risking dependency confusion/version drift and causing `server.cjs` crashes if dev-only `vite` is required at top level under `--omit=dev`.
    - **Defense:** Added `*downloaded-logs*`, `public/assets/aistudio`, `server.cjs`, and `*.map` to `.dockerignore`; regenerated `package-lock.json` so `npm ci` and `npm ci --omit=dev` pass deterministically; moved `vite` loading in `server.ts` to dynamic `await import('vite')` strictly inside `NODE_ENV !== "production"`.

26. **Vulnerability: Reader Catalog SQL Injection, Draft/Staff PII Leakage & Cold-Start Cache Stampede (DoS)**
    - **Exploit Vector:** (a) Crafting malicious `:id` or `?slug=` path parameters (`/api/posts/' OR 1=1--`) to extract unpublished `draft`/`archived` articles or internal staff `author_email`/`author_uid` columns from Neon PostgreSQL; (b) 100+ concurrent readers hitting `/api/posts` during a Cloud Run cold start and triggering thousands of outbound R2/Neon requests (cache stampede); (c) `NEON_DATABASE_URL` configured with a restricted push-only DB role (`42501 permission denied for table articles`) causing every `/api/posts` request to throw 500 or hammer Neon on every hit.
    - **Defense:** (a) Enforced strict `$1` parameterized SQL queries with hard `WHERE status = 'published'` predicates and explicit column projection in `src/server/articleCatalog.ts` that never selects `author_email` or `author_uid`, plus `stripArticlePii()` scrubbing on all R2/Worker payloads; (b) guarded catalog resolution with a single-flight `inFlightFeedPromise` lock, 60-second memory cache, bounded batch size (`10` on server, `8` on native APK), and startup `warmupArticleCatalog()`; (c) caught PostgreSQL `42501` / `42P01` codes cleanly with a 5-minute circuit backoff so restricted roles degrade silently to R2 CDN without leaking DB errors.


