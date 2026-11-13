import React, { useState, useEffect, useRef } from 'react';
import AdMobNativeAd from './AdMobNativeAd';
import { sanitizeArticleHtml } from '../utils/sanitizeHtml';

interface ProgressiveArticleBodyProps {
  contentHtml: string;
  topPhotos?: React.ReactNode;
  middlePhotos?: React.ReactNode;
  bottomPhotos?: React.ReactNode;
  slotKey?: string;
  loadingMore?: boolean;
}

interface ContentChunk {
  id: string;
  html: string;
  isMiddleDivider?: boolean;
}

/**
 * ProgressiveArticleBody
 * Implements the Google News / Substack progressive scroll-reading architecture:
 * 1. Immediate Instant Lead: First paragraphs and top photos render immediately (0ms latency).
 * 2. Progressive Scroll Reveal: Subsequent paragraphs, media, and sections stream in smoothly
 *    one-by-one as the reader scrolls down the page.
 * 3. Zero Cumulative Layout Shift (CLS): Smooth ease-out opacity and slide transitions.
 */
export default function ProgressiveArticleBody({
  contentHtml,
  topPhotos,
  middlePhotos,
  bottomPhotos,
  slotKey = 'article-middle',
  loadingMore = false
}: ProgressiveArticleBodyProps): React.JSX.Element {
  const [chunks, setChunks] = useState<ContentChunk[]>([]);
  const [visibleChunkIds, setVisibleChunkIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!contentHtml || contentHtml.trim().length === 0) {
      setChunks([]);
      return;
    }

    // Split HTML by closing paragraph tags </p>
    const rawParagraphs = contentHtml.split('</p>').filter(p => p.trim().length > 0);
    
    if (rawParagraphs.length <= 2) {
      // Short dispatch: 1 single chunk
      setChunks([{ id: 'chunk-0', html: contentHtml }]);
      setVisibleChunkIds(new Set(['chunk-0']));
      return;
    }

    // Cluster paragraphs into digestible chunks (1-2 paragraphs per chunk)
    const newChunks: ContentChunk[] = [];
    const middleTargetIndex = Math.floor(rawParagraphs.length / 2);
    let currentChunkHtml = '';
    let chunkCounter = 0;

    rawParagraphs.forEach((p, idx) => {
      const closedParagraph = p.trim().endsWith('>') ? p : p + '</p>';
      currentChunkHtml += closedParagraph;

      // Group every 2 paragraphs (or 1st paragraph alone for instant lead)
      const isLeadParagraph = idx === 0;
      const isTimeForChunk = isLeadParagraph || (idx % 2 === 0) || idx === rawParagraphs.length - 1;

      if (isTimeForChunk || idx === rawParagraphs.length - 1) {
        newChunks.push({
          id: `chunk-${chunkCounter}`,
          html: currentChunkHtml,
          isMiddleDivider: idx === middleTargetIndex || (middleTargetIndex <= 1 && idx === 1)
        });
        currentChunkHtml = '';
        chunkCounter++;
      }
    });

    setChunks(newChunks);

    // Lead chunk (chunk-0) is ALWAYS visible immediately so reading starts at 0ms
    const initialVisible = new Set<string>(['chunk-0']);
    // If the screen is already large or has high viewport, also reveal chunk-1
    if (typeof window !== 'undefined' && window.innerHeight > 800 && newChunks.length > 1) {
      initialVisible.add('chunk-1');
    }
    setVisibleChunkIds(initialVisible);
  }, [contentHtml]);

  // Set up scroll intersection observer to stream paragraphs one-by-one
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      // Fallback: reveal all chunks if browser lacks observer
      setVisibleChunkIds(new Set(chunks.map(c => c.id)));
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chunkId = entry.target.getAttribute('data-chunk-id');
            if (chunkId) {
              setVisibleChunkIds((prev) => {
                if (prev.has(chunkId)) return prev;
                const next = new Set(prev);
                next.add(chunkId);
                return next;
              });
              // Once revealed, unobserve to free CPU cycles
              observerRef.current?.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: '160px 0px 80px 0px', // Trigger slightly before coming into view for seamless reading
        threshold: 0.05
      }
    );

    const elements = document.querySelectorAll('.progressive-article-chunk');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [chunks]);

  const middleChunkIndex = Math.max(1, Math.floor(chunks.length / 2));

  return (
    <div className="progressive-article-container space-y-4" id="article-content">
      {/* Top Media / Photography */}
      {topPhotos}

      {/* Progressive Text & Paragraph Stream */}
      {chunks.map((chunk, idx) => {
        const isVisible = visibleChunkIds.has(chunk.id);
        const isMiddle = idx === middleChunkIndex;

        return (
          <React.Fragment key={chunk.id}>
            <div
              data-chunk-id={chunk.id}
              className={`progressive-article-chunk transition-[opacity,transform] duration-400 ease-out will-change-[opacity,transform] ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-3 pointer-events-none'
              }`}
            >
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(chunk.html) }}
                className="article-rich-text prose max-w-none break-word break-words"
              />
            </div>

            {/* Natural Middle Editorial Break: Insert Middle Media & AdMob Unit */}
            {isMiddle && (
              <div className="my-6 space-y-4 transition-opacity duration-500 ease-out">
                {middlePhotos}
                <AdMobNativeAd slotKey={slotKey} />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Loading Skeleton Indicator when additional sections are streaming from Cloudflare */}
      {loadingMore && (
        <div className="space-y-3 pt-4 animate-pulse" aria-hidden="true">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-full"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-11/12"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-4/5"></div>
        </div>
      )}

      {/* Bottom Media / Photography */}
      {bottomPhotos}
    </div>
  );
}
