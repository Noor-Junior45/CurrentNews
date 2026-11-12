import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { cleanImageUrl, getYoutubeThumbnailUrl } from '../utils/imageUrl.ts';
import { getArticleFromR2, loadLocalFeed, getDeletedArticleIds } from './r2Articles.ts';

// Comprehensive search crawlers, social share bots, and modern AI agent browsers
const SOCIAL_BOT_REGEX = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|Pinterest|Applebot|Googlebot|Googlebot-News|Mediapartners-Google|AdsBot-Google|Google-Adwords-Instant|bingbot|SkypeUriPreview|vkShare|redditbot|YandexBot|DuckDuckBot|Baiduspider|GPTBot|ChatGPT-User|OAI-SearchBot|PerplexityBot|ClaudeBot|Claude-Web|Google-Extended|Applebot-Extended|Bytespider|Diffbot|CCBot/i;

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

  const reqPath = req.path.toLowerCase();

  // Read index.html template
  const indexPath = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'dist', 'index.html')
    : path.join(process.cwd(), 'index.html');

  if (!fs.existsSync(indexPath)) {
    return next();
  }

  let html = fs.readFileSync(indexPath, 'utf-8');

  // 1. Check for Article route: /post/:id or /post/:id/:slug
  const postMatch = req.path.match(/^\/post\/([^/?#]+)/);
  if (postMatch) {
    const postId = postMatch[1];
    const deletedIds = getDeletedArticleIds();
    if (deletedIds.has(postId)) {
      return next();
    }

    try {
      // Fetch full article from R2/local disk
      let post = await getArticleFromR2(postId);
      if (!post) {
        const feed = loadLocalFeed();
        post = feed.find((p: any) => p && p.id === postId);
      }

      if (!post || (!post.title && !post.content)) {
        return next();
      }

      const title = post.title || 'Current News — Breaking Dispatch';
      const rawContent = post.content || post.excerpt || '';
      const plainContent = rawContent
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;|&apos;/gi, "'")
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const summary = post.excerpt || (plainContent.length > 160 ? plainContent.substring(0, 160).trim() + '...' : plainContent);
      const rawImage = post.imageUrl || (Array.isArray(post.imageUrls) && post.imageUrls[0]) || '';
      const youtubeUrl = post.youtubeUrl || '';
      const ytThumb = getYoutubeThumbnailUrl(youtubeUrl);
      const mainImg = cleanImageUrl(rawImage) || ytThumb || 'https://currentnews.blog/CurrentNews.png';
      const secureImg = mainImg.startsWith('http:') ? mainImg.replace('http:', 'https:') : mainImg;
      const authorName = post.authorName || 'Current News';
      const category = post.category || 'General';
      const canonicalUrl = `https://currentnews.blog/post/${postId}`;
      const pubDate = post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString();
      const modDate = post.updatedAt ? new Date(post.updatedAt).toISOString() : pubDate;

      const isJharkhand = /jharkhand|ranchi|dhanbad|jamshedpur|bokaro|deoghar|hazaribagh/i.test(`${title} ${category} ${plainContent}`);
      const newsKeywords = isJharkhand
        ? 'news near Jharkhand, Jharkhand news, Ranchi news, India breaking news, news near me'
        : 'breaking news, current news, live reporting, news near me, world dispatch';

      let formattedPubDate = 'Recent Post';
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          formattedPubDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      } catch (e) {}

      // Replace Title & Description in HTML
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)} | Current News</title>`);
      html = html.replace(/<meta name="description"[^>]*>/gi, `<meta name="description" content="${escapeHtml(summary)}" />`);
      html = html.replace(/<link rel="canonical"[^>]*>/gi, `<link rel="canonical" href="${canonicalUrl}" />`);

      // Open Graph & Twitter Tags + Schema.org NewsArticle JSON-LD
      const metaTags = `
    <!-- Open Graph (Article Specific for Social Media, Google & AI Agents) -->
    <meta property="og:site_name" content="Current News" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)} | Current News" />
    <meta property="og:description" content="${escapeHtml(summary)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${escapeHtml(mainImg)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(secureImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="article:author" content="${escapeHtml(authorName)}" />
    <meta property="article:section" content="${escapeHtml(category)}" />
    <meta property="article:published_time" content="${pubDate}" />
    <meta property="article:modified_time" content="${modDate}" />
    <meta property="article:publisher" content="https://currentnews.blog" />
    <meta name="news_keywords" content="${escapeHtml(newsKeywords)}" />
    <meta name="geo.region" content="IN-JH" />
    <meta name="geo.placename" content="${isJharkhand ? 'Jharkhand, India' : 'India'}" />
    <meta name="geo.position" content="23.6102;85.2799" />
    <meta name="ICBM" content="23.6102, 85.2799" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@currentnewsblog" />
    <meta name="twitter:title" content="${escapeHtml(title)} | Current News" />
    <meta name="twitter:description" content="${escapeHtml(summary)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImg)}" />

    <!-- Schema.org NewsArticle Structured Data for Googlebot & AI Agents -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "NewsArticle",
          "@id": "${canonicalUrl}#article",
          "headline": ${JSON.stringify(title)},
          "description": ${JSON.stringify(summary)},
          "image": [${JSON.stringify(mainImg)}],
          "datePublished": ${JSON.stringify(pubDate)},
          "dateModified": ${JSON.stringify(modDate)},
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": ${JSON.stringify(canonicalUrl)}
          },
          "articleSection": ${JSON.stringify(category)},
          "inLanguage": "en-US",
          "isAccessibleForFree": true,
          "speakable": {
            "@type": "SpeakableSpecification",
            "cssSelector": ["h1", ".article-lead", ".prose"]
          },
          "author": [{
            "@type": "Person",
            "name": ${JSON.stringify(authorName)},
            "url": "https://currentnews.blog/about"
          }],
          "publisher": {
            "@type": "NewsMediaOrganization",
            "name": "Current News",
            "url": "https://currentnews.blog",
            "logo": {
              "@type": "ImageObject",
              "url": "https://currentnews.blog/CurrentNews.png"
            }
          }${isJharkhand ? `,
          "spatialCoverage": {
            "@type": "Place",
            "name": "Jharkhand, India",
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 23.6102,
              "longitude": 85.2799
            }
          }` : ''}
        },
        {
          "@type": "BreadcrumbList",
          "@id": "${canonicalUrl}#breadcrumb",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://currentnews.blog/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": ${JSON.stringify(category)},
              "item": "https://currentnews.blog/?category=${encodeURIComponent(category)}"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": ${JSON.stringify(title)},
              "item": ${JSON.stringify(canonicalUrl)}
            }
          ]
        }
      ]
    }
    </script>
      `;

      html = html.replace('</head>', `${metaTags}\n  </head>`);

      // Pre-render substantive article content into <div id="root">
      // so Googlebot, PerplexityBot, and ChatGPT Search index the real article text instantly
      const articlePreRenderHtml = `
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <a href="/" class="font-bold text-lg text-slate-900 tracking-tight uppercase">Current News</a>
        <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <a href="/">Home</a>
          <a href="/?category=Jharkhand">Jharkhand News</a>
          <a href="/about">About</a>
          <a href="/editorial-policy">Editorial Policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <nav class="text-xs font-semibold text-slate-500 mb-4">
          <a href="/">Home</a> / <a href="/?category=${encodeURIComponent(category)}">${escapeHtml(category)}</a> / <span>Article</span>
        </nav>
        <span class="text-xs font-bold uppercase text-emerald-600 tracking-wider">${escapeHtml(category)}</span>
        <h1 class="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-4 leading-tight">${escapeHtml(title)}</h1>
        <div class="flex items-center space-x-3 text-xs text-slate-500 mb-6">
          <span>By <strong>${escapeHtml(authorName)}</strong></span>
          <span>&bull;</span>
          <span>Published: ${formattedPubDate}</span>
        </div>
        ${mainImg ? `<div class="my-6"><img src="${escapeHtml(mainImg)}" alt="${escapeHtml(title)}" class="w-full max-h-[420px] object-cover rounded-xl" /></div>` : ''}
        <div class="prose max-w-none text-slate-800 text-base leading-relaxed space-y-4 my-6">
          ${rawContent}
        </div>
      </main>
      <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
        <p>&copy; ${new Date().getFullYear()} Current News. All rights reserved.</p>
        <p class="mt-2 text-slate-400">
          <a href="/about" class="underline">About Us</a> &bull;
          <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
          <a href="/contact" class="underline">Contact</a> &bull;
          <a href="/privacy" class="underline">Privacy Policy</a> &bull;
          <a href="/terms" class="underline">Terms of Service</a>
        </p>
      </footer>
      `;

      html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${articlePreRenderHtml}</div>`);

      return res.status(200).type('html').send(html);
    } catch (err) {
      console.error('Error serving article pre-render for bot:', err);
      return next();
    }
  }

  // 2. Editorial trust & legal routes pre-rendering for crawlers: /about, /editorial-policy, /contact, /privacy, /terms
  if (reqPath === '/about' || reqPath === '/editorial-policy' || reqPath === '/contact' || reqPath === '/privacy' || reqPath === '/terms') {
    const pageTitles: Record<string, string> = {
      '/about': 'About Us | Current News',
      '/editorial-policy': 'Editorial & Fact-Checking Policy | Current News',
      '/contact': 'Contact Newsroom & Editorial Desk | Current News',
      '/privacy': 'Global Privacy Policy & Legal Protections | Current News',
      '/terms': 'Universal Terms of Service | Current News'
    };

    const canonicalUrl = `https://currentnews.blog${reqPath}`;
    html = html.replace(/<title>.*?<\/title>/i, `<title>${pageTitles[reqPath]}</title>`);
    html = html.replace(/<link rel="canonical"[^>]*>/gi, `<link rel="canonical" href="${canonicalUrl}" />`);
    html = html.replace(/<meta property="og:url"[^>]*>/gi, `<meta property="og:url" content="${canonicalUrl}" />`);

    const trustPageHtml = `
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <a href="/" class="font-bold text-lg text-slate-900 tracking-tight uppercase">Current News</a>
      <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/editorial-policy">Editorial Policy</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </nav>
    </header>
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 class="text-3xl font-black text-slate-900 mb-4">${escapeHtml(pageTitles[reqPath])}</h1>
      <div class="prose max-w-none text-slate-700 text-sm leading-relaxed space-y-4">
        <p><strong>Current News</strong> is an independent digital news organization dedicated to transparent, verified, and uncorrupted reporting. Operating under strict journalistic independence, our newsroom provides breaking public interest journalism, regional updates near Jharkhand, national affairs, and global dispatches.</p>
        <p>Our editorial team adheres to a strict two-source verification policy, prompt transparent corrections, international copyright adherence, and full user data privacy protections.</p>
        <p>Canonical URL: <code>${canonicalUrl}</code></p>
      </div>
    </main>
    <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
      <p>&copy; ${new Date().getFullYear()} Current News. All rights reserved.</p>
      <p class="mt-2 text-slate-400">
        <a href="/about" class="underline">About Us</a> &bull;
        <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
        <a href="/contact" class="underline">Contact</a> &bull;
        <a href="/privacy" class="underline">Privacy Policy</a> &bull;
        <a href="/terms" class="underline">Terms of Service</a>
      </p>
    </footer>
    `;

    html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${trustPageHtml}</div>`);
    return res.status(200).type('html').send(html);
  }

  // 3. Homepage & category pre-rendering for Googlebot, Googlebot-News, and AI agents on root /
  if (reqPath === '/' || reqPath === '') {
    try {
      const deletedIds = getDeletedArticleIds();
      const feed = loadLocalFeed();
      const selectedCategory = String(req.query.category || '').toLowerCase();
      
      const filtered = feed.filter((p: any) => {
        if (!p || !p.id || deletedIds.has(p.id) || p.status === 'draft') return false;
        if (selectedCategory) {
          return String(p.category || '').toLowerCase() === selectedCategory;
        }
        return true;
      }).slice(0, 20);

      let storiesHtml = '';
      for (const p of filtered) {
        const id = p.id;
        const pTitle = p.title || '';
        const pCat = p.category || 'News';
        const pAuthor = p.authorName || 'Current News';
        let pDateFormatted = '';
        try {
          if (p.createdAt) {
            const d = new Date(p.createdAt);
            if (!isNaN(d.getTime())) pDateFormatted = d.toLocaleDateString();
          }
        } catch (e) {}

        storiesHtml += `
          <article class="p-4 border border-slate-200 rounded-xl mb-4 bg-white">
            <span class="text-xs font-bold uppercase text-emerald-600">${escapeHtml(pCat)}</span>
            <h2 class="text-lg font-bold text-slate-900 mt-1 mb-2">
              <a href="/post/${id}" class="hover:underline">${escapeHtml(pTitle)}</a>
            </h2>
            <p class="text-xs text-slate-500">By ${escapeHtml(pAuthor)}${pDateFormatted ? ` &bull; ${pDateFormatted}` : ''}</p>
          </article>
        `;
      }

      const isJharkhandReq = selectedCategory === 'jharkhand';
      const pageTitle = isJharkhandReq 
        ? 'Jharkhand News — Breaking Updates, Ranchi & Regional Reports | Current News'
        : 'Current News — Breaking News Near Me, Jharkhand & Global Ledger';
      const pageDesc = isJharkhandReq
        ? 'Read the latest verified breaking news near Jharkhand, Ranchi, Jamshedpur, Dhanbad, and all 24 districts. Live reporting on politics, schemes, crime, and community.'
        : 'Comprehensive, verified global news coverage, breaking reports near Jharkhand, India, finance, geopolitics, and culture updated 24/7.';

      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);
      html = html.replace(/<meta name="description" content="[\s\S]*?"\s*\/?>/i, `<meta name="description" content="${escapeHtml(pageDesc)}" />`);

      const headlineText = isJharkhandReq
        ? 'Jharkhand News & Regional Breaking Dispatches'
        : 'Breaking News Near Me & Real-Time Dispatches';
      const subText = isJharkhandReq
        ? 'Real-time verified coverage near Jharkhand, Ranchi, Jamshedpur, Dhanbad, Bokaro, and all 24 districts.'
        : 'Delivering verified geopolitical disclosures, investigative reporting, technological developments, and global affairs.';

      const homePreRenderHtml = `
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <a href="/" class="font-bold text-xl text-slate-900 tracking-tight uppercase">Current News</a>
          <p class="text-xs text-slate-500 font-mono">Independent Ledger &bull; Autonomous Press Alliance</p>
        </div>
        <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <a href="/?category=Jharkhand" class="text-amber-600 font-bold">Jharkhand News</a>
          <a href="/about">About</a>
          <a href="/editorial-policy">Editorial Policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div class="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 mb-2">${escapeHtml(headlineText)}</h1>
          <p class="text-sm text-slate-600 max-w-2xl leading-relaxed">
            ${escapeHtml(subText)}
          </p>
        </div>
        <section>
          <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-200 pb-2">Latest News Dispatches</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${storiesHtml || '<p class="text-xs text-slate-500">Connecting to live news dispatches...</p>'}
          </div>
        </section>
      </main>
      <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
        <p>&copy; ${new Date().getFullYear()} Current News. All rights reserved.</p>
        <p class="mt-2 text-slate-400">
          <a href="/?category=Jharkhand" class="underline">Jharkhand Coverage</a> &bull;
          <a href="/about" class="underline">About Us</a> &bull;
          <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
          <a href="/contact" class="underline">Contact</a> &bull;
          <a href="/privacy" class="underline">Privacy Policy</a> &bull;
          <a href="/terms" class="underline">Terms of Service</a>
        </p>
      </footer>
      `;

      html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${homePreRenderHtml}</div>`);
      return res.status(200).type('html').send(html);
    } catch (err) {
      console.error('Error pre-rendering homepage for bot:', err);
      return next();
    }
  }

  return next();
}

