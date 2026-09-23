import React, { useState, useEffect } from 'react';
import { Post, slugify } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

interface BlogPostCardProps {
  post: Post;
  globalPenName?: string;
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

export default function BlogPostCard({ post, globalPenName }: BlogPostCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const previewText = getHtmlTextPreview(post.content);
  const displayedAuthor = post.authorName || globalPenName || 'Chronicle Staff Report';
  const postUrl = `/post/${post.id}/${slugify(post.title)}`;
  
  const [likes, setLikes] = useState(post.likes || 0);
  const [dislikes, setDislikes] = useState(post.dislikes || 0);
  const [myReaction, setMyReaction] = useState<'liked' | 'disliked' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`react_${post.id}`) as 'liked' | 'disliked' | null;
    setMyReaction(saved);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const reactionDocRef = doc(db, 'reactions', `${user.uid}_${post.id}`);
          const snap = await getDoc(reactionDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const serverType = data.type as 'liked' | 'disliked' | null;
            setMyReaction(serverType);
            if (serverType) {
              localStorage.setItem(`react_${post.id}`, serverType);
            } else {
              localStorage.removeItem(`react_${post.id}`);
            }
          } else {
            setMyReaction(null);
            localStorage.removeItem(`react_${post.id}`);
          }
        } catch (err) {
          console.warn('Failed to load user reaction from Firestore', err);
        }
      } else {
        setMyReaction(null);
      }
    });

    return () => unsubscribe();
  }, [post.id]);

  useEffect(() => {
    setLikes(post.likes || 0);
    setDislikes(post.dislikes || 0);
  }, [post.likes, post.dislikes]);

  const handleReaction = async (type: 'liked' | 'disliked', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      const confirmSignIn = window.confirm("To like or dislike this dispatch, you must be logged in. Would you like to sign in with your Google account now?");
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

    const postRef = doc(db, 'posts', post.id);
    const reactionRef = doc(db, 'reactions', `${user.uid}_${post.id}`);

    let newLikes = likes;
    let newDislikes = dislikes;
    let nextReaction: 'liked' | 'disliked' | null = null;

    let likesDiff = 0;
    let dislikesDiff = 0;

    if (myReaction === type) {
      // Undo reaction
      if (type === 'liked') {
        newLikes = Math.max(0, likes - 1);
        likesDiff = -1;
      } else {
        newDislikes = Math.max(0, dislikes - 1);
        dislikesDiff = -1;
      }
      localStorage.removeItem(`react_${post.id}`);
      nextReaction = null;
    } else {
      // Apply new reaction
      if (type === 'liked') {
        newLikes = likes + 1;
        likesDiff = 1;
        if (myReaction === 'disliked') {
          newDislikes = Math.max(0, dislikes - 1);
          dislikesDiff = -1;
        }
      } else {
        newDislikes = dislikes + 1;
        dislikesDiff = 1;
        if (myReaction === 'liked') {
          newLikes = Math.max(0, likes - 1);
          likesDiff = -1;
        }
      }
      localStorage.setItem(`react_${post.id}`, type);
      nextReaction = type;
    }

    setLikes(newLikes);
    setDislikes(newDislikes);
    setMyReaction(nextReaction);

    try {
      // Update reactions collection
      if (nextReaction === null) {
        await deleteDoc(reactionRef);
      } else {
        await setDoc(reactionRef, {
          userId: user.uid,
          userEmail: user.email || '',
          postId: post.id,
          type: nextReaction,
          updatedAt: new Date().toISOString()
        });
      }

      // Update post likes/dislikes counts
      const updates: Record<string, any> = {};
      if (likesDiff !== 0) updates.likes = increment(likesDiff);
      if (dislikesDiff !== 0) updates.dislikes = increment(dislikesDiff);
      if (Object.keys(updates).length > 0) {
        await updateDoc(postRef, updates);
      }
    } catch (err) {
      console.error('Failed to update reaction in Firestore', err);
      // Rollback on failure
      setLikes(likes);
      setDislikes(dislikes);
      setMyReaction(myReaction);
      if (myReaction === null) {
        localStorage.removeItem(`react_${post.id}`);
      } else {
        localStorage.setItem(`react_${post.id}`, myReaction);
      }
    }
  };

  // Format creation date elegantly
  let publishDate = 'Recent Post';
  if (post.createdAt) {
    const d = typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate() : new Date(post.createdAt);
    publishDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const hasYt = !!post.youtubeUrl && post.youtubeUrl.trim().length > 0;
  const hasFb = !!post.facebookUrl && post.facebookUrl.trim().length > 0;

  return (
    <article 
      onClick={() => navigate(postUrl)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(postUrl);
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
            <Link to={`/post/${post.id}/${slugify(post.title)}`} className="text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {post.title}
            </Link>
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
            onClick={(e) => e.stopPropagation()}
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
