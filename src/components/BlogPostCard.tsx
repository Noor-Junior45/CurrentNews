import React, { useState, useEffect } from 'react';
import { Post, slugify } from '../types';
import { Link } from 'react-router-dom';
import { Calendar, Youtube, Facebook, ArrowRight, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

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
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  const excerpt = tempDiv.textContent || tempDiv.innerText || '';
  if (excerpt.length <= maxLength) return excerpt;
  return excerpt.substring(0, maxLength).trim() + '...';
}

export default function BlogPostCard({ post, globalPenName }: BlogPostCardProps): React.JSX.Element {
  const previewText = getHtmlTextPreview(post.content);
  const displayedAuthor = post.authorName || globalPenName || 'Chronicle Staff Report';
  
  const [likes, setLikes] = useState(post.likes || 0);
  const [dislikes, setDislikes] = useState(post.dislikes || 0);
  const [myReaction, setMyReaction] = useState<'liked' | 'disliked' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`react_${post.id}`) as 'liked' | 'disliked' | null;
    setMyReaction(saved);
  }, [post.id]);

  useEffect(() => {
    setLikes(post.likes || 0);
    setDislikes(post.dislikes || 0);
  }, [post.likes, post.dislikes]);

  const handleReaction = async (type: 'liked' | 'disliked', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!auth.currentUser) {
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
      const updates: Record<string, any> = {};
      if (likesDiff !== 0) updates.likes = increment(likesDiff);
      if (dislikesDiff !== 0) updates.dislikes = increment(dislikesDiff);
      if (Object.keys(updates).length > 0) {
        await updateDoc(postRef, updates);
      }
    } catch (err) {
      console.error('Failed to update likes/dislikes in database', err);
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
      className="group bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
      id={`post-card-${post.id}`}
    >
      <div className="p-4 sm:p-6">
        
        {/* Meta badges/info */}
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-4 font-mono">
          <span className="flex items-center space-x-1">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>{publishDate}</span>
          </span>

          <div className="flex items-center space-x-2">
            <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700">
              {post.category || 'General'}
            </span>
            {hasYt && (
              <span className="p-1 rounded-sm bg-red-50 dark:bg-red-950/20 flex items-center justify-center" title="YouTube video attached">
                <svg className="h-4 w-4 fill-[#FF0000]" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.513 3.545 12 3.545 12 3.545s-7.513 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.875.508 9.388.508 9.388.508s7.513 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </span>
            )}
            {hasFb && (
              <span className="p-1 rounded-sm bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center" title="Facebook reference attached">
                <svg className="h-4 w-4 fill-[#1877F2]" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-lg sm:text-xl text-slate-900 group-hover:text-indigo-600 tracking-tight leading-snug mb-3 transition-colors">
          <Link to={`/post/${post.id}/${slugify(post.title)}`}>{post.title}</Link>
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed mb-4">
          {previewText || <span className="italic text-slate-400">No text preview available.</span>}
        </p>

        {/* Reactions Toolbar */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100/60" id="card-reactions">
          <button
            onClick={(e) => handleReaction('liked', e)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all border cursor-pointer ${
              myReaction === 'liked'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-3xs'
                : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-slate-200/60'
            }`}
            title="Like this dispatch"
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${myReaction === 'liked' ? 'fill-emerald-600 animate-pulse' : ''}`} />
            <span className="font-sans">{likes}</span>
          </button>

          <button
            onClick={(e) => handleReaction('disliked', e)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all border cursor-pointer ${
              myReaction === 'disliked'
                ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-3xs'
                : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-slate-200/60'
            }`}
            title="Dislike this dispatch"
          >
            <ThumbsDown className={`h-3.5 w-3.5 ${myReaction === 'disliked' ? 'fill-rose-600' : ''}`} />
            <span className="font-sans">{dislikes}</span>
          </button>

          {/* Elegant Views Counter beside reactions */}
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium ml-auto" title="Total article views">
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-sans">{post.views || 0}</span>
          </div>
        </div>

      </div>

      <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img 
            src="https://i.imgur.com/gq2X5nE.jpeg" 
            alt="Author DP" 
            className="h-6 w-6 rounded-full object-cover border border-slate-200"
            referrerPolicy="no-referrer"
          />
          <span className="text-[11px] font-semibold text-slate-500">
            {displayedAuthor}
          </span>
        </div>
        <Link 
          to={`/post/${post.id}/${slugify(post.title)}`} 
          className="text-slate-900 group-hover:text-indigo-600 font-sans text-xs font-semibold uppercase tracking-wider flex items-center space-x-1 transition-colors"
        >
          <span>Read Full Article</span>
          <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

    </article>
  );
}
