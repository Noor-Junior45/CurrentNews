import type { Request, Response } from 'express';
import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: true,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => {
      console.error('[Push Service] Unexpected idle PostgreSQL client error:', err);
    });
  }
  return pool;
}

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

function isValidEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== 'string' || endpoint.length > 500) return false;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    const isFcm = host === 'fcm.googleapis.com' || host.endsWith('.fcm.googleapis.com');
    const isApple = host.endsWith('.push.apple.com');
    const isWindows = host.endsWith('.notify.windows.com');
    const isMozilla = host === 'updates.push.services.mozilla.com' || host.endsWith('.updates.push.services.mozilla.com');
    return isFcm || isApple || isWindows || isMozilla;
  } catch {
    return false;
  }
}

function isValidBase64UrlKey(val: unknown, maxLen: number): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return false;
  return BASE64URL_REGEX.test(trimmed);
}

/**
 * GET /api/push/public-key
 * Returns the VAPID Public Key needed by the browser/Android device to generate push credentials.
 * Reads exclusively from VAPID_PUBLIC_KEY env var.
 */
export function handleGetVapidPublicKey(_req: Request, res: Response) {
  const rawKey = process.env.VAPID_PUBLIC_KEY;
  if (!rawKey || !rawKey.trim()) {
    console.error('[Push Service] VAPID_PUBLIC_KEY environment variable is not defined.');
    return res.status(503).json({
      success: false,
      error: 'VAPID public key is not configured',
    });
  }

  return res.json({
    success: true,
    publicKey: rawKey.trim(),
  });
}

/**
 * POST /api/push/subscribe
 * Registers a device push subscription into Neon PostgreSQL push_subscriptions table.
 */
export async function handleSubscribe(req: Request, res: Response) {
  try {
    const { subscription, userAgent } = req.body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        error: 'Missing required push subscription object or keys',
      });
    }

    if (!isValidEndpoint(subscription.endpoint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription endpoint: must be https and hosted by an authorized push gateway (fcm.googleapis.com, push.apple.com, notify.windows.com, or updates.push.services.mozilla.com) under 500 characters',
      });
    }

    const p256dh = subscription.keys.p256dh;
    const auth = subscription.keys.auth;

    if (!isValidBase64UrlKey(p256dh, 200) || !isValidBase64UrlKey(auth, 50)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription keys: p256dh must be base64url <= 200 chars and auth must be base64url <= 50 chars',
      });
    }

    const db = getPool();
    if (!db) {
      console.error('[Push Service] NEON_DATABASE_URL environment variable is not defined.');
      return res.status(503).json({
        success: false,
        error: 'Push subscription database unavailable',
      });
    }

    const rawUserAgent = typeof userAgent === 'string'
      ? userAgent.slice(0, 500)
      : (typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : null);

    await db.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO NOTHING`,
      [subscription.endpoint, p256dh, auth, rawUserAgent]
    );

    return res.json({
      success: true,
      message: 'Device subscribed to background push notifications successfully.',
    });
  } catch (error: any) {
    console.error('[Push Service] Subscription error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save push subscription',
    });
  }
}

/**
 * POST /api/push/unsubscribe
 * Removes a device push subscription from Neon PostgreSQL push_subscriptions table by endpoint.
 */
export async function handleUnsubscribe(req: Request, res: Response) {
  try {
    const { endpoint } = req.body || {};

    if (!isValidEndpoint(endpoint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription endpoint: must be https and hosted by an authorized push gateway under 500 characters',
      });
    }

    const db = getPool();
    if (!db) {
      console.error('[Push Service] NEON_DATABASE_URL environment variable is not defined.');
      return res.status(503).json({
        success: false,
        error: 'Push subscription database unavailable',
      });
    }

    await db.query(
      `DELETE FROM push_subscriptions WHERE endpoint = $1`,
      [endpoint]
    );

    return res.json({
      success: true,
      message: 'Device unsubscribed successfully.',
    });
  } catch (error: any) {
    console.error('[Push Service] Unsubscribe error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unsubscribe device',
    });
  }
}
