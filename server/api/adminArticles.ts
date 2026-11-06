import type { Request, Response } from 'express';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { query, isNeonConfigured } from '../db/neon.ts';
import { saveArticleToR2, deleteArticleFromR2, getFeedFromR2, loadLocalFeed, extractPlainExcerpt } from '../../src/server/r2Articles.ts';
import { slugify } from '../../src/types.ts';

const ALLOWED_CATEGORIES = [
  'Jharkhand', 'Politics', 'Tech', 'Sports', 'Business', 'Health',
  'World', 'Opinion', 'General', 'National', 'Economy', 'Culture', 'Science'
];

export function sanitizeArticleContent(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'a', 'ul', 'ol', 'li', 'blockquote',
      'img', 'figure', 'figcaption', 'iframe',
      'div', 'span', 'pre', 'code', 'table', 'tbody', 'tr', 'td', 'th'
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title'],
      div: ['class', 'style'],
      span: ['class', 'style'],
      p: ['class', 'style'],
      figure: ['class'],
      figcaption: ['class']
    },
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
      'www.facebook.com',
      'facebook.com'
    ],
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      iframe: ['https']
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer'
        }
      })
    }
  });
}

const articleSchema = z.object({
  id: z.string().trim().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().min(1, 'Content is required').max(500 * 1024, 'Content cannot exceed 500KB'),
  category: z.string().trim().refine(val => !val || ALLOWED_CATEGORIES.some(c => c.toLowerCase() === val.toLowerCase()), {
    message: 'Category must be from the allowed category taxonomy'
  }).default('General'),
  youtubeUrl: z.string().trim().refine(val => !val || /^https?:\/\//i.test(val), { message: 'YouTube URL must be http/https' }).optional().default(''),
  facebookUrl: z.string().trim().refine(val => !val || /^https?:\/\//i.test(val), { message: 'Facebook URL must be http/https' }).optional().default(''),
  customLinks: z.array(z.string().trim().refine(val => !val || /^https?:\/\//i.test(val), { message: 'Custom links must be valid URLs' })).max(20).optional().default([]),
  hashtags: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  imageUrl: z.string().trim().optional().default(''),
  imageUrlFallback: z.string().trim().optional().default(''),
  imageUrls: z.array(z.string().trim()).max(10).optional().default([]),
  imageUrlsFallback: z.array(z.string().trim()).max(10).optional().default([]),
  imagePosition: z.string().optional().default('top'),
  galleryPositions: z.array(z.string()).max(10).optional().default([]),
  authorName: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export function mapRowToArticle(row: any): any {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category || 'General',
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    youtubeUrl: row.youtube_url || '',
    facebookUrl: row.facebook_url || '',
    customLinks: Array.isArray(row.custom_links) ? row.custom_links : [],
    imageUrl: row.image_url || '',
    imageUrlFallback: row.image_url_fallback || '',
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    imageUrlsFallback: Array.isArray(row.image_urls_fallback) ? row.image_urls_fallback : [],
    imagePosition: row.image_position || 'top',
    galleryPositions: Array.isArray(row.gallery_positions) ? row.gallery_positions : [],
    authorId: row.author_uid,
    authorName: row.author_name || 'Current News',
    authorEmail: row.author_email || '',
    status: row.status,
    version: row.version || 1,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
    syncError: row.sync_error || null,
  };
}

async function recordAuditLog(
  actorUid: string,
  actorEmail: string,
  action: string,
  entity: string,
  entityId: string,
  meta: any,
  ip: string
) {
  if (!isNeonConfigured()) return;
  try {
    await query(
      `INSERT INTO audit_log (actor_uid, actor_email, action, entity, entity_id, meta, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorUid, actorEmail, action, entity, entityId, JSON.stringify(meta), ip]
    );
  } catch (err: any) {
    console.debug('[Audit Log] Notice:', err?.message || err);
  }
}

/**
 * POST /api/admin/articles
 * Create or update an article in Neon, then sync to R2 if published.
 */
export async function handleAdminCreateOrUpdateArticle(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const parseResult = articleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: parseResult.error.format()
    });
  }

  const data = parseResult.data;
  const isUpdate = Boolean(data.id);
  const articleId = data.id || ('post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));
  const rawSlug = slugify(data.title) || articleId;
  const slug = `${rawSlug}-${articleId.slice(-6)}`;
  const sanitizedContent = sanitizeArticleContent(data.content);
  const excerpt = extractPlainExcerpt(sanitizedContent, 200);
  const authorName = data.authorName?.trim() || 'Current News';
  const now = new Date();

  // If Neon is configured, verify writer authorization
  if (isNeonConfigured() && isUpdate) {
    const existingRes = await query('SELECT id, author_uid, status FROM articles WHERE id = $1', [articleId]);
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (user.role === 'writer' && existing.author_uid !== user.uid) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Writers may only edit their own articles'
        });
      }
    }
  }

  const postPayloadForR2 = {
    id: articleId,
    slug,
    title: data.title,
    content: sanitizedContent,
    excerpt,
    category: data.category,
    hashtags: data.hashtags,
    youtubeUrl: data.youtubeUrl,
    facebookUrl: data.facebookUrl,
    customLinks: data.customLinks,
    imageUrl: data.imageUrl,
    imageUrlFallback: data.imageUrlFallback,
    imageUrls: data.imageUrls,
    imageUrlsFallback: data.imageUrlsFallback,
    imagePosition: data.imagePosition,
    galleryPositions: data.galleryPositions,
    authorId: user.uid,
    authorName,
    authorEmail: user.email || '',
    status: data.status,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  let neonArticle: any = null;
  let syncError: string | null = null;
  let syncedAt: Date | null = null;

  if (isNeonConfigured()) {
    try {
      const publishedAt = data.status === 'published' ? now : null;

      const upsertSql = `
        INSERT INTO articles (
          id, slug, title, excerpt, content, category, hashtags,
          youtube_url, facebook_url, custom_links,
          image_url, image_url_fallback, image_urls, image_urls_fallback,
          image_position, gallery_positions,
          author_uid, author_name, author_email,
          status, version, created_at, updated_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16,
          $17, $18, $19,
          $20, 1, $21, $22, $23
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          content = EXCLUDED.content,
          category = EXCLUDED.category,
          hashtags = EXCLUDED.hashtags,
          youtube_url = EXCLUDED.youtube_url,
          facebook_url = EXCLUDED.facebook_url,
          custom_links = EXCLUDED.custom_links,
          image_url = EXCLUDED.image_url,
          image_url_fallback = EXCLUDED.image_url_fallback,
          image_urls = EXCLUDED.image_urls,
          image_urls_fallback = EXCLUDED.image_urls_fallback,
          image_position = EXCLUDED.image_position,
          gallery_positions = EXCLUDED.gallery_positions,
          author_name = EXCLUDED.author_name,
          status = EXCLUDED.status,
          version = articles.version + 1,
          updated_at = EXCLUDED.updated_at,
          published_at = COALESCE(articles.published_at, EXCLUDED.published_at)
        RETURNING *;
      `;

      const values = [
        articleId,
        slug,
        data.title,
        excerpt,
        sanitizedContent,
        data.category,
        data.hashtags,
        data.youtubeUrl,
        data.facebookUrl,
        data.customLinks,
        data.imageUrl,
        data.imageUrlFallback,
        data.imageUrls,
        data.imageUrlsFallback,
        data.imagePosition,
        data.galleryPositions,
        user.uid,
        authorName,
        user.email || '',
        data.status,
        now,
        now,
        publishedAt
      ];

      const dbRes = await query(upsertSql, values);
      neonArticle = mapRowToArticle(dbRes.rows[0]);
    } catch (dbErr: any) {
      console.error('[Admin API] Neon write error:', dbErr?.message || dbErr);
      return res.status(500).json({
        success: false,
        error: 'Database write failed: ' + (dbErr?.message || 'Internal error')
      });
    }
  }

  // Dual-write: If published, synchronize with Cloudflare R2 / local feed
  if (data.status === 'published') {
    try {
      const r2Res = await saveArticleToR2(postPayloadForR2);
      if (r2Res.success) {
        syncedAt = new Date();
        if (isNeonConfigured()) {
          await query(
            'UPDATE articles SET synced_at = $1, sync_error = NULL WHERE id = $2',
            [syncedAt, articleId]
          );
        }
      } else {
        syncError = r2Res.error || 'Failed to sync to Cloudflare R2';
        if (isNeonConfigured()) {
          await query(
            'UPDATE articles SET sync_error = $1 WHERE id = $2',
            [syncError, articleId]
          );
        }
      }
    } catch (r2Err: any) {
      syncError = r2Err?.message || 'Cloudflare R2 sync failed';
      console.warn('[Admin API] R2 sync warning:', syncError);
      if (isNeonConfigured()) {
        try {
          await query('UPDATE articles SET sync_error = $1 WHERE id = $2', [syncError, articleId]);
        } catch (_) {}
      }
    }
  }

  // Audit log
  await recordAuditLog(
    user.uid,
    user.email || '',
    isUpdate ? 'article.update' : 'article.create',
    'article',
    articleId,
    { title: data.title, status: data.status, syncError },
    req.ip || ''
  );

  const returnedArticle = neonArticle || postPayloadForR2;

  if (syncError) {
    return res.status(200).json({
      success: true,
      article: returnedArticle,
      warning: `Article saved in Neon database, but public CDN sync error occurred: ${syncError}`,
      syncError
    });
  }

  return res.status(200).json({
    success: true,
    article: returnedArticle
  });
}

/**
 * GET /api/admin/articles
 * Lists articles with cursor pagination and role filtering.
 */
export async function handleAdminGetArticles(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const statusParam = (req.query.status as string || '').trim().toLowerCase();
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = Math.max(1, Math.min(50, isNaN(limitParam) ? 20 : limitParam));
  const cursor = (req.query.cursor as string || '').trim();

  if (isNeonConfigured()) {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Role check: Writers only see their own articles; Admins see all
      if (user.role === 'writer') {
        conditions.push(`author_uid = $${paramIndex++}`);
        params.push(user.uid);
      }

      // Status filter
      if (statusParam && ['draft', 'published', 'archived'].includes(statusParam)) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(statusParam);
      } else {
        // Exclude archived by default unless requested
        conditions.push(`status != 'archived'`);
      }

      // Cursor pagination (by updated_at DESC, id DESC)
      if (cursor) {
        try {
          const [cursorTime, cursorId] = cursor.split('_');
          if (cursorTime && cursorId) {
            conditions.push(`(updated_at, id) < ($${paramIndex++}, $${paramIndex++})`);
            params.push(new Date(parseInt(cursorTime, 10)), cursorId);
          }
        } catch (_) {}
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);
      const querySql = `
        SELECT * FROM articles
        ${whereClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT $${paramIndex};
      `;

      const dbRes = await query(querySql, params);
      const rows = dbRes.rows;
      const hasMore = rows.length > limit;
      const resultRows = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && resultRows.length > 0) {
        const last = resultRows[resultRows.length - 1];
        nextCursor = `${new Date(last.updated_at).getTime()}_${last.id}`;
      }

      const articles = resultRows.map(mapRowToArticle);

      return res.status(200).json({
        success: true,
        articles,
        hasMore,
        nextCursor,
        count: articles.length
      });
    } catch (err: any) {
      console.error('[Admin API] Get articles Neon error:', err?.message || err);
      // Fall through to fallback
    }
  }

  // Graceful fallback if Neon is not yet provisioned
  try {
    const rawFeed = await getFeedFromR2();
    const localFeed = loadLocalFeed();
    const map = new Map<string, any>();
    for (const p of [...rawFeed, ...localFeed]) {
      if (p && p.id) map.set(p.id, p);
    }
    let articles = Array.from(map.values());

    if (user.role === 'writer') {
      articles = articles.filter(p => p.authorId === user.uid || (p.authorEmail && p.authorEmail.toLowerCase() === (user.email || '').toLowerCase()));
    }

    if (statusParam) {
      articles = articles.filter(p => (p.status || 'published').toLowerCase() === statusParam);
    }

    return res.status(200).json({
      success: true,
      articles: articles.slice(0, limit),
      hasMore: articles.length > limit,
      fallback: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to list articles' });
  }
}

/**
 * DELETE /api/admin/articles/:id
 * Soft-delete an article (admin only, or writer for their own draft).
 */
export async function handleAdminDeleteArticle(req: Request, res: Response) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Article ID required' });
  }

  if (isNeonConfigured()) {
    try {
      const checkRes = await query('SELECT id, author_uid, status FROM articles WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Article not found' });
      }

      const article = checkRes.rows[0];

      // Permission check: Writer can only delete their own DRAFTS; Admins can delete anything
      if (user.role === 'writer') {
        if (article.author_uid !== user.uid) {
          return res.status(403).json({ success: false, error: 'Forbidden: Writers may only delete their own articles' });
        }
        if (article.status !== 'draft') {
          return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can archive published articles' });
        }
      }

      // Soft delete: status = 'archived'
      await query(`UPDATE articles SET status = 'archived', updated_at = now() WHERE id = $1`, [id]);

      // If it was published, remove from public feed and R2
      if (article.status === 'published') {
        await deleteArticleFromR2(id);
      }

      await recordAuditLog(
        user.uid,
        user.email || '',
        'article.delete',
        'article',
        id,
        { previousStatus: article.status },
        req.ip || ''
      );

      return res.status(200).json({
        success: true,
        message: 'Article archived successfully'
      });
    } catch (err: any) {
      console.error('[Admin API] Delete article error:', err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete article' });
    }
  }

  // Fallback: delete from R2 and local mirror
  await deleteArticleFromR2(id);
  return res.status(200).json({ success: true, message: 'Article removed' });
}

/**
 * GET /api/admin/me
 * Returns authenticated staff identity and role.
 */
export async function handleAdminGetMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return res.status(200).json({
    success: true,
    uid: req.user.uid,
    email: req.user.email,
    role: req.user.role
  });
}
