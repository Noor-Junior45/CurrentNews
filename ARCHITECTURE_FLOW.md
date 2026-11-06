# ARCHITECTURE_FLOW.md — Visual System State

```mermaid
graph TD
    Client[Client Browser / Mobile App] --> GCLB[Google Cloud Load Balancer / Cloudflare CDN]
    GCLB -->|Trust Proxy / TCP 650s Keep-Alive| EdgeRouter[Express server.ts on Cloud Run 0.0.0.0:PORT]

    subgraph HostRoutingAndSegregation [Multi-Host Architecture & Security Perimeter]
        EdgeRouter --> CheckHost{Host header?}
        CheckHost -->|admin.currentnews.blog| AdminHost[Admin Host: Dedicated Editorial Portal]
        AdminHost -->|Inject Header| XRobots[X-Robots-Tag: noindex, nofollow]
        AdminHost -->|Non-Admin Path| RedirectAdmin[Redirect to /admin]
        AdminHost -->|/admin or /api/admin| AdminApp[Serve Admin SPA & Admin API]
        
        CheckHost -->|currentnews.blog / www| ReaderHost[Public Reader Domain]
        ReaderHost -->|Visit /admin| Redirect301[301 Permanent Redirect to admin.currentnews.blog/admin]
        ReaderHost -->|Call /api/admin/*| Block404[HTTP 404 JSON Shield]
        ReaderHost -->|Public Paths| ReaderApp[Public Reader App]
        
        CheckHost -->|localhost / *.run.app| DevBypass[Dev & Cloud Run Preview Bypass]
    end

    subgraph AuthenticationAndRoles [Firebase Custom Claims & Token Verification]
        AdminUser[Admin / Writer Reporter] --> GoogleAuth[Firebase Auth Google Sign-In]
        GoogleAuth --> TokenClaims[ID Token with Custom Claims: role = admin | writer]
        AdminApp -->|Authorization: Bearer ID_TOKEN| RequireRole[server/auth/requireRole.ts Middleware]
        RequireRole -->|verifyIdToken checkRevoked=true & email_verified=true| AttachUser[req.user = { uid, email, role }]
        CLI[Cloud Shell / Admin CLI] --> SetRole[scripts/set-role.mjs via Application Default Credentials ADC]
        SetRole --> MintClaims[setCustomUserClaims + revokeRefreshTokens]
    end

    subgraph EditorialSourceOfTruth [Editorial Database & Publishing Pipeline]
        AdminApp -->|POST /api/admin/articles| AdminCreateOrUpdate[server/api/adminArticles.ts]
        AdminCreateOrUpdate --> ZodValidate[Zod Schema Validation & sanitize-html]
        AdminCreateOrUpdate --> OwnershipCheck{Writer owns article OR Admin?}
        OwnershipCheck -->|No| Reject403[403 Forbidden]
        OwnershipCheck -->|Yes| NeonWrite[(Neon PostgreSQL: articles & staff tables)]
        NeonWrite --> AuditLog[(Neon audit_log: actor_uid, action, entity)]
        NeonWrite -->|Status == published| R2DualWrite[Dual-Write to Cloudflare R2: media.currentnews.blog/articles/feed.json]
        
        AdminApp -->|DELETE /api/admin/articles/:id| AdminDelete[Soft-Delete Archive in Neon & Purge from R2 Feed]
        AdminApp -->|GET /api/admin/articles| AdminQuery[Cursor Pagination from Neon with Role Filtering]
    end

    subgraph ReaderDataPipeline [Zero-Quota Public Reader Architecture]
        ReaderApp -->|Feed & Article Reads| R2Feed[Cloudflare R2: media.currentnews.blog/articles/feed.json]
        ReaderApp -->|Likes, Views & Comments| EdgeWorker[Cloudflare Worker api.currentnews.blog & D1 SQLite]
        LockedFirestore[(Firebase Firestore: Locked allow read, write: if false;)]
    end
```
