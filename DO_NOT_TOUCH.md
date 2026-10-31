# DO_NOT_TOUCH.md — Locked UI & Core Logic Registry

The following files, components, and logic structures represent finalized UI and core infrastructure. They MUST NOT be rewritten, restyled, deleted, or altered unless explicitly ordered by the user:

1. **`src/views/HomeView.tsx`**
   - Public reader feed grid layout, responsive typography, filter category tabs, and trending spotlight.
   - Dynamic page-by-page navigator and pagination scroll preservation.

2. **`src/views/PostDetailView.tsx`**
   - Reading paper warm beige background (`bg-[#f7f4ed]` / dark: `#161412`).
   - High-contrast solid black typography (`text-black` / dark: `text-slate-100`) across breadcrumbs, author, date, views, and hashtags.
   - Guaranteed visible mobile social share buttons (Universal Share, X [Twitter], WhatsApp).
   - Article reader typography, inline image flow (`cleanImageUrl`), and fallback mechanics.
   - Background scroll progress tracker (`saveReadingProgress`).

3. **`src/views/PrivacyView.tsx` & `src/views/TermsView.tsx`**
   - Soft cream/beige theme styling (`#fbf8f2` / `#161412`), chapter navigation book design, and international legal copyright clauses.

4. **`src/components/Header.tsx` & `src/components/Footer.tsx`**
   - Navigation header and footer with conditional display per `PROFILE_PAGES`.

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


