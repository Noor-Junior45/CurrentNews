import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { Post } from '../types';
import { sanitizePostImages } from '../utils/imageUrl';
import { getCompressedStories } from '../utils/compressedStorage';
import { api } from '../utils/api';
import { clientLoadBalancer } from '../utils/clientLoadBalancer';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import AdminAuthGuard from '../components/AdminAuthGuard';
import { updateDocumentSEO } from '../utils/seo';
import { 
  Cloud, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Edit3, 
  PlusCircle, 
  Newspaper, 
  Mail, 
  TrendingUp, 
  Clock, 
  Share2 
} from 'lucide-react';

export default function AdminDashboardView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

  // Global Pen Name dynamic profile fields
  const [globalPenName, setGlobalPenName] = useState<string>(() => {
    return localStorage.getItem('current_news_pen_name_global') || '';
  });
  const [tempPenName, setTempPenName] = useState<string>(() => {
    return localStorage.getItem('current_news_pen_name_global') || '';
  });
  const [isSavingPenName, setIsSavingPenName] = useState<boolean>(false);
  const [showPenNameModal, setShowPenNameModal] = useState<boolean>(false);

  // Cloudflare R2 zero-quota article sync state
  const [isSyncingR2, setIsSyncingR2] = useState(false);
  const [r2SyncFeedback, setR2SyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    updateDocumentSEO({
      title: 'Admin Dashboard — Current News Live',
      description: 'Current News Live autonomous publishing desk and story manager.',
      canonicalPath: '/admin',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const loadData = async () => {
    if (!user) return;
    setFeedLoading(true);
    try {
      // 1. Fetch user pen name (Worker D1 with local cache fallback)
      try {
        const cloudPenName = await api.getUserPenName();
        if (cloudPenName) {
          setGlobalPenName(cloudPenName);
          setTempPenName(cloudPenName);
          try {
            localStorage.setItem(`current_news_pen_name_${user.uid}`, cloudPenName);
            localStorage.setItem('current_news_pen_name_global', cloudPenName);
          } catch (_) {}
        }
      } catch (err: any) {
        console.debug('Could not load pen name from Worker D1, checking local storage:', err);
        try {
          const cached = localStorage.getItem(`current_news_pen_name_${user.uid}`) || localStorage.getItem('current_news_pen_name_global');
          if (cached) {
            setGlobalPenName(cached);
            setTempPenName(cached);
          }
        } catch (_) {}
      }

      // 2. Fetch subscribers
      try {
        const fetchedSubs = await api.getSubscribersAdmin();
        setSubscribers(fetchedSubs.map(s => ({ id: s.email, email: s.email, createdAt: s.created_at })));
      } catch (subErr: any) {
        console.debug('Could not load subscribers from Worker D1:', subErr);
      }

      // 3. Fetch posts from Light Feed & Local Disk / R2 Mirror
      let fetched: Post[] = [];
      try {
        const feedRes = await fetch('/api/articles/feed');
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          if (Array.isArray(feedData.articles)) {
            fetched = feedData.articles.map(sanitizePostImages);
          }
        }
        if (fetched.length === 0) {
          const { posts: feedPosts } = await clientLoadBalancer.fetchArticlesFeed({ limit: 100 });
          fetched = feedPosts.map(sanitizePostImages);
        }
      } catch (postErr: any) {
        console.debug('Posts query notice, checking local cache:', postErr);
        const compressed = getCompressedStories();
        if (compressed && compressed.length > 0) {
          fetched = compressed.map(sanitizePostImages);
        }
      }

      // Filter publications so author only sees their own posts
      const ownPosts = fetched.filter(p => {
        if (p.authorEmail) {
          return p.authorEmail.toLowerCase() === user?.email?.toLowerCase();
        }
        return isAdmin;
      });

      setPosts(ownPosts);
    } catch (err: any) {
      console.warn('Dashboard load notice:', err);
      // Fallback to local cache so dashboard never breaks
      const compressed = getCompressedStories();
      if (compressed && compressed.length > 0) {
        setPosts(compressed.map(sanitizePostImages));
      }
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin]);

  const handleSavePenName = async () => {
    if (!tempPenName.trim()) {
      setErrorMsg('Pen name cannot be empty.');
      return;
    }
    if (!user) return;

    const trimmed = tempPenName.trim();
    setIsSavingPenName(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Save to local cache first so UI responds immediately
    try {
      localStorage.setItem(`current_news_pen_name_${user.uid}`, trimmed);
      localStorage.setItem('current_news_pen_name_global', trimmed);
    } catch (_) {}

    try {
      await api.setUserPenName(trimmed);

      setGlobalPenName(trimmed);
      setShowPenNameModal(false);
      setSuccessMsg('Author byline pen name saved successfully to Cloudflare D1.');
    } catch (err: any) {
      console.error('Failed to save pen name:', err);
      setErrorMsg('Could not save pen name to database. Saved in local cache.');
    } finally {
      setIsSavingPenName(false);
    }
  };

  const handleSyncToR2 = async () => {
    setIsSyncingR2(true);
    setR2SyncFeedback(null);
    setErrorMsg(null);

    try {
      const feedRes = await fetch('/api/articles/feed');
      const feedData = feedRes.ok ? await feedRes.json() : {};
      const allPosts = Array.isArray(feedData.articles) ? feedData.articles : [];

      const response = await fetch('/api/articles/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: allPosts })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setR2SyncFeedback(`Successfully verified ${result.synced || allPosts.length} articles in Cloudflare R2.`);
      } else {
        throw new Error(result.error || 'Failed to sync articles to Cloudflare R2.');
      }
    } catch (err: any) {
      console.error('R2 sync notice:', err);
      setErrorMsg(err.message || 'Error occurred while mirroring articles to Cloudflare R2.');
    } finally {
      setIsSyncingR2(false);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-white dark:bg-slate-950" id="admin-dashboard-view">
        <ProfilePageNavbar 
          title="Admin Dashboard" 
          fallbackUrl="/profile" 
          onBack={() => navigate('/profile')} 
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notifications */}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 text-green-800 dark:text-green-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-sans font-medium">{successMsg}</span>
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
                <span className="text-sm font-sans font-medium">{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isQuotaExceeded && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200 rounded-xl shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1 text-sm font-sans space-y-1">
                  <div className="font-bold font-display text-amber-900 dark:text-amber-100">
                    Firestore Daily Read Quota Exceeded
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300 leading-relaxed">
                    The database has reached the free tier daily read quota limit (50,000 daily read units). Cached dispatches and locally saved pen names remain active. Quota resets daily at midnight PST.
                  </p>
                  <div className="pt-2">
                    <a 
                      href="https://console.firebase.google.com/project/gen-lang-client-0638643565/firestore/databases/ai-studio-6e2ba5e1-c245-4586-90fd-9ba4777b81c4/data?openUpgradeDialog=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold transition-colors"
                    >
                      Open Firebase Console Upgrade Dialog &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-10" id="segment-dashboard-body">
            {/* Cloudflare R2 Zero-Quota Article Storage Engine */}
            <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-amber-50/40 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-stone-900 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6" id="cloudflare-r2-engine">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] bg-blue-600 text-white font-bold font-mono px-2 py-0.5 rounded-sm uppercase tracking-wider inline-flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> Cloudflare R2 Active
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold font-mono px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    Zero Firestore Read Quota
                  </span>
                </div>
                <h3 className="text-lg font-display font-black text-slate-900 dark:text-white mb-1">
                  High-Throughput Global Edge Mirror
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  Public reader traffic is served via Cloudflare R2 and Edge CDN (<code>media.currentnews.blog</code>). Firestore is reserved for editorial writes.
                </p>
                {r2SyncFeedback && (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-4 h-4" />
                    <span>{r2SyncFeedback}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleSyncToR2}
                  disabled={isSyncingR2}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:bg-blue-400 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingR2 ? 'animate-spin' : ''}`} />
                  <span>{isSyncingR2 ? 'Mirroring to Edge...' : 'Mirror All Stories to R2'}</span>
                </button>
              </div>
            </div>

            {/* Quick Action Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Link
                to="/admin/draft"
                className="p-6 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/60 rounded-2xl shadow-xs transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <h4 className="font-display font-bold text-base text-slate-900 dark:text-white mb-1.5">
                    Draft New Publication
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    Compose new investigative reports, attach photos, configure embeds, and publish live dispatches.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-4 group-hover:translate-x-1 transition-transform">
                  Open Composer &rarr;
                </span>
              </Link>

              <Link
                to="/admin/publications"
                className="p-6 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-amber-950/20 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/60 rounded-2xl shadow-xs transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <h4 className="font-display font-bold text-base text-slate-900 dark:text-white mb-1.5">
                    Current Publications
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    Browse, filter, edit, or remove all live publications and draft manuscripts ({posts.length} records).
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 mt-4 group-hover:translate-x-1 transition-transform">
                  Manage Ledger &rarr;
                </span>
              </Link>

              <Link
                to="/admin/audience"
                className="p-6 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/60 rounded-2xl shadow-xs transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h4 className="font-display font-bold text-base text-slate-900 dark:text-white mb-1.5">
                    Audience Registry
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    View registered citizen subscriber emails, verify push notification devices, and test email circulars.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-4 group-hover:translate-x-1 transition-transform">
                  View Registry &rarr;
                </span>
              </Link>
            </div>

            {/* Author Pen Name Configuration Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold font-mono uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block mb-1">
                  Editorial Author Byline
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Active Pen Name:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 underline-offset-4">
                    {globalPenName || user?.displayName || 'Current News'}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  This custom byline is automatically applied to your published stories and RSS dispatches.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTempPenName(globalPenName || user?.displayName || 'Current News');
                  setShowPenNameModal(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors inline-flex items-center gap-2 cursor-pointer self-start md:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Configure Pen Name</span>
              </button>
            </div>

            {/* Platform Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-slate-400 dark:text-slate-500 tracking-wider block">Live Active Dispatches</span>
                  <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                    {posts.filter(p => p.status === 'published').length}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                    Broadcasting in feed
                  </span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-slate-400 dark:text-slate-500 tracking-wider block">Draft Manuscripts</span>
                  <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                    {posts.filter(p => p.status === 'draft').length}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 block">
                    Saved in work queue
                  </span>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-slate-400 dark:text-slate-500 tracking-wider block">Media Broadcasts</span>
                  <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                    {posts.filter(p => (!!p.youtubeUrl && p.youtubeUrl.trim() !== '') || (!!p.facebookUrl && p.facebookUrl.trim() !== '')).length}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
                    Natively embed feeds
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  <Share2 className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-indigo-500 dark:text-indigo-400 tracking-wider block">Audience Subscribers</span>
                  <span className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 block">
                    {subscribers.length}
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 block">
                    Natively registered audience
                  </span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-100/60 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                  <Mail className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configure Pen Name Modal */}
        {showPenNameModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Configure Author Pen Name
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPenNameModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Specify the byline name you wish to appear on all newly drafted articles, press releases, and editorial dispatches.
              </p>

              <input
                type="text"
                value={tempPenName}
                onChange={(e) => setTempPenName(e.target.value)}
                placeholder="e.g. Current News Editorial Staff"
                maxLength={60}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 mb-5 font-medium"
              />

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPenNameModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePenName}
                  disabled={isSavingPenName}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:bg-indigo-400 cursor-pointer"
                >
                  {isSavingPenName ? 'Saving...' : 'Save Pen Name'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminAuthGuard>
  );
}
