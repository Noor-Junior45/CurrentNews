import React, { useState, useEffect } from 'react';
import { Post, slugify } from '../types';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { safeFormatDate } from '../utils/dateHelper';
import { saveCompressedStory } from '../utils/compressedStorage';
import { clientLoadBalancer } from '../utils/clientLoadBalancer';
import { api, PostStats } from '../utils/api';
import { reactionStore } from '../utils/reactionStore';

interface BlogPostCardProps {
  post: Post;
  globalPenName?: string;
  cardStats?: PostStats;
  isLikedByUser?: boolean;
  key?: any;
}

/**
 * Strips HTML tags, removes raw &nbsp / HTML entities, and returns a truncated plain text snippet for elegant card previews.
 */
function cleanPreviewText(htmlOrText: string, maxLength: number = 160): string {
  if (!htmlOrText) return '';
  // 1. Strip [fig. N] or [figure N] markers before previewing
  let text = htmlOrText.replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '');
  // 2. Strip HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  // 3. Strip base64 data URLs if any leaked
  text = text.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/g, '');
  // 4. Decode &nbsp, &#160, \u00a0, and common HTML entities
  text = text
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&#160;?/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-z0-9#]{1,7};?/gi, ' ');
  // 5. Clean up duplicate whitespace
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export default function BlogPostCard({ post, globalPenName, cardStats, isLikedByUser }: BlogPostCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const rawPreview = post.excerpt || post.content || '';
  const previewText = cleanPreviewText(rawPreview, 160);
  const cleanTitle = (post.title || '')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&#160;?/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const displayedAuthor = post.authorName || globalPenName || 'Current News';
  const postUrl = `/post/${post.id}/${slugify(post.title)}`;

  const handleOpenPost = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      const currentSearch = location.search || '';
      sessionStorage.setItem('current_news_return_search', currentSearch);
      sessionStorage.setItem('current_news_return_scroll', String(window.scrollY));
      // Save preview into user cache memory for instant 0ms reader opening
      saveCompressedStory(post);
    } catch (err) {
      console.debug('Failed to cache return position', err);
    }
    navigate(postUrl, { state: { previewPost: post } });
  };
  
  const [baseLikes, setBaseLikes] = useState(cardStats?.likes ?? post.likes ?? 0);
  const [baseDislikes, setBaseDislikes] = useState(cardStats?.dislikes ?? post.dislikes ?? 0);
  const [isHeartPopping, setIsHeartPopping] = useState(false);
  const [, setTick] = useState(0);

  // Subscribe to reactionStore for instant updates across the app
  useEffect(() => {
    return reactionStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (isLikedByUser !== undefined) {
      reactionStore.registerServerState(post.id, isLikedByUser ? 'like' : null);
    }
  }, [isLikedByUser, post.id]);

  useEffect(() => {
    // Never overwrite with a stale server count if there is a pending or recent reaction change
    if (reactionStore.hasPendingOrRecentChange(post.id)) {
      return;
    }
    if (cardStats) {
      setBaseLikes(cardStats.likes);
      setBaseDislikes(cardStats.dislikes);
    } else {
      setBaseLikes(post.likes || 0);
      setBaseDislikes(post.dislikes || 0);
    }
  }, [cardStats, post.likes, post.dislikes, post.id]);

  const { likes: displayedLikes, dislikes: displayedDislikes, myReaction: currentReaction } =
    reactionStore.getCalculatedCounts(post.id, baseLikes, baseDislikes);

  const handleReaction = async (type: 'liked' | 'disliked', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      const confirmSignIn = window.confirm(
        "To like or dislike this dispatch, you must be logged in. Would you like to sign in with your Google account now?"
      );
      if (confirmSignIn) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithPopup(auth, provider);
        } catch (err) {
          console.error("Popup sign in failed", err);
        }
      }
      return;
    }

    const targetType: 'like' | 'dislike' | null =
      type === 'liked'
        ? (currentReaction === 'like' ? null : 'like')
        : (currentReaction === 'dislike' ? null : 'dislike');

    if (targetType === 'like') {
      setIsHeartPopping(true);
      setTimeout(() => setIsHeartPopping(false), 150);
    }

    reactionStore.setReaction(post.id, targetType);
  };

  // Format creation date elegantly
  const publishDate = safeFormatDate(post?.createdAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const hasYt = !!post.youtubeUrl && post.youtubeUrl.trim().length > 0;
  const hasFb = !!post.facebookUrl && post.facebookUrl.trim().length > 0;

  return (
    <article 
      onClick={() => handleOpenPost()}
      onMouseEnter={() => clientLoadBalancer.prefetchArticle(post.id)}
      onTouchStart={() => clientLoadBalancer.prefetchArticle(post.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenPost();
        }
      }}
      tabIndex={0}
      role="link"
      className="group newspaper-paper border-0 border-b border-black dark:border-slate-700 sm:border sm:border-slate-200 dark:sm:border-slate-700 sm:hover:border-slate-300 dark:sm:hover:border-slate-600 rounded-none sm:rounded-xl overflow-hidden shadow-none sm:shadow-xs sm:hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 sm:h-[265px] sm:max-h-[265px]"
      id={`post-card-${post.id}`}
    >
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between select-text sm:h-full">
        
        <div className="flex flex-col">
          {/* Heading of article: Zero bottom padding + calibrated leading/max-height keep Line 1-2 matras intact while completely hiding Line 3+ Devanagari upper vowel matras */}
          <h3 className="font-display font-bold text-lg sm:text-[15px] lg:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-[1.58] sm:leading-[1.5] pt-[3px] sm:pt-[2px] pb-0 mb-1.5 transition-colors line-clamp-2 max-h-[calc(3.12em+3px)] sm:min-h-[calc(2.96em+2px)] sm:max-h-[calc(2.96em+2px)] overflow-hidden">
            <span onClick={handleOpenPost} className="text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {cleanTitle}
            </span>
          </h3>

          {/* Writer name (no avatar), Date, Tag badge, YouTube & Facebook icons in the same line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2 sm:mb-2.5 font-sans shrink-0">
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[130px] py-0.5">
              {displayedAuthor}
            </span>
            <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] sm:text-xs shrink-0 py-0.5">
              {publishDate}
            </span>

            {/* Tag text between date and social media logos without background box */}
            <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
            <span className="card-category-tag text-xs font-semibold text-indigo-600 dark:text-indigo-400 capitalize truncate max-w-[85px] py-0.5">
              {post.category || 'General'}
            </span>

            {(hasYt || hasFb) && (
              <div className="flex items-center space-x-1.5 ml-0.5 shrink-0">
                {hasYt && (
                  <span className="flex items-center justify-center" title="YouTube video attached">
                    <svg className="h-3.5 w-3.5 fill-[#FF0000]" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.513 3.545 12 3.545 12 3.545s-7.513 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.875.508 9.388.508 9.388.508s7.513 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </span>
                )}
                {hasFb && (
                  <span className="flex items-center justify-center" title="Facebook reference attached">
                    <svg className="h-3.5 w-3.5 fill-[#1877F2]" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Excerpt / Summary Description: Added py-0.5 to prevent bottom matra clipping on multiline clamp */}
          <p className="text-sm sm:text-xs lg:text-[13px] text-slate-600 dark:text-slate-300 line-clamp-3 sm:line-clamp-2 sm:min-h-[2.4rem] leading-relaxed py-0.5 mb-3 sm:mb-2 overflow-hidden">
            {previewText || <span className="italic text-slate-400 dark:text-slate-500">No text preview available.</span>}
          </p>
        </div>

        {/* Bottom bar: Liked & Disliked buttons, Views, and Read full article */}
        <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-700 mt-auto shrink-0" id="card-reactions">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={(e) => handleReaction('liked', e)}
              className={`reaction-btn-clean min-h-[44px] min-w-[44px] -ml-2 sm:ml-0 inline-flex items-center justify-center gap-1.5 px-2 text-xs font-sans font-medium transition-colors cursor-pointer bg-transparent border-0 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 ${
                currentReaction === 'like'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
              title="Like this dispatch"
              type="button"
            >
              <ThumbsUp
                className={`h-4 w-4 transition-transform duration-150 ease-out ${
                  isHeartPopping ? 'scale-125' : 'scale-100'
                } ${
                  currentReaction === 'like'
                    ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-300'
                }`}
              />
              <span className="font-sans text-xs">{displayedLikes}</span>
            </button>

            <button
              onClick={(e) => handleReaction('disliked', e)}
              className={`reaction-btn-clean min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-2 text-xs font-sans font-medium transition-colors cursor-pointer bg-transparent border-0 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 ${
                currentReaction === 'dislike'
                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
              title="Dislike this dispatch"
              type="button"
            >
              <ThumbsDown
                className={`h-4 w-4 ${
                  currentReaction === 'dislike'
                    ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400'
                    : 'text-slate-400 dark:text-slate-300'
                }`}
              />
              <span className="font-sans text-xs">{displayedDislikes}</span>
            </button>

            {/* Views counter */}
            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-400 font-medium py-2 px-1" title="Total article views">
              <Eye className="h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
              <span className="font-sans">{post.views || 0}</span>
            </div>
          </div>

          <Link 
            to={postUrl}
            state={{ previewPost: post }}
            onClick={(e) => {
              e.stopPropagation();
              try {
                saveCompressedStory(post);
              } catch (err) {}
            }}
            className="read-full-article-link min-h-[44px] inline-flex items-center justify-center py-2 px-2 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 font-sans text-xs font-semibold transition-colors shrink-0 -mr-2"
            id={`read-article-link-${post.id}`}
          >
            <span>Read full article...</span>
          </Link>
        </div>

      </div>

    </article>
  );
}
