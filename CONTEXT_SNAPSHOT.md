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
  - Role-based author & admin access via Firebase Custom Claims and server-side verification.
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
  - Fixed `Failed to save pen name: Missing or insufficient permissions`: Added `match /users/{userId}` security rule in `firestore.rules` allowing authenticated users to manage their own pen name profiles, explicitly added `you@example.com` to admin checks, and registered the `User` schema in `firebase-blueprint.json`. Successfully deployed rules via `deploy_firebase`.
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
  - Cloudflare Edge Worker service (managed in CurrentNews-Admin repository) with D1 database bound to `currentnews-db` under route `api.currentnews.blog/*`.
  - Token Auth: Edge Worker verifies Firebase Auth JWTs directly with Web Crypto API (`crypto.subtle`) using Google's public JWK set (`securetoken@system.gserviceaccount.com`).
  - Strict Admin Authorization: Direct exact email matching against `ADMIN_EMAILS` (`you@example.com`).
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
  - Cloudflare Worker Durable Object write coalescing (`StatsAggregator` in Edge Worker): 30s alarm timer merges pending reaction/view deltas into a single D1 batch update (`ON CONFLICT(post_id) DO UPDATE SET likes=MAX(0, likes+excluded.likes)...`), direct D1 fallback on failure, edge caching on `GET /stats` (`s-maxage=60`), and admin `POST /admin/recount`.
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
  - Resolved Cloudflare Worker authorization gap in Edge Worker: added `AUTHORIZED_WRITER_AND_ADMIN_EMAILS` (including `you@example.com` and `@currentnews.blog` domains) so `GET /subscribers` and admin endpoints succeed for all authorized newsroom writers and admins instead of returning 403.
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
  - Cloudflare Worker Auth by Role (Edge Worker): Extended `verifyFirebaseIdToken` to extract `{ uid, email, emailVerified, role }` and validate `iat` (not in future) and `auth_time` (present and valid). Replaced all email check functions with `isAdmin(user) = user.role === 'admin' && user.emailVerified === true`. Purged all hardcoded emails, `@currentnews.blog` suffix bypass, and `ADMIN_EMAILS` from worker code and configuration.
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
- [x] **Phase 51 (Cloud Run Diagnostic Log Purge & Git Push Fix):** [COMPLETED]
  - Diagnosed Cloud Run 401 Unauthorized (`auth/argument-error`) caused by leading whitespace in `FIREBASE_PROJECT_ID=" gen-lang-client-0638643565"`.
  - Added `.trim()` guardrail to `server/auth/firebaseAdmin.ts` so environment whitespace never disrupts JWT token verification.
  - Deleted `/public/assets/aistudio/downloaded-logs-20261106-204203_c156b31e.json` (7MB log file) that was exceeding GitHub push limits.
  - Added `*downloaded-logs*` to `.gitignore` to prevent downloaded log attachments from blocking git pushes in the future.
- [x] **Phase 52 (Neon to Cloudflare D1 Publish Pipeline & Outbox Sync):** [COMPLETED]
  - D1 Reader Schema: Created 0001_articles.sql (in CurrentNews-Admin repo) storing only published articles with slug, published, and category indexes.
  - Internal Signed Endpoints (Edge Worker API): Implemented `/internal/publish`, `/internal/unpublish`, `/internal/bulk`, and `/internal/reconcile` protected with HMAC-SHA256 signatures (`SYNC_SECRET`), constant-time signature comparison, body size caps (1MB/5MB), and zero CORS headers.
  - Public Reader Endpoints (Edge Worker API): Implemented `GET /articles` (keyset pagination, light fields), `GET /articles/:idOrSlug` (full parsed article), and `GET /articles/recent-ids` with 60s edge caching and 300s stale-while-revalidate.
  - Outbox Publisher (`server/sync/d1Publisher.ts`): Added `signedPost`, `publishArticleToD1`, `unpublishArticleFromD1`, and `syncPendingArticles(50)` with exponential backoff and 10s timeouts.
  - Neon Outbox Migration (`migrations/002_sync.sql`): Added `sync_pending`, `synced_version`, and partial outbox index.
  - Admin Endpoints: Added `POST /api/admin/sync/run` (admin role) and `POST /api/admin/sync-tick` (`X-Sync-Token` constant-time check).
  - Admin UI: Added "Live", "Sync pending", and "Sync failed" badges (with error tooltip) and "Retry sync" button in `CurrentPublicationsView.tsx`, plus warning message forward in `DraftPublicationView.tsx`.
  - Full Resync CLI: Created `scripts/resync-d1.mjs` supporting `--dry-run` and safe reconciliation.
- [x] **Phase 53 (Admin Article Loading, Role-Scoped Editing & Optimistic Concurrency):** [COMPLETED]
  - Server: Implemented `GET /api/admin/articles/:id` behind `requireRole('admin', 'writer')`. Queries Neon Postgres directly with fallback to R2/local disk. Restricts writers to their authored articles (`author_uid === user.uid`), while admins can read any. Reusable `mapRowToArticle` parses arrays and maps snake_case DB columns to camelCase `Post` shape.
  - Client: Updated `DraftPublicationView.tsx` to load articles via `adminFetch('/api/admin/articles/:id')`. Displays specific actionable error messages in existing error banner (e.g. "Article not found (404)", "You can only edit your own articles (403)", "Session expired, please sign in again (401)") and logs errors with status/body to `console.error`.
  - Optimistic Concurrency: Tracks `loadedVersion` state. Server checks incoming `version` against database `version` during `isUpdate` in `POST /api/admin/articles`; returns HTTP 409 `{ code: "version_conflict", error: "This article was changed elsewhere, please reload" }` if another user or window updated the article first. Client alerts the editor and prevents overwriting. On success, increments `version` by 1.
  - CurrentPublicationsView: Added `Archived` status badge; verified Edit button correctly opens `/admin/draft?id=${post.id}`; ensured all statuses (published, draft, archived) are visible in the editorial list.
- [x] **Phase 54 (Admin Host Routing Hardening, PWA Isolation, Auth Readiness & Clock Skew Leeway):** [COMPLETED]
  - Admin Host Routing (`server.ts`): On `admin.currentnews.blog`, any path starting with `/api/` that is not `/api/admin/*` strictly returns JSON 404 `{ error: "Not found" }` (never redirects to `/admin`, never returns HTML). Explicitly allowed `GET /healthz` and `/readyz` on the admin host. Enforced `no-store, no-cache, must-revalidate` on admin pages and APIs.
  - PWA Isolation: Omitted `<link rel="manifest">` and Service Worker registration when `window.location.hostname.startsWith('admin.')`. Cleaned up stale registrations on admin portal. In `public/sw.js`, explicitly bypassed and blocked caching for any admin page or admin API response.
  - Load Balancer Probing Check: Inspected `src/utils/clientLoadBalancer.ts`. Probing begins automatically inside `ClientLoadBalancer.constructor()` at module load time; reported to user that no external call site exists to gate without modifying the locked file.
  - Auth Readiness (`src/utils/adminFetch.ts`): Awaits `auth.authStateReady()` before accessing `currentUser`. If no user is authenticated, halts early with `{ error: "Signing in...", code: "signing_in" }`. On any 401 response, calls `currentUser.getIdToken(true)` to force refresh and retries the request exactly once.
- [x] **Phase 56 (Security Hardening — Helmet CSP, Proxy Trust, Rate Limiting & Mail Sanitization):** [COMPLETED]
  - Helmet CSP & HSTS: Configured `helmet` with strict CSP (`self` for scripts; `img-src` self, media CDN, `https:`, `data:`, `blob:`; `connect-src` self, D1/worker API, identitytoolkit, securetoken, Google APIs, AdSense, Analytics; `frame-src` YouTube, Google, DoubleClick, Firebase; HSTS with 1 year max-age, subdomains, and preload).
  - Proxy Trust: Replaced `trust proxy: true` with `app.set('trust proxy', 2)` to accurately extract authentic client IPs through 2 reverse proxy hops (GFE / Cloudflare).
  - Rate Limiting: Integrated `express-rate-limit` with 300 requests / 15 minutes across `/api/*` and 5 requests / hour on `POST /api/mail/send-alert`.
  - Alert Mail Hardening (`api/mail/send-alert.ts`): Stripped newlines and carriage returns from `title` and HTML-escaped it for both email subject and body; enforced RFC email validation; parsed `link` with `new URL()` requiring hostname `currentnews.blog` or `www.currentnews.blog`.
  - Database TLS Hardening: Purged `rejectUnauthorized: false` from all migration and seed scripts, requiring standard CA verification (`ssl: true`).
- [x] **Phase 58 (Persistent Neon Push Subscriptions & VAPID Hardening):** [COMPLETED]
  - Persistent Neon PostgreSQL storage: Migrated push subscription storage to shared table `push_subscriptions` (`id bigserial`, `endpoint unique`, `p256dh`, `auth`, `user_agent`, `created_at`). Subscribe executes `INSERT ... ON CONFLICT (endpoint) DO NOTHING`; unsubscribe executes `DELETE FROM push_subscriptions WHERE endpoint = $1`. Completely purged ephemeral disk files `data/push_subscriptions.json` and `data/vapid_keys.json`.
  - Strict VAPID Key Configuration: VAPID public key is read strictly from `process.env.VAPID_PUBLIC_KEY`. Dynamic key generation removed. Returns HTTP 503 if unconfigured.
  - Endpoint & Cryptographic Validation: Restricted `endpoint` to `https://` with approved push delivery gateways (`fcm.googleapis.com`, `*.fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`, `updates.push.services.mozilla.com`, `*.updates.push.services.mozilla.com`) under 500 characters. Enforced base64url regex (`^[A-Za-z0-9_-]+$`) on `p256dh` (max 200 chars) and `auth` (max 50 chars).
  - Rate Limiting: Added `pushLimiter` with `express-rate-limit` capping `POST /api/push/subscribe` and `POST /api/push/unsubscribe` to 10 requests per hour per IP.
  - Admin Boundary: Removed `/api/push/subscribers-count` and broadcast routes from this reader application. Documented `NEON_DATABASE_URL` (with role limited to INSERT/DELETE) and `VAPID_PUBLIC_KEY` in `.env.example`.
- [x] **Phase 59 (Live Domain Images, Logo, Facebook Player & Push Auto-Prompt):** [COMPLETED]
  - Native Push Permission Auto-Prompt on Site Open: In `src/utils/pushManager.ts`, added `initPushNotificationPermissionOnSiteOpen()` which auto-requests native browser permission on site open when `Notification.permission === 'default'`. If granted, sets `browser_notifications_enabled` to `'true'`, notifies settings via custom `settings-updated` DOM event, and registers subscription on the backend via `subscribeUserToPush()`. If permission was already granted, keeps setting ON and synchronizes subscription via `syncPushSubscriptionOnAppBoot()`.
  - Settings UI Synchronization: Updated `Header.tsx` and `SettingsView.tsx` so notification toggle reflects `Notification.permission === 'granted'` and automatically connects the subscription string if not previously subscribed.
  - Image Path Sanitation: Removed malformed `/uploads/photo.jpg/img/` URL fragments across `data/feed.json` and `data/articles/*.json`, normalizing all paths to `/img/{id}-{n}.webp`. Sanitized image URLs across `/api/posts` endpoints in `src/server/postsApi.ts`.
  - Brand Logo & Fallback Assets: Mounted `/public` static middleware directly in `server.ts` before SPA fallback, guaranteeing `/CurrentNews.png` returns HTTP 200. Added brand avatar fallback in `PostDetailView.tsx` and `AboutView.tsx` defaulting to `/CurrentNews.png` on img error.
  - Facebook Video Player & SDK CSP: Added `https://www.facebook.com`, `https://facebook.com`, `https://*.facebook.com` to `frame-src`, `connect.facebook.net` and `facebook.net` to `script-src`, and `*.facebook.com`, `*.fbcdn.net` to `connect-src` in Helmet CSP.
  - Cloud Run Dockerfile: Configured Stage 2 runner image with `RUN mkdir -p data/img` so Cloud Run containers dynamically maintain local webp fallback directories without requiring `data/` in git or build context.
- [x] **Phase 60 (Unified Two-Tier Navbar Design with Blush Theme):** [COMPLETED]
  - Unified Two-Tier Navbar: Updated 1st line (`header#main-header`) and 2nd line (`div#category-filter-header`) to both share background.
  - Seamless Boundary: Eliminated dividing horizontal line and shadow between 1st line and 2nd line on home page (`border-b-0 shadow-none`), while preserving the single bottom dividing line at the bottom of the 2nd line in the exact same line colour.
  - Full-Bleed Alignment: Styled Line 2 with full-viewport width (`style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}`) and inner grid container (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`) matching Line 1 to the pixel.
  - Preserved Button Designs: All category tab buttons (`cat-tab-*`), active amber underlines (`border-amber-600/90`), count badges, search trigger, and profile button shapes remain 100% intact.
- [x] **Phase 61 (Fixed Navbar & Article Under-Scroll with #ffe8d6 Warm Peach Theme):** [COMPLETED]
  - Fixed Navbar: Configured `#main-header` with `fixed top-0 left-0 right-0 w-full z-50` and mounted a 72px document flow spacer (`#header-fixed-spacer`).
  - Smooth Article Under-Scroll: Individual article pages (`PostDetailView.tsx`) start immediately below the navbar at 72px without any header clipping or overlap, and as the user scrolls, all article content, images, paragraphs, and media scroll smoothly underneath the fixed navbar.
  - Color Synchronization: Updated Line 2 (`#category-filter-header`) and `index.css` to match user's `#ffe8d6` warm peach/apricot theme.
- [x] **Phase 62 (Navbar #fbf1e5 Beige Theme, Curved Bottom, Playfair/Lora Fonts & Side Menu Drawer):** [COMPLETED]
  - Beige Palette: Updated `#main-header`, `#category-filter-header`, and `src/index.css` to warm editorial beige `#fbf1e5`.
  - Curved Navbar Bottom: Added `rounded-b-2xl sm:rounded-b-3xl border-b border-slate-300/70 dark:border-slate-800/80 shadow-xs` to the bottom of the navbar. When page content scrolls under it, it flows under the elegant curved edge seamlessly.
  - Typography: Imported and applied Google Fonts `Playfair Display` for "Current News" and `Lora` for "Independent Ledger", while preserving standard sans-serif uppercase bold font on all category button labels.
  - Left-Side Drawer Menu: On article reading pages (where Line 2 is hidden), added a three-line menu trigger (`#header-side-menu-trigger`) on the left of "Current News". Clicking it opens a smooth spring-animated left-side drawer (`w-[72vw] max-w-[280px] sm:w-80`) with `#fbf1e5` beige background and backdrop blur, displaying all category navigation buttons with instant feed filtering.
- [x] **Phase 63 (Home Page 3-Line Menu on Scroll & Bottom Top Articles Section):** [COMPLETED]
  - Home Page 3-Line Menu Trigger on Scroll: Updated `Header.tsx` to detect when Line 2 of navbar scrolls out of view (`window.scrollY > 68`). When Line 2 is hidden, the 3-horizontal-line menu button smoothly appears on the left of "Current News" on the home page and Line 1 curves its bottom edge (`rounded-b-2xl sm:rounded-b-3xl shadow-xs`).
  - Top Articles Section (`#top-articles-box-area`): Removed the bottom stacked category section from `HomeView.tsx` and replaced it with a Top 4 most liked/read stories section formatted as a numbered list (`Top Articles: 1. <truncated headline>...`) with interactive headline buttons that instantly open the respective article.
- [x] **Phase 64 (Reader Security Hardening — Mail Relay Removal, Webhook Lock & DOMPurify):** [COMPLETED]
  - Removed Public Mail Relay: Deleted `api/mail/send-alert.ts`, removed `/api/mail/send-alert` route, rate limiter, and imports from `server.ts`. Removed client-side calls in `Header.tsx` and removed contact form UI from `ContactView.tsx` (now routing readers to direct email). Unmatched `/api/mail/send-alert` requests return 404 JSON.
  - Locked Inbound Mail Webhook: Restricted `/api/mail/inbound` strictly to GET and POST; removed wildcard `Access-Control-Allow-Origin: *`; enforced constant-time `crypto.timingSafeEqual` comparison against `INBOUND_WEBHOOK_SECRET` (returns 401 on missing or invalid secret). Updated all contact/DMCA addresses to `help@currentnews.blog`.
  - Browser-Side HTML Sanitization: Added `src/utils/sanitizeHtml.ts` using DOMPurify with strict whitelist (only YouTube https iframes allowed, strips style and on* attributes, enforces `rel="noopener noreferrer nofollow"` and `target="_blank"`, preserves Quill `ql-*` classes). Integrated before `dangerouslySetInnerHTML` in `ProgressiveArticleBody.tsx` and `LikedView.tsx`.
  - Scoped Image CORS: Confined `Access-Control-Allow-Origin: *` headers strictly to static image asset routes (`/img` and `/uploads`).
  - Documentation Sanitization: Cleaned connection strings in `CHECKLIST.md` and `docs/NEON.md` to `NEON_DATABASE_URL=<set in Secret Manager>`. Regenerated `package-lock.json` with `npm ci` passing.
- [x] **Phase 65 (Embed Player Viewport Purification):** [COMPLETED]
  - Removed Redundant Bottom Bars: Removed the bottom action bars ("YouTube Video ready to play / Watch on YouTube" and "Facebook Reel/Video/Post ready to play / Watch on Facebook") and disclaimer text below the video player containers in `src/components/EmbedHandler.tsx`.
- [x] **Phase 68 (Side Menu Expansion, Compact Viewport Ratio Fit & Jharkhand/World Loading Fix):** [COMPLETED]
  - Fixed Jharkhand & World Loading: Resolved root cause where English-only keyword matching failed on Hindi Devanagari news copy, causing Jharkhand to show 0 articles. Added comprehensive Devanagari keyword regex (`झारखंड`, `गोड्डा`, `रांची`, `बसंतराय`, `हनवारा`, `महागामा`, `देवघर`, etc.) and World regex (`विदेश`, `सऊदी`, `रियाद`, `हूती`, `बांग्लादेश`, etc.) across `src/views/HomeView.tsx` (`checkPostCategoryMatch`) and `src/server/postsApi.ts`.
  - In-Memory Full Feed Retained: Updated `fetchArticlesFeed` in `HomeView.tsx` to request the complete catalog so switching between categories is instantaneous (0ms) and never purges remaining articles from memory.
  - Side Menu Categories Expansion: Expanded `SIDE_MENU_CATEGORIES` to 14 newsroom sections (`All`, `Jharkhand`, `National`, `World`, `Politics`, `Business`, `Sports`, `Tech`, `Health`, `Crime`, `Education`, `Entertainment`, `Opinion`, `General`).
  - Scroll-Free Proportional Drawer Layout: Reduced button height (`py-1 sm:py-1.2`), condensed typography (`text-[10.5px] sm:text-xs`), removed 44px min-height constraints, and tightened drawer header/footer padding so all 14 categories fit on any device screen height ratio (from 568px phones to large tablets) without requiring scrolling.
- [x] **Phase 69 (Capacitor Android Play Store Update Verification & Asset Sync):** [COMPLETED]
  - Version Increment for Play Store: Bumped `versionCode = 2` and `versionName = "1.0.1"` in `android/app/build.gradle.kts` and synchronized `CURRENT_CLIENT_VERSION = '1.0.1'` and `CURRENT_CLIENT_VERSION_CODE = 2` in `src/utils/appVersionManager.ts`, fully aligned with `src/server/appVersionApi.ts` for Google Play Store updates.
  - Capacitor Android Sync: Ran `npm run build && npx cap sync android` to compile web production assets into `dist/` and sync into native Android assets (`android/app/src/main/assets/public/`) with updated native plugin bindings (`@capacitor/app` and `@capacitor-community/admob`).
  - Android Manifest & Security Check: Verified deep linking for `https://currentnews.blog` and `https://www.currentnews.blog`, permissions (`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`), AdMob application ID (`ca-app-pub-5865716270182311~4645476456`), and native back gesture handling in `MainActivity.kt`.
- [x] **Phase 70 (App Version 4 / 1.0.3 & Android 15 Edge-to-Edge Migration):** [COMPLETED]
  - Version Increment to 4 (1.0.3): Updated `android/app/build.gradle.kts` (`versionCode = 4`, `versionName = "1.0.3"`), `src/utils/appVersionManager.ts` (`CURRENT_CLIENT_VERSION = '1.0.3'`, `CURRENT_CLIENT_VERSION_CODE = 4`), `src/server/appVersionApi.ts`, and `data/app-version.json`.
  - Android 15 (API 35+) Edge-to-Edge Migration: Implemented `enableEdgeToEdge()` in `MainActivity.kt` and migrated `themes.xml` away from deprecated parameters (`android:statusBarColor` and `android:windowLightStatusBar`) to transparent system bars, eliminating Google Play Console deprecation warnings.
  - Window Insets & Notch Handling: Integrated `ViewCompat.setOnApplyWindowInsetsListener` handling status bar, navigation bar, and display cutout insets (`WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()`), ensuring webview content is never obscured by Android 15 system bars or camera cutouts. Added `viewport-fit=cover` to `index.html`.
  - Synced & Verified: Ran `npm run build && npx cap sync android` to sync assets into `android/app/src/main/assets/public/`. Passed TypeScript compilation and lint checks with 0 errors.
- [x] **Phase 72 (Reader Article Loading Fallback via Cloudflare D1/Worker):** [COMPLETED]
  - Multi-Tier Article Resolution in `src/server/postsApi.ts`: Updated `handleGetPostById` to check (a) in-memory cache, (b) Cloudflare Edge Worker at `WORKER_BASE_URL` or `https://api.currentnews.blog` (`GET /articles/:id` with 4s timeout), (c) R2 and local disk as final fallback.
  - Consistent D1 Schema Mapping: Implemented `mapD1ArticleToPost` mapping `title`, `content`, `category`, `hashtags`, `imageUrl`, `imageUrlFallback`, `imageUrls`, `imageUrlsFallback`, `imagePosition`, `galleryPositions`, `youtubeUrl`, `facebookUrl`, `authorName`, `createdAt`, `updatedAt`, `status: "published"`.
  - Feed Fallback: Updated `handleGetPosts` to fall back to Worker `GET /articles?limit=100` if R2 and disk return no articles, preserving the 60-second in-memory cache.
- [x] **Phase 73 (Worker Safe JSON Parsing & HTML Response Interception):** [COMPLETED]
  - Diagnosed and fixed `[Posts API] Worker article fetch deferred/failed: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON` in `src/server/postsApi.ts` and `src/utils/clientLoadBalancer.ts`.
  - Added explicit `Accept: 'application/json'` request header on all Worker fetch calls.
  - Guarded response parsing with `resp.headers.get('content-type')?.includes('application/json')` and string inspection (`rawText.trim().startsWith('{')` / `[`).
- [x] **Phase 74 (Dynamic Hero Poster Article Photo & Editorial Fallback):** [COMPLETED]
  - Created `getPostCoverImage(post)` in `src/utils/imageUrl.ts` to inspect `imageUrl`, `image_url`, `imageUrls[0]`, `imageUrlFallback`, and `content` `<img>` tags.
  - Updated `HomeView.tsx` hero showcase poster: renders the article's real photo when present (with `onError` fallback to `/editorial-default-poster.jpg`), and cleanly renders the default editorial poster when no image is present.
- [x] **Phase 75 (Article Image Breakdown & Malformed URL Sanitization):** [COMPLETED]
  - Diagnosed root cause of article image breakdown in `PQRf0KBMW81Cl7VFNyJL` ("सऊदी अरब में दो बांग्लादेशी नागरिकों..."): legacy HTML stored `https://https://media.currentnews.blog/uploads/photo.jpg/img/...` with double protocols that browsers could not resolve as hostnames.
  - Added DOMPurify `IMG` hook in `src/utils/sanitizeHtml.ts` and enhanced `src/utils/imageUrl.ts` and `PostDetailView.tsx` to automatically self-heal all inline `<img src="...">` URLs using `cleanImageUrl()`.
  - Audited and sanitized all 41 articles and 49 images in `data/articles/*.json`; verified that 100% of the 45 unique CDN image URLs return HTTP 200 OK.
- [x] **Phase 76 (Google SERP Site Name, AI Agent Browser & Geo Search Optimization):** [COMPLETED]
  - Google SERP Site Name Specification: Updated `index.html` Schema.org `WebSite`, `<meta property="og:site_name">`, and `<meta name="application-name">` to strictly `"name": "Current News"`, `"alternateName": ["Current News Live", "CurrentNews"]` (removed domain names from alternate names), matching user screenshot requirement for the site name above the domain in Google search results.
  - Sitemaps & RSS Feeds Resiliency: Rewrote `api/sitemap.xml.ts` and `api/rss.xml.ts` using `loadLocalFeed()` from `src/server/r2Articles.ts` instead of locked Firestore REST API. Now generates 56 dynamic entries in `sitemap.xml` with `<news:news>` and `<image:image>` tags, plus 41 articles with `<enclosure>` images in `rss.xml`.
  - Social & Search Bot Server Pre-Rendering: Updated `src/server/socialPreview.ts` to recognize modern AI search agents (`GPTBot`, `PerplexityBot`, `ClaudeBot`, `Claude-Web`, `Google-Extended`, `Applebot-Extended`, `OAI-SearchBot`) alongside Googlebot and Googlebot-News. Reads article data from `data/articles/${postId}.json` and `loadLocalFeed()`, pre-rendering semantic HTML and `NewsArticle` Schema.org JSON-LD with geo tags.
  - Canonical Domain Enforcement & 301 Redirects: Added middleware in `server.ts` redirecting non-canonical domains (`*.cloud.run`, `*.run.app`, and apex `currentnews.blog`) with HTTP 301 to `https://www.currentnews.blog`, while safely bypassing localhost, internal probes, and AI Studio dev frames. Injected `Link: <https://www.currentnews.blog...>; rel="canonical"` headers on all HTML responses.
  - AI Context & Robots Directive: Created `public/llms.txt` standard specification and updated `public/robots.txt` explicitly welcoming search engines and AI agents with dual sitemap links.
- **Immediate Next Step:** Production deployment verification on Google Cloud Run.




