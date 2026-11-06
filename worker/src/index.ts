import { DurableObject } from 'cloudflare:workers';

// Cloudflare Worker & D1 runtime declarations
export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta: any }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<any[]>;
  exec(query: string): Promise<any>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  DB: D1Database;
  AGG: DurableObjectNamespace;
  FIREBASE_PROJECT_ID?: string;
}

/**
 * Singleton Durable Object for coalescing stats updates (likes, dislikes, views)
 * into high-performance periodic D1 batch writes every 30 seconds.
 * Persists pending deltas in ctx.storage to prevent data loss on DO eviction.
 */
export class StatsAggregator extends DurableObject {
  private deltas: Map<string, { likes: number; dislikes: number; views: number }> = new Map();
  private env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;

    // Load persisted deltas on initialization before processing any requests
    this.ctx.blockConcurrencyWhile(async () => {
      try {
        const stored = await this.ctx.storage.get<Record<string, { likes: number; dislikes: number; views: number }>>('deltas');
        if (stored && typeof stored === 'object') {
          for (const [postId, stats] of Object.entries(stored)) {
            if (stats) {
              this.deltas.set(postId, {
                likes: Number(stats.likes) || 0,
                dislikes: Number(stats.dislikes) || 0,
                views: Number(stats.views) || 0,
              });
            }
          }
        }
      } catch (err) {
        console.error('[StatsAggregator] Error restoring deltas from storage:', err);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/add') {
      let body: any = {};
      try {
        body = await request.json();
      } catch (e) {}

      const { postId, likes = 0, dislikes = 0, views = 0 } = body;
      if (!postId || typeof postId !== 'string') {
        return new Response('Missing postId', { status: 400 });
      }

      const current = this.deltas.get(postId) || { likes: 0, dislikes: 0, views: 0 };
      current.likes += Number(likes) || 0;
      current.dislikes += Number(dislikes) || 0;
      current.views += Number(views) || 0;
      this.deltas.set(postId, current);

      // Persist deltas to ctx.storage on every addition so DO eviction does not lose stats
      try {
        await this.ctx.storage.put('deltas', Object.fromEntries(this.deltas.entries()));
      } catch (storeErr) {
        console.error('[StatsAggregator] Failed to persist deltas:', storeErr);
      }

      // On the first add, set 30s alarm only if no alarm is currently active
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + 30000);
      }

      return new Response(JSON.stringify({ success: true, pending: this.deltas.size }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm(): Promise<void> {
    if (this.deltas.size === 0) {
      await this.ctx.storage.delete('deltas');
      return;
    }

    // Snapshot deltas to flush
    const snapshot = new Map(this.deltas);
    const statements: D1PreparedStatement[] = [];

    for (const [postId, delta] of snapshot.entries()) {
      if (delta.likes === 0 && delta.dislikes === 0 && delta.views === 0) continue;
      statements.push(
        this.env.DB.prepare(
          `INSERT INTO posts_stats(post_id, likes, dislikes, views) VALUES(?, ?, ?, ?)
           ON CONFLICT(post_id) DO UPDATE SET
             likes = MAX(0, likes + excluded.likes),
             dislikes = MAX(0, dislikes + excluded.dislikes),
             views = views + excluded.views`
        ).bind(postId, delta.likes, delta.dislikes, delta.views)
      );
    }

    if (statements.length === 0) {
      this.deltas.clear();
      await this.ctx.storage.delete('deltas');
      return;
    }

    try {
      // Execute in D1 batch in chunks
      const chunkSize = 50;
      for (let i = 0; i < statements.length; i += chunkSize) {
        await this.env.DB.batch(statements.slice(i, i + chunkSize));
      }

      // Clear the flushed deltas only after the D1 batch succeeds
      for (const [postId, delta] of snapshot.entries()) {
        const remaining = this.deltas.get(postId);
        if (remaining) {
          remaining.likes -= delta.likes;
          remaining.dislikes -= delta.dislikes;
          remaining.views -= delta.views;
          if (remaining.likes === 0 && remaining.dislikes === 0 && remaining.views === 0) {
            this.deltas.delete(postId);
          }
        }
      }

      // Update storage state after batch completion
      if (this.deltas.size === 0) {
        await this.ctx.storage.delete('deltas');
      } else {
        await this.ctx.storage.put('deltas', Object.fromEntries(this.deltas.entries()));
      }
    } catch (err) {
      console.error('[StatsAggregator] D1 batch failed, re-arming alarm:', err);
      // Keep deltas in memory and storage, and re-arm alarm to retry in 15s
      await this.ctx.storage.setAlarm(Date.now() + 15000);
    }
  }
}

/**
 * Dispatch stats delta to the singleton StatsAggregator Durable Object
 */
async function sendDeltaToAggregator(
  env: Env,
  postId: string,
  delta: { likes?: number; dislikes?: number; views?: number }
): Promise<void> {
  if (env.AGG) {
    const id = env.AGG.idFromName('global');
    const stub = env.AGG.get(id);
    const res = await stub.fetch(
      new Request('http://agg/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, ...delta }),
      })
    );
    if (!res.ok) {
      throw new Error(`StatsAggregator returned HTTP ${res.status}`);
    }
    return;
  }
  throw new Error('AGG binding not configured');
}

interface JWKKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface AuthUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  role?: string;
}

// In-memory cache for Google's public JWK set
let cachedJwks: { keys: JWKKey[]; expiresAt: number } | null = null;

// Lightweight in-memory rate limiting per IP for write endpoints
const ipWriteRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = ipWriteRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipWriteRateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, entry] of ipWriteRateLimits.entries()) {
    if (now > entry.resetAt) {
      ipWriteRateLimits.delete(ip);
    }
  }
}

// Exact allowed CORS origins (no wildcards)
const ALLOWED_ORIGINS = [
  'https://currentnews.blog',
  'https://www.currentnews.blog',
  'https://admin.currentnews.blog',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };

  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function jsonResponse(data: any, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
      ...headers,
    },
  });
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Fetch Google's public JWK set for Firebase ID Token verification
 */
async function getGoogleJwks(): Promise<JWKKey[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const url = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWK set: ${res.status}`);
  }

  let maxAge = 3600;
  const cacheControl = res.headers.get('Cache-Control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (match) {
    maxAge = parseInt(match[1], 10);
  }

  const data = (await res.json()) as { keys: JWKKey[] };
  cachedJwks = {
    keys: data.keys || [],
    expiresAt: now + maxAge * 1000,
  };

  return cachedJwks.keys;
}

/**
 * Verifies a Firebase ID token using Google's public JWK set and Web Crypto API.
 * Validates expiration, issued-at time (no future iat), auth_time presence, issuer, audience, and subject.
 * Returns { uid, email, emailVerified, role }.
 */
async function verifyFirebaseIdToken(token: string, projectId: string): Promise<AuthUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64));
    const header = JSON.parse(headerJson);
    if (header.alg !== 'RS256' || !header.kid) return null;

    // Decode payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    // Verify standard Firebase JWT claims
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    // Reject tokens whose iat is in the future
    if (!payload.iat || typeof payload.iat !== 'number' || payload.iat > nowSec) return null;
    // Reject tokens whose auth_time is missing or in the future
    if (!payload.auth_time || typeof payload.auth_time !== 'number' || payload.auth_time > nowSec) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (payload.aud !== projectId) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;

    // Fetch Google JWKs
    const jwks = await getGoogleJwks();
    const jwk = jwks.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    // Import Public Key into Web Crypto
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    // Verify cryptographic signature
    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      dataToVerify
    );

    if (!isValid) return null;

    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      emailVerified: payload.email_verified === true,
      role: typeof payload.role === 'string' ? payload.role : undefined,
    };
  } catch (err) {
    console.warn('[Worker Auth] Token verification error:', err);
    return null;
  }
}

/**
 * Authenticate incoming request via Authorization: Bearer <token>
 */
async function authenticateRequest(request: Request, env: Env): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const projectId = env.FIREBASE_PROJECT_ID || 'gen-lang-client-0638643565';
  return await verifyFirebaseIdToken(token, projectId);
}

/**
 * Role check: User must have custom claim role 'admin' and a verified email.
 * Zero hardcoded email addresses.
 */
function isAdmin(user: AuthUser | null): boolean {
  return !!user && user.role === 'admin' && user.emailVerified === true;
}

/**
 * Safe JSON body parser enforcing a maximum byte limit to prevent DoS memory exhaustion.
 */
async function parseJsonBody<T = any>(
  request: Request,
  maxBytes: number = 16 * 1024
): Promise<{ data: T | null; error?: string; status?: number }> {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > maxBytes) {
    return { data: null, error: 'Payload too large', status: 413 };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { data: null, error: 'Payload too large', status: 413 };
  }

  if (!text.trim()) {
    return { data: {} as T };
  }

  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return { data: null, error: 'Invalid JSON payload', status: 400 };
  }
}

// Validation constants
const POST_ID_REGEX = /^[A-Za-z0-9_-]{6,64}$/;
const PUSH_ID_REGEX = /^[A-Za-z0-9_-]{16,128}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    // Preflight OPTIONS handler
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Cleanup rate limits periodically
    if (Math.random() < 0.05) {
      cleanupRateLimits();
    }

    // Rate limit write endpoints lightly per IP
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      if (!checkRateLimit(clientIp, 80, 60000)) {
        return jsonResponse(
          { error: 'Too many requests. Please slow down.' },
          429,
          corsHeaders
        );
      }
    }

    try {
      // -------------------------------------------------------------
      // 1. GET /stats?ids=a,b,c
      // Batch fetch likes/dislikes/views for multiple posts in ONE query
      // -------------------------------------------------------------
      if (method === 'GET' && path === '/stats') {
        const idsParam = url.searchParams.get('ids') || '';
        const ids = idsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 100);

        if (ids.length === 0) {
          return jsonResponse({ stats: {} }, 200, {
            ...corsHeaders,
            'Cache-Control': 'public, s-maxage=30',
          });
        }

        // Validate IDs format to avoid malformed inputs
        const validIds = ids.filter((id) => POST_ID_REGEX.test(id));
        if (validIds.length === 0) {
          return jsonResponse({ stats: {} }, 200, {
            ...corsHeaders,
            'Cache-Control': 'public, s-maxage=30',
          });
        }

        const placeholders = validIds.map(() => '?').join(',');
        const query = `SELECT post_id, likes, dislikes, views FROM posts_stats WHERE post_id IN (${placeholders})`;
        const stmt = env.DB.prepare(query).bind(...validIds);
        const { results } = await stmt.all();

        const statsMap: Record<string, { likes: number; dislikes: number; views: number }> = {};
        for (const id of validIds) {
          statsMap[id] = { likes: 0, dislikes: 0, views: 0 };
        }

        if (results && Array.isArray(results)) {
          for (const row of results as any[]) {
            if (row.post_id) {
              statsMap[row.post_id] = {
                likes: Number(row.likes) || 0,
                dislikes: Number(row.dislikes) || 0,
                views: Number(row.views) || 0,
              };
            }
          }
        }

        return jsonResponse({ stats: statsMap }, 200, {
          ...corsHeaders,
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        });
      }

      // -------------------------------------------------------------
      // 2. POST /view/:postId
      // Increments view count, deduplicated 1 count per IP+post per 30 min
      // -------------------------------------------------------------
      if (method === 'POST' && path.startsWith('/view/')) {
        const postId = path.replace('/view/', '').trim();
        if (!POST_ID_REGEX.test(postId)) {
          return jsonResponse({ error: 'Invalid post ID format' }, 400, corsHeaders);
        }

        // Deduplicate using Cloudflare Cache API
        const cache = (caches as any).default;
        const cacheUrl = new URL(`https://cache.local/view/${encodeURIComponent(postId)}/${encodeURIComponent(clientIp)}`);
        const cacheKey = new Request(cacheUrl.toString());

        const cachedHit = await cache.match(cacheKey);
        if (cachedHit) {
          return jsonResponse({ success: true, deduped: true }, 200, corsHeaders);
        }

        // Put deduplication marker into Cache API with 30-min TTL
        const dedupeResponse = new Response('1', {
          headers: { 'Cache-Control': 'public, max-age=1800' },
        });
        ctx.waitUntil(cache.put(cacheKey, dedupeResponse));

        // Send { views: 1 } to Durable Object, with fallback to direct D1
        ctx.waitUntil((async () => {
          try {
            await sendDeltaToAggregator(env, postId, { views: 1 });
          } catch (err) {
            console.warn('[Worker] AGG failed for view, falling back to direct D1 update:', err);
            await env.DB.prepare(
              `INSERT INTO posts_stats (post_id, views) VALUES (?, 1)
               ON CONFLICT(post_id) DO UPDATE SET views = views + 1`
            ).bind(postId).run();
          }
        })());

        return jsonResponse({ success: true, viewsIncremented: true }, 200, corsHeaders);
      }

      // -------------------------------------------------------------
      // 3. GET /reaction/:postId (requires auth)
      // Returns current user's reaction ('like' | 'dislike' | null)
      // -------------------------------------------------------------
      if (method === 'GET' && path.startsWith('/reaction/')) {
        const postId = path.replace('/reaction/', '').trim();
        if (!POST_ID_REGEX.test(postId)) {
          return jsonResponse({ error: 'Invalid post ID format' }, 400, corsHeaders);
        }

        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const row = await env.DB.prepare(
          'SELECT type FROM reactions WHERE user_id = ? AND post_id = ?'
        )
          .bind(user.uid, postId)
          .first<{ type: string }>();

        return jsonResponse(
          {
            type: row?.type || null,
          },
          200,
          {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          }
        );
      }

      // -------------------------------------------------------------
      // 4. POST /reaction/:postId { type } (requires auth)
      // Writes user's reaction row immediately and coalesces stats delta
      // -------------------------------------------------------------
      if (method === 'POST' && path.startsWith('/reaction/')) {
        const postId = path.replace('/reaction/', '').trim();
        if (!POST_ID_REGEX.test(postId)) {
          return jsonResponse({ error: 'Invalid post ID format' }, 400, corsHeaders);
        }

        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const { data: body, error: bodyErr, status: bodyStatus } = await parseJsonBody(request, 16 * 1024);
        if (bodyErr) {
          return jsonResponse({ error: bodyErr }, bodyStatus || 400, corsHeaders);
        }

        const targetType = body?.type === 'like' || body?.type === 'dislike' ? body.type : null;
        const nowMs = Date.now();

        // 1. Check current reaction
        const currentRow = await env.DB.prepare(
          'SELECT type FROM reactions WHERE user_id = ? AND post_id = ?'
        )
          .bind(user.uid, postId)
          .first<{ type: string }>();

        const prevType = currentRow?.type || null;

        // If target matches current state, nothing to change
        if (prevType === targetType) {
          return jsonResponse({ success: true, type: targetType }, 200, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        // 2. Write user's row in reactions table immediately
        if (targetType === null) {
          await env.DB.prepare('DELETE FROM reactions WHERE user_id = ? AND post_id = ?')
            .bind(user.uid, postId)
            .run();
        } else {
          await env.DB.prepare(
            `INSERT INTO reactions (user_id, post_id, type, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id, post_id) DO UPDATE SET type = excluded.type, updated_at = excluded.updated_at`
          )
            .bind(user.uid, postId, targetType, nowMs)
            .run();
        }

        // 3. Compute delta (prev -> target)
        let deltaLikes = 0;
        let deltaDislikes = 0;

        if (prevType === 'like') {
          deltaLikes -= 1;
        } else if (prevType === 'dislike') {
          deltaDislikes -= 1;
        }

        if (targetType === 'like') {
          deltaLikes += 1;
        } else if (targetType === 'dislike') {
          deltaDislikes += 1;
        }

        // 4. Send delta to Durable Object with direct D1 fallback
        ctx.waitUntil((async () => {
          try {
            await sendDeltaToAggregator(env, postId, { likes: deltaLikes, dislikes: deltaDislikes });
          } catch (aggErr) {
            console.warn('[Worker] AGG failed for reaction, falling back to direct D1:', aggErr);
            await env.DB.prepare(
              `INSERT INTO posts_stats (post_id, likes, dislikes, views)
               VALUES (?, MAX(0, ?), MAX(0, ?), 0)
               ON CONFLICT(post_id) DO UPDATE SET
                 likes = MAX(0, likes + ?),
                 dislikes = MAX(0, dislikes + ?)`
            ).bind(
              postId,
              Math.max(0, deltaLikes),
              Math.max(0, deltaDislikes),
              deltaLikes,
              deltaDislikes
            ).run();
          }
        })());

        return jsonResponse({ success: true, type: targetType }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      // -------------------------------------------------------------
      // 5. GET /my-reactions (requires auth)
      // Returns list of post IDs liked by the authenticated user
      // -------------------------------------------------------------
      if (method === 'GET' && path === '/my-reactions') {
        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const { results } = await env.DB.prepare(
          `SELECT post_id FROM reactions WHERE user_id = ? AND type = 'like' ORDER BY updated_at DESC`
        )
          .bind(user.uid)
          .all<{ post_id: string }>();

        const likedPostIds = (results || []).map((r) => r.post_id);
        return jsonResponse({ likedPostIds }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      // -------------------------------------------------------------
      // 6. POST /subscribe { email }
      // Insert new subscriber with strict length and email regex validation
      // -------------------------------------------------------------
      if (method === 'POST' && path === '/subscribe') {
        const { data: body, error: bodyErr, status: bodyStatus } = await parseJsonBody(request, 16 * 1024);
        if (bodyErr) {
          return jsonResponse({ error: bodyErr }, bodyStatus || 400, corsHeaders);
        }

        const email = (body?.email || '').trim().toLowerCase();
        if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
          return jsonResponse({ error: 'Valid email address is required' }, 400, corsHeaders);
        }

        const nowMs = Date.now();
        await env.DB.prepare(
          `INSERT INTO subscribers (email, created_at) VALUES (?, ?)
           ON CONFLICT(email) DO NOTHING`
        )
          .bind(email, nowMs)
          .run();

        return jsonResponse({ success: true, message: 'Subscribed successfully' }, 200, corsHeaders);
      }

      // -------------------------------------------------------------
      // 7. GET /subscribe/check?email= (requires verified email auth)
      // Non-admins can only check their own verified email
      // -------------------------------------------------------------
      if (method === 'GET' && path === '/subscribe/check') {
        const user = await authenticateRequest(request, env);
        if (!user || !user.emailVerified || !user.email) {
          return jsonResponse({ error: 'Unauthorized: Verified email required' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const queryEmail = (url.searchParams.get('email') || '').trim().toLowerCase();
        const userEmail = user.email.toLowerCase();

        // Non-admins can only act on their own email address
        if (!isAdmin(user) && queryEmail && queryEmail !== userEmail) {
          return jsonResponse({ error: 'Forbidden: Email mismatch' }, 403, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const emailToCheck = queryEmail || userEmail;
        const row = await env.DB.prepare('SELECT email FROM subscribers WHERE email = ?')
          .bind(emailToCheck)
          .first<{ email: string }>();

        return jsonResponse({ subscribed: !!row }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      // -------------------------------------------------------------
      // 8. DELETE /subscribe (requires verified email auth)
      // Removes user's own subscription based on auth token
      // -------------------------------------------------------------
      if (method === 'DELETE' && path === '/subscribe') {
        const user = await authenticateRequest(request, env);
        if (!user || !user.emailVerified || !user.email) {
          return jsonResponse({ error: 'Unauthorized: Verified email required' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        let targetEmail = user.email.toLowerCase();
        if (isAdmin(user)) {
          const { data: body } = await parseJsonBody(request, 16 * 1024);
          const overrideEmail = (body?.email || url.searchParams.get('email') || '').trim().toLowerCase();
          if (overrideEmail) {
            targetEmail = overrideEmail;
          }
        }

        await env.DB.prepare('DELETE FROM subscribers WHERE email = ?')
          .bind(targetEmail)
          .run();

        return jsonResponse({ success: true, message: 'Unsubscribed successfully' }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      // -------------------------------------------------------------
      // 9. Push Notification Endpoints
      // POST /push/subscribe, DELETE /push/subscribe, GET /push/count
      // -------------------------------------------------------------
      if (method === 'POST' && path === '/push/subscribe') {
        const { data: body, error: bodyErr, status: bodyStatus } = await parseJsonBody(request, 16 * 1024);
        if (bodyErr) {
          return jsonResponse({ error: bodyErr }, bodyStatus || 400, corsHeaders);
        }

        const id = (body?.id || '').trim();
        if (!PUSH_ID_REGEX.test(id)) {
          return jsonResponse({ error: 'Invalid push subscription ID format' }, 400, corsHeaders);
        }

        const subStr = typeof body?.subscription === 'string'
          ? body.subscription
          : JSON.stringify(body?.subscription || {});

        // Max 4KB size cap for subscription payload
        if (!subStr || subStr.length > 4096) {
          return jsonResponse({ error: 'Subscription payload exceeds 4KB limit' }, 400, corsHeaders);
        }

        // Verify payload contains a valid HTTPS endpoint
        let subObj: any = null;
        try {
          subObj = JSON.parse(subStr);
        } catch (_) {
          return jsonResponse({ error: 'Invalid subscription JSON' }, 400, corsHeaders);
        }

        if (!subObj || typeof subObj.endpoint !== 'string' || !subObj.endpoint.startsWith('https://')) {
          return jsonResponse({ error: 'Subscription must contain a valid https endpoint' }, 400, corsHeaders);
        }

        const nowMs = Date.now();
        await env.DB.prepare(
          `INSERT INTO push_subscriptions (id, subscription, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET subscription = excluded.subscription`
        )
          .bind(id, subStr, nowMs)
          .run();

        return jsonResponse({ success: true, message: 'Push subscription stored' }, 200, corsHeaders);
      }

      if (method === 'DELETE' && path === '/push/subscribe') {
        let id = url.searchParams.get('id') || '';
        if (!id) {
          const { data: body } = await parseJsonBody(request, 16 * 1024);
          id = body?.id || '';
        }

        if (!id || !PUSH_ID_REGEX.test(id)) {
          return jsonResponse({ error: 'Invalid push subscription ID format' }, 400, corsHeaders);
        }

        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Push subscription removed' }, 200, corsHeaders);
      }

      if (method === 'GET' && path === '/push/count') {
        const row = await env.DB.prepare('SELECT COUNT(*) as count FROM push_subscriptions').first<{ count: number }>();
        const count = row?.count || 0;

        return jsonResponse(
          { count },
          200,
          {
            ...corsHeaders,
            'Cache-Control': 'public, s-maxage=300',
          }
        );
      }

      // -------------------------------------------------------------
      // 10. User Pen Name Endpoints (requires auth)
      // GET /user/pen-name, PUT /user/pen-name
      // -------------------------------------------------------------
      if (path === '/user/pen-name') {
        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        if (method === 'GET') {
          const row = await env.DB.prepare('SELECT pen_name FROM users WHERE uid = ?')
            .bind(user.uid)
            .first<{ pen_name: string }>();

          return jsonResponse({ penName: row?.pen_name || null }, 200, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        if (method === 'PUT') {
          const { data: body, error: bodyErr, status: bodyStatus } = await parseJsonBody(request, 16 * 1024);
          if (bodyErr) {
            return jsonResponse({ error: bodyErr }, bodyStatus || 400, corsHeaders);
          }

          // Strip HTML tags, control characters, collapse whitespace, max 100 chars
          const rawName = typeof body?.penName === 'string' ? body.penName : '';
          const penName = rawName
            .replace(/<[^>]*>/g, '')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100);

          await env.DB.prepare(
            `INSERT INTO users (uid, pen_name) VALUES (?, ?)
             ON CONFLICT(uid) DO UPDATE SET pen_name = excluded.pen_name`
          )
            .bind(user.uid, penName)
            .run();

          return jsonResponse({ success: true, penName }, 200, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }
      }

      // -------------------------------------------------------------
      // 11. Admin-Only Endpoints (requires auth + role 'admin' + verified email)
      // GET /subscribers, DELETE /admin/subscriber, POST /import, POST /admin/recount
      // -------------------------------------------------------------
      if (path === '/subscribers' && method === 'GET') {
        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }
        if (!isAdmin(user)) {
          return jsonResponse({ error: 'Forbidden: Admin role required' }, 403, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const { results } = await env.DB.prepare(
          'SELECT email, created_at FROM subscribers ORDER BY created_at DESC LIMIT 1000'
        ).all<{ email: string; created_at: number }>();

        return jsonResponse({ subscribers: results || [] }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      if (path === '/admin/subscriber' && method === 'DELETE') {
        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }
        if (!isAdmin(user)) {
          return jsonResponse({ error: 'Forbidden: Admin role required' }, 403, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const { data: body, error: bodyErr, status: bodyStatus } = await parseJsonBody(request, 16 * 1024);
        if (bodyErr) {
          return jsonResponse({ error: bodyErr }, bodyStatus || 400, corsHeaders);
        }

        const email = (body?.email || url.searchParams.get('email') || '').trim().toLowerCase();
        if (!email) {
          return jsonResponse({ error: 'Email is required' }, 400, corsHeaders);
        }

        await env.DB.prepare('DELETE FROM subscribers WHERE email = ?').bind(email).run();
        return jsonResponse({ success: true, message: 'Subscriber deleted' }, 200, {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        });
      }

      // POST /import: Bulk import JSON from Firestore export into D1 (5MB cap, admin only)
      if (path === '/import' && method === 'POST') {
        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }
        if (!isAdmin(user)) {
          return jsonResponse({ error: 'Forbidden: Admin role required' }, 403, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        const { data, error: bodyErr, status: bodyStatus } = await parseJsonBody(request, 5 * 1024 * 1024);
        if (bodyErr || !data) {
          return jsonResponse({ error: bodyErr || 'Invalid JSON payload' }, bodyStatus || 400, corsHeaders);
        }

        const counts = {
          posts_stats: 0,
          reactions: 0,
          subscribers: 0,
          push_subscriptions: 0,
          users: 0,
        };

        const batchStatements: D1PreparedStatement[] = [];

        // 1. posts_stats
        if (Array.isArray(data.posts_stats)) {
          for (const item of data.posts_stats) {
            if (item.post_id && POST_ID_REGEX.test(item.post_id)) {
              batchStatements.push(
                env.DB.prepare(
                  `INSERT INTO posts_stats (post_id, likes, dislikes, views)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(post_id) DO UPDATE SET
                     likes = excluded.likes,
                     dislikes = excluded.dislikes,
                     views = excluded.views`
                ).bind(
                  item.post_id,
                  Number(item.likes) || 0,
                  Number(item.dislikes) || 0,
                  Number(item.views) || 0
                )
              );
              counts.posts_stats++;
            }
          }
        }

        // 2. reactions
        if (Array.isArray(data.reactions)) {
          for (const item of data.reactions) {
            if (item.user_id && item.post_id && POST_ID_REGEX.test(item.post_id) && (item.type === 'like' || item.type === 'dislike')) {
              batchStatements.push(
                env.DB.prepare(
                  `INSERT INTO reactions (user_id, post_id, type, updated_at)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(user_id, post_id) DO UPDATE SET
                     type = excluded.type,
                     updated_at = excluded.updated_at`
                ).bind(
                  item.user_id,
                  item.post_id,
                  item.type,
                  Number(item.updated_at) || Date.now()
                )
              );
              counts.reactions++;
            }
          }
        }

        // 3. subscribers
        if (Array.isArray(data.subscribers)) {
          for (const item of data.subscribers) {
            const email = (item.email || '').trim().toLowerCase();
            if (email && email.length <= 254 && EMAIL_REGEX.test(email)) {
              batchStatements.push(
                env.DB.prepare(
                  `INSERT INTO subscribers (email, created_at)
                   VALUES (?, ?)
                   ON CONFLICT(email) DO NOTHING`
                ).bind(email, Number(item.created_at) || Date.now())
              );
              counts.subscribers++;
            }
          }
        }

        // 4. push_subscriptions
        if (Array.isArray(data.push_subscriptions)) {
          for (const item of data.push_subscriptions) {
            if (item.id && PUSH_ID_REGEX.test(item.id) && item.subscription) {
              const subStr = typeof item.subscription === 'string'
                ? item.subscription
                : JSON.stringify(item.subscription);
              if (subStr.length <= 4096) {
                batchStatements.push(
                  env.DB.prepare(
                    `INSERT INTO push_subscriptions (id, subscription, created_at)
                     VALUES (?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET subscription = excluded.subscription`
                  ).bind(item.id, subStr, Number(item.created_at) || Date.now())
                );
                counts.push_subscriptions++;
              }
            }
          }
        }

        // 5. users
        if (Array.isArray(data.users)) {
          for (const item of data.users) {
            if (item.uid) {
              const rawPenName = typeof item.pen_name === 'string' ? item.pen_name : '';
              const cleanPenName = rawPenName
                .replace(/<[^>]*>/g, '')
                .replace(/[\x00-\x1F\x7F]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 100);

              batchStatements.push(
                env.DB.prepare(
                  `INSERT INTO users (uid, pen_name)
                   VALUES (?, ?)
                   ON CONFLICT(uid) DO UPDATE SET pen_name = excluded.pen_name`
                ).bind(item.uid, cleanPenName)
              );
              counts.users++;
            }
          }
        }

        // Execute batch in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < batchStatements.length; i += chunkSize) {
          const chunk = batchStatements.slice(i, i + chunkSize);
          await env.DB.batch(chunk);
        }

        return jsonResponse(
          {
            success: true,
            message: 'Firestore export imported into Cloudflare D1 successfully',
            imported: counts,
          },
          200,
          {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          }
        );
      }

      // -------------------------------------------------------------
      // 12. POST /admin/recount (requires admin auth)
      // Rebuilds posts_stats likes/dislikes from reactions table in ONE GROUP BY query
      // -------------------------------------------------------------
      if (method === 'POST' && path === '/admin/recount') {
        const user = await authenticateRequest(request, env);
        if (!user) {
          return jsonResponse({ error: 'Unauthorized' }, 401, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }
        if (!isAdmin(user)) {
          return jsonResponse({ error: 'Forbidden: Admin role required' }, 403, {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          });
        }

        await env.DB.exec(`
          INSERT INTO posts_stats (post_id, likes, dislikes, views)
          SELECT
            post_id,
            SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END) AS likes,
            SUM(CASE WHEN type = 'dislike' THEN 1 ELSE 0 END) AS dislikes,
            0 AS views
          FROM reactions
          GROUP BY post_id
          ON CONFLICT(post_id) DO UPDATE SET
            likes = excluded.likes,
            dislikes = excluded.dislikes;
        `);

        return jsonResponse(
          {
            success: true,
            message: 'Posts stats successfully recounted from reactions table',
          },
          200,
          {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          }
        );
      }

      // Root / Health endpoint
      if (path === '/' || path === '/health') {
        return jsonResponse(
          {
            service: 'currentnews-worker',
            status: 'operational',
            edge: 'cloudflare',
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders
        );
      }

      // 404 for unknown endpoints
      return jsonResponse({ error: 'Endpoint not found' }, 404, corsHeaders);
    } catch (err: any) {
      console.error('[Worker Fatal Error]', err);
      return jsonResponse(
        {
          error: 'Internal Server Error',
        },
        500,
        corsHeaders
      );
    }
  },
};
