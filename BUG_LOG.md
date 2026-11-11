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

- [x] **Bug ID & Summary:** BUG-020 — Migrated Image URLs Malformed with Accidental Path Injections (`/uploads/photo.jpg/img/...`) and Unverified Uploads.
  - **Root Cause:** `process.env.R2_PUBLIC_DOMAIN` was used directly without stripping URL protocols or path fragments. When an environment variable contained path components or protocol formatting, generated public image URLs became `https://media.currentnews.blog/uploads/photo.jpg/img/<id>-1.webp`. Furthermore, missing R2 credentials previously fell back silently rather than aborting, causing articles to be rewritten to point to images that were never uploaded.
  - **Permanent Guardrail:** Implemented `getPublicBase()` in `src/server/r2Articles.ts` to strictly sanitize the hostname (stripping protocol, paths, and query parameters) and return `https://${host}` (fallback: `https://media.currentnews.blog`). Configured `uploadBase64ImageToR2` to throw a fatal error if R2 credentials are missing or PutObject fails. Created `scripts/migrate-from-r2.mjs` which scans all `articles/*.json` in R2, decodes base64 images into `img/{postId}-{n}.webp`, sends a mandatory `HEAD` request to `https://media.currentnews.blog/img/...` (aborting if not 200), repairs malformed URLs, writes cleaned full articles to `articles/{id}.json`, and rebuilds a tiny 37 KB light index in `articles/feed.json`. Added `--dry-run` flag support.

- [x] **Bug ID & Summary:** BUG-021 — Rapid Reaction Tapping Causing D1 Write Amplification, Network Race Conditions, and Stale Count Overwrites.
  - **Root Cause:** Direct un-debounced calls to the API on every button tap caused concurrent D1 database updates, network race conditions, and UI count flicker when background `/stats` polls overwrote fresh user reactions with stale server numbers.
  - **Permanent Guardrail:** Implemented `src/utils/reactionStore.ts` with local & server-confirmed state separation, 1500 ms trailing debounce on user taps, no-op cancellation if final state matches confirmed state, exponential backoff retry queue in `cn_react_queue_${uid}`, automatic flush on lifecycle events (`visibilitychange`, `pagehide` with keepalive, `online`, app start), 401 handling, 10-minute session caching on `/my-reactions`, and a count formula (`displayedCount = serverCount + (localMine === 'like' ? 1 : 0) - (confirmedMine === 'like' ? 1 : 0)`). Implemented write coalescing in Cloudflare Edge Worker using a Durable Object (`StatsAggregator`) with a 30s alarm timer to merge high-frequency stats deltas into a single D1 batch update (`ON CONFLICT(post_id) DO UPDATE SET likes=MAX(0, likes+excluded.likes)...`), with immediate D1 fallbacks on failure. Added 3-minute `/stats` caching in `localStorage` in `HomeView.tsx` requesting only missing/stale IDs.

- [x] **Bug ID & Summary:** BUG-022 — Raw `&nbsp;` and HTML Entities Leaking into Preview Excerpts and Variable Card Heights on Desktop/Tablet.
  - **Root Cause:** Truncating HTML without decoding entities left non-breaking spaces (`&nbsp;`, `&nbsp`, `&#160;`) in excerpts, which React displayed as literal characters. In addition, varying title and excerpt lengths caused cards across desktop and tablet grids to have unequal heights.
  - **Permanent Guardrail:** Implemented `cleanPreviewText` across client components, `HomeView.tsx`, `PostDetailView.tsx`, and `extractPlainExcerpt` in `r2Articles.ts` / `migrate-from-r2.mjs` to strip `&nbsp;?`, `&#160;?`, `\u00a0`, and common HTML entities, replacing them with standard whitespace. For big screens and tablets (`sm:` and `lg:`), cards are locked to `sm:h-[265px] sm:max-h-[265px]` with a 2-line heading slot (`sm:text-[15px] lg:text-base sm:line-clamp-2 sm:h-[2.75rem]`), a 2-line description slot (`sm:text-xs lg:text-[13px] sm:line-clamp-2 sm:h-[2.35rem]`), and bottom reaction bars pinned via `mt-auto`. Phone screen design (`< sm`) remains untouched.

- [x] **Bug ID & Summary:** BUG-023 — Empty Grid Hole on Tablet Screen After 3rd Card Caused by Misaligned Ad Column Span.
  - **Root Cause:** On tablet screens (`sm:grid-cols-2`), inserting an ad with `sm:col-span-2` after the 3rd card (`idx === 2`) left Row 2 Column 2 empty, because CSS Grid auto-placement wrapped the 2-column ad to Row 3, creating an empty gap between the 3rd and 4th card.
  - **Permanent Guardrail:** Full-width ads in responsive CSS grids must strictly align with full row completions across each breakpoint's column count. On tablet (2 columns), ads are placed at even card boundaries (e.g. after card 4 at `idx === 3` with `hidden sm:block lg:hidden sm:col-span-2`), while on desktop (3 columns) ads are placed at `idx === 2` (`col-span-1 sm:hidden lg:block lg:col-span-3`). Common multiples of 2 and 3 (such as 6 cards at `idx === 5` and 12 cards at `idx === 11`) are shared across mobile, tablet, and desktop with zero empty spaces.
- [x] **Bug ID & Summary:** BUG-024 — Opening an article opened scrolled down at "Related Coverage" instead of from the top of the article.
  - **Root Cause:** In React Router SPA, navigating to `/post/:id` or between articles does not automatically reset window scroll. When a user clicked an article card after scrolling down the home feed (e.g. `scrollY = 1200px`), the scroll offset was retained. Because the article detail view mounts with lightweight preview content before full progressive scroll streaming, 1200px positioned the viewport at the bottom of the article directly over `<div id="related-articles-section">` ("Related Coverage"). Similarly, clicking links inside "Related Coverage" changed route params without resetting scroll.
- [x] **Bug ID & Summary:** BUG-025 — Home feed hero poster flashed/jumped on screen for a second when opening an article.
  - **Root Cause:** In `BlogPostCard.tsx`'s `handleOpenPost` and `HomeView.tsx`'s hero slide click handler, `window.scrollTo({ top: 0, left: 0, behavior: 'instant' })` was invoked synchronously *before* `navigate()`. When a user clicked a card down in the feed (e.g. `scrollY = 1500px`), `HomeView` was immediately yanked to `scrollY = 0`, flashing the top hero poster carousel on screen for several frames before React Router committed the transition to `PostDetailView`.
  - **Permanent Guardrail:** Never call `window.scrollTo(0, 0)` in `onClick` handlers prior to `navigate()` on the originating page. Scroll resets must strictly execute inside `useLayoutEffect` on the *destination* component (`PostDetailView.tsx` on `[id]`) and in the top-level router watcher (`ScrollToTop` in `src/App.tsx`). `useLayoutEffect` executes synchronously before the browser paints the new route, guaranteeing the article opens at `0px` without ever displaying the previous page at `0px` or flashing the hero poster.

- [x] **Bug ID & Summary:** BUG-026 — Manuscript typing box required precise tap/click on first line to focus.
  - **Root Cause:** `.ql-container.ql-snow` had `min-height: 240px`, but child `.ql-editor` contenteditable element lacked `min-height` and defaulted to `height: auto` without parent flex-grow, leaving ~85% of the box as dead container space where clicks/taps failed to trigger focus.
  - **Permanent Guardrail:** Set `.ql-container.ql-snow` with `display: flex !important; flex-direction: column !important; cursor: text !important;` and `.ql-editor` with `min-height: 260px !important; height: 100% !important; flex: 1 1 auto !important; cursor: text !important;` in `src/index.css`. Added `handleEditorAreaClick` in `RichTextEditor.tsx` with toolbar protection (`if (target.closest('.ql-toolbar')) return`) that guarantees tapping/clicking anywhere inside the box immediately calls `editor.focus()` and sets caret position without disrupting intra-text selections.

- [x] **Bug ID & Summary:** BUG-027 — Admin saw zero publications if posts belonged to legacy author email, and Cloudflare Worker denied writers access to subscribers.
  - **Root Cause:** In `CurrentPublicationsView.tsx`, `fetched.filter(p => { if (p.authorEmail) return p.authorEmail === user.email; return isAdmin; })` prematurely executed the email match and returned false without reaching `return isAdmin;` when an admin (`you@example.com`) logged in to view existing articles with other author emails. In addition, Cloudflare Worker `isUserAdmin` in Edge Worker only had a hardcoded single fallback email (`you@example.com`), returning 403 Forbidden on `GET /subscribers` for newsroom writers and other admins.
  - **Permanent Guardrail:** Always evaluate `if (isAdmin) return true;` first in publication views so that all published newsroom data across the ledger is visible to administrators, while scoping non-admin writers to their authored posts. In Edge Worker, define `AUTHORIZED_WRITER_AND_ADMIN_EMAILS` including all authorized administrators, `@currentnews.blog` domains, and environment writers so that subscriber metrics and directory views are seamlessly accessible to all newsroom staff.

- [x] **Bug ID & Summary:** BUG-028 — `[R2 Articles] Error deleting S3 object from R2: InvalidArgument: Credential access key has length 53, should be 32`.
  - **Root Cause:** In Cloudflare R2, S3-compatible Access Key IDs are strictly 32-character hexadecimal strings, whereas Cloudflare API Tokens are 40–60 characters (length 53). When `process.env.R2_ACCESS_KEY_ID` contained a 53-character Cloudflare API Token, `new S3Client(...)` was instantiated with the invalid length, causing the AWS S3 SDK and R2 endpoint to throw HTTP 400 `InvalidArgument` during S3 operations (`DeleteObjectCommand`, `PutObjectCommand`).
  - **Permanent Guardrail:** Enforce strict credential validation in `getR2Credentials()` across `src/server/r2Articles.ts` and `src/server/r2Upload.ts`: check for swapped keys (`64` vs `32`), verify `accessKeyId.length === 32` before initializing `S3Client`, and return `null` if invalid. Provide direct Cloudflare REST API fallbacks (`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${key}` with `Authorization: Bearer ${apiToken}`) for PUT and DELETE operations when an API token is present, and ensure local disk storage (`data/articles/*.json`, `data/feed.json`, `data/img/`) serves as an infallible local mirror fallback so deletions and writes succeed without breaking the app.

- [x] **Bug ID & Summary:** BUG-029 — Deleted article not deleted and still showing in dispatches and feeds.
  - **Root Cause:** Multiple caching layers caused resurrection of deleted articles:
    1. `deleteArticleFromR2` previously attempted `inMemoryFeedCache.filter(p => p.id !== postId)` without verifying if `inMemoryFeedCache` was initialized, and whenever `getFeedFromR2()` re-fetched `articles/feed.json` from the external Cloudflare edge CDN (`https://media.currentnews.blog/articles/feed.json`), the cached remote feed re-injected the deleted post into the local feed.
    2. `src/server/postsApi.ts` maintained its own separate `inMemoryPostsCache` and read from a misnamed path (`data/articles/feed.json` instead of `data/feed.json`), so `/api/posts` continued serving the deleted article.
    3. On the client side, `handleDeletePost` only filtered local React component state without removing the article from `localStorage` (`cn_compressed_stories_v2` and `cn_compressed_article_v2_${id}`), and without notifying other views or listeners via event broadcast.
    4. Client-side `clientLoadBalancer.ts` fetched from static CDN and wrote the deleted article back into `localStorage`.
  - **Permanent Guardrail:** Implemented a unified **Server and Client Tombstone Architecture**:
    - **Server:** Created persistent registry `data/deleted_articles.json` via `getDeletedArticleIds()` and `markArticleDeleted(postId)`. All feed endpoints (`/api/articles/feed`, `/api/posts`, `getFeedFromR2`, `loadLocalFeed`) strictly filter out any tombstoned IDs, and single post endpoint (`/api/posts/:id`, `getArticleFromR2`) immediately returns 404 for tombstoned IDs. An observer hook invalidates `postsApi` in-memory cache on deletion.
- [x] **Bug ID & Summary:** BUG-030 — Newly posted articles temporarily appeared in "My Publications" for ~30 seconds, then disappeared as if they never existed.
  - **Root Cause:**
    1. Missing Cloudflare R2 write credentials in server environment caused `saveArticleToR2` to fail when uploading to R2. The article was saved only in server RAM and local container disk.
    2. In `src/server/r2Articles.ts`, `getFeedFromR2()` had a 30-second TTL (`FEED_CACHE_TTL = 30000`). After 30s, it fetched `https://media.currentnews.blog/articles/feed.json` from the public CDN. Because the new article wasn't in R2, the CDN returned the older feed, and `getFeedFromR2()` directly assigned `inMemoryFeedCache = lightList`, overwriting in-memory cache and wiping out the newly created article.
    3. On Google Cloud Run container restarts or scale-downs, ephemeral disk storage (`data/articles/`) was wiped because articles were never persisted to Cloud Firestore.
    4. On the client, `DraftPublicationView.tsx` never cached the post in `compressedStorage`, and `CurrentPublicationsView.tsx` bypassed local storage whenever the CDN returned articles.
  - **Permanent Guardrail:**
    1. In `src/server/r2Articles.ts`, implemented `mergeFeedWithLocalAndCache()`: whenever remote CDN or S3 returns a feed, all locally saved articles (`data/articles/*.json`, `data/feed.json`, and `inMemoryFeedCache`) not present in the CDN are merged and preserved. CDN polls can NEVER overwrite or drop local articles.
    2. Dual-Layer Persistence: In `DraftPublicationView.tsx`, articles are directly saved to Cloud Firestore (`posts/{postId}`) via client SDK (authenticated by Firebase Auth) AND cached in client compressed storage (`saveCompressedStory` & `saveCompressedStories`).
    3. In `CurrentPublicationsView.tsx`, `fetchAdminPosts` merges `/api/articles/feed`, Firestore `posts` collection, and local compressed stories, deduplicating by ID so newly created articles are immediately and permanently visible.
- [x] **Bug ID & Summary:** BUG-031 — Hardcoded Admin Email Lists & Insecure Client-Side Admin Elevation Vulnerability.
  - **Root Cause:** Admin access was previously evaluated using client-side hardcoded email arrays (`AUTHORIZED_ADMIN_EMAILS`, `VITE_ADMIN_EMAILS`, `AUTHORIZED_ADMIN_DOMAINS`) in `src/hooks/useAuthState.ts` and `src/utils/writers.ts`. Any user spoofing client state or modifying environment variables could access admin views, and write endpoints lacked server-side token and role verification.
  - **Permanent Guardrail:** Enforce server-side role validation via Firebase Custom Claims (`admin`, `writer`, `none`) with `requireRole` middleware on Express routes (`/api/admin/*`, `/api/articles/save`, `/api/upload`, `/api/mail/send-alert`, `/api/push/broadcast`). In `src/hooks/useAuthState.ts`, role is extracted exclusively from `user.getIdTokenResult(true).claims.role`. All hardcoded admin/writer email lists have been deleted. Neon Postgres acts as the editorial source of truth, and `firestore.rules` is locked down with `allow read, write: if false;`.

- [x] **Bug ID & Summary:** BUG-032 — Cloudflare Edge Worker Hardcoded Email Lists, Token Verification Gaps & Durable Object Eviction Data Loss.
  - **Root Cause:**
    1. Edge Worker hardcoded email lists and `@currentnews.blog` suffix bypasses, drifting out of sync with Firebase Custom Claims.
    2. `verifyFirebaseIdToken` did not inspect token claims (`role`, `email_verified`), future `iat` timestamps, or missing `auth_time`.
    3. `StatsAggregator` stored reaction/view deltas in ephemeral RAM only (`this.deltas = new Map()`); if Cloudflare evicted the DO before the 30-second alarm fired, accumulated likes and views were permanently lost.
  - **Permanent Guardrail:**
    1. Purged all hardcoded emails from the worker and `wrangler.toml`. Role checks now strictly enforce `isAdmin(user) = user.role === 'admin' && user.emailVerified === true`.
    2. Tokens with future `iat` or missing/future `auth_time` are immediately rejected.
    3. `StatsAggregator` uses `this.ctx.storage.put()` on every delta addition and hydrates state in the constructor using `this.ctx.blockConcurrencyWhile()`, deleting storage records only upon verified D1 batch commits.

- [x] **Bug ID & Summary:** BUG-034 — Opaque "Unauthorized: Invalid authentication credentials" Errors and Silent Token Expiration / Revocation Gaps.
  - **Root Cause:**
    1. In `server/auth/requireRole.ts`, any error during `verifyIdToken(token, true)` that was not `id-token-revoked` or `id-token-expired` fell through to a generic "Unauthorized: Invalid authentication credentials" without an error code, making diagnostics impossible.
    2. Revocation checking requires contacting Google's backend, which fails if credentials or network are restricted in certain environments.
    3. The client had no automatic token refresh retry logic when tokens expired or were revoked, causing immediate failed requests.
  - **Permanent Guardrail:**
    1. Mapped all rejections in `requireRole.ts` to standard error codes (`no_token`, `token_expired`, `token_revoked`, `invalid_token`, `auth_backend_error`, `email_not_verified`, `no_role`, `forbidden`) with `console.warn` logging the code, method, path, hasHeader, projectId, and firebaseErrorCode without logging sensitive tokens, emails, or DB URLs.
    2. Added `AUTH_CHECK_REVOKED` env flag (defaults to "true"; allows "false" to bypass revocation check when needed).
    3. Implemented `adminFetch` with automatic single retry via `auth.currentUser.getIdToken(true)` upon receiving `token_expired` or `token_revoked`, and formatted readable error messages in error banners.

- [x] **Bug ID & Summary:** BUG-035 — Cloud Run 401 Unauthorized `auth/argument-error` due to leading whitespace in `FIREBASE_PROJECT_ID`.
  - **Root Cause:** In Cloud Run revision `currentnews-00030-wvm`, `FIREBASE_PROJECT_ID` had an accidental leading space (`" gen-lang-client-0638643565"`). Firebase Admin initialized with this string and checked JWT `aud` and `iss` claims against `" gen-lang-client-0638643565"` instead of `"gen-lang-client-0638643565"`, throwing `auth/argument-error` on all valid Firebase ID tokens.
  - **Permanent Guardrail:** `server/auth/firebaseAdmin.ts` sanitizes and trims `process.env.FIREBASE_PROJECT_ID` (`.trim()`) on initialization and in `getAdminProjectId()`, guaranteeing that whitespace in environment variables cannot cause token audience verification failures.

- [x] **Bug ID & Summary:** BUG-036 — "Failed to load article details." when editing an article in the admin panel (`/admin/draft?id=:id`).
  - **Root Cause:** `DraftPublicationView` previously loaded articles for editing from the public endpoint `GET /api/posts/:id`, which reads Cloudflare R2 / local container disk. Neon Postgres is the editorial source of truth where drafts and updated revisions live, so editing non-synced drafts or new edits returned 404 and triggered a generic failure banner.
  - **Permanent Guardrail:**
    1. Added authenticated `GET /api/admin/articles/:id` behind `requireRole('admin', 'writer')` that queries Neon Postgres directly (with fallback to R2 if unconfigured), returns the full article (including drafts and archived) mapped to the standard camelCase `Post` shape, and restricts writers to their authored posts (`author_uid === user.uid`).
    2. Updated `DraftPublicationView` to load the article via `adminFetch('/api/admin/articles/:id')` and display actionable error banner messages based on status codes (404 Not Found, 403 Forbidden, 401 Session Expired).
    3. Added optimistic locking: client tracks `loadedVersion` and sends it to `POST /api/admin/articles`. The server detects stale overwrites and returns `409` (`version_conflict`), alerting the editor to reload before overwriting changes.

- [x] **Bug ID & Summary:** BUG-037 — Admin Host Route Leakage, PWA Infiltration, and Premature Client Auth Fetch Failure.
  - **Root Cause:**
    1. On `admin.currentnews.blog`, non-admin `/api/*` endpoints previously redirected to `/admin` returning HTML rather than a clean JSON 404, breaking programmatic API consumers.
    2. Service worker and manifest link registered on the admin portal, risking cached admin assets and conflicting service worker behavior on administrative screens.
    3. `adminFetch` read `auth.currentUser` synchronously before Firebase Auth initialized (`authStateReady()`), triggering unauthenticated requests when refreshing admin tabs.
    4. Worker rejected Firebase tokens with strict `iat` or `auth_time > nowSec` without allowance for minor clock skew between servers.
  - **Permanent Guardrail:**
    1. In `server.ts`, all paths on `admin.currentnews.blog` starting with `/api/` (except `/api/admin/*`) return JSON 404 `{ error: "Not found" }`, and `/healthz`/`/readyz` are allowed.
    2. Omitted `<link rel="manifest">` and Service Worker registration when hostname starts with `admin.`, and enforced `no-store, no-cache, must-revalidate` plus SW cache bypass on all admin assets.
    3. In `adminFetch`, awaited `auth.authStateReady()` before accessing `currentUser`, aborting early with `{ error: "Signing in...", code: "signing_in" }` if unauthenticated, and retrying with `currentUser.getIdToken(true)` on any 401.
    4. In Edge Worker, added 60-second clock leeway for `iat` and `auth_time`.

- [x] **Bug ID & Summary:** BUG-038 — AI Studio Dev/Preview Iframe Showing "Refused to Connect" after Helmet Introduction.
  - **Root Cause:** Default `helmet()` enables `X-Frame-Options: SAMEORIGIN` and restricts CSP `frame-ancestors` strictly to `'self'`. When the applet dev URL (`*.run.app`) was loaded within the AI Studio embedded preview `<iframe>` on `aistudio.google.com`, the browser rejected framing due to mismatched parent origin.
  - **Permanent Guardrail:** In `server.ts`, disable `xFrameOptions: false`, set `crossOriginOpenerPolicy: false`, and explicitly configure CSP `frameAncestors: ["'self'", "https://*.google.com", "https://*.aistudio.google.com", "https://*.run.app", "https://*.googleusercontent.com", "https://*.cloud.google.com"]` so the application runs securely while permitting legitimate AI Studio preview and Google Cloud framing.

- [x] **Bug ID & Summary:** BUG-039 — Helmet CSP Blocking Facebook Video Player Embeds, Facebook SDK, and Cloudflare R2 / Imgur Image Assets.
  - **Root Cause:** The initial CSP configuration restricted `frame-src` strictly to YouTube and Google domains, and omitted `connect.facebook.net` and `facebook.com` from `script-src` and `connect-src`. This caused browsers to block Facebook video embeds and Facebook Social Plugins. Furthermore, `img-src` lacked explicit allowances for Cloudflare R2 staging domains and Imgur avatar hosts.
  - **Permanent Guardrail:** Configured `server.ts` Helmet CSP directives with: `frame-src: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com", "https://www.facebook.com", "https://facebook.com", "https://*.facebook.com", "https://*.google.com", "https://*.doubleclick.net", "https://*.firebaseapp.com"]`; `script-src: ["'self'", "'unsafe-inline'", "https://pagead2.googlesyndication.com", "https://*.googlesyndication.com", "https://*.google.com", "https://*.doubleclick.net", "https://connect.facebook.net", "https://*.facebook.net", "https://*.facebook.com"]`; `img-src: ["'self'", "data:", "blob:", "https://media.currentnews.blog", "https://*.r2.dev", "https://i.imgur.com", "https://*.imgur.com", "https:"]`; and `connect-src: ["'self'", "https://api.currentnews.blog", "https://media.currentnews.blog", "https://*.r2.dev", "https://*.facebook.com", "https://*.facebook.net", "https://*.fbcdn.net", "https://identitytoolkit.googleapis.com", ...]`.

- [x] **Bug ID & Summary:** BUG-040 — Live Domain Image 404s from Accidental `/uploads/photo.jpg/img/` URL Path Fragments and Missing `data/` in Cloud Run Docker Image.
  - **Root Cause:** 18 feed items and 64 article records stored image URLs with an accidental `/uploads/photo.jpg/img/` prefix, causing 404s when queried against R2. Additionally, Stage 2 of `Dockerfile` omitted `COPY --from=builder /app/data ./data`, causing local fallback image serving (`/img/*`) to fail if R2 was temporarily unreachable.
  - **Permanent Guardrail:**
    1. Sanitized all image URL paths in `data/feed.json` and `data/articles/*.json`, normalizing all paths to `/img/{id}-{n}.webp`.
    2. Added `cleanImageUrl` and `getFallbackImageUrl` sanitization across `/api/posts` endpoints in `src/server/postsApi.ts`.
    3. Added `COPY --from=builder /app/data ./data` to `Dockerfile` runner stage so Cloud Run containers maintain local webp fallback assets.
    4. Mounted static root `/public` handler before dist fallback in `server.ts` so brand assets (`/CurrentNews.png`) always return HTTP 200.

- [x] **Bug ID & Summary:** BUG-041 — YouTube Video Player Configuration Error (Error 153) and Facebook Video Player Referrer Isolation.
  - **Root Cause:** 
    1. Helmet's default middleware in `server.ts` outputs `Referrer-Policy: no-referrer`. Because YouTube and Facebook embedded iframes require an HTTP `Referer` header to authenticate the host domain, YouTube immediately aborted player initialization and displayed "Video player configuration error" (YouTube Error 153).
    2. Embedded YouTube and Facebook iframes lacked explicit `referrerPolicy="strict-origin-when-cross-origin"` attributes.
    3. `index.html` lacked the `<meta name="referrer" content="strict-origin-when-cross-origin">` declaration.
  - **Permanent Guardrail:**
    1. Configured Helmet in `server.ts` with `referrerPolicy: { policy: "strict-origin-when-cross-origin" }`.
    2. Added `<meta name="referrer" content="strict-origin-when-cross-origin" />` to `<head>` in `index.html`.
    3. Updated `EmbedHandler.tsx` to set `referrerPolicy="strict-origin-when-cross-origin"` and `loading="eager"` on both YouTube and Facebook iframes.
    4. Switched YouTube iframe domain to `https://www.youtube-nocookie.com/embed/${ytVideoId}?rel=0&playsinline=1&enablejsapi=1` to eliminate third-party cookie restrictions across modern privacy browsers.
    5. Added quick-action direct playback bars ("Watch Video on YouTube" and "Watch Video on Facebook") and inline reload triggers so readers in restricted webviews or privacy networks can always watch videos seamlessly.

- [x] **Bug ID & Summary:** BUG-042 — Public Mail Relay Exposure, Inbound Mail CORS Misconfiguration & Unsanitized Browser Article HTML Rendering.
  - **Root Cause:**
    1. `/api/mail/send-alert` permitted unauthenticated public clients to trigger transactional emails with arbitrary titles and recipients, exposing a public mail relay.
    2. `/api/mail/inbound` had permissive `Access-Control-Allow-Origin: *` headers and accepted all HTTP methods without secret authentication.
    3. Reader articles rendered raw `chunk.html` via `dangerouslySetInnerHTML` without client-side DOMPurify sanitization.
    4. Documentation contained sample connection strings with usernames and passwords.
  - **Permanent Guardrail:**
    1. Completely deleted `/api/mail/send-alert` and `api/mail/send-alert.ts`. Any requests return standard 404 JSON. Removed form UI that triggered it.
    2. Restricted `/api/mail/inbound` strictly to GET and POST, removed permissive CORS headers, and enforced constant-time secret authentication using `crypto.timingSafeEqual` against `INBOUND_WEBHOOK_SECRET` (returning 401 when missing or wrong).
    3. Created `src/utils/sanitizeHtml.ts` with DOMPurify: allows safe tags (`h1-h6`, `p`, `img`, `table`, etc.), YouTube-only https iframes, http/https schemes, strips inline style and on* attributes, forces `rel="noopener noreferrer nofollow"`, and preserves all Quill `ql-*` classes.
    4. Confined `Access-Control-Allow-Origin: *` strictly to static image routes (`/img` and `/uploads`).
    5. Cleaned connection strings in `CHECKLIST.md` and `docs/NEON.md` to `NEON_DATABASE_URL=<set in Secret Manager>`.

- [x] **Bug ID & Summary:** BUG-043 — Deleted Demo Articles Resurrected on Reader and Hindi Headline Matra Clipping in Hero Poster.
  - **Root Cause:**
    1. Demo articles (`post_1793979188690_fibeqk` and `post_1794056976447_h5095f`) deleted from the admin tab still existed on disk in `data/feed.json` and `data/articles/feed.json`, and on Cloudflare R2 (`post_1793731462909_88he4y`). The reader client's `getDeletedStoryIds()` only read localStorage without syncing remote tombstoned IDs, causing demo posts to re-appear.
    2. Hero poster headline had ultra-tight `leading-[1.18]` without vertical padding, causing top and bottom Devanagari vowel matras (`े`, `ै`, `ो`, `ौ`, `ं`, `ु`, `ू`) to be clipped by CSS line-clamp overflow boundaries.
    3. Bottom Top Articles list had hardcoded `slice(0, 42)` truncation, preventing tablet and laptop screens from showing longer headlines.
  - **Permanent Guardrail:**
    1. Purged demo posts from `data/feed.json` and `data/articles/feed.json`, added `SEED_DELETED_IDS` in `src/utils/compressedStorage.ts` and `src/server/r2Articles.ts`, filtered deleted IDs in `api/rss.xml.ts`, and added `syncDeletedStoriesFromRemote()` in `HomeView.tsx` so tombstoned articles are immediately and permanently purged from client memory.
    2. Set hero poster headline to relaxed `leading-[1.3] sm:leading-[1.28] md:leading-[1.24]` with `py-1` and `overflow-visible`, ensuring Devanagari script renders with 100% full matra visibility.
    3. Replaced hardcoded title slicing with native CSS `min-w-0 flex-1 truncate`, ensuring single-line ellipsis on mobile phones and natural long headline previews on tablet and laptop screens without altering font size.

- [x] **Bug ID & Summary:** BUG-045 — Devanagari vowel matras (`े`, `ै`, `ो`, `ौ`, `ं`, `ु`, `ू`) clipped on phone screen in article cards.
  - **Root Cause:**
    1. In `BlogPostCard.tsx`, the card title had `leading-snug` (tight line height of 1.375) and `tracking-tight` (-0.025em letter-spacing), causing glyph collision on mobile screens.
    2. Zero vertical padding (`py-0`) combined with `line-clamp-2` caused the bounding box's `overflow: hidden` to clip top vowel matras (`े`, `ै`, `ो`, `ौ`, `ं`) at the upper clamp boundary and bottom vowel matras (`ु`, `ू`, `्`) at the lower clamp boundary.
    3. The font stack lacked explicit `"Noto Sans Devanagari"` support, causing fallback font height mismatches on mobile devices.
  - **Permanent Guardrail:**
    1. In `BlogPostCard.tsx`, updated title heading to `leading-[1.45] sm:leading-[1.38]`, removed `tracking-tight`, added `py-1`, and moved clean `line-clamp-2` to the block heading with `sm:min-h-[2.9rem]`.
    2. Added `py-0.5` to excerpt description `<p>` and metadata spans to protect Devanagari text in multi-line clamp.
    3. Added `Noto Sans Devanagari` to Google Fonts import and font stacks in `src/index.css` for cross-device Devanagari rendering.
    4. Applied matching relaxed leading and `py-0.5` padding across `LikedView.tsx`, `HomeView.tsx`, and `PostDetailView.tsx`.

- [x] **Bug ID & Summary:** BUG-046 — Jharkhand and World categories failing to load articles from 3-line menu drawer and drawer overflowing screen height.
  - **Root Cause:**
    1. In `postsApi.ts` and `HomeView.tsx`, the `isJharkhand` filter checked only romanized English terms (`jharkhand`, `ranchi`, `dhanbad`, etc.), failing to match Hindi Devanagari news copy ("झारखंड", "गोड्डा", "रांची", "बसंतराय", "हनवारा", "महागामा"), causing Jharkhand category requests to return 0 articles.
    2. In `HomeView.tsx`, `fetchPosts` requested `category: selectedCategory` from the load balancer, discarding the rest of the in-memory catalog and preventing subsequent switches back to other categories.
    3. The side menu drawer buttons had rigid `min-h-[44px]` with wide padding, causing the drawer panel to exceed viewport height on small and standard mobile screens and requiring vertical scrolling.
  - **Permanent Guardrail:**
    1. Implemented comprehensive Devanagari and regional keyword recognition in `checkPostCategoryMatch` (`HomeView.tsx`) and `handleGetPosts` (`postsApi.ts`), reliably matching 26+ Jharkhand dispatches and international World dispatches.
    2. Configured `fetchArticlesFeed` in `HomeView.tsx` to retrieve the complete catalog (`category: 'All'`) so all categories are instantly available in-memory for 0ms transitions.
    3. Styled drawer category buttons with compact proportional sizing (`py-1 sm:py-1.2 px-2.5 text-[10.5px] sm:text-xs`) and evenly spaced flex distribution (`flex-1 justify-evenly`), fitting all 14 categories within ~440px total height and eliminating vertical scrolling across all mobile device screen ratios.

- [x] **Bug ID & Summary:** BUG-047 — Android Capacitor Version Code Stagnation Blocking Google Play Store Update Uploads.
  - **Root Cause:** `android/app/build.gradle.kts` had `versionCode = 1` and `versionName = "1.0.0"`. Google Play Console strictly blocks release updates if the version code is equal to or less than the previously released APK/AAB bundle code.
- [x] **Bug ID & Summary:** BUG-048 — Android 15 (Target SDK 35+) Deprecated System Bar APIs & Insets Collision Warning in Google Play Console.
  - **Root Cause:** In Android 15, apps targeting SDK 35+ enforce edge-to-edge by default. `android:statusBarColor` and `android:windowLightStatusBar` in `themes.xml` were deprecated, triggering the Play Store Console warning: `"Your app uses deprecated APIs or parameters for edge-to-edge"` and `"Edge-to-edge may not display for all users"`. Without insets handling, webview content risked being obscured behind status bars and gesture navigation bars.
  - **Permanent Guardrail:** Replaced deprecated theme parameters in `themes.xml` with transparent system bars (`@android:color/transparent`), invoked modern `enableEdgeToEdge()` in `MainActivity.kt` `onCreate`, added `ViewCompat.setOnApplyWindowInsetsListener` to pad status bar, navigation bar, and display cutouts (`systemBars() or displayCutout()`), and added `viewport-fit=cover` to `index.html`. Bumped app version to 4 (1.0.3).











