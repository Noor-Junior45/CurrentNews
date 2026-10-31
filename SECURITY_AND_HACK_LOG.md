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

