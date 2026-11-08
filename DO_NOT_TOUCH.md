# DO_NOT_TOUCH.md — Locked UI & Core Logic Registry

The following files, components, and logic structures represent finalized UI and core infrastructure. They MUST NOT be rewritten, restyled, deleted, or altered unless explicitly ordered by the user:

1. **`src/views/HomeView.tsx`**
   - Editorial Hero Showcase (`#editorial-hero-showcase`): Panoramic animated multi-poster showcase (`#hero-feature-poster-carousel`) using Golden Ratio scaling (`aspect-[4/3]` to `md:aspect-[1.618/1]`) and Right-to-Left swipe animations without overlay numbers, dots, or arrow clutter.
   - Dynamic Category Matching: When on 'All' category page, rotates dispatches across all categories; when on specific category tab (e.g. 'Sports', 'Tech', 'Politics', 'Business', 'Health', 'World', 'Opinion', 'General', 'Jharkhand'), automatically filters posters to match that specific category while preserving 100% of the design, typography, and animation physics.
   - Default author byline unified to "Current News".
   - Public reader feed grid layout, responsive typography, filter category tabs, and pick-up reading progress card.
   - Dynamic page-by-page navigator and pagination scroll preservation.

2. **`src/views/PostDetailView.tsx`**
   - Reading paper warm beige background (`bg-[#f7f4ed]` / dark: `#161412`).
   - High-contrast solid black typography (`text-black` / dark: `text-slate-100`) across breadcrumbs, author, date, views, and hashtags.
   - Guaranteed visible mobile social share buttons (Universal Share, X [Twitter], WhatsApp).
   - Article reader typography, inline image flow (`cleanImageUrl`), and fallback mechanics.
   - Background scroll progress tracker (`saveReadingProgress`).

3. **`src/components/ProfilePageNavbar.tsx` & All Profile Sub-Pages**
   - Universal Left-Aligned Header Layout: All page titles (`Profile`, `Privacy Policy`, `Terms of Service`, `Settings`, `Liked`, `Account Deletion`, `Admin`, `About Us`, `Contact`, `Editorial Policy`, `Sign In`) are strictly positioned on the left side, directly next to the tailless arrow back button (`ChevronLeft`).
   - Tailless back button and Android edge-swipe gesture navigation strictly return to the `/profile` page (or Home on Profile root).
   - Soft cream/beige theme styling (`#fbf8f2` / `#161412`), chapter navigation book design, and international legal copyright clauses.

4. **`src/components/Header.tsx` & `src/components/Footer.tsx`**
   - Navigation header and footer with conditional display per `PROFILE_PAGES`.
   - Footer copyright typography: `© 2026 Current News. All rights reserved.` with all "Live (Independent Ledger)" suffixes removed.

5. **`src/components/AndroidBackGestureHandler.tsx` & `android/app/src/main/java/blog/currentnews/app/MainActivity.kt`**
   - Predictive Android back gesture and hardware back button delegation logic to prevent app close during article reading.

6. **`android/app/src/main/java/blog/currentnews/app/NativeGoogleAuthPlugin.kt`**
   - Native Google Play Services Account Chooser bridge (bypasses WebView password popups).

7. **`src/utils/admob.ts`**
   - Hardcoded AdMob App ID (`ca-app-pub-5865716270182311~4645476456`) and Banner ID (`ca-app-pub-5865716270182311/2031114923`).

8. **`src/utils/seo.ts` & `public/robots.txt` & `api/sitemap.xml.ts`**
   - Canonical URL construction (`https://www.currentnews.blog`).
   - Dynamic OpenGraph, Twitter Cards, keywords, and Schema.org JSON-LD injection engine.
   - Regional & Geolocation targeting for Jharkhand (`geo.region: IN-JH`, `geo.placename: Jharkhand, India`, `geo.position: 23.6102;85.2799`, `ICBM`, `coverage`, `target: Jharkhand`).
   - Local Schema.org `areaServed` mapping for Jharkhand and key municipal districts (Ranchi, Jamshedpur, Dhanbad, Bokaro, Deoghar, Hazaribagh) plus `knowsAbout` topics.
   - Googlebot & Googlebot-News discovery directives with security disallow on utility routes (`/admin`, `/profile`, `/settings`, `/liked`, `/delete-account`, `/api/`).
   - Google News standard XML sitemap with `<news:news>` schemas, dedicated `/?category=Jharkhand` entry (priority 0.95), and `<news:keywords>` regional tags.

9. **`src/server/r2Articles.ts` & Cloudflare R2 Feed Pipeline**
   - Direct S3-compatible integration with bucket `currentnews-media` and public CDN domain `media.currentnews.blog`.
   - Aggregated public articles feed (`articles/feed.json`) and individual article store (`articles/${id}.json`).
   - Fast fallback to local server disk (`data/articles/feed.json` and `data/articles/${id}.json`).
   - Endpoints: `POST /api/articles/save`, `DELETE /api/articles/:id`, `POST /api/articles/sync`.
   - Strict zero-quota architecture: Firebase Firestore reads are bypassed on public feed views, preserving Firestore for admin writes and Google Authentication.

10. **`src/components/ProgressiveArticleBody.tsx` (Google News Reading Engine)**
   - Progressive scroll-reading architecture: lead paragraph renders immediately (0ms), while subsequent paragraphs and media stream in smoothly on scroll.
   - Preserves all inline photography, gallery positions, captions, and AdMob Native Advanced monetization slots (`article-middle`).
   - Zero layout shift (CLS = 0) with graceful fallback for legacy browsers and search engine crawlers.

11. **`src/utils/clientLoadBalancer.ts` (Resilient Multi-Origin Load Balancer)**
   - Multi-origin routing (Cloudflare Edge CDN, Cloud Run Origin API, R2 Mirror).
   - Automated circuit breaker (trips for 30s after 2 consecutive failures) and real-time latency probing.
   - Speculative pre-fetching for instant article transitions without user wait-time.

12. **`src/utils/appVersionManager.ts` & Server Version API**
   - Server-driven version check (`GET /api/app/version` & `POST /api/app/version`).
   - Native Capacitor build comparison engine (`build` code & `versionName`).
   - UI update pop-up (`AppUpdatePrompt`) unmounted from DOM per user request to maintain completely uninterrupted reading.

13. **Uncluttered Zero-Popup Reader Experience Policy**
   - Web Push Notification Alert Prompt (`NotificationBanner.tsx`) and Newsletter Subscription Modal (`NewsletterPopup.tsx`) are permanently removed from the codebase.
   - Reader viewport is strictly preserved with zero intrusive subscription or alert overlays.

14. **Dedicated Public Reader View Files Architecture**
   - Every public reader sub-page has its own modular file in `src/views/`:
     * `src/views/SettingsView.tsx` (theme, notifications, and preferences)
     * `src/views/LikedView.tsx` (curated liked articles ledger)
     * `src/views/DeleteAccountView.tsx` (account purge & Google Play data safety compliance)
     * `src/views/PrivacyView.tsx` (Privacy Policy)
     * `src/views/TermsView.tsx` (Terms of Service)
     * `src/views/AboutView.tsx` (E-E-A-T About Us)
     * `src/views/ContactView.tsx` (Reader Contact & Editorial Office)
     * `src/views/EditorialPolicyView.tsx` (Editorial Standards & Ethics)
   - All admin panels and write actions are decoupled to `https://admin.currentnews.blog/admin`. Any `/admin*` URL strictly 301 redirects to the dedicated admin repository.


