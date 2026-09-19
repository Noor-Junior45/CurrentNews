import { useEffect, useState } from 'react';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Post, slugify } from '../types';
import { cleanImageUrl, getFallbackImageUrl, sanitizePostImages } from '../utils/imageUrl';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function LikedView() {
  const navigate = useNavigate();
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null);
      try {
        let likedIds: string[] = [];

        if (user) {
          // Fetch reactions from Firestore
          const reactionsQuery = query(
            collection(db, 'reactions'),
            where('userId', '==', user.uid),
            where('type', '==', 'liked')
          );
          const reactionSnapshot = await getDocs(reactionsQuery);
          reactionSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.postId) {
              likedIds.push(data.postId);
            }
          });
        }

        // Fallback to localStorage if the user is a guest or we didn't find any Firestore liked posts yet
        if (likedIds.length === 0) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('react_')) {
              const val = localStorage.getItem(key);
              if (val === 'liked') {
                const id = key.replace('react_', '');
                if (!likedIds.includes(id)) {
                  likedIds.push(id);
                }
              }
            }
          }
        }

        if (likedIds.length === 0) {
          setLikedPosts([]);
          setLoading(false);
          return;
        }

        // Firestore 'in' operator max is 30 IDs per query. Chunk IDs into groups of 30 to fetch all liked articles for long scrolling
        const chunkSize = 30;
        const chunks: string[][] = [];
        for (let i = 0; i < likedIds.length; i += chunkSize) {
          chunks.push(likedIds.slice(i, i + chunkSize));
        }

        const list: Post[] = [];
        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          const q = query(
            collection(db, 'posts'),
            where(documentId(), 'in', chunk)
          );
          const snapshot = await getDocs(q);
          snapshot.forEach(docSnap => {
            list.push(sanitizePostImages({ id: docSnap.id, ...docSnap.data() } as Post));
          });
        }

        setLikedPosts(list);
      } catch (err) {
        console.error('Failed to fetch liked posts', err);
        setError('Unable to load your liked dispatches. Make sure your network connection is active.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl" id="liked-error">
          <p className="text-sm font-sans font-medium text-red-700">{error}</p>
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
                        if (fb && target.src !== fb) {
                          target.src = fb;
                        } else {
                          const defaultEmblem = 'https://i.imgur.com/gFgShoZ.jpeg';
                          if (target.src !== defaultEmblem) {
                            target.src = defaultEmblem;
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
                      {post.createdAt ? (typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date(post.createdAt).toLocaleDateString()) : ''}
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
