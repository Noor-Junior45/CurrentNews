# CONTEXT_SNAPSHOT.md — Multi-AI Handoff Brain

## 1. Current Tech Stack
- **Frontend:** React 19, TypeScript 5.8, Tailwind CSS v4, Lucide React, Motion
- **Runtime & Deployment:** Standalone Express server on Node.js 22, Google Cloud Run ready (`Dockerfile`, `.dockerignore`)
- **Database & Auth:** Firebase Firestore (`ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4`), Firebase Auth + Native Play Services
- **Storage & Media:** Cloudflare R2 object storage (`media.currentnews.blog`) via AWS S3 SDK
- **Monetization (AdMob Active Units):**
  - Banner: `CurrentNews_Bottom_Banner` (`ca-app-pub-5865716270182311/2031114923`)
  - Native Advanced: `currentnew_native` (`ca-app-pub-5865716270182311/1743128281`)
- **Mobile Packaging:** Capacitor 8.5 for Android (`blog.currentnews.app`)

## 2. Directory Tree
```
├── Dockerfile & .dockerignore # Cloud Run containerization
├── android/app/src/main/     # Native Android Java/Kotlin, Manifest, resources
├── api/                      # Pure Express modular routes (mail, sitemap, rss, ads.txt)
├── public/                   # Static assets, robots.txt, app-ads.txt, ads.txt, manifest.json
├── src/
│   ├── components/           # Header, Footer, AdMobNativeAd, AdSpace, RichTextEditor
│   ├── hooks/                # useAdSenseRouteGuard.ts (AdMob mobile banner watcher)
│   ├── utils/                # admob.ts (Hardcoded AdMob constants), imageUrl.ts, pushManager.ts
│   ├── views/                # HomeView, PostDetailView, AdminView, PrivacyView, TermsView, etc.
│   ├── App.tsx & main.tsx
├── server.ts                 # Full-stack Express entry point bound to 0.0.0.0:PORT
└── capacitor.config.ts
```

## 3. Completed vs Pending
- **Phase 1 (UI/Frontend):** [COMPLETED] Responsive feed, reading progress cache, soft cream legal books, back gestures.
- **Phase 2 (Monetization & AdMob Native Advanced):** [COMPLETED]
  - Category navbar tabs text made solid black (`text-black font-bold`).
  - Integrated `currentnew_native` AdMob Native Advanced ad unit (`ca-app-pub-5865716270182311/1743128281`).
  - Placed 2 native ads inside articles (middle and bottom) and between feed cards with policy-compliant spacing and "Ad / Sponsored" labels.
- **Phase 3 (Server Acceleration, Compressed Storage & Role Access):** [COMPLETED]
  - Client-side compressed story storage (`src/utils/compressedStorage.ts`) with LZW UTF-16 compression, giving instant (0ms) story loads on mobile phones and saving Firestore quota.
  - Dynamic writer/admin access: anyone placing their email in `VITE_WRITERS` (or `VITE_WRITER_EMAILS`, `VITE_ADMIN_EMAILS`) gets instant authoring & admin access on Google sign-in.
  - Completely cleaned `.env.example` of all `VITE_ADSENSE_*` and ad prompts so AI Studio / Cloud Run never prompts the user for ad variables.
- **Phase 4 (Google Search Ranking & Advanced SEO Architecture):** [COMPLETED]
  - Full Schema.org `@graph` JSON-LD structured data on `index.html` featuring `WebSite` with Google Sitelinks Search Box (`potentialAction` / `SearchAction`) and `NewsMediaOrganization` with E-E-A-T credentials (ethics, corrections, diversity, masthead).
  - Enhanced `NewsArticle` Schema.org with Google SERP `BreadcrumbList` on `PostDetailView.tsx`.
  - Google News XML Sitemap (`api/sitemap.xml.ts`) with `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"` namespace, `<news:news>` tags, and `changefreq: always` for top ranking.
  - Granular robots directives (`noindex, follow` on utility/auth pages, `noindex, nofollow` on `/admin`) and dedicated crawler rules for `Googlebot` and `Googlebot-News` in `robots.txt`.
- **Phase 5 (Regional & Jharkhand Local Search Top Ranking):** [COMPLETED]
  - Geo-targeting meta tags (`geo.region: IN-JH`, `geo.placename: Jharkhand, India`, `geo.position: 23.6102;85.2799`, `ICBM: 23.6102, 85.2799`, `coverage`, `target: Jharkhand`).
  - Google News & Local Search target keywords (`news near Jharkhand`, `Jharkhand news`, `Ranchi news live`, `Jharkhand breaking news`, `Dhanbad news`, `Jamshedpur news`).
  - Schema.org `areaServed` mapping for Jharkhand and key cities (Ranchi, Jamshedpur, Dhanbad, Bokaro Steel City, Deoghar, Hazaribagh) plus `knowsAbout` and `locationCreated`.
  - Refined reader category navbar: removed visible `Jharkhand` tab button per user design request, while keeping smart query matching and dedicated sitemap URL (`/?category=Jharkhand`, priority 0.95) for search crawler indexing.
  - Server-side bot pre-rendering for Googlebot / Googlebot-News requesting Jharkhand regional coverage in `socialPreview.ts`.
- **Phase 9 (Google News Progressive Loading & Staggered Scroll Stream):** [COMPLETED]
  - All 41 historical articles verified moved to Cloudflare R2 object storage (`articles/${id}.json`) and indexed in `articles/feed.json`.
  - Staggered progressive feed hydration in `HomeView.tsx`: 1st article reveals immediately (0ms delay), followed by 2nd, 3rd, 4th, ... nth cards cascading smoothly with 45ms stagger timing.
  - Preview Box First: Home feed cards load only preview metadata (title, byline, date, image, excerpt, reactions), preventing heavy HTML downloads on the homepage.
  - Instant Article Opening (0ms): `PostDetailView.tsx` renders the preview box (headline, author "Current News", timestamp, reading time, hero photo, lead excerpt) instantly from user cache memory or navigation state with zero blank screen.
  - Progressive Paragraph Reveal on Scroll (`ProgressiveArticleBody.tsx`): Lead paragraphs appear immediately, while subsequent paragraphs, media, and native AdMob ads stream in progressively via an IntersectionObserver as the reader scrolls down the page.
  - Client Cache Memory: All opened articles and feed records are compressed with LZW in `compressedStorage` (`localStorage`), allowing offline reading and instant re-opening with zero network latency.
- **Phase 10 (Multi-Origin Load Balancing & GCLB Production Architecture):** [COMPLETED]
  - Server-side load balancing: Added `app.set('trust proxy', true)` for Google Cloud Load Balancer (GCLB) and Cloudflare proxy support.
  - Aligned TCP keep-alive timeouts (`keepAliveTimeout = 650000ms`, `headersTimeout = 660000ms`) to eliminate 502 Bad Gateway race conditions with Google Front End (GFE) / Cloud Run.
  - Added container probes: `GET /healthz` (liveness), `GET /readyz` (readiness with RAM/CPU telemetry), and `GET /api/lb/status`.
  - Client-side smart load balancer (`src/utils/clientLoadBalancer.ts`): Dynamic multi-origin traffic distribution (Cloudflare Edge CDN <-> Cloud Run Origin API <-> R2 Mirror) with active latency scoring, circuit breaker (30s cooldown after 2 failures), and transparent fallback.
- **Phase 11 (Server-Driven In-App Update Engine — Option B):** [COMPLETED]
  - Server endpoints: `GET /api/app/version` and `POST /api/app/version` managing `latestVersion`, `latestVersionCode`, `minSupportedVersionCode`, `releaseNotes`, and `forceUpdate` flag.
  - Client controller (`src/utils/appVersionManager.ts`): Semantic version parser and build code checker via `@capacitor/app` (`App.getInfo()`).
  - Update popup banner completely removed from UI per user request, leaving zero popup interruptions.
- **Phase 12 (Category-Synchronized Dynamic Poster Showcase):** [COMPLETED]
  - Poster pool dynamically synchronizes with active `selectedCategory`: viewing "All" cycles through all dispatches, while viewing "Sports", "Politics", "Tech", "Business", "Health", "World", "Opinion", "General", or "Jharkhand" filters the rotating carousel strictly to dispatches from that category.
  - Automatically resets carousel index (`currentPosterIndex`) to 0 on category switch to prevent index bounds drift.
  - Preserves 100% of the Golden Ratio aspect ratios, Right-to-Left swipe animation, high-contrast typography, and beige/blue/brown color theme.
- **Phase 13 (Popup De-Cluttering & Codebase Purification):** [COMPLETED]
  - Permanently removed Web Push Notification Alert Prompt (`NotificationBanner.tsx`) from `src/App.tsx` and filesystem.
  - Permanently deleted Newsletter Subscription Modal (`NewsletterPopup.tsx`) from filesystem.
  - Streamlined reader viewport: zero intrusive popup sheets or subscription overlays during reading.
- **Phase 14 (Legal Navigation & Header Left Alignment Alignment):** [COMPLETED]
  - Renamed top navbar headings to "Privacy Policy" and "Terms of Service" placed directly on the left adjacent to the tailless back button (`ChevronLeft`).
  - Unified back navigation: tapping the tailless back button, triggering touch edge-swipe gestures, or pressing the Android hardware back button strictly navigates back to `/profile`.
- **Phase 15 (Universal Left-Aligned Navbar & Profile Page Alignment):** [COMPLETED]
  - Updated `ProfilePageNavbar.tsx` so the page title is universally positioned on the left side, directly next to the tailless back button (`ChevronLeft`).
  - Applied across the Profile dashboard (`/profile`) and all individual sub-pages (`/settings`, `/liked`, `/delete-account`, `/admin`, `/about`, `/contact`, `/editorial-policy`, `/signin`, `/privacy`, `/terms`).
  - Verified 100% presence of all individual page view files in `src/views/`.
- **Phase 17 (Firestore Quota Resilience & Security Rules Resolution):** [COMPLETED]
  - Fixed `Failed to save pen name: Missing or insufficient permissions`: Added `match /users/{userId}` security rule in `firestore.rules` allowing authenticated users to manage their own pen name profiles, explicitly added `mdhassan1738@gmail.com` to admin checks, and registered the `User` schema in `firebase-blueprint.json`. Successfully deployed rules via `deploy_firebase`.
  - Added dual-layer caching for author pen names: `localStorage.setItem('current_news_pen_name_' + user.uid)` ensures pen names render instantly without requiring a network read and persist even during quota exhaustion.
  - Fixed `[Push Service] Count error: [FirebaseError: Quota limit exceeded]`: Replaced unbounded `getDocs(collection(db, 'push_subscriptions'))` with `getCountFromServer` aggregate queries, added a 5-minute memory cache, and implemented safe quota error interception returning `{ success: true, count, quotaLimited: true }` instead of HTTP 500.
  - Added zero-quota fallback in `AdminDashboardView.tsx` and `CurrentPublicationsView.tsx` to read from compressed local storage and Cloudflare R2 mirror when Firestore read units are exhausted.
  - Handled Firebase Firestore GrpcConnection 'Listen' stream idle timeout cancellation as an expected non-breaking lifecycle event.
- **Phase 18 (R2 Light Feed Index & Base64 Image Extraction):** [COMPLETED]
  - R2 Feed Payload Reduction: `articles/feed.json` optimized from 5.7 MB down to 37 KB (99.3% reduction) by stripping `content` HTML and base64 URLs, retaining only light index items (`id`, `title`, `category`, `authorName`, `createdAt`, `status`, `imageUrl`, `hashtags`, `likes`, `dislikes`, `views`, `excerpt`).
  - Base64 Image Extraction: Implemented `processAndExtractBase64Images` in `src/server/r2Articles.ts` to scan `imageUrl`, `imageUrlFallback`, `imageUrls`, `imageUrlsFallback` and `<img src="data:...">` in HTML content, decode base64 blobs, upload directly to R2 as `img/{postId}-{n}.webp` with 1-year immutable cache headers (`public, max-age=31536000, s-maxage=31536000, immutable`), and replace inline URLs with `https://media.currentnews.blog/img/{postId}-{n}.webp`.
  - Added admin migration endpoint `POST /api/articles/migrate-images` which successfully migrated 46 base64 images and re-indexed all 41 articles.
  - Zero-Firestore Reads for Feed & Related Posts: Removed all `getDoc`/`getDocs` calls on `posts` from `HomeView.tsx`, `BlogPostCard.tsx`, and the related-posts carousel in `PostDetailView.tsx`.
- **Phase 19 (Cloudflare D1 & Edge Worker Migration — Decoupling Reader Data from Firestore):** [COMPLETED]
  - Created `/worker` service with Cloudflare Worker (`/worker/src/index.ts`), D1 database schema (`/worker/schema.sql`), and `wrangler.toml` bound to `currentnews-db` under route `api.currentnews.blog/*`.
  - Token Auth: Edge Worker verifies Firebase Auth JWTs directly with Web Crypto API (`crypto.subtle`) using Google's public JWK set (`securetoken@system.gserviceaccount.com`).
  - Strict Admin Authorization: Direct exact email matching against `ADMIN_EMAILS` (`mdhassan1738@gmail.com`).
  - Edge Cache & Rate Limiting: 30-second edge cache on `GET /stats?ids=...`, 30-minute deduplication on `POST /view/:postId` via Cloudflare Cache API, and IP rate limiting on writes.
  - Zero-Firestore Reader Operations: Replaced Firestore queries across `HomeView.tsx` (batch stats + my-reactions), `BlogPostCard.tsx`, `PostDetailView.tsx`, `Header.tsx`, `SettingsView.tsx`, `AudienceRegistryView.tsx`, `LikedView.tsx`, `AdminDashboardView.tsx`, `CurrentPublicationsView.tsx`, `DraftPublicationView.tsx`, `DeleteAccountView.tsx`, and `pushNotifications.ts`.
  - `src/firebase.ts` converted to export strictly `auth`; zero `firebase/firestore` calls remain in client and server code.
  - Data Migration: Added `scripts/export-firestore.ts` with quota resilience to export Firestore data to `/scripts/firestore-export.json` and `POST /import` endpoint to batch-load into D1.
- **Phase 20 (Static SEO Fallback Isolation & Service Worker Cache Fix):** [COMPLETED]
  - Isolated static crawler fallback HTML into `<noscript>` tags in `index.html` so standard browsers never display raw fallback text.
  - Replaced `<div id="root">` content with a clean initial wireframe skeleton that matches the actual app layout during initial bundle download.
  - Bumped PWA service worker to `v2` (`current-news-live-v2`) and switched navigation requests (`event.request.mode === 'navigate'`) to a strict **Network-First** strategy so browsers never get trapped in stale cached HTML.
  - Implemented root `ErrorBoundary` in `src/components/ErrorBoundary.tsx` wrapping `<App />` in `src/main.tsx` to handle any unexpected runtime errors gracefully with instant recovery.
- **Phase 21 (Streamlined In-App Account Deletion):** [COMPLETED]
  - Removed top descriptive policy paragraph from `/delete-account`.
  - Removed "Method 2: External Email Request" and external mailto logic.
  - Removed "Method 1" heading and subtitle; the interface directly displays user login credentials, Permanent Action Notice, confirmation checklist/input, and deletion trigger.
- **Phase 22 (One-Click Copy Confirmation Pill):** [COMPLETED]
  - Styled confirmation label to match reference image: light gray pill badge (`Type [DELETE ❐] to confirm:`) with icon-only copy trigger, smooth active states, clipboard copying with fallback, and subtle check indicator.
- [x] **Phase 23 (R2 Image URL Sanitization & Standalone Migration Tool):** [COMPLETED]
  - Added `getPublicBase()` in `src/server/r2Articles.ts` to strictly sanitize the hostname from `R2_PUBLIC_DOMAIN` (stripping protocol, path, and query params) and always return `https://${host}` (fallback: `https://media.currentnews.blog`).
  - Strict atomic upload: `uploadBase64ImageToR2` throws a fatal error if credentials or PutObject fail, guaranteeing articles can never point to unverified image links.
  - Added self-healing URL sanitization in `imageUrl.ts` and `processAndExtractBase64Images` repairing accidental `/uploads/.../img/` paths.
  - Created standalone CLI tool `scripts/migrate-from-r2.mjs` (and `npm run migrate:r2`): downloads all bucket articles, decodes base64 images into `img/{postId}-{n}.webp`, sends mandatory `HEAD` requests to verify HTTP 200 before writing, updates full articles, rebuilds light 37 KB `feed.json`, supports `--dry-run`, and outputs a comprehensive migration summary.
- [x] **Phase 24 (Instagram-Style Optimistic Reactions & Durable Object Write Coalescing):** [COMPLETED]
  - Verified `src/server/r2Articles.ts` public URL builder using `getPublicBase()`; added `--fix-urls` mode to `scripts/migrate-from-r2.mjs` with HEAD checks, broken URL correction, missing image alerts, and `--dry-run` metrics.
  - Client-side reaction store (`src/utils/reactionStore.ts`): optimistic local state with 1500ms trailing debounce after last tap, no-op cancellation if reverted, exponential backoff retry queue (`cn_react_queue_${uid}`), automatic flush on visibilitychange/pagehide/online, HTTP 401 handling, 10-minute session caching on `/my-reactions`, and count formula preventing stale count overwrites.
  - Shared UI integration: Heart-pop animation (scale 1.25, 150ms) on `BlogPostCard.tsx` and `PostDetailView.tsx`. 24h deduplicated view count reporting via `cn_viewed_${postId}`.
  - HomeView 3-minute `/stats` cache (`cn_stats_cache`), fetching only missing or stale IDs from the edge Worker.
  - Cloudflare Worker Durable Object write coalescing (`StatsAggregator` in `worker/src/index.ts`): 30s alarm timer merges pending reaction/view deltas into a single D1 batch update (`ON CONFLICT(post_id) DO UPDATE SET likes=MAX(0, likes+excluded.likes)...`), direct D1 fallback on failure, edge caching on `GET /stats` (`s-maxage=60`), and admin `POST /admin/recount`.
- [x] **Phase 25 (Preview Entity Stripping & Uniform Desktop/Tablet Card Grid):** [COMPLETED]
  - Entity Sanitization: Implemented `cleanPreviewText` across `BlogPostCard.tsx`, `HomeView.tsx`, `PostDetailView.tsx`, and `extractPlainExcerpt` in `src/server/r2Articles.ts` and `scripts/migrate-from-r2.mjs`, stripping `&nbsp;?`, `&#160;?`, `\u00a0`, and all raw HTML entities into clean single whitespace. Deep cleaned local `data/feed.json`.
  - Big Screen & Tablet Uniform Card Dimensions: Enforced `sm:h-[265px] sm:max-h-[265px]` on `BlogPostCard` with reduced 2-line heading slots (`sm:text-[15px] lg:text-base sm:line-clamp-2 sm:h-[2.75rem]`), reduced 2-line description slots (`sm:text-xs lg:text-[13px] sm:line-clamp-2 sm:h-[2.35rem]`), and pinned bottom reaction bar. Mobile phone screen layout (`< sm`) is 100% preserved.
- [x] **Phase 26 (20 Articles per Page & Responsive Grid Ad Alignment):** [COMPLETED]
  - Verified 20 articles per page pagination on the home feed (`postsPerPage = 20`) with smooth numeric and prev/next page navigation.
  - Verified 100% operational status of all application routes (`/post/:id`, `/profile`, `/signin`, `/liked`, `/settings`, `/delete-account`, `/about`, `/contact`, `/editorial-policy`, `/privacy`, `/terms`, `/admin`).
  - Fixed empty gap on tablet screens after the 3rd card: On 2-column tablet screens, ads are aligned after 4 cards (`idx === 3`) completing 2 full rows, while desktop 3-column ads trigger at `idx === 2` and common multiples of 6 (`idx === 5`, `idx === 11`), eliminating all holes.
- [x] **Phase 27 (Icon-Only Tailless Pagination Buttons):** [COMPLETED]
  - Streamlined `#pagination-prev-btn` and `#pagination-next-btn` in `HomeView.tsx`: removed text spans (`Prev` and `Next`), leaving clean tailless chevron arrow icons (`ChevronLeft` and `ChevronRight`).
  - Formatted buttons as uniform 44x44px square touch targets (`min-h-[44px] min-w-[44px] flex items-center justify-center`) matching the adjacent numeric page pills, with explicit `aria-label` tags for accessibility.
- [x] **Phase 28 (Universal Scroll Management & Top Article Opening):** [COMPLETED]
  - Root Cause Fixed: In React Router SPA, navigating to an article (`/post/:id`) from a scrolled position on the feed retained the window scroll offset (e.g. 1200px), dropping the user straight to "Related Coverage" at the bottom of the article.
  - Implemented top-level `ScrollToTop` router component inside `<BrowserRouter>` in `src/App.tsx` that resets window scroll to `top: 0` on every forward route change.
  - Preserved feed scroll restoration: When returning from an article back to the home feed, `current_news_return_scroll` is preserved and `HomeView.tsx` smoothly restores the reader's exact previous reading position. Homepage pagination (`?page=`) continues smooth-scrolling to `#posts-grid`.
- [x] **Phase 29 (Eliminate Pre-Navigation Scroll Flashes via useLayoutEffect):** [COMPLETED]
  - Root Cause Fixed: Synchronous `window.scrollTo(0, 0)` calls inside `onClick` handlers (`handleOpenPost` on cards and hero poster in `HomeView.tsx`) yanked the current homepage to the top before navigation occurred, causing the top hero carousel poster to flash on screen for a split second before the article rendered.
  - Removed all pre-navigation `window.scrollTo` calls from click handlers in `BlogPostCard.tsx` and `HomeView.tsx`.
  - Upgraded `ScrollToTop` in `src/App.tsx` and the `[id]` scroll watcher in `src/views/PostDetailView.tsx` from `useEffect` to `useLayoutEffect`. This guarantees the browser resets the window scroll to `0px` synchronously *before* the new article paints to the screen, completely eliminating the hero poster flash and ensuring seamless 0ms top-of-article rendering.
- [x] **Phase 30 (Draft Composer Optimization & Photo Workflow Reorganization):** [COMPLETED]
  - Removed "Editorial Byline / Writer *" input box from `/admin/draft`: authorName is automatically populated from the logged-in user or active pen name (`user?.displayName || 'Current News'`), eliminating unnecessary redundant fields.
  - Rearranged section order: Photo Attachment Section (`PhotoAttachmentSection`) moved directly ABOVE the Manuscript section (`RichTextEditor`), allowing writers to upload photos first and reference/insert them seamlessly into the manuscript.
  - Display Size Responsive Fit: Upgraded container width to `w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8` with fluid `w-full min-w-0 box-border` styling across all inputs, category selectors, photo rows, and editors to comfortably fill laptop and desktop screens without cramped constraints or horizontal overflow on mobile.
  - End of Story Photos Default: Configured all uploaded primary and gallery photos in `PhotoAttachmentSection.tsx` and `DraftPublicationView.tsx` to default to `'bottom'` ("End of Story"), rendering photos neatly at the conclusion of the article body.
- [x] **Phase 31 (Draft Labels, Reference Link Redesign & Smart Hashtags):** [COMPLETED]
  - Form Label Refinement: Renamed labels to clean, concise names: `Title *`, `Category *`, `Manuscript *`, and `Reference Link`.
  - Reference Link Redesign: Rebuilt section with header, an empty container box space (`min-h-[64px]`), and a below-box pill button titled "Add hyperlink". Clicking "Add hyperlink" appends rows formatted precisely as `<no.> <link input> <delete button>`. Links render seamlessly at the end of articles via `EmbedHandler.tsx`.
  - Context-Aware Suggested & Popular Hashtags: Integrated category-aware hashtag suggestions mapped to the selected `category` (`Jharkhand`, `Politics`, `Tech`, `Sports`, `Business`, `Health`, `World`, `Opinion`, `General`) alongside global trending/popular tags (`#BreakingNews`, `#LiveUpdates`, `#CurrentNews`, `#India`, etc.). One-tap chip clicks toggle/append tags cleanly with duplicate prevention.
- [x] **Phase 32 (Manuscript Writing Assistant & Design Preset Removal):** [COMPLETED]
  - Targeted Selected Element (`div#quill-editor-wrapper > div:nth-of-type(1)`): Removed the entire "Writing Assistant & Design Presets" panel from the top of `RichTextEditor.tsx`.
  - Removed all associated template buttons: Alert Banner, Editorial Note, Key Takeaways, Highlight Quote, and Interview Q&A.
  - Retained clean standard Quill WYSIWYG toolbar and editor controls, keeping full imperative handle compatibility for direct photo embedding.
- [x] **Phase 33 (Enlarge & Center "Add Hyperlink" Action):** [COMPLETED]
  - Targeted Selected Element (`div:nth-of-type(6) > div:nth-of-type(2) > button:nth-of-type(1)`): Placed the "Add hyperlink" action button in a centered flex container (`flex justify-center mt-3.5`).
  - Increased button footprint: expanded padding to `px-6 py-2.5 sm:px-8 sm:py-3`, enlarged text to `text-sm font-bold tracking-wide`, scaled icon to `w-4.5 h-4.5`, and added subtle interactive hover/active transitions (`hover:scale-[1.02] active:scale-[0.98]`).
- [x] **Phase 34 (Full-Width Add Hyperlink Pill Button with Title Case):** [COMPLETED]
  - Targeted Selected Element (`div:nth-of-type(6) > div:nth-of-type(2) > button:nth-of-type(1)`): Expanded the button length to span full width (`w-full`) touching both sides within the container's margins (`box-border py-3 sm:py-3.5 px-6 rounded-full`).
  - Updated button text and placeholder copy to proper capital & small letter Title Case: `Add Hyperlink`.
- [x] **Phase 35 (Add Hyperlink Height Ratio & Font Matched to Discard Draft):** [COMPLETED]
  - Height & Font Ratio Match: Scaled vertical padding to `py-2.5 px-5` and font typography to `text-xs font-bold`, identical to the Discard Draft action button (`div:nth-of-type(9) > button:nth-of-type(1)`).
  - Kept full-width layout (`w-full box-border`) touching both margins of the form container with `h-4 w-4` icon and rounded-full pill outline.
- [x] **Phase 36 (Title Box Auto-Wrapping & Adaptive Expansion):** [COMPLETED]
  - Targeted Selected Element (`form > div:nth-of-type(1) > input#post-title`): Replaced fixed single-line input with full-width (`w-full box-border`) auto-expanding `<textarea id="post-title">`.
  - Added text-wrapping and scrollHeight auto-height adjustment so long headlines wrap cleanly across multiple lines without horizontal cutoff, allowing writers to view and edit the entire title with ease.
  - Added real-time character counter (`{title.length}/200`), Enter-key form submission guard, and `resize-y` handle.
- [x] **Phase 37 (Manuscript Box Full-Height Typing & Tap-to-Focus Activation):** [COMPLETED]
  - Targeted Selected Element (`div#quill-editor-wrapper > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1)` / `.ql-editor`): Resolved issue where tapping or clicking in the manuscript box required aiming specifically at the first line.
  - Set `.ql-container.ql-snow` with `display: flex !important; flex-direction: column !important; cursor: text !important; min-height: 260px;` and `.ql-editor` with `min-height: 260px !important; height: 100% !important; flex: 1 1 auto !important; cursor: text !important; box-sizing: border-box !important;`.
  - Added `handleEditorAreaClick` in `src/components/RichTextEditor.tsx` that intercepts clicks/taps across the full box area (with toolbar exclusion), immediately focusing the editor and placing the typing caret at the end of content so mobile soft keyboards and desktop typing activate anywhere inside the box.
- [x] **Phase 38 (Current Publications Persistent Sticky Navbar & Single-Line Phone Filter Buttons):** [COMPLETED]
  - Targeted Selected Element 1 (`header > div > div:nth-of-type(2) > a`): Removed plus button from `ProfilePageNavbar` in `src/views/CurrentPublicationsView.tsx`.
  - Targeted Selected Element 2 (`div#publications-filter-tabs`): Fitted all three filter buttons (`All (XX)`, `Published (XX)`, `Drafts (XX)`) into a single row on phone screens via `grid grid-cols-3 gap-1` with compact typography (`text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider px-1.5 sm:px-4 py-1.5 truncate whitespace-nowrap`).
  - Persistent Dual-Tier Sticky Navbar: Unified `ProfilePageNavbar` (`sticky top-0 z-40`) and the filter switcher (`sticky top-14 sm:top-16 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b`) so both act as an immovable persistent navbar while all publications cards, tables, and notices scroll smoothly underneath.
- [x] **Phase 40 (Audience Registry 3-Box Hierarchy & Compact Inline Badge):** [COMPLETED]
  - Targeted Selected Element 1 (`div#audience-registry-view > div:nth-of-type(1) > div:nth-of-type(1) > h2`): Removed the top "Audience & Alert Console" header and subtitle text from `src/views/AudienceRegistryView.tsx`.
  - Re-ordered console sections starting immediately below navbar in exact requested 3-box hierarchy:
    1. Box 1: Push Notifications (`Push Notifications`)
    2. Box 2: Email Test (`Email Test`)
    3. Box 3: All User Email List (`All User Email List`)
  - Targeted Selected Element 2 (`div#audience-registry-view > div > div:nth-of-type(2) > div:nth-of-type(1) > div > div`): Redesigned Push Notification heading:
    - Positioned active device indicator badge directly adjacent to the `Push Notifications` heading.
    - Stripped "Active Device(s)" text completely, displaying strictly the alert logo (`Bell`), the device count number, and an inline refresh button (`RefreshCw`).
    - Maintained exact pill styling (`bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-xl shadow-xs`).
    - Retained all broadcast input logic, "Ping All Devices" action, and feedback banner.
- [x] **Phase 42 (Admin Dashboard Redesign & Author-Isolated Image/Story Metrics):** [COMPLETED]
  - Removed the top Cloudflare R2 / High-Throughput Global Edge Mirror box and the 3 quick action navigation cards (`Draft New Publication`, `Current Publications`, `Audience Registry`).
  - Positioned the **Editorial Author Byline** box at the very top of the page, displaying `Active pen name : <writer_name>`.
  - Removed the description copy below the pen name and added a pill-shaped button (`rounded-full`) for editing and saving pen names directly inline with D1 synchronization and local caching.
  - Positioned the metrics cards below in a 5-box responsive grid:
    1. `Live Active Dispatches`: strictly counting published stories by the authenticated author.
    2. `Draft Manuscripts`: counting saved drafts by the author.
    3. `Media Broadcasts`: counting stories with attached YouTube/Facebook video broadcasts by the author.
    4. `Audience Subscribers`: registered citizen subscribers.
    5. `Published Image`: newly introduced metric displaying the exact count of photos attached and posted across published stories exclusively by that author.
- [x] **Phase 44 (Login Flow, Cloudflare Worker Permissions & Newsroom Published Data Visibility):** [COMPLETED]
  - Audited full login flow (Firebase Web Google Sign-In & Native Android Play Services Google Account Chooser via `NativeGoogleAuthPlugin`).
  - Resolved Cloudflare Worker authorization gap in `/worker/src/index.ts`: added `AUTHORIZED_WRITER_AND_ADMIN_EMAILS` (including `mdnoor4860@gmail.com`, `mdhassan1738@gmail.com`, `alifraja404@gmail.com`, and `@currentnews.blog` domains) so `GET /subscribers` and admin endpoints succeed for all authorized newsroom writers and admins instead of returning 403.
  - Resolved publications filtering in `CurrentPublicationsView.tsx` and `AdminDashboardView.tsx`: verified that all published newsroom data across the ledger is fully visible to administrators while preserving author-specific filtering for non-admin writers.
  - Verified subscriber metrics and subscriber directory visibility for all writers.
- [x] **Phase 45 (Live Liked Articles Synchronization & Manuscript Full-Box Tap-to-Type Activation):** [COMPLETED]
  - Manuscript Box Tap-to-Type Everywhere: Configured `.ql-editor` and `.ql-container` with `min-height: 280px; height: auto !important; flex: 1 1 auto; padding: 16px;` and added `pointer-events: none` on placeholder pseudo-elements. Connected `onClick` and `onTouchEnd` on the outer wrapper with `handleFocusEditor`, ensuring clicking or tapping ANYWHERE inside the entire manuscript box immediately activates the typing caret and opens the keyboard without requiring the writer to tap the first line.
  - Liked Dispatches Real-Time Synchronization: Upgraded `LikedView.tsx` to subscribe directly to `reactionStore.subscribe()` and aggregate liked article IDs from in-memory optimistic state (`reactionStore.getLikedIds()`), server `/my-reactions`, local user storage, guest storage (`cn_react_guest`), and legacy keys.
  - Dynamic Migration: Enabled guest likes migration to user account upon sign-in and real-time cache synchronization in `reactionStore.setReaction()`, ensuring liked articles appear immediately on `/liked` without delays.
  - Documented VAPID Push configuration keys (`VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `VAPID_PRIVATE_KEY`).
- [x] **Phase 46 (Articles Count Alignment & Pagination Limit Fix):** [COMPLETED]
  - Root Cause Diagnosed: Database and feed data were 100% consistent (41 published articles). The home page showed only 30 articles because `HomeView.tsx` requested `limit: 30`, `clientLoadBalancer.ts` defaulted origin queries to `limit=30`, and `postsApi.ts` clamped queries to `Math.min(50, limit)`.
  - Resolution: Updated `HomeView.tsx` to request `limit: 100`, updated `clientLoadBalancer.ts` to default to 100, and updated `postsApi.ts` to allow up to 200 or all (`limit=all`).
  - Result: The home page now receives all 41 published articles. With 20 articles per page, Page 1 displays 1–20, Page 2 displays 21–40, and Page 3 displays 41 (`Showing 1–20 of 41 articles (Page 1 of 3)`), perfectly matching the admin published count of 41.
- [x] **Phase 47 (Post Persistence Architecture & CDN Overwrite Prevention):** [COMPLETED]
  - Root Cause Diagnosed: Newly posted articles temporarily appeared for ~30 seconds because `saveArticleToR2` stored them in RAM/ephemeral disk while R2 write credentials were unset; exactly 30s later, `getFeedFromR2()` polled `media.currentnews.blog/articles/feed.json` and directly assigned `inMemoryFeedCache = lightList`, overwriting server memory with stale CDN data and wiping the new article.
  - Multi-Layer Solution Implemented:
    1. Server Cache Guard: Implemented `mergeFeedWithLocalAndCache()` in `src/server/r2Articles.ts` so CDN polls NEVER overwrite local articles (`data/articles/*.json`, `data/feed.json`, RAM cache); local articles not yet present on CDN are preserved.
    2. Cloud Firestore Dual-Write: Exported `db` in `src/firebase.ts` and connected `setDoc(doc(db, 'posts', publishedPostId), fullPostToSave)` in `DraftPublicationView.tsx` (authenticated by Firebase Auth admin permissions) and server-side REST API sync.
    3. Client 0ms Offline Cache: In `DraftPublicationView.tsx`, immediately cached posts in `saveCompressedStory` and `saveCompressedStories`.
    4. Admin Publications Resilient Hydration: In `CurrentPublicationsView.tsx`, merged `/api/articles/feed`, Firestore `posts` collection, and local compressed stories into a unified list.
- [x] **Phase 48 (Neon Postgres Source of Truth, Firebase Custom Claims & Admin Host Routing):** [COMPLETED]
  - Role-Based Access Control via Firebase Custom Claims: Created `server/auth/firebaseAdmin.ts` with ADC and `scripts/set-role.mjs` (`node scripts/set-role.mjs <email> <admin|writer|none>`). Initialized `server/auth/requireRole.ts` middleware requiring `email_verified === true`, verifying claims, and attaching `req.user`. Purged all hardcoded email lists (`AUTHORIZED_ADMIN_EMAILS`, `AUTHORIZED_ADMIN_DOMAINS`, `AUTHORIZED_CREDENTIAL_HASHES`, and `VITE_ADMIN_EMAILS`) across client hooks and server code.
  - Neon Postgres Editorial Source of Truth: Created `server/db/neon.ts` with connection pooling, `migrations/001_init.sql` (`staff`, `articles`, indexes, `audit_log`), `scripts/migrate-neon.mjs`, and `docs/NEON.md`.
  - Admin Endpoints (`/api/admin/*`): Handlers for `POST /api/admin/articles` (zod validation, rich-text HTML sanitization via `sanitize-html`, writer ownership enforcement, Neon write + R2 dual-write, audit log), `GET /api/admin/articles` (cursor pagination, role filtering), `DELETE /api/admin/articles/:id` (draft/ownership check, soft archive, audit log), and `GET /api/admin/me`.
  - Strict Route Protection: Protected `/api/upload`, `/api/articles/save`, `/api/articles/:id`, `/api/articles/sync`, `/api/articles/migrate-images`, and `/api/mail/send-alert` with `requireRole('admin', 'writer')`; protected `/api/push/broadcast` and `POST /api/app/version` with `requireRole('admin')`.
  - Host Routing & Segregation: Configured middleware in `server.ts` segregating `admin.currentnews.blog` (serves only `/admin`, `/api/admin`, static assets, injects `X-Robots-Tag: noindex, nofollow`, redirects other paths to `/admin`) from `currentnews.blog` / `www` (301 redirects `/admin` to `admin.currentnews.blog`, returns 404 JSON for `/api/admin/*`). Bypasses host checks on `localhost` and `*.run.app`.
  - Database Lockdown: Replaced `firestore.rules` with `allow read, write: if false;` and deployed via `deploy_firebase`. Removed all Firestore reads and writes from `DraftPublicationView.tsx` and `CurrentPublicationsView.tsx`.
- [x] **Phase 49 (Edge Worker Role Hardening, Durable Object Persistence & Android URL Resolution):** [COMPLETED]
  - Cloudflare Worker Auth by Role (`worker/src/index.ts`): Extended `verifyFirebaseIdToken` to extract `{ uid, email, emailVerified, role }` and validate `iat` (not in future) and `auth_time` (present and valid). Replaced all email check functions with `isAdmin(user) = user.role === 'admin' && user.emailVerified === true`. Purged all hardcoded emails, `@currentnews.blog` suffix bypass, `ADMIN_EMAILS`, and `WRITERS` from worker code and `wrangler.toml`.
  - Admin Route Enforcement: Restricted `GET /subscribers`, `DELETE /admin/subscriber`, `POST /import`, and `POST /admin/recount` strictly to `isAdmin`. Enforced self-ownership and email verification on `/subscribe/check` and `DELETE /subscribe`.
  - Input Validation & Abuse Reduction: Strict regex validation on `postId` (`/^[A-Za-z0-9_-]{6,64}$/`) for stats/reactions, email validation & lowercase normalization on `/subscribe`, `id` regex (`/^[A-Za-z0-9_-]{16,128}$/`) and https endpoint checks on `/push/subscribe`, HTML & control char stripping on `/user/pen-name`. Added 16KB global request body size cap (5MB for `/import`).
  - Durable Object State Persistence: Enhanced `StatsAggregator` DO with `this.ctx.storage` persistence (`blockConcurrencyWhile` constructor hydration, `storage.put` on additions, atomic storage delete/update on successful D1 flush) to eliminate lost likes/views across DO evictions.
  - CORS Hardening: Replaced wildcard with exact origin allowlist (`https://currentnews.blog`, `https://www.currentnews.blog`, `https://admin.currentnews.blog`, `https://localhost`, `capacitor://localhost`, `http://localhost:3000`, `http://localhost:5173`), omitting `Access-Control-Allow-Origin` on unauthorized origins and always returning `Vary: Origin`.
  - Android URL Resolution (`src/utils/webBase.ts`): Created `webUrl()` helper resolving relative paths to `https://www.currentnews.blog` on native Capacitor platforms while keeping admin calls relative. Wrapped `/api/app/version`, `/api/push/public-key`, `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/mail/send-alert`, and `/img/` / `/uploads/` URLs.
  - Build Hygiene: Configured `vite.config.ts` with `build.sourcemap: false`, updated `package.json` to emit `server.cjs` outside `dist/` without sourcemaps, updated `Dockerfile` to copy `server.cjs`, and ignored `*.map` and `server.cjs` in `.gitignore`.
- [x] **Phase 50 (Granular Admin Auth Diagnosis, Token Auto-Refresh & Error Banners):** [COMPLETED]
  - Error Code Mapping in `requireRole.ts`: Mapped rejections to standard JSON `{ error, code }` with status: `no_token` (401), `token_expired` (401), `token_revoked` (401), `invalid_token` (401), `auth_backend_error` (503), `email_not_verified` (403), `no_role` (403), `forbidden` (403).
  - Diagnostic Logging: Rejections log `[auth] <code> <method> <path> hasHeader=<bool> projectId=<value> firebaseErrorCode=<error.code>` without exposing tokens, full emails, or database URLs.
  - Project ID Verification: Server startup logs active Firebase Admin `projectId` and warns if differing from `FIREBASE_PROJECT_ID`.
  - Configurable Revocation Checking: Added `AUTH_CHECK_REVOKED` env flag (defaults to `true`; only when strictly `"false"` does it skip revocation checking).
  - Universal Admin Fetch (`src/utils/adminFetch.ts`): Client-side helper automatically captures `token_expired` and `token_revoked` errors, calls `auth.currentUser.getIdToken(true)` to force-refresh, and retries the request once before propagating errors.
  - User-Facing Error Banners: Wired `adminFetch` into `DraftPublicationView`, `AdminDashboardView`, `CurrentPublicationsView`, and `AudienceRegistryView`, rendering clear human-readable messages in existing error banners without modifying UI styles.
  - Identity Endpoint: Verified `GET /api/admin/me` (`requireRole('admin', 'writer')`) returning `{ success: true, uid, role, email }`.
- **Immediate Next Step:** Run `CHECKLIST.md` steps:
  1. Neon migration (`node scripts/migrate-neon.mjs`) and set admin claim (`node scripts/set-role.mjs mdhassan1738@gmail.com admin`).
  2. Cloudflare Worker D1 migration (`cd worker && npx wrangler d1 execute currentnews-db --remote --file=schema.sql`) and deploy (`npx wrangler deploy`).
  3. Delete obsolete `server.cjs` and `server.cjs.map` from `android/app/src/main/assets/public/` before next Android release build.


