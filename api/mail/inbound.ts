import crypto from 'crypto';
import type { Request, Response } from 'express';

export const INBOUND_MAIL_CONFIG = {
  name: 'Current News',
  address: 'help@currentnews.blog',
  formatted: 'Current News <help@currentnews.blog>',
  mailto: 'mailto:Current%20News%20%3Chelp%40currentnews.blog%3E',
};

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Inbound Mail Webhook API Handler
 * Securely processes inbound mail webhook notifications for help@currentnews.blog.
 * Requires secret header authenticated via crypto.timingSafeEqual against INBOUND_WEBHOOK_SECRET.
 */
export default async function handler(req: Request, res: Response) {
  // Reject any method other than GET or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  // Webhook security: Require INBOUND_WEBHOOK_SECRET
  const expectedSecret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!expectedSecret || expectedSecret.trim().length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Webhook secret is not configured',
    });
  }

  const rawHeader = (
    req.headers['x-webhook-secret'] ||
    req.headers['x-inbound-secret'] ||
    req.headers['x-inbound-webhook-secret'] ||
    req.headers['authorization']
  );

  let providedSecret = '';
  if (typeof rawHeader === 'string') {
    providedSecret = rawHeader.startsWith('Bearer ') ? rawHeader.slice(7).trim() : rawHeader.trim();
  }

  if (!providedSecret || !safeCompare(providedSecret, expectedSecret.trim())) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing webhook secret header',
    });
  }

  // GET: Return verified inbound configuration
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'Current News Inbound Mail Dispatch',
      name: INBOUND_MAIL_CONFIG.name,
      address: INBOUND_MAIL_CONFIG.address,
      formatted: INBOUND_MAIL_CONFIG.formatted,
      mailto: INBOUND_MAIL_CONFIG.mailto,
      timestamp: new Date().toISOString(),
    });
  }

  // POST: Receive and process verified inbound webhook payload
  const payload = req.body || {};
  return res.status(200).json({
    success: true,
    message: `Inbound mail payload received for ${INBOUND_MAIL_CONFIG.formatted}`,
    recipient: INBOUND_MAIL_CONFIG.formatted,
    receivedAt: new Date().toISOString(),
  });
}
