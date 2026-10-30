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
