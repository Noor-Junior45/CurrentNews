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
- **Phase 23 (R2 Image URL Sanitization & Standalone Migration Tool):** [COMPLETED]
  - Added `getPublicBase()` in `src/server/r2Articles.ts` to strictly sanitize the hostname from `R2_PUBLIC_DOMAIN` (stripping protocol, path, and query params) and always return `https://${host}` (fallback: `https://media.currentnews.blog`).
  - Strict atomic upload: `uploadBase64ImageToR2` throws a fatal error if credentials or PutObject fail, guaranteeing articles can never point to unverified image links.
  - Added self-healing URL sanitization in `imageUrl.ts` and `processAndExtractBase64Images` repairing accidental `/uploads/.../img/` paths.
  - Created standalone CLI tool `scripts/migrate-from-r2.mjs` (and `npm run migrate:r2`): downloads all bucket articles, decodes base64 images into `img/{postId}-{n}.webp`, sends mandatory `HEAD` requests to verify HTTP 200 before writing, updates full articles, rebuilds light 37 KB `feed.json`, supports `--dry-run`, and outputs a comprehensive migration summary.
- **Immediate Next Step:** Production deployment to Google Cloud Run and Cloudflare D1/Worker deployment.
