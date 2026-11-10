import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import inboundHandler from './api/mail/inbound.ts';
import rssHandler from './api/rss.xml.ts';
import adsHandler from './api/ads.txt.ts';
import appAdsHandler from './api/app-ads.txt.ts';
import sitemapHandler from './api/sitemap.xml.ts';
import { handleSocialPreview } from './src/server/socialPreview.ts';
import {
  handleGetVapidPublicKey,
  handleSubscribe,
  handleUnsubscribe
} from './src/server/pushNotifications.ts';
import { handleGetPosts, handleGetPostById, handleGetWriters } from './src/server/postsApi.ts';
import { ensureR2ArticlesWarmup, getFeedFromR2, getDeletedArticleIds } from './src/server/r2Articles.ts';
import { handleGetAppVersion } from './src/server/appVersionApi.ts';

// Load environment variables
dotenv.config();

// Helper to safely execute async route handlers with standard error catching
const asyncHandler = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      console.error('Error in route handler:', error);
      if (!res.headersSent) {
        res.status(500).send(error?.message || 'Internal Server Error');
      }
    }
  };
};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Trust proxy: 2 hops for Google Cloud Load Balancer (GCLB) / Google Front End and Cloudflare Anycast CDN
  app.set('trust proxy', 2);

  // Security headers with Helmet and Content Security Policy (CSP)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://pagead2.googlesyndication.com",
            "https://*.googlesyndication.com",
            "https://*.google.com",
            "https://*.doubleclick.net",
            "https://www.googletagmanager.com",
            "https://apis.google.com",
            "https://connect.facebook.net",
            "https://*.facebook.net",
            "https://*.facebook.com"
          ],
          imgSrc: [
            "'self'",
            "https://media.currentnews.blog",
            "https://*.r2.dev",
            "https://i.imgur.com",
            "https://*.imgur.com",
            "https:",
            "data:",
            "blob:"
          ],
          connectSrc: [
            "'self'",
            "https://api.currentnews.blog",
            "https://media.currentnews.blog",
            "https://*.r2.dev",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://*.googleapis.com",
            "https://*.firebaseio.com",
            "https://*.google.com",
            "https://*.doubleclick.net",
            "https://pagead2.googlesyndication.com",
            "https://www.google-analytics.com",
            "https://*.googletagmanager.com",
            "https://*.facebook.com",
            "https://*.facebook.net",
            "https://*.fbcdn.net",
            "https://*.youtube.com",
            "https://*.youtube-nocookie.com",
            "https://*.googlevideo.com",
            "ws:",
            "wss:"
          ],
          frameSrc: [
            "'self'",
            "https://www.youtube.com",
            "https://youtube.com",
            "https://*.youtube.com",
            "https://www.youtube-nocookie.com",
            "https://*.youtube-nocookie.com",
            "https://www.facebook.com",
            "https://facebook.com",
            "https://*.facebook.com",
            "https://*.google.com",
            "https://*.doubleclick.net",
            "https://*.firebaseapp.com",
            "https://googleads.g.doubleclick.net"
          ],
          frameAncestors: [
            "'self'",
            "https://*.google.com",
            "https://*.aistudio.google.com",
            "https://*.run.app",
            "https://*.googleusercontent.com",
            "https://*.cloud.google.com"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          mediaSrc: ["'self'", "https:", "blob:", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xFrameOptions: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })
  );

  // General rate limiter: 300 requests per 15 minutes per IP on /api/*
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again after 15 minutes.'
    }
  });


  // Strict rate limiter: 10 requests per hour per IP on /api/push/subscribe and /api/push/unsubscribe
  const pushLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many push subscription requests from this IP, please try again after an hour.'
    }
  });

  // Apply general API rate limiter to all /api/* routes
  app.use('/api', apiLimiter);

  // Health-check (liveness) endpoint for Google Cloud Run / Container orchestrators
  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain; charset=utf-8').send('OK');
  });

  // Readiness probe endpoint for Google Cloud Load Balancer (GCLB) backend health checks
  app.get('/readyz', (_req, res) => {
    const memory = process.memoryUsage();
    res.status(200).json({
      status: 'ready',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      service: 'currentnews-web-applet',
      platform: 'google-cloud-run',
    });
  });

  // Client load balancer telemetry status endpoint
  app.get('/api/lb/status', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      node: 'gcp-cloud-run-primary',
      region: process.env.K_REVISION ? 'gcp-serverless' : 'local-node',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // Admin Redirection & Public Host Routing
  const ADMIN_BASE_URL = (process.env.ADMIN_BASE_URL || 'https://admin.currentnews.blog').replace(/\/+$/, '');

  app.use((req, res, next) => {
    const pathName = req.path || '';

    // Permanently redirect all admin portal visits to the dedicated admin repository
    if (pathName === '/admin' || pathName.startsWith('/admin/')) {
      const targetUrl = `${ADMIN_BASE_URL}${req.originalUrl || '/admin'}`;
      return res.redirect(301, targetUrl);
    }

    // Return 404 JSON for any stale admin API calls
    if (pathName === '/api/admin' || pathName.startsWith('/api/admin/')) {
      return res.status(404).json({
        success: false,
        error: `Admin APIs have moved to ${ADMIN_BASE_URL}`
      });
    }

    return next();
  });

  // Strict 1MB body limit for public reader routes
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // High-performance Cloudflare R2 / Edge reader endpoints (zero Firestore read quota consumption)
  app.get('/api/posts', asyncHandler(handleGetPosts));
  app.get('/api/posts/:id', asyncHandler(handleGetPostById));
  app.get('/api/articles/feed', asyncHandler(async (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const feed = await getFeedFromR2();
    res.json({ success: true, articles: feed });
  }));
  app.get('/api/articles/deleted', asyncHandler(async (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const deleted = Array.from(getDeletedArticleIds());
    res.json({ success: true, deletedIds: deleted });
  }));
  app.get('/api/writers', asyncHandler(handleGetWriters));
  app.use('/img', express.static(path.join(process.cwd(), 'data', 'img'), {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  // Server-driven App Update endpoint (Google Play Store / Cloud Run reader version check)
  app.get('/api/app/version', asyncHandler(handleGetAppVersion));

  // Inbound mail endpoint for webhook notifications (accepts strictly GET and POST, no wildcard CORS)
  app.all('/api/mail/inbound', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }
    return next();
  }, asyncHandler(inboundHandler));

  // Dynamically serve dynamic XML Sitemap endpoint
  app.all('/sitemap.xml', asyncHandler(sitemapHandler));

  // Dynamically serve dynamic RSS Feed endpoint
  app.all('/rss.xml', asyncHandler(rssHandler));

  // Serve the ads.txt file
  app.all('/ads.txt', asyncHandler(adsHandler));

  // Serve the app-ads.txt file for Google AdMob app verification
  app.all('/app-ads.txt', asyncHandler(appAdsHandler));

  // Explicitly serve robots.txt with text/plain
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8').sendFile(path.join(process.cwd(), 'public', 'robots.txt'));
  });

  // Explicitly serve Android App Links Digital Asset Links JSON (.well-known/assetlinks.json)
  app.get(['/.well-known/assetlinks.json', '/.well-known/assetlinks'], (_req, res) => {
    res.type('application/json').sendFile(path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json'));
  });

  // Automated Push Notification API routes (background alerts subscription for readers)
  app.get('/api/push/public-key', handleGetVapidPublicKey);
  app.post('/api/push/subscribe', pushLimiter, asyncHandler(handleSubscribe));
  app.post('/api/push/unsubscribe', pushLimiter, asyncHandler(handleUnsubscribe));

  // Fallback 404 handler for any unmatched /api/* route so it NEVER returns HTML to API clients
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
    });
  });

  // Error middleware for /api/* ensuring all unhandled API errors respond with JSON, never HTML
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Unhandled API Error]:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal API Server Error',
      });
    }
  });

  // Dynamic Open Graph and Twitter Card tags injection for social crawlers (Facebook, X, WhatsApp, LinkedIn, Discord, Telegram, etc.)
  app.use(handleSocialPreview);

  // Serve uploaded media files directly from local storage with static image CORS
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  // Connect Vite configuration dynamically to support dev vs prod modes
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const publicPath = path.join(process.cwd(), 'public');
    app.use(express.static(publicPath, { maxAge: '1h' }));
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on http://localhost:${PORT}`);
    // Non-blocking warmup check to guarantee Cloudflare R2 articles feed is primed
    ensureR2ArticlesWarmup().catch(err => console.debug('[R2 Warmup Background]:', err));
  });

  // Google Cloud Load Balancer (GCLB) keep-alive alignment to prevent 502 Bad Gateway race conditions
  // GFE timeout is 600s; backend must exceed this (650s / 660s)
  server.keepAliveTimeout = 650000;
  server.headersTimeout = 660000;

  // Graceful shutdown handling for Cloud Run container lifecycle (SIGTERM/SIGINT)
  const shutdown = (signal: string) => {
    console.log(`[Lifecycle] Received ${signal}. Draining connections and shutting down gracefully...`);
    server.close(() => {
      console.log('[Lifecycle] HTTP server successfully closed.');
      process.exit(0);
    });
    // Force close after 10 seconds if connections are hanging
    setTimeout(() => {
      console.error('[Lifecycle] Forcefully terminating after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
