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
 * Strips HTML tags and returns a truncated plain text snippet for elegant card previews.
 */
function getHtmlTextPreview(htmlString: string, maxLength: number = 160): string {
  if (!htmlString) return '';
  // Strip [fig. N] or [figure N] markers before previewing
  const cleaned = htmlString.replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleaned;
  const excerpt = tempDiv.textContent || tempDiv.innerText || '';
  if (excerpt.length <= maxLength) return excerpt;
  return excerpt.substring(0, maxLength).trim() + '...';
}

export default function BlogPostCard({ post, globalPenName, cardStats, isLikedByUser }: BlogPostCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const previewText = post.excerpt || getHtmlTextPreview(post.content || '');
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
      className="group newspaper-paper border-0 border-b border-black dark:border-slate-700 sm:border sm:border-slate-200 dark:sm:border-slate-700 sm:hover:border-slate-300 dark:sm:hover:border-slate-600 rounded-none sm:rounded-xl overflow-hidden shadow-none sm:shadow-xs sm:hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      id={`post-card-${post.id}`}
    >
      <div className="p-4 sm:p-6 flex flex-col flex-1 justify-between select-text">
        
        <div>
          {/* Heading of article */}
          <h3 className="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 tracking-tight leading-snug mb-2 transition-colors">
            <span onClick={handleOpenPost} className="text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {post.title}
            </span>
          </h3>

          {/* Writer name (no avatar), Date, Tag badge, YouTube & Facebook icons in the same line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-3 font-sans">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {displayedAuthor}
            </span>
            <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] sm:text-xs">
              {publishDate}
            </span>

            {/* Tag text between date and social media logos without background box */}
            <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
            <span className="card-category-tag text-xs font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
              {post.category || 'General'}
            </span>

            {(hasYt || hasFb) && (
              <div className="flex items-center space-x-1.5 ml-0.5">
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

          {/* Excerpt / Summary Description */}
          <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed mb-4">
            {previewText || <span className="italic text-slate-400 dark:text-slate-500">No text preview available.</span>}
          </p>
        </div>

        {/* Bottom bar: Liked & Disliked buttons, Views, and Read full article */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700 mt-auto" id="card-reactions">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={(e) => handleReaction('liked', e)}
              className={`reaction-btn-clean min-h-[44px] min-w-[44px] -ml-2 sm:ml-0 inline-flex items-center justify-center gap-1.5 px-2 text-xs font-sans font-medium transition-colors cursor-pointer bg-transparent border-0 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 ${
                myReaction === 'liked'
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
              title="Like this dispatch"
              type="button"
            >
              <ThumbsUp className={`h-4 w-4 ${myReaction === 'liked' ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-300'}`} />
              <span className="font-sans text-xs">{likes}</span>
            </button>

            <button
              onClick={(e) => handleReaction('disliked', e)}
              className={`reaction-btn-clean min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-2 text-xs font-sans font-medium transition-colors cursor-pointer bg-transparent border-0 rounded-lg hover:bg-slate-100/70 dark:hover:bg-slate-800/60 ${
                myReaction === 'disliked'
                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
              }`}
              title="Dislike this dispatch"
              type="button"
            >
              <ThumbsDown className={`h-4 w-4 ${myReaction === 'disliked' ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : 'text-slate-400 dark:text-slate-300'}`} />
              <span className="font-sans text-xs">{dislikes}</span>
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
