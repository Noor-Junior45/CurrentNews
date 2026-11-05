import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Post, slugify } from '../types';
import { cleanImageUrl, getFallbackImageUrl, sanitizePostImages } from '../utils/imageUrl';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import { safeFormatDate } from '../utils/dateHelper';
import { updateDocumentSEO } from '../utils/seo';
import { api } from '../utils/api';
import { clientLoadBalancer } from '../utils/clientLoadBalancer';
import { getCompressedStory } from '../utils/compressedStorage';
import { reactionStore } from '../utils/reactionStore';

export default function LikedView() {
  const navigate = useNavigate();
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Saved Stories & Bookmarks — Current News Live',
      description: 'Review your bookmarked articles, saved reports, and favorited investigations on Current News Live.',
      canonicalPath: '/liked',
      robots: 'noindex, follow'
    });
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    let isMounted = true;

    const refreshLikedPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = auth.currentUser;
        const likedIdSet = new Set<string>();

        // 1. Live in-memory liked IDs from reactionStore (instant zero-delay)
        reactionStore.getLikedIds().forEach(id => likedIdSet.add(id));

        // 2. Fetch server-confirmed reactions if logged in
        if (user) {
          try {
            const serverLiked = await reactionStore.loadMyReactions();
            serverLiked.forEach(id => likedIdSet.add(id));
          } catch (e) {
            console.debug('Failed to fetch user liked posts from reactionStore:', e);
          }

          // Also check persistent user storage
          try {
            const stored = localStorage.getItem(`cn_react_${user.uid}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              for (const [id, type] of Object.entries(parsed)) {
                if (type === 'like') {
                  likedIdSet.add(id);
                }
              }
            }
          } catch (_) {}
        }

        // 3. Check guest storage for any liked posts
        try {
          const guestStored = localStorage.getItem('cn_react_guest');
          if (guestStored) {
            const parsed = JSON.parse(guestStored);
            for (const [id, type] of Object.entries(parsed)) {
              if (type === 'like') {
                likedIdSet.add(id);
              }
            }
          }
        } catch (_) {}

        // 4. Legacy react_ keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('react_')) {
            const val = localStorage.getItem(key);
            if (val === 'liked') {
              const id = key.replace('react_', '');
              likedIdSet.add(id);
            }
          }
        }

        // 5. Exclude any post that was unliked or disliked locally
        const finalLikedIds: string[] = [];
        for (const id of Array.from(likedIdSet)) {
          const currentReaction = reactionStore.getReaction(id);
          // If explicitly set to dislike or null after tap, skip it
          if (currentReaction === 'dislike') continue;
          if (currentReaction === null && reactionStore.hasPendingOrRecentChange(id)) continue;
          finalLikedIds.push(id);
        }

        if (finalLikedIds.length === 0) {
          if (isMounted) {
            setLikedPosts([]);
            setLoading(false);
          }
          return;
        }

        // Fetch articles using light feed and client load balancer
        let feedPosts: Post[] = [];
        try {
          const res = await clientLoadBalancer.fetchArticlesFeed({ limit: 100 });
          feedPosts = res.posts || [];
        } catch (_) {}

        const feedMap = new Map<string, Post>();
        for (const p of feedPosts) {
          feedMap.set(p.id, p);
        }

        const list: Post[] = [];
        for (const id of finalLikedIds) {
          if (feedMap.has(id)) {
            list.push(sanitizePostImages(feedMap.get(id)!));
          } else {
            const cached = getCompressedStory(id);
            if (cached) {
              list.push(sanitizePostImages(cached));
            } else {
              try {
                const { post: fetchedPost } = await clientLoadBalancer.fetchArticleById(id);
                if (fetchedPost) {
                  list.push(sanitizePostImages(fetchedPost));
                }
              } catch (_) {}
            }
          }
        }

        if (isMounted) {
          setLikedPosts(list);
        }
      } catch (err) {
        console.error('Failed to fetch liked posts', err);
        if (isMounted) {
          setError('Unable to load your liked dispatches. Make sure your network connection is active.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    refreshLikedPosts();

    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      refreshLikedPosts();
    });

    const unsubscribeReaction = reactionStore.subscribe(() => {
      refreshLikedPosts();
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeReaction();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950" id="liked-articles-view">
      {/* Top Header with liquid glass Back button and short heading */}
      <ProfilePageNavbar title="Liked" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4" id="liked-loading">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono tracking-wide text-slate-400 animate-pulse">
            Decrypting liked dispatches database...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl" id="liked-error">
          <p className="text-sm font-sans font-medium text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : likedPosts.length === 0 ? (
        <div 
          className="p-10 text-center bg-slate-50/65 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800" 
          id="liked-empty-state"
        >
          <BookOpen className="h-12 w-12 text-slate-350 mx-auto mb-4 stroke-[1.5]" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-250 font-mono tracking-wide">
            Your ledger index is vacant
          </h3>
          <div className="mt-6">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1 text-xs font-semibold font-mono text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Start Curating Articles
            </Link>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800" id="liked-posts-list">
          {likedPosts.map((post) => {
            // Get raw text preview
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.content || '';
            const rawText = tempDiv.textContent || tempDiv.innerText || '';
            const preview = rawText.substring(0, 140).trim() + (rawText.length > 140 ? '...' : '');

            const thumbUrl = cleanImageUrl(post.imageUrl);

            return (
              <article 
                key={post.id}
                onClick={() => navigate(`/post/${post.id}/${slugify(post.title)}`)}
                tabIndex={0}
                role="link"
                className="group py-4 sm:py-5 flex items-start gap-4 sm:gap-6 transition-colors cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/30 rounded-lg px-2 -mx-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                id={`liked-item-${post.id}`}
              >
                {/* Compact Thumbnail Image */}
                {thumbUrl && (
                  <div
                    className="w-24 sm:w-32 h-20 sm:h-24 rounded-lg overflow-hidden shrink-0 border border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 block relative"
                  >
                    <img 
                      src={thumbUrl} 
                      alt={post.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fb = getFallbackImageUrl(post.imageUrl, post.imageUrlFallback);
                        if (fb && target.src !== fb && !fb.startsWith('data:')) {
                          target.src = fb;
                        } else {
                          const parent = target.parentElement;
                          if (parent) {
                            parent.style.display = 'none';
                          } else {
                            target.style.display = 'none';
                          }
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Article Info in compact stack */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {post.category || 'General'}
                      </span>
                      {post.readTime && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
                          <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{post.readTime} min read</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="font-sans font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight leading-snug line-clamp-2">
                      {post.title}
                    </h3>

                    {preview && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans mt-1 line-clamp-2 hidden sm:block">
                        {preview}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    <span>
                      {safeFormatDate(post?.createdAt, { month: 'short', day: 'numeric', year: 'numeric' }, '')}
                    </span>
                    <span 
                      className="text-indigo-600 dark:text-indigo-400 group-hover:underline text-xs font-semibold shrink-0 py-1"
                    >
                      Read Article →
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      </div>
    </div>
  );
}
