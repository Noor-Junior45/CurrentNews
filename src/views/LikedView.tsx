import { useEffect, useState } from 'react';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Post, slugify } from '../types';
import { cleanImageUrl, getFallbackImageUrl, sanitizePostImages } from '../utils/imageUrl';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Tag } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function LikedView() {
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

        // Limit to 30 for safety/firestore limitations on 'in' operators
        const subsetIds = likedIds.slice(0, 30);
        const q = query(
          collection(db, 'posts'),
          where(documentId(), 'in', subsetIds)
        );
        
        const snapshot = await getDocs(q);
        const list: Post[] = [];
        snapshot.forEach(docSnap => {
          list.push(sanitizePostImages({ id: docSnap.id, ...docSnap.data() } as Post));
        });

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
        <div className="grid gap-4 sm:gap-6" id="liked-posts-grid">
          {likedPosts.map((post) => {
            // Get raw text preview
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.content || '';
            const rawText = tempDiv.textContent || tempDiv.innerText || '';
            const preview = rawText.substring(0, 180).trim() + (rawText.length > 180 ? '...' : '');

            const thumbUrl = cleanImageUrl(post.imageUrl);

            return (
              <div 
                key={post.id}
                className="group p-5 bg-white dark:bg-slate-905 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-3xs hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-705 transition-all duration-200 flex flex-col sm:flex-row gap-5"
                id={`liked-card-${post.id}`}
              >
                {thumbUrl && (
                  <div className="w-full sm:w-40 h-28 sm:h-auto rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <img 
                      src={thumbUrl} 
                      alt={post.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
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
                
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-medium capitalize bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/40 dark:border-indigo-900/40 px-2 py-0.5 rounded">
                        <Tag className="h-2 w-2" />
                        <span>{post.category || 'General'}</span>
                      </span>
                      {post.readTime && (
                        <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{post.readTime} min read</span>
                        </span>
                      )}
                    </div>

                    <Link 
                      to={`/post/${post.id}/${slugify(post.title)}`}
                      className="block hover:text-indigo-600 transition-colors"
                    >
                      <h3 className="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100 tracking-tight leading-tight group-hover:text-indigo-600">
                        {post.title}
                      </h3>
                    </Link>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans mt-2 line-clamp-2">
                      {preview}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4 text-[11px] font-mono font-medium text-slate-400">
                    <span>
                      Published: {post.createdAt ? (typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date(post.createdAt).toLocaleDateString()) : 'N/A'}
                    </span>
                    <Link 
                      to={`/post/${post.id}/${slugify(post.title)}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Read Dispatch</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>
    </div>
  );
}
