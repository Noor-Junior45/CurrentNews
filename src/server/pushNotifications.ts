import { Request, Response } from 'express';
import webpush from 'web-push';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load Firebase configuration
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.error('[Push Service] Failed to read firebase-applet-config.json:', e);
}

const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

// VAPID credentials for Web Push protocol (RFC 8292 / RFC 8291 standard)
// These allow waking up Android phones (via Google Play Services / FCM) and PCs without native app store builds.
let resolvedPublicKey = process.env.VAPID_PUBLIC_KEY;
let resolvedPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!resolvedPublicKey || !resolvedPrivateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    resolvedPublicKey = resolvedPublicKey || generated.publicKey;
    resolvedPrivateKey = resolvedPrivateKey || generated.privateKey;
  } catch (genErr) {
    console.warn('[Push Service] Could not generate dynamic VAPID keys:', genErr);
  }
}

export const VAPID_PUBLIC_KEY = resolvedPublicKey || '';
export const VAPID_PRIVATE_KEY = resolvedPrivateKey || '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@currentnews.blog';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[Push Service] VAPID details configured successfully.');
  } catch (vapidErr) {
    console.error('[Push Service] VAPID initialization error:', vapidErr);
  }
}

// Generate stable deterministic ID from endpoint URL
function getEndpointId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 32);
}

/**
 * GET /api/push/public-key
 * Returns the VAPID Public Key needed by the browser/Android device to generate push credentials.
 */
export function handleGetVapidPublicKey(_req: Request, res: Response) {
  return res.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
}

/**
 * POST /api/push/subscribe
 * Registers a device push subscription into Firestore push_subscriptions collection.
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

    const docId = getEndpointId(subscription.endpoint);
    const subRef = doc(db, 'push_subscriptions', docId);

    await setDoc(subRef, {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: userAgent || req.headers['user-agent'] || '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }, { merge: true });

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
 * Removes a device push subscription when the user toggles off alerts.
 */
export async function handleUnsubscribe(req: Request, res: Response) {
  try {
    const { endpoint } = req.body || {};

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing subscription endpoint',
      });
    }

    const docId = getEndpointId(endpoint);
    const subRef = doc(db, 'push_subscriptions', docId);
    await deleteDoc(subRef);

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

/**
 * GET /api/push/subscribers-count
 * Returns the count of registered push devices.
 */
export async function handleGetSubscribersCount(_req: Request, res: Response) {
  try {
    const snapshot = await getDocs(collection(db, 'push_subscriptions'));
    return res.json({
      success: true,
      count: snapshot.size,
    });
  } catch (error: any) {
    console.error('[Push Service] Count error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to count subscribers',
    });
  }
}

/**
 * POST /api/push/broadcast
 * Dispatches an automated background push notification to all subscribed devices.
 * Wakes up closed apps, sleeping phones, and background service workers.
 */
export async function handleBroadcast(req: Request, res: Response) {
  try {
    const { title, body, url, postId, image, icon } = req.body || {};

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Notification title is required',
      });
    }

    const payload = JSON.stringify({
      title: title || 'Current News Live',
      body: body || 'A new article has just been published.',
      url: url || '/',
      postId: postId || '',
      image: image || undefined,
      icon: icon || 'https://i.imgur.com/gFgShoZ.jpeg',
      badge: 'https://i.imgur.com/gFgShoZ.jpeg',
      timestamp: Date.now(),
    });

    // Fetch all active subscriptions from Firestore
    const snapshot = await getDocs(collection(db, 'push_subscriptions'));
    const subscriptions: any[] = [];
    snapshot.forEach((d) => {
      subscriptions.push({ id: d.id, ...d.data() });
    });

    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        message: 'No active device subscriptions found.',
        sent: 0,
        failed: 0,
        purged: 0,
        total: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    let purged = 0;

    // Send notifications in batches to avoid overwhelming network
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
                auth: sub.keys?.auth,
              },
            };

            await webpush.sendNotification(pushConfig, payload, {
              TTL: 86400, // Keep in Google/Apple push queue for 24 hours if device is offline
              urgency: 'high',
            });
            sent++;
          } catch (err: any) {
            failed++;
            // 404 or 410 means the user uninstalled the app or revoked notification permission
            if (err.statusCode === 404 || err.statusCode === 410) {
              try {
                await deleteDoc(doc(db, 'push_subscriptions', sub.id));
                purged++;
              } catch (_) {}
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
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('[Push Service] Broadcast dispatch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch push broadcast',
    });
  }
}
