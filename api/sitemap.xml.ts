import type { Request, Response } from 'express';
import { loadLocalFeed, getDeletedArticleIds } from '../src/server/r2Articles.ts';
import { cleanImageUrl } from '../src/utils/imageUrl.ts';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'currentnews.blog';
    const siteUrl = host.includes('localhost') ? `${protocol}://${host}` : 'https://currentnews.blog';

    const todayIso = new Date().toISOString().split('T')[0];

    // If Googlebot requests sitemap_index.xml, provide a valid Sitemap Index document
    if (req.path === '/sitemap_index.xml') {
      const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap.xml</loc>
    <lastmod>${todayIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/rss.xml</loc>
    <lastmod>${todayIso}</lastmod>
  </sitemap>
</sitemapindex>`;
      return res.status(200).send(sitemapIndexXml);
    }

    // Load articles reliably from local persistent disk & R2 mirror
    const deletedIds = getDeletedArticleIds();
    const feed = loadLocalFeed();
    const items = (feed || []).filter((p: any) => p && p.id && !deletedIds.has(p.id) && p.status !== 'draft');

    const escapeXml = (unsafe: string) => {
      return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const slugify = (text: string) => {
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    };

    const categorySlugs = [
      'Jharkhand',
      'National',
      'World',
      'Politics',
      'Business',
      'Technology',
      'Crime',
      'Environment',
      'Editorial'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Core Canonical Landing Pages -->
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
`;

    // Category landing pages for geo & topical authority
    for (const cat of categorySlugs) {
      const isJharkhand = cat.toLowerCase() === 'jharkhand';
      xml += `  <url>
    <loc>${siteUrl}/?category=${encodeURIComponent(cat)}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>always</changefreq>
    <priority>${isJharkhand ? '0.98' : '0.85'}</priority>
  </url>
`;
    }

    // Trust & Compliance Pages
    const trustPages = [
      { path: '/about', priority: '0.8', freq: 'weekly' },
      { path: '/editorial-policy', priority: '0.8', freq: 'weekly' },
      { path: '/contact', priority: '0.7', freq: 'weekly' },
      { path: '/privacy', priority: '0.5', freq: 'monthly' },
      { path: '/terms', priority: '0.5', freq: 'monthly' },
    ];

    for (const page of trustPages) {
      xml += `  <url>
    <loc>${siteUrl}${page.path}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    // Individual Article URLs with News and Image Extensions
    for (const post of items) {
      const slug = slugify(post.title || '');
      const postUrl = slug ? `${siteUrl}/post/${post.id}/${slug}` : `${siteUrl}/post/${post.id}`;
      let lastmod = todayIso;
      let pubDateIso = new Date().toISOString();
      if (post.updatedAt || post.createdAt) {
        try {
          const d = new Date(post.updatedAt || post.createdAt);
          if (!isNaN(d.getTime())) {
            lastmod = d.toISOString().split('T')[0];
            pubDateIso = d.toISOString();
          }
        } catch {
          // fallback to todayIso
        }
      }

      const isJharkhand = /jharkhand|ranchi|dhanbad|jamshedpur|bokaro|deoghar|hazaribagh/i.test(`${post.title} ${post.category || ''} ${post.excerpt || ''}`);
      const newsKeywords = isJharkhand
        ? 'news near Jharkhand, Jharkhand news, Ranchi news, India breaking news, news near me'
        : 'breaking news, current news, live reporting, news near me, world dispatch';

      const postImg = cleanImageUrl(post.imageUrl || (Array.isArray(post.imageUrls) && post.imageUrls[0]) || '');

      xml += `  <url>
    <loc>${escapeXml(postUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${isJharkhand ? '0.95' : '0.90'}</priority>
    <news:news>
      <news:publication>
        <news:name>Current News</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDateIso}</news:publication_date>
      <news:title>${escapeXml(post.title || 'Breaking Dispatch')}</news:title>
      <news:keywords>${escapeXml(newsKeywords)}</news:keywords>
    </news:news>
${postImg ? `    <image:image>
      <image:loc>${escapeXml(postImg)}</image:loc>
      <image:title>${escapeXml(post.title || 'Current News')}</image:title>
    </image:image>
` : ''}  </url>
`;
    }

    xml += `</urlset>`;

    return res.status(200).send(xml);
  } catch (err: any) {
    console.error('Sitemap generation error:', err);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Unable to generate sitemap: ${err.message}`);
  }
}
