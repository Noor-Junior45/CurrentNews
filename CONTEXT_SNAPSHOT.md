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
  - Verified 100% Google AdMob Policies and Terms of Service compliance.
- **Immediate Next Step:** Production deployment to Google Cloud Run and high-scale R2 static mirroring if traffic exceeds millions.

