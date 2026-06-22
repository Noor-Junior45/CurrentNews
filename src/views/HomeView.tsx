import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, slugify } from '../types';
import BlogPostCard from '../components/BlogPostCard';
import { Newspaper, Search, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, ThumbsUp } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

function getHtmlTextPreview(htmlString: string, maxLength: number = 160): string {
  if (!htmlString) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  const excerpt = tempDiv.textContent || tempDiv.innerText || '';
  if (excerpt.length <= maxLength) return excerpt;
  return excerpt.substring(0, maxLength).trim() + '...';
}

function BlogPostCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-3xs p-6 flex flex-col justify-between h-[255px] animate-pulse">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-slate-100 rounded-md w-24"></div>
          <div className="h-5 bg-slate-100/90 rounded-md w-16"></div>
        </div>
        
        <div className="h-5.5 bg-slate-150 rounded-md w-11/12 mb-2.5"></div>
        <div className="h-5.5 bg-slate-150 rounded-md w-8/12 mb-4"></div>
        
        <div className="space-y-2 mb-4">
          <div className="h-3 bg-slate-100/80 rounded-md w-full"></div>
          <div className="h-3 bg-slate-100/80 rounded-md w-11/12"></div>
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 rounded-full bg-slate-100"></div>
          <div className="h-3.5 bg-slate-100 rounded-md w-16"></div>
        </div>
        <div className="h-3.5 bg-slate-100 rounded-md w-24"></div>
      </div>
    </div>
  );
}

export default function HomeView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [globalPenName, setGlobalPenName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'All';
  const setSelectedCategory = (cat: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (cat === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', cat);
    }
    setSearchParams(nextParams);
  };
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 20;

  // Reset to first page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    const path = 'posts';
    try {
      // Recover dynamic editor pen name
      try {
        const docSettings = await getDoc(doc(db, 'settings', 'editorProfile'));
        if (docSettings.exists()) {
          setGlobalPenName(docSettings.data().penName || '');
        }
      } catch (settingsErr) {
        console.warn('Failed to load global profile name', settingsErr);
      }

      const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const fetchedPosts: Post[] = [];
      querySnapshot.forEach((doc) => {
        fetchedPosts.push({
          id: doc.id,
          ...doc.data()
        } as Post);
      });
      setPosts(fetchedPosts);
    } catch (err) {
      console.error(err);
      setError('Could not retrieve publications. Please make sure the database is provisioned and active.');
      // Handle the error specifically according to Firestore guidelines with rich JSON
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrappedErr) {
        // Suppress breaking exception to let state handle gracefully in the UI
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const filteredPosts = posts.filter((post) => {
    // Hide drafts from general public readers
    if (post.status === 'draft') return false;

    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      post.title.toLowerCase().includes(term) ||
      post.content.toLowerCase().includes(term)
    );
    if (selectedCategory === 'All') {
      return matchesSearch;
    }
    const postCategory = post.category || 'General';
    return matchesSearch && postCategory.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Calculate dynamic trending posts: must have at least 100 likes and surpass others (sorted descending)
  const trendingPosts = posts
    .filter((p) => p.status !== 'draft' && (p.likes || 0) >= 100)
    .sort((a, b) => (b.likes || 0) - (a.likes || 0));

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const paginatedPosts = filteredPosts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="homepage-view">
      
      {/* Editorial Headline Hero Banner */}
      <div className="border-b-4 border-double border-slate-900 pb-10 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-widest block mb-2">Today's Dispatch</span>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-slate-950 tracking-tight leading-none flex items-center gap-3">
            <Newspaper className="h-10 w-10 text-slate-900 shrink-0" />
            <span>CURRENT NEWS LIVE</span>
          </h1>
          <p className="text-sm text-slate-500 mt-3 font-sans max-w-xl">
            Read critical, up-to-date insights, independent coverages, and reports of global scale from our field editors.
          </p>
        </div>

        {/* Searching & Live Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className={`relative flex items-center transition-all duration-300 ${isSearchExpanded || searchTerm ? 'w-full md:w-72' : 'w-10 animate-fade-in'}`}>
            {isSearchExpanded || searchTerm ? (
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search major articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:border-transparent transition-all shadow-xs"
                  id="search-input"
                  autoFocus
                />
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setIsSearchExpanded(false);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
                  title="Clear & Close Search"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 bg-white shadow-xs cursor-pointer transition-colors flex items-center justify-center w-10 h-10 shrink-0"
                title="Search dispatches"
              >
                <Search className="h-4.5 w-4.5 text-slate-800" />
              </button>
            )}
          </div>
          <button 
            onClick={fetchPosts}
            title="Refresh feed"
            className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 bg-white shadow-xs cursor-pointer transition-colors w-10 h-10 flex items-center justify-center shrink-0"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 🚀 Dynamic Trending Spotlight */}
      {trendingPosts.length > 0 && (
         <div className="mb-10 p-6 bg-amber-50/40 border border-amber-200/50 rounded-2xl shadow-3xs" id="trending-spotlight-section">
           <div className="flex items-center space-x-2 mb-4">
             <span className="flex h-2.5 w-2.5 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
             </span>
             <h3 className="font-display font-extrabold text-sm text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
               <span>🔥 Trending Reader Favorites</span>
             </h3>
             <span className="text-[10px] text-slate-400 font-mono font-bold">(Articles with over hundreds of upvotes that surpass all others)</span>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
             {trendingPosts.map((trendingPost, idx) => {
               const preview = getHtmlTextPreview(trendingPost.content, 90);
               return (
                 <Link
                   key={trendingPost.id}
                   to={`/post/${trendingPost.id}/${slugify(trendingPost.title)}`}
                   className="group bg-white p-4 rounded-xl border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all duration-300 flex flex-col justify-between cursor-pointer"
                 >
                   <div>
                     <div className="flex items-center justify-between gap-1.5 mb-2.5">
                       <span className="text-[9px] font-mono bg-amber-100 text-amber-900 border border-amber-200/50 uppercase font-black px-1.5 py-0.5 rounded">
                         #{idx + 1} HOT
                       </span>
                       <span className="text-[10px] text-slate-500 font-bold font-mono flex items-center gap-1">
                         <ThumbsUp className="h-3 w-3 text-emerald-500 fill-emerald-100" /> {trendingPost.likes || 0}
                       </span>
                     </div>
                     <h4 className="font-display font-bold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                       {trendingPost.title}
                     </h4>
                     <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                       {preview}
                     </p>
                   </div>
                   <div className="mt-3 pt-2.5 border-t border-slate-150 flex items-center justify-between text-[10px] text-slate-400 font-semibold font-mono">
                     <span className="bg-slate-100 text-slate-600 text-[8px] font-bold uppercase tracking-wider px-1 px-1.5 rounded">{trendingPost.category || 'General'}</span>
                     <span className="text-indigo-600 group-hover:underline flex items-center gap-0.5">Read article →</span>
                   </div>
                 </Link>
               );
             })}
           </div>
         </div>
      )}

      {/* Category Filter Tabs with dynamic soft cream selection and bottom line indicator */}
      <div className="sticky top-[72px] z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/80 dark:bg-slate-900/95 dark:border-slate-800/80 py-2 mb-8 shadow-3xs px-4 -mx-4 sm:-mx-8 lg:-mx-8" id="category-filter-header">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto pb-0.5 scroll-smooth no-scrollbar" id="category-filter-tabs">
          {['All', 'General', 'Politics', 'Tech', 'Sports', 'Opinion', 'Business', 'Health', 'World'].map((cat) => {
            // Count matching posts for this specific category (taking into account loaded posts)
            const count = posts.filter(p => {
              const postCategory = p.category || 'General';
              if (cat === 'All') return true;
              return postCategory.toLowerCase() === cat.toLowerCase();
            }).length;

            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`py-1.5 px-2.5 sm:px-3.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1 border-b-2 -mb-px hover:text-slate-900 dark:hover:text-slate-100 ${
                  isSelected 
                    ? 'bg-amber-100/60 text-amber-950 border-amber-600/80 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500 rounded-t-lg' 
                    : 'bg-transparent border-transparent text-slate-400 dark:text-slate-500 hover:border-slate-350'
                }`}
                id={`cat-tab-${cat.toLowerCase()}`}
              >
                <span>{cat === 'All' ? 'All' : cat}</span>
                <span className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded-full ${isSelected ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-300' : 'bg-slate-200/60 dark:bg-slate-900 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div id="loading-skeletons" className="space-y-6">
          <p className="text-slate-400 text-xs font-mono font-bold uppercase tracking-widest text-center animate-pulse mb-6">
            Connecting to live independent dispatches...
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <BlogPostCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center max-w-2xl mx-auto" id="error-banner">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-slate-900 mb-2">Feed Connection Error</h3>
          <p className="text-sm text-slate-600 mb-6">{error}</p>
          <button 
            onClick={fetchPosts}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-2xs max-w-xl mx-auto my-6" id="empty-feed">
          <Newspaper className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-slate-900 mb-1">No Articles Published</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {searchTerm ? `No stories match current search query: "${searchTerm}"` : 'The independent ledger is clean. Check back soon for the latest stories.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Clear Search Guard
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8" id="posts-grid">
            {paginatedPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} globalPenName={globalPenName} />
            ))}
          </div>

          {/* Premium Page-by-Page Dispatch Navigator */}
          {totalPages > 1 && (
            <div className="mt-12 pt-6 border-t border-slate-200/65 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs text-slate-500" id="feed-pagination">
              <div>
                Showing <strong className="text-slate-800 dark:text-slate-200 font-semibold">{(currentPage - 1) * postsPerPage + 1}</strong> to <strong className="text-slate-800 dark:text-slate-200 font-semibold">{Math.min(currentPage * postsPerPage, filteredPosts.length)}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-semibold">{filteredPosts.length}</strong> active dispatches
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 border border-slate-350 hover:bg-slate-50 text-slate-700 disabled:opacity-45 dark:border-slate-800 dark:text-slate-300 bg-white dark:bg-slate-950 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Newer</span>
                </button>

                {/* Individual numerical pager list */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pgNum) => (
                    <button
                      key={pgNum}
                      onClick={() => {
                        setCurrentPage(pgNum);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      className={`h-7 w-7 rounded-md font-semibold text-xs transition-all flex items-center justify-center cursor-pointer ${
                        currentPage === pgNum 
                          ? 'bg-amber-50/70 text-amber-900 border border-amber-300 dark:bg-amber-950/20 dark:text-amber-250 dark:border-amber-900 shadow-3xs'
                          : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-950 dark:border-slate-850 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {pgNum}
                    </button>
                  ))}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage(prev => Math.min(prev + 1, totalPages));
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 border border-slate-350 hover:bg-slate-50 text-slate-700 disabled:opacity-45 dark:border-slate-800 dark:text-slate-300 bg-white dark:bg-slate-950 rounded-lg transition-all flex items-center gap-1 cursor-pointer font-medium disabled:cursor-not-allowed"
                >
                  <span>Older</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
