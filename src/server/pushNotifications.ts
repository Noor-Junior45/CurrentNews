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
const NATIVE_FCM_ENDPOINT_REGEX = /^fcm:[A-Za-z0-9_:-]{100,400}$/;

function isNativeFcmEndpoint(endpoint: unknown): endpoint is string {
  return typeof endpoint === 'string' && NATIVE_FCM_ENDPOINT_REGEX.test(endpoint);
}

function isWebPushEndpoint(endpoint: unknown): endpoint is string {
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
 * Supports both Web Push ({ subscription: { endpoint, keys }, userAgent })
 * and native Android FCM ({ endpoint: "fcm:<token>", keys: { p256dh: "fcm", auth: "fcm" }, userAgent }).
 */
export async function handleSubscribe(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const subObj =
      body.subscription && typeof body.subscription === 'object'
        ? body.subscription
        : body;

    const endpoint: unknown = subObj?.endpoint;
    const keys: unknown = subObj?.keys;
    const userAgent: unknown = body.userAgent;

    if (!endpoint || !keys || typeof keys !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing required push subscription endpoint or keys',
      });
    }

    const p256dh = (keys as Record<string, unknown>).p256dh;
    const auth = (keys as Record<string, unknown>).auth;

    let resolvedP256dh: string;
    let resolvedAuth: string;

    if (isNativeFcmEndpoint(endpoint)) {
      if (p256dh !== 'fcm' || auth !== 'fcm') {
        return res.status(400).json({
          success: false,
          error: 'Invalid native FCM subscription keys: p256dh and auth must both be "fcm"',
        });
      }
      resolvedP256dh = 'fcm';
      resolvedAuth = 'fcm';
    } else if (isWebPushEndpoint(endpoint)) {
      if (
        p256dh === 'fcm' ||
        auth === 'fcm' ||
        !isValidBase64UrlKey(p256dh, 200) ||
        !isValidBase64UrlKey(auth, 50)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription keys: p256dh must be base64url <= 200 chars and auth must be base64url <= 50 chars',
        });
      }
      resolvedP256dh = (p256dh as string).trim();
      resolvedAuth = (auth as string).trim();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription endpoint: must be an authorized https Web Push gateway or valid fcm:<token> endpoint',
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
      [endpoint, resolvedP256dh, resolvedAuth, rawUserAgent]
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

    if (!isNativeFcmEndpoint(endpoint) && !isWebPushEndpoint(endpoint)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription endpoint: must be an authorized https Web Push gateway or valid fcm:<token> endpoint',
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
