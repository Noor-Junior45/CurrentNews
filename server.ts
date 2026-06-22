import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Dynamically serve dynamic RSS Feed endpoint
  app.get('/rss.xml', async (req, res) => {
    try {
      const siteUrl = `${req.protocol}://${req.get('host')}`;
      
      // Configuration extracted dynamically
      const config = {
        projectId: "gen-lang-client-0638643565",
        firestoreDatabaseId: "ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4"
      };

      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery`;
      
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: "posts" }],
          orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
          limit: 20
        }
      };

      const response = await fetch(firestoreUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryBody)
      });

      if (!response.ok) {
        throw new Error(`Firestore REST query returned HTTP status ${response.status}`);
      }

      const queryResult = await response.json();
      
      // XML safety/escaping helper
      const escapeXml = (unsafe: string) => {
        return (unsafe || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      // Raw Firestore REST Value mapping helper
      const parseFirestoreFields = (fields: any) => {
        const result: any = {};
        if (!fields) return result;
        for (const key of Object.keys(fields)) {
          const valObj = fields[key];
          if ('stringValue' in valObj) {
            result[key] = valObj.stringValue;
          } else if ('timestampValue' in valObj) {
            result[key] = valObj.timestampValue;
          } else if ('integerValue' in valObj) {
            result[key] = parseInt(valObj.integerValue, 10);
          } else if ('booleanValue' in valObj) {
            result[key] = valObj.booleanValue;
          } else if ('mapValue' in valObj) {
            result[key] = parseFirestoreFields(valObj.mapValue.fields);
          } else {
            result[key] = Object.values(valObj)[0];
          }
        }
        return result;
      };

      const items: any[] = [];
      if (Array.isArray(queryResult)) {
        for (const item of queryResult) {
          if (item.document) {
            const fields = parseFirestoreFields(item.document.fields);
            const id = item.document.name.split("/").pop();
            items.push({ id, ...fields });
          }
        }
      }

      // Build XML conformant RSS channel data
      let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Current News Live - Independent Ledger</title>
  <link>${siteUrl}</link>
  <description>Serving the public interest with transparent, accurate, and autonomous journalism.</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

      for (const item of items) {
        const title = item.title || 'Untitled Dispatch';
        const rawContent = item.content || '';
        const author = item.authorName || 'Chronicle Staff Report';
        const category = item.category || 'General';
        const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : new Date().toUTCString();
        const postLink = `${siteUrl}/post/${item.id}`;

        xml += `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(postLink)}</link>
    <guid isPermaLink="false">${escapeXml(item.id)}</guid>
    <pubDate>${pubDate}</pubDate>
    <author>${escapeXml(author)}</author>
    <category>${escapeXml(category)}</category>
    <description><![CDATA[${rawContent}]]></description>
  </item>
`;
      }

      xml += `</channel>
</rss>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.status(200).send(xml);

    } catch (err: any) {
      console.error('RSS endpoint generation breakdown:', err);
      res.status(500).setHeader('Content-Type', 'text/plain').send(`Unable to serve the RSS feed document: ${err.message}`);
    }
  });

  // Serve the ads.txt file
  app.get('/ads.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send('google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0');
  });

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
