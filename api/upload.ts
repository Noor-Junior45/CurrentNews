import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Let Busboy / multipart parser handle binary file stream in Vercel Serverless
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST is accepted.' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    // Read request body buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const fullBuffer = Buffer.concat(chunks);

    // Parse boundary
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = match ? match[1] || match[2] : null;
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid multipart boundary' });
    }

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = splitBuffer(fullBuffer, boundaryBuffer);

    let fileBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    let originalName = 'photo.jpg';

    for (const part of parts) {
      const headerEndIndex = part.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) continue;

      const headerText = part.subarray(0, headerEndIndex).toString('utf8');
      const bodyBuffer = part.subarray(headerEndIndex + 4);

      if (headerText.includes('name="image"') && headerText.includes('filename="')) {
        const fnMatch = headerText.match(/filename="([^"]+)"/);
        if (fnMatch) originalName = fnMatch[1];

        const ctMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
        if (ctMatch) mimeType = ctMatch[1].trim();

        // Strip trailing \r\n before closing boundary
        let endLen = bodyBuffer.length;
        if (bodyBuffer.subarray(endLen - 2).toString() === '\r\n') {
          endLen -= 2;
        }
        fileBuffer = bodyBuffer.subarray(0, endLen);
        break;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No image file binary was received.' });
    }

    // Configure Cloudflare R2 S3 client
    const accountId = process.env.R2_ACCOUNT_ID || 'd3dfb94681e636f340d88b37fd135cee';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '83ca15d6a4a26f6e1175f3b0852f59bc';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '93df40e3213b4d93ce923f4189e8d24a6202795eca8d7e292b44c3e682ed6d69';
    const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
    const bucketName = process.env.R2_BUCKET_NAME || 'currentnews-media';

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    let ext = 'jpg';
    if (mimeType === 'image/png') ext = 'png';
    else if (mimeType === 'image/webp') ext = 'webp';
    else if (mimeType === 'image/gif') ext = 'gif';
    else if (mimeType === 'image/svg+xml') ext = 'svg';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const key = `uploads/${year}/${month}/${Date.now()}_${randomHex}_${sanitizedName}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await s3Client.send(command);

    const customDomain = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
    const r2DevDomain = process.env.R2_DEV_DOMAIN || 'pub-03dd1274c4824531a1478f20e0485d75.r2.dev';

    return res.status(200).json({
      success: true,
      url: `https://${customDomain}/${key}`,
      fallbackUrl: `https://${r2DevDomain}/${key}`,
      key: key,
      size: fileBuffer.length,
      mimetype: mimeType,
    });
  } catch (error: any) {
    console.error('Vercel R2 upload error:', error);
    return res.status(500).json({
      error: 'Failed to process image upload to Cloudflare R2',
      details: error?.message || String(error),
    });
  }
}

// Utility to split buffer by delimiter
function splitBuffer(buf: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index: number;

  while ((index = buf.indexOf(delimiter, start)) !== -1) {
    if (index > start) {
      parts.push(buf.subarray(start, index));
    }
    start = index + delimiter.length;
  }

  if (start < buf.length) {
    parts.push(buf.subarray(start));
  }

  return parts;
}
