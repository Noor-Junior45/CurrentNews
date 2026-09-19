import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { cleanImageUrl, getYoutubeThumbnailUrl } from '../utils/imageUrl.js';

// Recognized social platform web crawlers & scrapers
const SOCIAL_BOT_REGEX = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|Pinterest|Applebot|Googlebot|bingbot|SkypeUriPreview|vkShare|redditbot/i;

const escapeHtml = (unsafe: string) => {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export async function handleSocialPreview(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = SOCIAL_BOT_REGEX.test(userAgent) || req.query.social_preview === '1';

  // If not a crawler and not explicitly requesting preview inspection, yield to standard SPA router
  if (!isBot) {
    return next();
  }

  // Extract post ID from URL pattern /post/:id or /post/:id/:slug
  const match = req.path.match(/^\/post\/([^/?#]+)/);
  if (!match) {
    return next();
  }

  const postId = match[1];

  try {
    const config = {
      projectId: "gen-lang-client-0638643565",
      firestoreDatabaseId: "ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4",
      apiKey: "AIzaSyAvFbWQ8kimAfhubQxNIQ0aow1ylZQ8evA"
    };

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery?key=${config.apiKey}`;
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "posts" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "__name__" },
            op: "EQUAL",
            value: {
              referenceValue: `projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/posts/${postId}`
            }
          }
        },
        limit: 1
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return next();
    }

    const data = await resp.json();
    const docItem = Array.isArray(data) && data[0]?.document ? data[0].document : null;
    if (!docItem || !docItem.fields) {
      return next();
    }

    const fields = docItem.fields;
    const title = fields.title?.stringValue || 'Current News Live - Independent Ledger';
    const rawContent = fields.content?.stringValue || '';
    const plainContent = rawContent
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;|&apos;/gi, "'")
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const summary = plainContent.length > 160 ? plainContent.substring(0, 160).trim() + '...' : plainContent;
    const rawImage = fields.imageUrl?.stringValue || '';
    const youtubeUrl = fields.youtubeUrl?.stringValue || '';
    const ytThumb = getYoutubeThumbnailUrl(youtubeUrl);
    const mainImg = cleanImageUrl(rawImage) || ytThumb || 'https://i.imgur.com/gFgShoZ.jpeg';
    const secureImg = mainImg.startsWith('http:') ? mainImg.replace('http:', 'https:') : mainImg;
    const authorName = fields.authorName?.stringValue || 'Chronicle Staff Report';
    const category = fields.category?.stringValue || 'News';
    const canonicalUrl = `https://www.currentnews.blog/post/${postId}`;

    // Read index.html template
    const indexPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'index.html')
      : path.join(process.cwd(), 'index.html');

    if (!fs.existsSync(indexPath)) {
      return next();
    }

    let html = fs.readFileSync(indexPath, 'utf-8');

    // Replace Title
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)} | Current News Live</title>`);

    // Replace or Inject Open Graph Tags
    const ogTags = `
    <!-- Open Graph (Article Specific for Social Media) -->
    <meta property="og:site_name" content="Current News Live" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(summary)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${escapeHtml(mainImg)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(secureImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Illustration for ${escapeHtml(title)}" />
    <meta property="og:locale" content="en_US" />
    <meta property="article:author" content="${escapeHtml(authorName)}" />
    <meta property="article:section" content="${escapeHtml(category)}" />
    <meta property="article:publisher" content="https://www.currentnews.blog" />

    <!-- Twitter Card (Article Specific) -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@currentnewsblog" />
    <meta name="twitter:creator" content="${escapeHtml(authorName)}" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(summary)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImg)}" />
    <meta name="twitter:image:alt" content="Illustration for ${escapeHtml(title)}" />
    `;

    // Remove existing generic og & twitter tags from index.html
    html = html.replace(/<meta property="og:[^>]*>/gi, '');
    html = html.replace(/<meta name="twitter:[^>]*>/gi, '');
    html = html.replace(/<meta name="description"[^>]*>/gi, `<meta name="description" content="${escapeHtml(summary)}" />`);

    // Inject before </head>
    html = html.replace('</head>', `${ogTags}\n  </head>`);

    res.status(200).type('html').send(html);
  } catch (err) {
    console.error('Error serving social preview for bot:', err);
    return next();
  }
}
