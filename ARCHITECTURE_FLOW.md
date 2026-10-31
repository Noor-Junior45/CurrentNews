# ARCHITECTURE_FLOW.md — Visual System State

```mermaid
graph TD
    Client[Reader / Mobile App or Web Browser] --> EdgeRouter[Express server.ts / Vercel Edge / Cloud Run]

    subgraph CrawlerVerification [Search Engine, Newsroom & Store Verification]
        EdgeRouter -->|GET /app-ads.txt| AppAdsFile[app-ads.txt: pub-5865716270182311 DIRECT f08c47fec0942fa0]
        EdgeRouter -->|GET /ads.txt| AdsFile[ads.txt: pub-5865716270182311 DIRECT f08c47fec0942fa0]
        EdgeRouter -->|GET /robots.txt| RobotsTxt[robots.txt: Googlebot & Googlebot-News Allow / Disallow Utility]
        EdgeRouter -->|GET /sitemap.xml| SitemapXml[sitemap.xml.ts: Google News xmlns:news with news:news tags]
        EdgeRouter -->|GET /.well-known/assetlinks.json| AssetLinks[Android App Links Digital Asset Links]
        EdgeRouter -->|GET /healthz| HealthCheck[Cloud Run 200 OK Health Probe]
    end

    subgraph ClientEnvironmentRouter [Client Platform Detection]
        Client --> DetectPlatform{Capacitor.isNativePlatform()?}
        
        DetectPlatform -->|Native Android App| NativePhoneMode[AdMob Native Mode]
        DetectPlatform -->|Web Browser / PWA| WebBrowserMode[Google AdSense Mode]
    end

    subgraph NativePhoneApp [Phone App: AdMob Engine]
        NativePhoneMode --> AdMobManager[src/utils/admob.ts: @capacitor-community/admob]
        AdMobManager --> PlayServicesAds[com.google.android.gms:play-services-ads:23.6.0]
        AdMobManager --> RouteGuardNative[useAdSenseRouteGuard: Content Routes = Show Banner; Utility Routes = Hide Banner]
        NativePhoneMode --> SuppressWebAds[AdSpace.tsx: Return null inside DOM to eliminate web clutter & empty boxes]
    end

    subgraph WebsiteAdSense [Website: Google AdSense Engine]
        WebBrowserMode --> AdSpaceWeb[AdSpace.tsx: ins.adsbygoogle units]
        AdSpaceWeb --> ClientAdSense[ca-pub-5865716270182311 In-Feed & In-Article Units]
        WebBrowserMode --> RouteGuardWeb[useAdSenseRouteGuard: Noindex & Auto-Ads Suppressed on Admin/Profile/Auth]
    end

    subgraph BackendDataStore [Cloud Persistence & Storage]
        Client --> FirestoreDB[(Firebase Firestore: Articles, Reactions, Views)]
        Client --> R2Storage[Cloudflare R2: media.currentnews.blog Photos]
    end
```
