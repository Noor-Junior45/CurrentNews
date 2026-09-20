import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Lazy initialize S3 Client for Cloudflare R2
let s3Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!s3Client) {
    const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }
  return s3Client;
}

export async function handleR2Upload(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No image file was provided for upload.' });
      return;
    }

    // Determine extension from original name or mimetype
    const mime = (file.mimetype || '').toLowerCase();
    const originalName = file.originalname || '';
    let ext = 'jpg';
    if (mime === 'image/png') ext = 'png';
    else if (mime === 'image/webp') ext = 'webp';
    else if (mime === 'image/gif') ext = 'gif';
    else if (mime === 'image/svg+xml') ext = 'svg';
    else if (mime === 'image/avif') ext = 'avif';
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
    else {
      const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch) {
        const foundExt = extMatch[1].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif', 'avif'].includes(foundExt)) {
          ext = foundExt === 'jpeg' ? 'jpg' : foundExt;
        }
      }
    }

    // Standardize ContentType so browsers display images correctly
    let uploadContentType = file.mimetype;
    if (!uploadContentType || uploadContentType === 'application/octet-stream' || !uploadContentType.startsWith('image/')) {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        avif: 'image/avif',
      };
      uploadContentType = mimeMap[ext] || 'image/jpeg';
    }

    // Generate unique slug with year/month folder structure for clean organization
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const sanitizedOriginal = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'photo';
    const key = `uploads/${year}/${month}/${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;

    let publicUrl = '';
    let fallbackUrl = '';

    // Check if Cloudflare R2 is configured
    const client = getR2Client();
    if (client) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME || 'currentnews-media';
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: uploadContentType,
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await client.send(command);

        const sanitizeDomain = (val: string | undefined, fallback: string): string => {
          if (!val) return fallback;
          let d = val.trim().replace(/^(?:https?[:/]*)+/i, '');
          d = d.split('/')[0];
          d = d.replace(/\/+$/, '').trim();
          return d || fallback;
        };

        const customDomain = sanitizeDomain(process.env.R2_PUBLIC_DOMAIN, 'media.currentnews.blog');
        const r2DevDomain = sanitizeDomain(process.env.R2_DEV_DOMAIN, 'pub-03dd1274c4824531a1478f20e0485d75.r2.dev');

        publicUrl = `https://${customDomain}/${key}`;
        fallbackUrl = `https://${r2DevDomain}/${key}`;
      } catch (r2Error) {
        console.warn('R2 storage push failed, smoothly switching to local disk storage:', r2Error);
      }
    }

    // If R2 is not configured or failed, save locally in public/uploads for instant reliability
    if (!publicUrl) {
      const localDir = path.join(process.cwd(), 'public', 'uploads', String(year), month);
      await fs.promises.mkdir(localDir, { recursive: true });
      const localFileName = `${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;
      const localFilePath = path.join(localDir, localFileName);
      await fs.promises.writeFile(localFilePath, file.buffer);

      publicUrl = `/uploads/${year}/${month}/${localFileName}`;
      fallbackUrl = publicUrl;
    }

    res.json({
      success: true,
      url: publicUrl,
      fallbackUrl: fallbackUrl,
      key: key,
      size: file.size,
      mimetype: file.mimetype,
    });
  } catch (error: any) {
    console.warn('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload photo.',
      details: error?.message || String(error),
    });
  }
}
