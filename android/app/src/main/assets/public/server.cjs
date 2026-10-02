var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path4 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_multer = __toESM(require("multer"), 1);

// api/mail/send-alert.ts
async function sendResendEmail(toEmail, subject, htmlContent, textContent) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not defined.");
  }
  const senderEmail = process.env.RESEND_SENDER_EMAIL || "alerts@currentnews.blog";
  const senderName = process.env.RESEND_SENDER_NAME || "Current News";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [toEmail],
      subject,
      html: htmlContent,
      text: textContent,
      reply_to: "Current News <support@guashoomin.resend.app>"
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    let parsedMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.message) {
        parsedMessage = parsed.message;
      }
    } catch (e) {
    }
    const lowerMsg = parsedMessage.toLowerCase();
    if (response.status === 403 && (lowerMsg.includes("domain is not verified") || lowerMsg.includes("you can only send testing emails") || lowerMsg.includes("verify a domain"))) {
      throw new Error(`RESEND_DOMAIN_UNVERIFIED: ${parsedMessage}`);
    }
    throw new Error(`Resend API responded with status ${response.status}: ${parsedMessage}`);
  }
  return await response.json();
}
async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  const { email, title, link } = req.body || {};
  if (!email || !title) {
    return res.status(400).json({ success: false, message: "Recipient email and subject title are required." });
  }
  console.log(`
==================================================`);
  console.log(`[VERCEL SERVERLESS RESEND API] Dispatch initiated`);
  console.log(`Target Recipient : ${email}`);
  console.log(`Alert Subject    : ${title}`);
  console.log(`Access Link      : ${link || "N/A"}`);
  console.log(`==================================================
`);
  try {
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
        <h1>Current News</h1>
        <p>Independent Ledger &amp; Alerts</p>
      </div>
      <div class="content">
        <h2>${title}</h2>
        <p>Hello,</p>
        <p>We are pleased to bring you the latest verified update from Current News. Stay ahead of the curve with our independent journalism and real-time dispatches.</p>
        <p>Click the button below to access the live story or explore our coverage immediately.</p>
        <div class="btn-container">
          <a href="${link || "https://currentnews.blog"}" class="btn" target="_blank">Access Live Story</a>
        </div>
      </div>
      <div class="footer">
        <p><strong>Current News</strong></p>
        <p>Serving the public interest with transparent, accurate, and autonomous journalism.</p>
        <p style="margin-top: 12px; color: #94a3b8;">
          You received this email because you subscribed to our breaking news alerts.<br>
          If you wish to stop receiving these dispatches, you can <a href="${link || "https://currentnews.blog"}/unsubscribe">unsubscribe</a> at any time.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
    const textContent = `Welcome to Current News! ${title}. Read more at ${link || "https://currentnews.blog"}`;
    const result = await sendResendEmail(email, title, htmlContent, textContent);
    console.log(`[VERCEL SERVERLESS RESEND API] Email successfully dispatched. Result:`, result);
    return res.status(200).json({
      success: true,
      message: `Automated breaking news alert email compiled and sent to ${email} via Resend API.`
    });
  } catch (err) {
    console.error("[VERCEL SERVERLESS RESEND API] Failed to send email via Resend API:", err);
    if (err.message && err.message.startsWith("RESEND_DOMAIN_UNVERIFIED:")) {
      const rawMessage = err.message.replace("RESEND_DOMAIN_UNVERIFIED:", "").trim();
      return res.status(403).json({
        success: false,
        isDomainRestriction: true,
        message: `Resend blocked this request because your sending domain isn't verified yet.`,
        detail: rawMessage,
        solution: `Please log into Resend, go to Domains (https://resend.com/domains), add and verify "currentnews.blog" (or whichever domain you're sending from), then set RESEND_SENDER_EMAIL to an address on that domain. Until verified, Resend only lets you send to the email address on your own Resend account.`
      });
    }
    return res.status(500).json({
      success: false,
      message: "Resend API dispatch failed",
      error: err.message
    });
  }
}

// api/mail/inbound.ts
var INBOUND_MAIL_CONFIG = {
  name: "Current News",
  address: "support@guashoomin.resend.app",
  formatted: "Current News <support@guashoomin.resend.app>",
  mailto: "mailto:Current%20News%20%3Csupport%40guashoomin.resend.app%3E"
};
async function handler2(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      service: "Current News Inbound Mail Dispatch",
      name: INBOUND_MAIL_CONFIG.name,
      address: INBOUND_MAIL_CONFIG.address,
      formatted: INBOUND_MAIL_CONFIG.formatted,
      mailto: INBOUND_MAIL_CONFIG.mailto,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (req.method === "POST") {
    const payload = req.body || {};
    console.log("\n==================================================");
    console.log("[INBOUND MAIL WEBHOOK] Incoming message received");
    console.log(`Destination Recipient : ${INBOUND_MAIL_CONFIG.formatted}`);
    console.log("Sender From           :", payload.from || payload.sender || "Unknown");
    console.log("Subject               :", payload.subject || "No Subject");
    console.log("Timestamp             :", (/* @__PURE__ */ new Date()).toISOString());
    console.log("==================================================\n");
    return res.status(200).json({
      success: true,
      message: `Inbound mail payload received for ${INBOUND_MAIL_CONFIG.formatted}`,
      recipient: INBOUND_MAIL_CONFIG.formatted,
      receivedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return res.status(405).json({
    success: false,
    message: "Method Not Allowed"
  });
}

// api/rss.xml.ts
async function handler3(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).send("Method Not Allowed");
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=59");
  if (req.method === "HEAD") {
    return res.status(200).end();
  }
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "www.currentnews.blog";
    const siteUrl = `${protocol}://${host.includes("localhost") ? host : "www.currentnews.blog"}`;
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
    const escapeXml = (unsafe) => {
      return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };
    const parseFirestoreFields = (fields) => {
      const result = {};
      if (!fields) return result;
      for (const key of Object.keys(fields)) {
        const valObj = fields[key];
        if ("stringValue" in valObj) {
          result[key] = valObj.stringValue;
        } else if ("timestampValue" in valObj) {
          result[key] = valObj.timestampValue;
        } else if ("integerValue" in valObj) {
          result[key] = parseInt(valObj.integerValue, 10);
        } else if ("booleanValue" in valObj) {
          result[key] = valObj.booleanValue;
        } else if ("mapValue" in valObj) {
          result[key] = parseFirestoreFields(valObj.mapValue.fields);
        } else {
          result[key] = Object.values(valObj)[0];
        }
      }
      return result;
    };
    const items = [];
    if (Array.isArray(queryResult)) {
      for (const item of queryResult) {
        if (item.document) {
          const fields = parseFirestoreFields(item.document.fields);
          const id = item.document.name.split("/").pop();
          items.push({ id, ...fields });
        }
      }
    }
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Current News - Independent Ledger</title>
  <link>${siteUrl}</link>
  <description>Serving the public interest with transparent, accurate, and autonomous journalism.</description>
  <language>en-us</language>
  <lastBuildDate>${(/* @__PURE__ */ new Date()).toUTCString()}</lastBuildDate>
  <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;
    const slugify = (text) => {
      return text.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
    };
    for (const item of items) {
      const title = item.title || "Untitled Dispatch";
      const rawContent = item.content || "";
      const author = item.authorName || "Chronicle Staff Report";
      const category = item.category || "General";
      const pubDate = item.createdAt ? new Date(item.createdAt).toUTCString() : (/* @__PURE__ */ new Date()).toUTCString();
      const slug = slugify(title);
      const postLink = slug ? `${siteUrl}/post/${item.id}/${slug}` : `${siteUrl}/post/${item.id}`;
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
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(xml);
  } catch (err) {
    console.error("RSS endpoint generation breakdown:", err);
    res.setHeader("Content-Type", "text/plain");
    return res.status(500).send(`Unable to serve the RSS feed document: ${err.message}`);
  }
}

// api/ads.txt.ts
function handler4(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).send("Method Not Allowed");
  }
  res.setHeader("Content-Type", "text/plain");
  if (req.method === "HEAD") {
    return res.status(200).end();
  }
  return res.status(200).send("google.com, pub-5865716270182311, DIRECT, f08c47fec0942fa0");
}

// api/sitemap.xml.ts
async function handler5(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).send("Method Not Allowed");
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=59");
  if (req.method === "HEAD") {
    return res.status(200).end();
  }
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "www.currentnews.blog";
    const siteUrl = `${protocol}://${host.includes("localhost") ? host : "www.currentnews.blog"}`;
    const config = {
      projectId: "gen-lang-client-0638643565",
      firestoreDatabaseId: "ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4"
    };
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery`;
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "posts" }],
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }]
      }
    };
    let items = [];
    try {
      const response = await fetch(firestoreUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryBody)
      });
      if (response.ok) {
        const queryResult = await response.json();
        const parseFirestoreFields = (fields) => {
          const result = {};
          if (!fields) return result;
          for (const key of Object.keys(fields)) {
            const valObj = fields[key];
            if ("stringValue" in valObj) {
              result[key] = valObj.stringValue;
            } else if ("timestampValue" in valObj) {
              result[key] = valObj.timestampValue;
            } else if ("integerValue" in valObj) {
              result[key] = parseInt(valObj.integerValue, 10);
            } else if ("booleanValue" in valObj) {
              result[key] = valObj.booleanValue;
            }
          }
          return result;
        };
        if (Array.isArray(queryResult)) {
          for (const item of queryResult) {
            if (item.document) {
              const fields = parseFirestoreFields(item.document.fields);
              const id = item.document.name.split("/").pop();
              if (!fields.status || fields.status === "published") {
                items.push({ id, ...fields });
              }
            }
          }
        }
      }
    } catch (fetchErr) {
      console.warn("Failed to fetch posts for sitemap from Firestore REST, using fallback:", fetchErr);
    }
    const escapeXml = (unsafe) => {
      return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };
    const slugify = (text) => {
      return text.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
    };
    const todayIso = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/about</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/editorial-policy</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${siteUrl}/contact</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${siteUrl}/privacy</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${siteUrl}/terms</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
    for (const post of items) {
      const slug = slugify(post.title || "");
      const postUrl = slug ? `${siteUrl}/post/${post.id}/${slug}` : `${siteUrl}/post/${post.id}`;
      let lastmod = todayIso;
      if (post.updatedAt || post.createdAt) {
        try {
          const d = new Date(post.updatedAt || post.createdAt);
          if (!isNaN(d.getTime())) {
            lastmod = d.toISOString().split("T")[0];
          }
        } catch {
        }
      }
      xml += `  <url>
    <loc>${escapeXml(postUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
    xml += `</urlset>`;
    return res.status(200).send(xml);
  } catch (err) {
    console.error("Sitemap generation error:", err);
    res.setHeader("Content-Type", "text/plain");
    return res.status(500).send(`Unable to generate sitemap: ${err.message}`);
  }
}

// src/server/r2Upload.ts
var import_client_s3 = require("@aws-sdk/client-s3");
var import_crypto = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var s3Client = null;
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
    s3Client = new import_client_s3.S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }
  return s3Client;
}
async function handleR2Upload(req, res) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "No image file was provided for upload." });
      return;
    }
    const mime = (file.mimetype || "").toLowerCase();
    const originalName = file.originalname || "";
    let ext = "jpg";
    if (mime === "image/png") ext = "png";
    else if (mime === "image/webp") ext = "webp";
    else if (mime === "image/gif") ext = "gif";
    else if (mime === "image/svg+xml") ext = "svg";
    else if (mime === "image/avif") ext = "avif";
    else if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpg";
    else {
      const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch) {
        const foundExt = extMatch[1].toLowerCase();
        if (["jpg", "jpeg", "png", "webp", "gif", "svg", "heic", "heif", "avif"].includes(foundExt)) {
          ext = foundExt === "jpeg" ? "jpg" : foundExt;
        }
      }
    }
    let uploadContentType = file.mimetype;
    if (!uploadContentType || uploadContentType === "application/octet-stream" || !uploadContentType.startsWith("image/")) {
      const mimeMap = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        svg: "image/svg+xml",
        avif: "image/avif"
      };
      uploadContentType = mimeMap[ext] || "image/jpeg";
    }
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const randomHex = import_crypto.default.randomBytes(8).toString("hex");
    const sanitizedOriginal = originalName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30) || "photo";
    const key = `uploads/${year}/${month}/${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;
    let publicUrl = "";
    let fallbackUrl = "";
    const client = getR2Client();
    if (client) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME || "currentnews-media";
        const command = new import_client_s3.PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: uploadContentType,
          CacheControl: "public, max-age=31536000, immutable"
        });
        await client.send(command);
        const sanitizeDomain = (val, fallback) => {
          if (!val) return fallback;
          let d = val.trim().replace(/^(?:https?[:/]*)+/i, "");
          d = d.split("/")[0];
          d = d.replace(/\/+$/, "").trim();
          return d || fallback;
        };
        const customDomain = sanitizeDomain(process.env.R2_PUBLIC_DOMAIN, "media.currentnews.blog");
        const r2DevDomain = sanitizeDomain(process.env.R2_DEV_DOMAIN, "pub-03dd1274c4824531a1478f20e0485d75.r2.dev");
        publicUrl = `https://${customDomain}/${key}`;
        fallbackUrl = `https://${r2DevDomain}/${key}`;
      } catch (r2Error) {
        console.warn("R2 storage push failed, smoothly switching to local disk storage:", r2Error);
      }
    }
    if (!publicUrl) {
      const localDir = import_path.default.join(process.cwd(), "public", "uploads", String(year), month);
      await import_fs.default.promises.mkdir(localDir, { recursive: true });
      const localFileName = `${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;
      const localFilePath = import_path.default.join(localDir, localFileName);
      await import_fs.default.promises.writeFile(localFilePath, file.buffer);
      publicUrl = `/uploads/${year}/${month}/${localFileName}`;
      fallbackUrl = publicUrl;
    }
    res.json({
      success: true,
      url: publicUrl,
      fallbackUrl,
      key,
      size: file.size,
      mimetype: file.mimetype
    });
  } catch (error) {
    console.warn("Upload error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload photo.",
      details: error?.message || String(error)
    });
  }
}

// src/server/socialPreview.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);

// src/utils/imageUrl.ts
var NON_IMAGE_HOSTS_AND_PATTERNS = [
  "freeconvert.com",
  "convertio.co",
  "cloudconvert.com",
  "iloveimg.com",
  "online-convert.com",
  "zamzar.com",
  "tinyurl.com",
  "bit.ly",
  "jpg-converter",
  "png-converter",
  "image-converter"
];
function isLikelyImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  for (const pattern of NON_IMAGE_HOSTS_AND_PATTERNS) {
    if (trimmed.includes(pattern)) {
      return false;
    }
  }
  if (/\.(html?|php|asp|aspx|jsp|cgi)($|\?|#)/i.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) {
    return true;
  }
  if (/\.(jpe?g|png|webp|gif|svg|avif|bmp|ico)($|\?|#)/i.test(trimmed)) {
    return true;
  }
  const knownImageDomains = [
    "media.currentnews.blog",
    "r2.dev",
    "imgur.com",
    "images.unsplash.com",
    "img.youtube.com",
    "ytimg.com",
    "pbs.twimg.com",
    "res.cloudinary.com",
    "firebasestorage.googleapis.com",
    "googleusercontent.com"
  ];
  for (const domain of knownImageDomains) {
    if (trimmed.includes(domain)) {
      return true;
    }
  }
  return false;
}
function getYoutubeThumbnailUrl(youtubeUrl) {
  if (!youtubeUrl || typeof youtubeUrl !== "string") return null;
  const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}
function cleanImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  let cleaned = url.trim();
  if (!cleaned) return "";
  if (!isLikelyImageUrl(cleaned)) {
    return "";
  }
  cleaned = cleaned.replace(/^(?:https?[:/]*)+/i, "https://");
  cleaned = cleaned.replace(/\/uploads\/[^/]+\.(?:jpe?g|png|webp|gif|svg)\/uploads\//gi, "/uploads/");
  cleaned = cleaned.replace(/\/uploads\/uploads\//gi, "/uploads/");
  cleaned = cleaned.replace(/(https?:\/\/)|(\/+)/g, (match, protocol) => {
    return protocol ? protocol : "/";
  });
  if (cleaned.includes("imgur.com") && !/\.(png|jpg|jpeg|gif|webp)$/i.test(cleaned)) {
    cleaned = cleaned.replace("imgur.com", "i.imgur.com") + ".jpg";
  }
  return cleaned;
}

// src/server/socialPreview.ts
var SOCIAL_BOT_REGEX = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Slackbot|Pinterest|Applebot|Googlebot|Mediapartners-Google|AdsBot-Google|Google-Adwords-Instant|bingbot|SkypeUriPreview|vkShare|redditbot|YandexBot|DuckDuckBot|Baiduspider/i;
var escapeHtml = (unsafe) => {
  return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};
async function handleSocialPreview(req, res, next) {
  const userAgent = req.headers["user-agent"] || "";
  const isBot = SOCIAL_BOT_REGEX.test(userAgent) || req.query.social_preview === "1";
  if (!isBot) {
    return next();
  }
  const reqPath = req.path.toLowerCase();
  const indexPath = process.env.NODE_ENV === "production" ? import_path2.default.join(process.cwd(), "dist", "index.html") : import_path2.default.join(process.cwd(), "index.html");
  if (!import_fs2.default.existsSync(indexPath)) {
    return next();
  }
  let html = import_fs2.default.readFileSync(indexPath, "utf-8");
  let fbConfig = {};
  try {
    const configPath = import_path2.default.join(process.cwd(), "firebase-applet-config.json");
    if (import_fs2.default.existsSync(configPath)) {
      fbConfig = JSON.parse(import_fs2.default.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {
    console.error("[Social Preview] Failed to read firebase-applet-config.json:", e);
  }
  const config = {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || fbConfig.projectId || "",
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || fbConfig.firestoreDatabaseId || "(default)",
    apiKey: process.env.VITE_FIREBASE_API_KEY || fbConfig.apiKey || ""
  };
  const postMatch = req.path.match(/^\/post\/([^/?#]+)/);
  if (postMatch) {
    const postId = postMatch[1];
    try {
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
      const timeout = setTimeout(() => controller.abort(), 4e3);
      const resp = await fetch(firestoreUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const title = fields.title?.stringValue || "Current News Live - Independent Ledger";
      const rawContent = fields.content?.stringValue || "";
      const plainContent = rawContent.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#039;|&apos;/gi, "'").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const summary = plainContent.length > 160 ? plainContent.substring(0, 160).trim() + "..." : plainContent;
      const rawImage = fields.imageUrl?.stringValue || "";
      const youtubeUrl = fields.youtubeUrl?.stringValue || "";
      const ytThumb = getYoutubeThumbnailUrl(youtubeUrl);
      const mainImg = cleanImageUrl(rawImage) || ytThumb || "https://i.imgur.com/gFgShoZ.jpeg";
      const secureImg = mainImg.startsWith("http:") ? mainImg.replace("http:", "https:") : mainImg;
      const authorName = fields.authorName?.stringValue || "Chronicle Staff Report";
      const category = fields.category?.stringValue || "General";
      const canonicalUrl = `https://www.currentnews.blog/post/${postId}`;
      const pubDate = fields.createdAt?.timestampValue || (/* @__PURE__ */ new Date()).toISOString();
      let formattedPubDate = "Recent Post";
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          formattedPubDate = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        }
      } catch (e) {
      }
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)} | Current News Live</title>`);
      html = html.replace(/<meta name="description"[^>]*>/gi, `<meta name="description" content="${escapeHtml(summary)}" />`);
      html = html.replace(/<link rel="canonical"[^>]*>/gi, `<link rel="canonical" href="${canonicalUrl}" />`);
      const metaTags = `
    <!-- Open Graph (Article Specific for Social Media & Google) -->
    <meta property="og:site_name" content="Current News Live" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(summary)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${escapeHtml(mainImg)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(secureImg)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="article:author" content="${escapeHtml(authorName)}" />
    <meta property="article:section" content="${escapeHtml(category)}" />
    <meta property="article:published_time" content="${pubDate}" />
    <meta property="article:publisher" content="https://www.currentnews.blog" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(summary)}" />
    <meta name="twitter:image" content="${escapeHtml(mainImg)}" />

    <!-- Schema.org NewsArticle Structured Data for Googlebot & AdSense -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": ${JSON.stringify(title)},
      "description": ${JSON.stringify(summary)},
      "image": [${JSON.stringify(mainImg)}],
      "datePublished": ${JSON.stringify(pubDate)},
      "dateModified": ${JSON.stringify(pubDate)},
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": ${JSON.stringify(canonicalUrl)}
      },
      "author": [{
        "@type": "Person",
        "name": ${JSON.stringify(authorName)},
        "url": "https://www.currentnews.blog/about"
      }],
      "publisher": {
        "@type": "NewsMediaOrganization",
        "name": "Current News Live",
        "url": "https://www.currentnews.blog",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.currentnews.blog/CurrentNews.png"
        }
      }
    }
    </script>
      `;
      html = html.replace("</head>", `${metaTags}
  </head>`);
      const articlePreRenderHtml = `
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <a href="/" class="font-bold text-lg text-slate-900 tracking-tight uppercase">Current News Live</a>
        <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/editorial-policy">Editorial Policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <nav class="text-xs font-semibold text-slate-500 mb-4">
          <a href="/">Home</a> / <a href="/">${escapeHtml(category)}</a> / <span>Article</span>
        </nav>
        <span class="text-xs font-bold uppercase text-emerald-600 tracking-wider">${escapeHtml(category)}</span>
        <h1 class="text-3xl sm:text-4xl font-black text-slate-900 mt-2 mb-4 leading-tight">${escapeHtml(title)}</h1>
        <div class="flex items-center space-x-3 text-xs text-slate-500 mb-6">
          <span>By <strong>${escapeHtml(authorName)}</strong></span>
          <span>&bull;</span>
          <span>Published: ${formattedPubDate}</span>
        </div>
        ${mainImg ? `<div class="my-6"><img src="${escapeHtml(mainImg)}" alt="${escapeHtml(title)}" class="w-full max-h-[420px] object-cover rounded-xl" /></div>` : ""}
        <div class="prose max-w-none text-slate-800 text-base leading-relaxed space-y-4 my-6">
          ${rawContent}
        </div>
      </main>
      <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
        <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Current News Live \u2014 Independent Ledger. All rights reserved.</p>
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
      return res.status(200).type("html").send(html);
    } catch (err) {
      console.error("Error serving article pre-render for bot:", err);
      return next();
    }
  }
  if (reqPath === "/about" || reqPath === "/editorial-policy" || reqPath === "/contact") {
    const pageTitles = {
      "/about": "About Us | Current News Live \u2014 Independent Ledger",
      "/editorial-policy": "Editorial & Fact-Checking Policy | Current News Live",
      "/contact": "Contact Newsroom & Editorial Desk | Current News Live"
    };
    html = html.replace(/<title>.*?<\/title>/i, `<title>${pageTitles[reqPath]}</title>`);
    const trustPageHtml = `
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <a href="/" class="font-bold text-lg text-slate-900 tracking-tight uppercase">Current News Live</a>
      <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/editorial-policy">Editorial Policy</a>
        <a href="/contact">Contact</a>
      </nav>
    </header>
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 class="text-3xl font-black text-slate-900 mb-4">${escapeHtml(pageTitles[reqPath])}</h1>
      <div class="prose max-w-none text-slate-700 text-sm leading-relaxed space-y-4">
        <p><strong>Current News Live</strong> is an independent digital news ledger dedicated to transparent, verified, and uncorrupted reporting. Operating under strict journalistic independence, our newsroom provides breaking public interest journalism, geopolitical investigation, and technological insights.</p>
        <p>Our editorial team adheres to a strict two-source verification policy, prompt transparent corrections, and an absolute firewall between commercial advertising and reporting.</p>
      </div>
    </main>
    <footer class="bg-slate-900 text-slate-300 py-8 px-6 text-xs text-center border-t border-slate-800 mt-12">
      <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Current News Live \u2014 Independent Ledger. All rights reserved.</p>
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
    return res.status(200).type("html").send(html);
  }
  if (reqPath === "/" || reqPath === "") {
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents:runQuery?key=${config.apiKey}`;
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: "posts" }],
          orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
          limit: 10
        }
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(firestoreUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryBody),
        signal: controller.signal
      });
      clearTimeout(timeout);
      let storiesHtml = "";
      if (resp.ok) {
        const queryResult = await resp.json();
        if (Array.isArray(queryResult)) {
          for (const item of queryResult) {
            if (item.document?.fields) {
              const f = item.document.fields;
              const id = item.document.name.split("/").pop();
              const pTitle = f.title?.stringValue || "";
              const pCat = f.category?.stringValue || "News";
              const pAuthor = f.authorName?.stringValue || "Chronicle Staff";
              const pDate = f.createdAt?.timestampValue || "";
              let pDateFormatted = "";
              try {
                if (pDate) {
                  const d = new Date(pDate);
                  if (!isNaN(d.getTime())) pDateFormatted = d.toLocaleDateString();
                }
              } catch (e) {
              }
              storiesHtml += `
                <article class="p-4 border border-slate-200 rounded-xl mb-4 bg-white">
                  <span class="text-xs font-bold uppercase text-emerald-600">${escapeHtml(pCat)}</span>
                  <h2 class="text-lg font-bold text-slate-900 mt-1 mb-2">
                    <a href="/post/${id}" class="hover:underline">${escapeHtml(pTitle)}</a>
                  </h2>
                  <p class="text-xs text-slate-500">By ${escapeHtml(pAuthor)}${pDateFormatted ? ` &bull; ${pDateFormatted}` : ""}</p>
                </article>
              `;
            }
          }
        }
      }
      const homePreRenderHtml = `
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <a href="/" class="font-bold text-xl text-slate-900 tracking-tight uppercase">Current News Live</a>
          <p class="text-xs text-slate-500 font-mono">Independent Ledger &bull; Autonomous Press Alliance</p>
        </div>
        <nav class="flex items-center space-x-4 text-xs font-semibold text-slate-600">
          <a href="/about">About</a>
          <a href="/editorial-policy">Editorial Policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div class="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Independent Journalism & Real-Time Dispatches</h1>
          <p class="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Delivering verified geopolitical disclosures, investigative reporting, technological developments, and global affairs.
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
        <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Current News Live \u2014 Independent Ledger. All rights reserved.</p>
        <p class="mt-2 text-slate-400">
          <a href="/about" class="underline">About Us</a> &bull;
          <a href="/editorial-policy" class="underline">Editorial Policy</a> &bull;
          <a href="/contact" class="underline">Contact</a> &bull;
          <a href="/privacy" class="underline">Privacy Policy</a> &bull;
          <a href="/terms" class="underline">Terms of Service</a>
        </p>
      </footer>
      `;
      html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${homePreRenderHtml}</div>`);
      return res.status(200).type("html").send(html);
    } catch (err) {
      console.error("Error pre-rendering homepage for bot:", err);
      return next();
    }
  }
  return next();
}

// src/server/pushNotifications.ts
var import_web_push = __toESM(require("web-push"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var firebaseConfig = {};
try {
  const configPath = import_path3.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_fs3.default.existsSync(configPath)) {
    firebaseConfig = JSON.parse(import_fs3.default.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.error("[Push Service] Failed to read firebase-applet-config.json:", e);
}
var fbApp = (0, import_app.getApps)().length > 0 ? (0, import_app.getApp)() : (0, import_app.initializeApp)(firebaseConfig);
var db = (0, import_firestore.getFirestore)(fbApp, firebaseConfig.firestoreDatabaseId);
var resolvedPublicKey = process.env.VAPID_PUBLIC_KEY;
var resolvedPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (!resolvedPublicKey || !resolvedPrivateKey) {
  try {
    const generated = import_web_push.default.generateVAPIDKeys();
    resolvedPublicKey = resolvedPublicKey || generated.publicKey;
    resolvedPrivateKey = resolvedPrivateKey || generated.privateKey;
  } catch (genErr) {
    console.warn("[Push Service] Could not generate dynamic VAPID keys:", genErr);
  }
}
var VAPID_PUBLIC_KEY = resolvedPublicKey || "";
var VAPID_PRIVATE_KEY = resolvedPrivateKey || "";
var VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:alerts@currentnews.blog";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    import_web_push.default.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log("[Push Service] VAPID details configured successfully.");
  } catch (vapidErr) {
    console.error("[Push Service] VAPID initialization error:", vapidErr);
  }
}
function getEndpointId(endpoint) {
  return import_crypto2.default.createHash("sha256").update(endpoint).digest("hex").substring(0, 32);
}
function handleGetVapidPublicKey(_req, res) {
  return res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY
  });
}
async function handleSubscribe(req, res) {
  try {
    const { subscription, userAgent } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: "Missing required push subscription object or keys"
      });
    }
    const docId = getEndpointId(subscription.endpoint);
    const subRef = (0, import_firestore.doc)(db, "push_subscriptions", docId);
    await (0, import_firestore.setDoc)(subRef, {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userAgent: userAgent || req.headers["user-agent"] || "",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    return res.json({
      success: true,
      message: "Device subscribed to background push notifications successfully."
    });
  } catch (error) {
    console.error("[Push Service] Subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to save push subscription"
    });
  }
}
async function handleUnsubscribe(req, res) {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: "Missing subscription endpoint"
      });
    }
    const docId = getEndpointId(endpoint);
    const subRef = (0, import_firestore.doc)(db, "push_subscriptions", docId);
    await (0, import_firestore.deleteDoc)(subRef);
    return res.json({
      success: true,
      message: "Device unsubscribed successfully."
    });
  } catch (error) {
    console.error("[Push Service] Unsubscribe error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to unsubscribe device"
    });
  }
}
async function handleGetSubscribersCount(_req, res) {
  try {
    const snapshot = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db, "push_subscriptions"));
    return res.json({
      success: true,
      count: snapshot.size
    });
  } catch (error) {
    console.error("[Push Service] Count error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to count subscribers"
    });
  }
}
async function handleBroadcast(req, res) {
  try {
    const { title, body, url, postId, image, icon } = req.body || {};
    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Notification title is required"
      });
    }
    const payload = JSON.stringify({
      title: title || "Current News Live",
      body: body || "A new article has just been published.",
      url: url || "/",
      postId: postId || "",
      image: image || void 0,
      icon: icon || "https://i.imgur.com/gFgShoZ.jpeg",
      badge: "https://i.imgur.com/gFgShoZ.jpeg",
      timestamp: Date.now()
    });
    const snapshot = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db, "push_subscriptions"));
    const subscriptions = [];
    snapshot.forEach((d) => {
      subscriptions.push({ id: d.id, ...d.data() });
    });
    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        message: "No active device subscriptions found.",
        sent: 0,
        failed: 0,
        purged: 0,
        total: 0
      });
    }
    let sent = 0;
    let failed = 0;
    let purged = 0;
    const BATCH_SIZE = 25;
    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (sub) => {
          try {
            const pushConfig = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys?.p256dh,
                auth: sub.keys?.auth
              }
            };
            await import_web_push.default.sendNotification(pushConfig, payload, {
              TTL: 86400,
              // Keep in Google/Apple push queue for 24 hours if device is offline
              urgency: "high"
            });
            sent++;
          } catch (err) {
            failed++;
            if (err.statusCode === 404 || err.statusCode === 410) {
              try {
                await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "push_subscriptions", sub.id));
                purged++;
              } catch (_) {
              }
            } else {
              console.warn(`[Push Service] Push delivery notice for ${sub.id}:`, err.message);
            }
          }
        })
      );
    }
    return res.json({
      success: true,
      message: `Notification broadcast dispatched. Sent: ${sent}, Failed: ${failed}, Purged: ${purged}`,
      sent,
      failed,
      purged,
      total: subscriptions.length
    });
  } catch (error) {
    console.error("[Push Service] Broadcast dispatch error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to dispatch push broadcast"
    });
  }
}

// server.ts
import_dotenv.default.config();
var adaptVercelHandler = (handler6) => {
  return async (req, res) => {
    try {
      await handler6(req, res);
    } catch (error) {
      console.error("Error in adapted Vercel handler:", error);
      if (!res.headersSent) {
        res.status(500).send(error?.message || "Internal Server Error");
      }
    }
  };
};
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const upload = (0, import_multer.default)({
    storage: import_multer.default.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024
      // 20MB max file size
    },
    fileFilter: (_req, file, cb) => {
      const isImageMime = file.mimetype && (file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream" || file.mimetype === "application/x-zip-compressed" || file.mimetype === "binary/octet-stream");
      const hasImageExt = /\.(jpe?g|png|webp|gif|svg|bmp|tiff|heic|heif|avif)$/i.test(file.originalname || "");
      if (isImageMime || hasImageExt) {
        cb(null, true);
      } else {
        cb(new Error(`Only image files (JPEG, PNG, WebP, GIF, SVG, AVIF, HEIC) are permitted. Received: ${file.mimetype || "unknown"}`));
      }
    }
  });
  app.post("/api/upload", (req, res) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("[Upload Middleware Error]:", err);
        const isLimit = err.code === "LIMIT_FILE_SIZE";
        const msg = isLimit ? "Image file size exceeds the 20MB limit. Please select a smaller photo." : err.message || "Failed to process image upload.";
        return res.status(400).json({
          success: false,
          error: msg
        });
      }
      handleR2Upload(req, res);
    });
  });
  app.post("/api/mail/send-alert", adaptVercelHandler(handler));
  app.all("/api/mail/inbound", adaptVercelHandler(handler2));
  app.all("/sitemap.xml", adaptVercelHandler(handler5));
  app.all("/rss.xml", adaptVercelHandler(handler3));
  app.all("/ads.txt", adaptVercelHandler(handler4));
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain; charset=utf-8").sendFile(import_path4.default.join(process.cwd(), "public", "robots.txt"));
  });
  app.get("/api/push/public-key", handleGetVapidPublicKey);
  app.post("/api/push/subscribe", handleSubscribe);
  app.post("/api/push/unsubscribe", handleUnsubscribe);
  app.post("/api/push/broadcast", handleBroadcast);
  app.get("/api/push/subscribers-count", handleGetSubscribersCount);
  app.all("/api/*", (_req, res) => {
    res.status(404).json({
      success: false,
      error: "API endpoint not found"
    });
  });
  app.use("/api", (err, _req, res, _next) => {
    console.error("[Unhandled API Error]:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || "Internal API Server Error"
      });
    }
  });
  app.use(handleSocialPreview);
  app.use("/uploads", import_express.default.static(import_path4.default.join(process.cwd(), "public", "uploads")));
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path4.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path4.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
