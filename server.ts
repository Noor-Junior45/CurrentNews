import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';

// Import Vercel serverless handlers
import sendAlertHandler from './api/mail/send-alert.js';
import inboundHandler from './api/mail/inbound.js';
import rssHandler from './api/rss.xml.js';
import adsHandler from './api/ads.txt.js';
import sitemapHandler from './api/sitemap.xml.js';
import { handleR2Upload } from './src/server/r2Upload.js';
import { handleSocialPreview } from './src/server/socialPreview.js';

// Load environment variables
dotenv.config();

// Helper to adapt Vercel serverless handler (req, res) to Express middleware (req, res)
const adaptVercelHandler = (handler: any) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      // Vercel serverless request body is already parsed by express.json()
      await handler(req as any, res as any);
    } catch (error: any) {
      console.error('Error in adapted Vercel handler:', error);
      if (!res.headersSent) {
        res.status(500).send(error?.message || 'Internal Server Error');
      }
    }
  };
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json());

  // Configure Multer for Cloudflare R2 image upload (20MB max, flexible image types and extensions)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB max file size
    },
    fileFilter: (_req, file, cb) => {
      const isImageMime = file.mimetype && (
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/octet-stream' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.mimetype === 'binary/octet-stream'
      );
      const hasImageExt = /\.(jpe?g|png|webp|gif|svg|bmp|tiff|heic|heif|avif)$/i.test(file.originalname || '');

      if (isImageMime || hasImageExt) {
        cb(null, true);
      } else {
        cb(new Error(`Only image files (JPEG, PNG, WebP, GIF, SVG, AVIF, HEIC) are permitted. Received: ${file.mimetype || 'unknown'}`));
      }
    },
  });

  // Cloudflare R2 image upload endpoint with explicit JSON error interception
  app.post('/api/upload', (req, res) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        console.error('[Upload Middleware Error]:', err);
        const isLimit = err.code === 'LIMIT_FILE_SIZE';
        const msg = isLimit
          ? 'Image file size exceeds the 20MB limit. Please select a smaller photo.'
          : (err.message || 'Failed to process image upload.');
        return res.status(400).json({
          success: false,
          error: msg,
        });
      }
      handleR2Upload(req, res);
    });
  });

  // Backend mail endpoint for automated subscriber alerting adapted from the Vercel handler
  app.post('/api/mail/send-alert', adaptVercelHandler(sendAlertHandler));

  // Inbound mail endpoint for webhook notifications and recipient autofill
  app.all('/api/mail/inbound', adaptVercelHandler(inboundHandler));

  // Dynamically serve dynamic XML Sitemap endpoint adapted from the Vercel handler
  app.all('/sitemap.xml', adaptVercelHandler(sitemapHandler));

  // Dynamically serve dynamic RSS Feed endpoint adapted from the Vercel handler
  app.all('/rss.xml', adaptVercelHandler(rssHandler));

  // Serve the ads.txt file adapted from the Vercel handler
  app.all('/ads.txt', adaptVercelHandler(adsHandler));

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

  // Serve uploaded media files directly from local storage
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Connect Vite configuration dynamically to support dev vs prod modes
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on http://localhost:${PORT}`);
  });
}

startServer();
