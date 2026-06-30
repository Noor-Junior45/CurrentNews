import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

// Lazily initialize SMTP mail transport
let transporter: nodemailer.Transporter | null = null;

function getMailTransporter() {
  if (!transporter) {
    const user = process.env.GMAIL_USER || 'noorpos.alerts@gmail.com';
    const pass = process.env.GMAIL_APP_PASS || 'xilt ckks vqlj xcgi';
    
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass
      }
    });
  }
  return transporter;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json());

  // Backend mail endpoint for automated subscriber alerting using real Gmail SMTP
  app.post('/api/mail/send-alert', async (req, res) => {
    const { email, title, link } = req.body;
    
    if (!email || !title) {
      return res.status(400).json({ success: false, message: 'Recipient email and subject title are required.' });
    }

    console.log(`\n==================================================`);
    console.log(`[BACKEND SMTP ENGINE] Dispatch initiated via Gmail SMTP`);
    console.log(`Target Recipient : ${email}`);
    console.log(`Alert Subject    : ${title}`);
    console.log(`Access Link      : ${link || 'N/A'}`);
    console.log(`==================================================\n`);

    try {
      const activeTransporter = getMailTransporter();
      const mailUser = process.env.GMAIL_USER || 'noorpos.alerts@gmail.com';

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #0f172a;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      color: #94a3b8;
      margin: 4px 0 0 0;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .content {
      padding: 40px 32px;
      color: #334155;
    }
    .content h2 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .content p {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 8px 0;
    }
    .btn {
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: #0f172a;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Current News Live</h1>
        <p>Independent Ledger &amp; Live Alerts</p>
      </div>
      <div class="content">
        <h2>${title}</h2>
        <p>Hello,</p>
        <p>We are pleased to bring you the latest verified update from Current News Live. Stay ahead of the curve with our independent journalism and real-time dispatches.</p>
        <p>Click the button below to access the live story or explore our coverage immediately.</p>
        <div class="btn-container">
          <a href="${link || 'https://currentnews.blog'}" class="btn" target="_blank">Access Live Story</a>
        </div>
      </div>
      <div class="footer">
        <p><strong>Current News Live</strong></p>
        <p>Serving the public interest with transparent, accurate, and autonomous journalism.</p>
        <p style="margin-top: 12px; color: #94a3b8;">
          You received this email because you subscribed to our breaking news alerts.<br>
          If you wish to stop receiving these dispatches, you can <a href="${link || 'https://currentnews.blog'}/unsubscribe">unsubscribe</a> at any time.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const info = await activeTransporter.sendMail({
        from: `"Current News Live" <${mailUser}>`,
        to: email,
        subject: title,
        text: `Welcome to Current News Live! ${title}. Read more at ${link || 'https://currentnews.blog'}`,
        html: htmlContent
      });

      console.log(`[BACKEND SMTP ENGINE] Email successfully dispatched. Message ID: ${info.messageId}`);
      res.json({ 
        success: true, 
        message: `Automated breaking news alert email compiled and sent to ${email} via Google SMTP.` 
      });

    } catch (err: any) {
      console.error('[BACKEND SMTP ENGINE] Failed to send email via Google SMTP:', err);
      res.status(500).json({ 
        success: false, 
        message: 'SMTP dispatch failed', 
        error: err.message 
      });
    }
  });

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
