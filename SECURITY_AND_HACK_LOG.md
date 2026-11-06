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
