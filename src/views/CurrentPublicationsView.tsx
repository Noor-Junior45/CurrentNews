import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { Post, slugify } from '../types';
import { cleanImageUrl, sanitizePostImages } from '../utils/imageUrl';
import { getCompressedStories } from '../utils/compressedStorage';
import { safeFormatDate } from '../utils/dateHelper';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import AdminAuthGuard from '../components/AdminAuthGuard';
import { updateDocumentSEO } from '../utils/seo';
import { 
  PlusCircle, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Clock, 
  Newspaper 
} from 'lucide-react';

export default function CurrentPublicationsView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [pubListFilter, setPubListFilter] = useState<'all' | 'published' | 'drafts'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Current Publications — Current News Live',
      description: 'Manage and review published dispatches and draft manuscripts.',
      canonicalPath: '/admin/publications',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const fetchAdminPosts = async () => {
    if (!user) return;
    setFeedLoading(true);
    try {
      let fetched: Post[] = [];
      try {
        const feedRes = await fetch('/api/articles/feed');
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          if (Array.isArray(feedData.articles)) {
            fetched = feedData.articles.map(sanitizePostImages);
          }
        }
      } catch (feedErr) {
        console.debug('Feed fetch notice, checking local cache:', feedErr);
      }

      if (fetched.length === 0) {
        const compressed = getCompressedStories();
        if (compressed && compressed.length > 0) {
          fetched = compressed.map(sanitizePostImages);
        }
      }

      const ownPosts = fetched.filter(p => {
        if (p.authorEmail) {
          return p.authorEmail.toLowerCase() === user.email?.toLowerCase();
        }
        return isAdmin;
      });
      setPosts(ownPosts);
    } catch (err) {
      console.warn('Publications fetch warning:', err);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchAdminPosts();
    }
  }, [user, isAdmin]);

  const handleDeletePost = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // Remove from Cloudflare R2 and local disk mirror
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Failed to delete post: HTTP ${res.status}`);
      }

      setPosts(prev => prev.filter(p => p.id !== id));
      setSuccessMsg('Story deleted successfully from Cloudflare R2 and feed.');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete story. Permissions check required.');
    }
  };

  const filteredPosts = posts.filter(post => {
    if (pubListFilter === 'published') return post.status === 'published';
    if (pubListFilter === 'drafts') return post.status === 'draft';
    return true;
  });

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans" id="current-publications-view">
        <ProfilePageNavbar 
          title="Current Publications" 
          fallbackUrl="/profile" 
          onBack={() => navigate('/profile')} 
          rightAction={
            <Link
              to="/admin/draft"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Draft</span>
            </Link>
          }
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notifications */}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 text-green-800 dark:text-green-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 dark:text-green-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Filter Switcher and Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 mb-6">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
              {(['all', 'published', 'drafts'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPubListFilter(mode)}
                  className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                    pubListFilter === mode
                      ? 'bg-slate-950 dark:bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mode === 'all' && `All (${posts.length})`}
                  {mode === 'published' && `Published (${posts.filter(p => p.status === 'published').length})`}
                  {mode === 'drafts' && `Drafts (${posts.filter(p => p.status === 'draft').length})`}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Manage, edit, or delete your publications and drafts.
            </p>
          </div>

          {/* Publications List */}
          {feedLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white mb-3" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Loading publications ledger...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Newspaper className="h-12 w-12 text-slate-400 mx-auto mb-3 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                No publications found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-sm mx-auto">
                {pubListFilter === 'drafts' 
                  ? 'You currently have no draft manuscripts saved.' 
                  : pubListFilter === 'published'
                  ? 'No published stories found under your editorial byline.'
                  : 'Start reporting by composing your first publication draft.'}
              </p>
              <Link
                to="/admin/draft"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Story</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Thumbnail */}
                    {post.imageUrl ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/60 dark:border-slate-700">
                        <img 
                          src={cleanImageUrl(post.imageUrl)} 
                          alt={post.title} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-slate-400 border border-slate-200/60 dark:border-slate-700">
                        <Newspaper className="w-6 h-6 opacity-40" />
                      </div>
                    )}

                    {/* Metadata & Headline */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                          post.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                        }`}>
                          {post.status === 'published' ? 'Live' : 'Draft'}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
                          {post.category || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {safeFormatDate(post.createdAt)}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {post.title}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        By {post.authorName || 'Current News'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {post.status === 'published' && (
                      <Link
                        to={`/post/${post.id}/${slugify(post.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="View Live Article"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    )}

                    <Link
                      to={`/admin/draft?id=${post.id}`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(post.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Publication"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white mb-2">
                Permanently Delete Publication?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                This action is irreversible. The article will be immediately removed from Cloudflare R2 Edge CDN, Firestore, and search feeds.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePost(deleteConfirmId)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}
