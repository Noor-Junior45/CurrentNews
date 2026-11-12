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
    const host = req.headers.host || 'www.currentnews.blog';
    const siteUrl = `${protocol}://${host.includes('localhost') ? host : 'www.currentnews.blog'}`;
    
    const deletedIds = getDeletedArticleIds();
    const feed = loadLocalFeed();
    const items = (feed || [])
      .filter((p: any) => p && p.id && !deletedIds.has(p.id) && p.status !== 'draft')
      .slice(0, 50);

    // XML safety/escaping helper
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

    // Build XML conformant RSS channel data
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Current News — Independent Global Journalism &amp; Breaking Updates</title>
  <link>${siteUrl}</link>
  <description>Comprehensive, verified global news coverage, breaking reports near Jharkhand, India, finance, geopolitics, and culture updated 24/7.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

    for (const item of items) {
      const title = item.title || 'Untitled Dispatch';
      const rawExcerpt = item.excerpt || '';
      const author = item.authorName || 'Current News';
      const category = item.category || 'General';
      const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : new Date().toUTCString();
      const slug = slugify(title);
      const postLink = slug ? `${siteUrl}/post/${item.id}/${slug}` : `${siteUrl}/post/${item.id}`;
      const imgUrl = cleanImageUrl(item.imageUrl || (Array.isArray(item.imageUrls) && item.imageUrls[0]) || '');

      xml += `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(postLink)}</link>
    <guid isPermaLink="true">${escapeXml(postLink)}</guid>
    <pubDate>${pubDate}</pubDate>
    <author>${escapeXml(author)}</author>
    <category>${escapeXml(category)}</category>
    <description><![CDATA[${rawExcerpt}]]></description>
${imgUrl ? `    <enclosure url="${escapeXml(imgUrl)}" length="102400" type="image/jpeg" />
    <media:content url="${escapeXml(imgUrl)}" medium="image" />
` : ''}  </item>
`;
    }

    xml += `</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);

  } catch (err: any) {
    console.error('RSS endpoint generation breakdown:', err);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Unable to serve the RSS feed document: ${err.message}`);
  }
}
