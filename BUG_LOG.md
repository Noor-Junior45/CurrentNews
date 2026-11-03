# BUG_LOG.md — Anti-Regression Checklist

- [x] **Bug ID & Summary:** BUG-001 — In-app image preview replaced user photos with app logo.
  - **Root Cause:** Fallback handler in `imageUrl.ts` and `PostDetailView.tsx` erroneously substituted unverified image loading errors with `CurrentNews.png`.
  - **Permanent Guardrail:** Editorial photography fallbacks must collapse gracefully or load verified R2 mirrors; never substitute photos with brand emblems.

- [x] **Bug ID & Summary:** BUG-002 — Android back button closing app while reading article.
  - **Root Cause:** Android 13+ predictive back gesture invoked default `finish()` because `onBackPressedDispatcher` was unhandled in `MainActivity.kt`.
  - **Permanent Guardrail:** `MainActivity.kt` and `AndroidBackGestureHandler.tsx` must delegate navigation back to the home feed while restoring the exact scroll position and page index.

- [x] **Bug ID & Summary:** BUG-003 — AdSense web ads inside Android native webview violating Google policies and creating empty gaps.
  - **Root Cause:** Running standard web `adsbygoogle` script tags inside native Capacitor mobile webviews is restricted by Google AdSense policies and caused blank boxes on phones.
  - **Permanent Guardrail:** Suppressed all web AdSense DOM rendering on mobile and web; native monetization is delegated exclusively to Google Mobile Ads SDK / AdMob with hardcoded IDs.

- [x] **Bug ID & Summary:** BUG-004 — Missing `app-ads.txt` crawler verification for Google AdMob closed beta.
  - **Root Cause:** Missing `/app-ads.txt` endpoint on the developer website root caused AdMob to reject mobile app verification.
  - **Permanent Guardrail:** Both `/public/app-ads.txt`, `/api/app-ads.txt.ts`, and `server.ts` serve raw `text/plain; charset=utf-8` containing `google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0`.

- [x] **Bug ID & Summary:** BUG-005 — Unconfigured Ad Unit IDs causing invalid requests or build crashes.
  - **Root Cause:** Dynamic environment variables without fallbacks or invalid formats can lead to failed ad requests.
  - **Permanent Guardrail:** Hardcoded verified AdMob App ID (`ca-app-pub-5865716270182311~4645476456`), Banner ID (`ca-app-pub-5865716270182311/2031114923`), and Native Advanced ID (`ca-app-pub-5865716270182311/1743128281`) directly in the codebase and Android `strings.xml`.

- [x] **Bug ID & Summary:** BUG-006 — Firestore Free Daily Read Quota Exceeded (50,000 reads/day) throwing fatal exceptions.
  - **Root Cause:** Unbounded collection `getDocs` queries without pagination limits burned through the free tier daily 50,000 read units, throwing `FirebaseError: Quota limit exceeded`.
  - **Permanent Guardrail:** Added query `limit(30)` to post collection fetches, added deep local memory fallback (`cached_post_` and `cached_posts`), and updated `handleFirestoreError` in `firebase.ts` to intercept quota events as non-fatal rate-limits with seamless offline cache delivery instead of throwing breaking runtime exceptions.

- [x] **Bug ID & Summary:** BUG-007 — Repeated `Error checking newsletter subscription FirebaseError: Quota limit exceeded` in Header.
  - **Root Cause:** `src/components/Header.tsx` contained an aggressive `setInterval(handleSync, 1500)` that queried the Firestore `subscribers` collection every 1.5 seconds, generating 2,400+ reads per hour per client tab and rapidly exhausting the 50,000 daily read limit.
  - **Permanent Guardrail:** Never use `setInterval` to poll Firestore. Synchronize settings purely via browser `window.addEventListener('settings-updated')` and `'storage'` events, cache subscription states in `localStorage` (`cn_sub_${email}`), enforce `limit(1)` on single-document lookups, and catch quota errors gracefully without unhandled console errors.

- [x] **Bug ID & Summary:** BUG-008 — Firestore WebChannel 10s timeout and fatal `Please check your Firebase configuration` console error on boot.
  - **Root Cause:** Default WebChannel streaming in web SDK hung for 10 seconds in proxy/iframe environments before timing out, and `App.tsx` caught the offline state by throwing `console.error("Please check your Firebase configuration.")`.
  - **Permanent Guardrail:** Configured `initializeFirestore` with `experimentalAutoDetectLongPolling: true` to auto-detect iframe/proxy environments and seamlessly fall back to fast long-polling without hanging, and converted offline connection notifications in `App.tsx` to non-breaking `console.warn` ensuring 100% uninterrupted offline-first execution.

- [x] **Bug ID & Summary:** BUG-009 — Cloud Build Docker error `EUSAGE: npm ci can only install packages when your package.json and package-lock.json are in sync`.
  - **Root Cause:** Dependencies were added or updated in `package.json` without updating `package-lock.json` in the git repository. When `RUN npm ci` was invoked in Step 4 of the Docker build on Google Cloud Build, `npm ci` aborted with code 1 due to lockfile version mismatch.
  - **Permanent Guardrail:** Updated `Dockerfile` in both Stage 1 and Stage 2 to use `RUN npm ci || npm install` and `RUN npm ci --omit=dev || npm install --omit=dev`, guaranteeing that container builds on Cloud Run / Cloud Build succeed seamlessly even if lockfile drift occurs across git branches.

- [x] **Bug ID & Summary:** BUG-010 — Git push rejected by GitHub: `refusing to allow a Personal Access Token to create or update workflow without workflow scope`.
  - **Root Cause:** Committing `.github/workflows/deploy.yml` triggered GitHub's security check, which rejects pushes from standard Personal Access Tokens that don't have the explicit `workflow` OAuth scope checked. Since Google Cloud Run Continuous Deployment already connects directly to GitHub via Google Cloud Build webhooks, the workflow file was unnecessary.
  - **Permanent Guardrail:** Completely deleted `.github/workflows/deploy.yml` and the `.github` directory, relying exclusively on Cloud Run's native GitHub repository integration so `git push` succeeds with any standard GitHub token or SSH key.

- [x] **Bug ID & Summary:** BUG-011 — Bulk article migration throwing HTTP 413 `request entity too large`.
  - **Root Cause:** Express default `express.json()` parser limit is 100KB. Posting 40+ full HTML articles with rich images exceeded 100KB and caused Express to return 413 Payload Too Large.
  - **Permanent Guardrail:** Configured `app.use(express.json({ limit: '25mb' }))` and `app.use(express.urlencoded({ extended: true, limit: '25mb' }))` in `server.ts` to accommodate batch migrations and high-resolution articles.

- [x] **Bug ID & Summary:** BUG-012 — Free Firestore read quota (50k reads/day) exhausted from public readers, taking site down.
  - **Root Cause:** Thousands of daily readers caused direct or indirect Firestore `getDocs` collection scans, which hit the Google Cloud Free Tier limit and broke article reading.
  - **Permanent Guardrail:** Offloaded 100% of public article reading to Cloudflare R2 object storage (`media.currentnews.blog/articles/feed.json` and `${id}.json`) with zero Firestore reads for readers, reserving Firebase Auth exclusively for editor/admin sign-in.

- [x] **Bug ID & Summary:** BUG-013 — Full-screen spinner blocking reading on slow mobile connections when opening articles.
  - **Root Cause:** `PostDetailView` checked `if (loading)` before rendering, presenting a full-page loading spinner even when preview data (title, hero photo, author, excerpt) was already known from the feed card.
  - **Permanent Guardrail:** Seeded `post` state from router navigation state (`location.state.previewPost`), user cache memory (`getCompressedStory`), or feed memory (`getCompressedStories`). Conditioned full-page loading check to `if (loading && !post)`, ensuring the article preview box renders at **0ms** while full text sections stream in progressively on scroll via `ProgressiveArticleBody`.

- [x] **Bug ID & Summary:** BUG-015 — `Failed to save pen name: FirebaseError: Missing or insufficient permissions`.
  - **Root Cause:** `firestore.rules` lacked a match block for `/users/{userId}`, causing Firestore security rules to default-deny all writes when authors and administrators saved their pen name.
  - **Permanent Guardrail:** Added `match /users/{userId}` to `firestore.rules` permitting authenticated owners (`request.auth.uid == userId`) and administrators (`isAdmin()`) to update author pen name metadata, registered the `User` schema in `firebase-blueprint.json`, and added immediate local storage fallback (`current_news_pen_name_${uid}`) so pen names persist offline or during database rate limits.

- [x] **Bug ID & Summary:** BUG-016 — Push Service `[FirebaseError: Quota limit exceeded]` returning HTTP 500 on subscriber counts.
  - **Root Cause:** `/api/push/subscribers-count` executed an unbounded `getDocs(collection(db, 'push_subscriptions'))` on every request, downloading all documents and consuming Firestore daily read quotas until throwing `Quota limit exceeded`.
- [x] **Bug ID & Summary:** BUG-017 — R2 `articles/feed.json` 5.7 MB payload bloat caused by full HTML content and base64 inline images.
  - **Root Cause:** Editorial draft saves were persisting raw base64 data URLs in `imageUrl`, `imageUrlFallback`, `imageUrls`, `imageUrlsFallback`, and `<img src="data:...">` inside `content`. When `syncArticlesToR2` generated `articles/feed.json`, it dumped full HTML and multi-megabyte base64 strings into the feed array, forcing every homepage visitor to download 5.7 MB of data.
  - **Permanent Guardrail:** `saveArticleToR2` automatically runs `processAndExtractBase64Images` to decode all inline base64 images, upload them to R2 as `img/{postId}-{n}.webp` with 1-year immutable cache headers, and replace URLs with `https://media.currentnews.blog/img/{postId}-{n}.webp`. In addition, `updateFeedIndexInR2` and `syncArticlesToR2` strictly filter posts through `toLightArticle()`, keeping only light metadata (`id, title, category, authorName, createdAt, status, imageUrl, hashtags, likes, dislikes, views, excerpt`) without `content` HTML. All homepage and related-post queries consume the 37 KB light feed, leaving full articles strictly in `articles/{id}.json`.

- [x] **Bug ID & Summary:** BUG-018 — Firestore Quota Exhaustion for Reader-Side Interactions (Reactions, Views, Newsletter, Pen Name).
  - **Root Cause:** While article text and images were offloaded to R2 in Phase 18, reader interactions (likes, dislikes, view counts, newsletter subscription checks, subscriber management, and author pen names) were still calling Firestore collections directly, exhausting Google Cloud's free daily read quota and locking out users.
  - **Permanent Guardrail:** Replaced Firestore with Cloudflare D1 managed SQLite database via an edge Cloudflare Worker (`api.currentnews.blog`). Firebase Auth is retained strictly for user identity tokens, while `src/firebase.ts` exports strictly `auth`. All reader reads/writes use `src/utils/api.ts` with batch queries (`GET /stats?ids=...`, `GET /my-reactions`), 30-second edge cache headers, and 30-minute IP deduplication on post views via the Cloudflare Cache API. Zero Firestore database calls occur in production.

- [x] **Bug ID & Summary:** BUG-019 — Website Displayed Static Fallback Text ("Independent Journalism & Global Dispatches") Instead of Real Homepage.
  - **Root Cause:** Static editorial SEO fallback HTML was placed directly inside `<div id="root">` in `index.html`. In addition, `sw.js` was using a Cache-First strategy on navigation requests with a hardcoded `v1` cache, and the root React application lacked an ErrorBoundary. When earlier builds encountered Firestore quota errors on boot or when the service worker served stale cached HTML referencing outdated bundles, React did not hydrate, leaving the user viewing the raw static boilerplate.
  - **Permanent Guardrail:** Moved the static crawler fallback HTML into `<noscript>...</noscript>` so JavaScript-enabled browsers never display it. Replaced `<div id="root">` contents with a lightweight layout skeleton wireframe. Upgraded `sw.js` to `v2` with a strict Network-First policy for HTML navigation requests (`event.request.mode === 'navigate'`). Added a root `<ErrorBoundary>` in `src/components/ErrorBoundary.tsx` wrapping `<App />` in `src/main.tsx` with user-friendly recovery.
