import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Request, Response } from 'express';
import crypto from 'crypto';

// Lazy initialize S3 Client for Cloudflare R2
let s3Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID || 'd3dfb94681e636f340d88b37fd135cee';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '83ca15d6a4a26f6e1175f3b0852f59bc';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '93df40e3213b4d93ce923f4189e8d24a6202795eca8d7e292b44c3e682ed6d69';
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
      res.status(400).json({ error: 'No image file was provided for upload.' });
      return;
    }

    // Determine extension from original name or mimetype
    const mime = file.mimetype;
    let ext = 'jpg';
    if (mime === 'image/png') ext = 'png';
    else if (mime === 'image/webp') ext = 'webp';
    else if (mime === 'image/gif') ext = 'gif';
    else if (mime === 'image/svg+xml') ext = 'svg';
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';

    // Generate unique slug with year/month folder structure for clean organization
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const key = `uploads/${year}/${month}/${Date.now()}_${randomHex}_${sanitizedOriginal}.${ext}`;

    const bucketName = process.env.R2_BUCKET_NAME || 'currentnews-media';
    const client = getR2Client();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await client.send(command);

    // Formulate public URL - prioritize custom domain if configured, fallback to R2.dev domain
    const customDomain = process.env.R2_PUBLIC_DOMAIN || 'media.currentnews.blog';
    const r2DevDomain = process.env.R2_DEV_DOMAIN || 'pub-03dd1274c4824531a1478f20e0485d75.r2.dev';

    // Default to custom domain https://media.currentnews.blog/key
    const publicUrl = `https://${customDomain}/${key}`;
    const fallbackUrl = `https://${r2DevDomain}/${key}`;

    res.json({
      success: true,
      url: publicUrl,
      fallbackUrl: fallbackUrl,
      key: key,
      size: file.size,
      mimetype: file.mimetype,
    });
  } catch (error: any) {
    console.error('Error uploading file to Cloudflare R2:', error);
    res.status(500).json({
      error: 'Failed to upload photo to Cloudflare R2.',
      details: error?.message || String(error),
    });
  }
}
