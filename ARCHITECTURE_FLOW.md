# ARCHITECTURE_FLOW.md — Visual System State

```mermaid
graph TD
    Client[Reader / Mobile App or Web Browser] --> GCLB[Google Cloud Load Balancer / Cloudflare CDN]
    GCLB -->|Trust Proxy / TCP 650s Keep-Alive| EdgeRouter[Express server.ts on Cloud Run 0.0.0.0:PORT]

    subgraph LoadBalancingAndResilience [Load Balancing & Multi-Origin Routing]
        Client --> ClientLB[src/utils/clientLoadBalancer.ts: Latency Scored & Circuit Breaker]
        ClientLB -->|Priority 1: 35ms| CFCDN[Cloudflare Global Anycast Edge CDN: media.currentnews.blog]
        ClientLB -->|Priority 2: 80ms| CloudRunAPI[Cloud Run Origin API: /api/posts & /api/posts/:id]
        ClientLB -->|Priority 3: 120ms| R2Mirror[Cloudflare R2 Secondary Mirror: pub-*.r2.dev]
        ClientLB -->|Priority 4: 0ms| LocalLZW[Local LZW Compressed Cache: localStorage]
        ClientLB -->|Hover / Touch| SpeculativePrefetch[Speculative Hover Pre-fetch: 0ms Article View]
    end

    subgraph CrawlerVerification [Search Engine, Newsroom & Store Verification]
        EdgeRouter -->|GET /app-ads.txt| AppAdsFile[app-ads.txt: pub-5865716270182311 DIRECT f08c47fec0942fa0]
        EdgeRouter -->|GET /ads.txt| AdsFile[ads.txt: pub-5865716270182311 DIRECT f08c47fec0942fa0]
        EdgeRouter -->|GET /robots.txt| RobotsTxt[robots.txt: Googlebot & Googlebot-News Allow / Disallow Utility]
        EdgeRouter -->|GET /sitemap.xml| SitemapXml[sitemap.xml.ts: Google News xmlns:news with news:news tags]
        EdgeRouter -->|GET /.well-known/assetlinks.json| AssetLinks[Android App Links Digital Asset Links]
        EdgeRouter -->|GET /healthz| HealthCheck[Cloud Run 200 OK Liveness Probe]
        EdgeRouter -->|GET /readyz| ReadyCheck[Cloud Run Readiness Probe with Memory/Uptime Telemetry]
        EdgeRouter -->|GET /api/lb/status| LBStatus[Origin Cluster Health Status]
    end

    subgraph ClientEnvironmentRouter [Client Platform Detection]
        Client --> DetectPlatform{Capacitor.isNativePlatform()?}
        
        DetectPlatform -->|Native Android App| NativePhoneMode[AdMob Native Mode]
        DetectPlatform -->|Web Browser / PWA| WebBrowserMode[Google AdSense Mode]
    end

    subgraph HomeReaderExperience [Reader Home Experience]
        Client --> HeroSection[Editorial Hero Showcase: Golden Ratio Right-to-Left Swiping Carousel in Beige, Blue & Brown]
        HeroSection -->|Poster Click| PostDetail[PostDetailView: Article Reading]
        Client --> FeedGrid[Chronological Article Feed Grid & Category Filters]
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

    subgraph BackendDataStore [Cloud Persistence & High-Volume Storage]
        Client -->|Zero-Quota Public Feed & Story Reads| R2Feed[Cloudflare R2: media.currentnews.blog/articles/feed.json]
        Client -->|Single Article Read| R2Story[Cloudflare R2: media.currentnews.blog/articles/:id.json]
        Client -->|Express Proxy Cache| PostsApi[GET /api/posts & /api/posts/:id in server.ts]
        PostsApi --> R2Feed
        AdminUI[AdminView / Editorial Desk] -->|Firebase Auth Sign-In ONLY| FirebaseAuth[Firebase Auth / Google Sign-In]
        AdminUI -->|1. Direct Cloud Persistence| FirestoreDB[(Cloud Firestore: posts/postId via Client SDK & REST)]
        AdminUI -->|2. Instant Client Cache| LocalLZW[Client LZW UTF-16 compressedStorage: cn_compressed_stories_v2]
        AdminUI -->|3. Server Save & R2 Mirror| R2Save[POST /api/articles/save -> data/articles/ + Memory + Cloudflare R2]
        AdminUI -->|Delete Article| R2Delete[DELETE /api/articles/:id -> data/deleted_articles.json + Firestore + R2]
        EdgeRouter -->|getFeedFromR2| MergeFeed[mergeFeedWithLocalAndCache: Merges CDN with Local/Firestore so newly posted articles NEVER vanish]
        AdminUI -->|One-Click Sync| R2Sync[POST /api/articles/sync -> Mirrors All to R2]
    end
```
