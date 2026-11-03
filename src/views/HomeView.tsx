import React, { useEffect, useState, useMemo } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { api, PostStats } from '../utils/api';
import { Post, slugify } from '../types';
import { sanitizePostImages, cleanImageUrl } from '../utils/imageUrl';
import BlogPostCard from '../components/BlogPostCard';
import AdSpace from '../components/AdSpace';
import AdMobNativeAd from '../components/AdMobNativeAd';
import { 
  Newspaper, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  ThumbsUp, 
  WifiOff, 
  Bookmark, 
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getRecentInProgressArticles, clearReadingProgress, ReadingProgressRecord } from '../utils/readingProgress';
import { updateDocumentSEO } from '../utils/seo';
import { getCompressedStories, saveCompressedStories } from '../utils/compressedStorage';
import { safeFormatDate } from '../utils/dateHelper';
import { clientLoadBalancer } from '../utils/clientLoadBalancer';

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

function getPaginationRange(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function BlogPostCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 border-0 border-b border-black dark:border-black sm:border sm:border-slate-200/80 dark:sm:border-slate-800 rounded-none sm:rounded-xl overflow-hidden shadow-none sm:shadow-3xs p-4 sm:p-6 flex flex-col justify-between h-[255px] animate-pulse">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md w-24"></div>
          <div className="h-5 bg-slate-100/90 dark:bg-slate-800/90 rounded-md w-16"></div>
        </div>
        
        <div className="h-5.5 bg-slate-150 dark:bg-slate-700 rounded-md w-11/12 mb-2.5"></div>
        <div className="h-5.5 bg-slate-150 dark:bg-slate-700 rounded-md w-8/12 mb-4"></div>
        
        <div className="space-y-2 mb-4">
          <div className="h-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-md w-full"></div>
          <div className="h-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-md w-11/12"></div>
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800"></div>
          <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md w-16"></div>
        </div>
        <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-md w-24"></div>
      </div>
    </div>
  );
}

export default function HomeView() {
  const [posts, setPosts] = useState<Post[]>(() => {
    const compressed = getCompressedStories();
    return compressed && compressed.length > 0 ? compressed : [];
  });
  const [globalPenName, setGlobalPenName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(() => {
    const compressed = getCompressedStories();
    return !(compressed && compressed.length > 0);
  });
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(() => {
    const compressed = getCompressedStories();
    return Boolean(compressed && compressed.length > 0);
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedCategory = searchParams.get('category') || 'All';

  // Support opening posts via legacy query parameters with history replacement
  useEffect(() => {
    const postIdFromQuery = searchParams.get('post') || searchParams.get('p') || searchParams.get('id');
    if (postIdFromQuery) {
      navigate(`/post/${postIdFromQuery}`, { replace: true });
    }
  }, [searchParams, navigate]);
  const setSelectedCategory = (cat: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (cat === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', cat);
    }
    setSearchParams(nextParams);
  };
  const pageParam = searchParams.get('page');
  const initialPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
  const [currentPage, setCurrentPage] = useState(initialPage);
  const postsPerPage = 20;

  // Track articles saved in cache memory that were left in progress
  const [inProgressArticles, setInProgressArticles] = useState<ReadingProgressRecord[]>([]);

  // Keep return page updated so back navigation always returns to current page index
  useEffect(() => {
    sessionStorage.setItem('current_news_return_page', String(currentPage));
  }, [currentPage]);

  // Keep canonical and SEO tags synchronized for the homepage, categories, and searches
  useEffect(() => {
    if (searchTerm) {
      updateDocumentSEO({
        title: `Search: "${searchTerm}" — Current News Live`,
        description: `Search results and live reporting for "${searchTerm}" on Current News Live.`,
        canonicalPath: `/?search=${encodeURIComponent(searchTerm)}`,
        robots: 'noindex, follow'
      });
    } else if (selectedCategory && selectedCategory.toLowerCase() === 'jharkhand') {
      updateDocumentSEO({
        title: 'Jharkhand News Live — Breaking Updates, Ranchi & Regional Reports | Current News',
        description: 'Read the latest breaking news near Jharkhand, Ranchi, Jamshedpur, Dhanbad, and all 24 districts. Live updates, political developments, government schemes, and community reports.',
        canonicalPath: '/?category=Jharkhand',
        keywords: 'news near Jharkhand, Jharkhand news, Jharkhand breaking news, Ranchi news live, Dhanbad news, Jamshedpur news, Bokaro news, Jharkhand news today, Jharkhand news live, Current News Jharkhand',
        newsKeywords: 'news near Jharkhand, Jharkhand news, Jharkhand breaking news, Ranchi, Dhanbad, Jamshedpur, Jharkhand live updates',
        geoRegion: 'IN-JH',
        geoPlacename: 'Jharkhand, India',
        geoPosition: '23.6102;85.2799',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          'name': 'Jharkhand News & Regional Reports — Current News Live',
          'description': 'Comprehensive news coverage near Jharkhand, Ranchi, Jamshedpur, and all districts.',
          'url': 'https://www.currentnews.blog/?category=Jharkhand',
          'about': {
            '@type': 'AdministrativeArea',
            'name': 'Jharkhand',
            'identifier': 'IN-JH',
            'containedInPlace': {
              '@type': 'Country',
              'name': 'India'
            }
          }
        }
      });
    } else if (selectedCategory && selectedCategory !== 'All') {
      updateDocumentSEO({
        title: `${selectedCategory} News & Global Analysis — Current News Live`,
        description: `Read the latest verified ${selectedCategory.toLowerCase()} news, deep dives, investigative reports, and breaking updates on Current News Live.`,
        canonicalPath: `/?category=${encodeURIComponent(selectedCategory)}`,
        keywords: `${selectedCategory}, ${selectedCategory.toLowerCase()} news, breaking news, world news, current affairs, journalism, latest updates`,
        robots: 'index, follow'
      });
    } else {
      updateDocumentSEO({
        title: 'Current News Live — Independent Global Journalism & Live Ledger',
        description: 'Comprehensive, verified global news coverage, breaking reports near Jharkhand, India, finance, geopolitics, and culture updated 24/7.',
        canonicalPath: '/',
        keywords: 'news near Jharkhand, Jharkhand news, Ranchi news, breaking news, world news, global reports, live journalism, politics, technology, business',
        newsKeywords: 'news near Jharkhand, Jharkhand news, Ranchi news, India breaking news, world news',
        geoRegion: 'IN-JH',
        geoPlacename: 'Jharkhand, India',
        geoPosition: '23.6102;85.2799',
        robots: 'index, follow'
      });
    }
  }, [selectedCategory, searchTerm]);

  // Restore scroll position when returning from an article
  useEffect(() => {
    if (!loading) {
      const savedScroll = sessionStorage.getItem('current_news_return_scroll');
      if (savedScroll) {
        const scrollY = parseInt(savedScroll, 10);
        if (!isNaN(scrollY) && scrollY > 0) {
          const timer = setTimeout(() => {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
            sessionStorage.removeItem('current_news_return_scroll');
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [loading]);

  useEffect(() => {
    const updateProgressList = () => {
      setInProgressArticles(getRecentInProgressArticles());
    };
    updateProgressList();
    window.addEventListener('reading-progress-updated', updateProgressList);
    window.addEventListener('storage', updateProgressList);
    return () => {
      window.removeEventListener('reading-progress-updated', updateProgressList);
      window.removeEventListener('storage', updateProgressList);
    };
  }, []);

  // Sync page state when URL parameter changes
  useEffect(() => {
    const pageFromUrl = searchParams.get('page');
    if (pageFromUrl) {
      const parsed = parseInt(pageFromUrl, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed !== currentPage) {
        setCurrentPage(parsed);
      }
    } else if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchParams]);

  // Reset to first page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
    if (searchParams.has('page')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('page');
      setSearchParams(nextParams, { replace: true });
    }
  }, [selectedCategory, searchTerm]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const nextParams = new URLSearchParams(searchParams);
    if (newPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', newPage.toString());
    }
    setSearchParams(nextParams);
    document.getElementById('posts-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchPosts = async () => {
    // Only show full loading spinner if no compressed stories exist in storage
    if (posts.length === 0) {
      setLoading(true);
    }
    setError(null);
    const path = 'posts';
    try {
      // 1. Multi-Origin Client Load Balancer (Cloudflare Edge CDN <-> Cloud Run Origin API <-> R2 Mirror)
      const { posts: balancedPosts } = await clientLoadBalancer.fetchArticlesFeed({
        category: selectedCategory,
        search: searchTerm,
        limit: 30,
      });

      if (balancedPosts && balancedPosts.length > 0) {
        setPosts(balancedPosts);
        setLoading(false);
        setIsOfflineCached(false);
        return;
      }

      // 2. Local compressed storage fallback (instant offline render)
      const compressedPosts = getCompressedStories();
      if (compressedPosts && compressedPosts.length > 0) {
        setPosts(compressedPosts.map(sanitizePostImages));
        setLoading(false);
        setIsOfflineCached(true);
        return;
      }
    } catch (err: any) {
      console.warn('Fetch posts from network deferred, checking compressed storage:', err?.message || err);
      try {
        const compressedPosts = getCompressedStories();
        if (compressedPosts && compressedPosts.length > 0) {
          setPosts(compressedPosts.map(sanitizePostImages));
          setIsOfflineCached(true);
          setError(null);
        } else {
          const isQuota = String(err?.message || err).toLowerCase().includes('quota');
          if (isQuota) {
            setError('The free daily database read quota has been reached for today. Displaying cached dispatches while the daily quota resets.');
          } else {
            setError('Could not retrieve publications. Please make sure the database is provisioned and active.');
          }
        }
      } catch (cacheReadErr) {
        setError('Could not retrieve publications. Please make sure the database is provisioned and active.');
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
    if (selectedCategory.toLowerCase() === 'jharkhand') {
      const isJharkhand = (
        postCategory.toLowerCase() === 'jharkhand' ||
        post.title.toLowerCase().includes('jharkhand') ||
        post.content.toLowerCase().includes('jharkhand') ||
        post.title.toLowerCase().includes('ranchi') ||
        post.content.toLowerCase().includes('ranchi') ||
        post.title.toLowerCase().includes('dhanbad') ||
        post.title.toLowerCase().includes('jamshedpur') ||
        post.title.toLowerCase().includes('bokaro') ||
        (post.hashtags || []).some(h => /jharkhand|ranchi|dhanbad|jamshedpur/i.test(h))
      );
      return matchesSearch && isJharkhand;
    }
    return matchesSearch && postCategory.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Resolve published posts
  const publishedPosts = posts.filter((p) => p.status !== 'draft');

  // Featured Story Posters for rotating hero showcase (prioritizes stories with image covers)
  // Dynamic Category Filtering:
  // - If 'All' category page: shows posters from all dispatches across the publication.
  // - If specific category page (e.g. Sports, Politics, Tech): shows posters matching that specific category.
  const categoryPostsForPoster = selectedCategory === 'All'
    ? publishedPosts
    : publishedPosts.filter(p => {
        const postCat = p.category || 'General';
        if (selectedCategory.toLowerCase() === 'jharkhand') {
          return (
            postCat.toLowerCase() === 'jharkhand' ||
            p.title.toLowerCase().includes('jharkhand') ||
            p.content.toLowerCase().includes('jharkhand') ||
            p.title.toLowerCase().includes('ranchi') ||
            p.content.toLowerCase().includes('ranchi') ||
            p.title.toLowerCase().includes('dhanbad') ||
            p.title.toLowerCase().includes('jamshedpur') ||
            p.title.toLowerCase().includes('bokaro') ||
            (p.hashtags || []).some(h => /jharkhand|ranchi|dhanbad|jamshedpur/i.test(h))
          );
        }
        return postCat.toLowerCase() === selectedCategory.toLowerCase();
      });

  // Use category-filtered dispatches if available; gracefully fallback to publishedPosts if a category has 0 posts
  const activePosterPool = categoryPostsForPoster.length > 0 ? categoryPostsForPoster : publishedPosts;

  const postsWithImage = activePosterPool.filter((p) => p.imageUrl && p.imageUrl.trim().length > 0);
  const posterPosts = (postsWithImage.length >= 3 
    ? postsWithImage 
    : [...postsWithImage, ...activePosterPool.filter(p => !p.imageUrl || !p.imageUrl.trim().length)]
  ).slice(0, 6);

  const [currentPosterIndex, setCurrentPosterIndex] = useState(0);
  const [isPosterHovered, setIsPosterHovered] = useState(false);

  // Reset poster rotation index to 0 whenever category changes
  useEffect(() => {
    setCurrentPosterIndex(0);
  }, [selectedCategory]);

  // Auto-rotate poster every 6 seconds, pause on mouse hover
  useEffect(() => {
    if (posterPosts.length <= 1 || isPosterHovered) return;
    const interval = setInterval(() => {
      setCurrentPosterIndex((prev) => (prev + 1) % posterPosts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [posterPosts.length, isPosterHovered]);

  const activePoster = posterPosts.length > 0 ? posterPosts[currentPosterIndex % posterPosts.length] : null;

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
  const paginatedPosts = filteredPosts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);

  // Batch stats for all visible cards in ONE GET /stats?ids=... call
  const [statsMap, setStatsMap] = useState<Record<string, PostStats>>({});
  const [userLikedIds, setUserLikedIds] = useState<Set<string>>(new Set());

  // Fetch the user's own reactions once via /my-reactions, not per card
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const liked = await api.getMyReactions();
          setUserLikedIds(new Set(liked));
        } catch (e) {
          console.debug('Failed to load user reactions:', e);
        }
      } else {
        setUserLikedIds(new Set());
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch likes/dislikes/views for all visible cards with ONE query
  useEffect(() => {
    if (paginatedPosts.length === 0) return;
    const ids = paginatedPosts.map(p => p.id);
    api.getPostStats(ids).then(newStats => {
      if (newStats && Object.keys(newStats).length > 0) {
        setStatsMap(prev => ({ ...prev, ...newStats }));
      }
    }).catch(err => {
      console.debug('Failed to batch load post stats:', err);
    });
  }, [currentPage, filteredPosts.length, selectedCategory, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-0" id="homepage-view">

      {isOfflineCached && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 rounded-xl p-3 px-4 mb-4 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs font-medium mt-4" id="offline-banner">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
            <span><strong>Offline Mode:</strong> Displaying cached news dispatches from your last visit. Please reconnect to view live dispatches.</span>
          </div>
          <button 
            onClick={fetchPosts}
            className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-colors shrink-0 cursor-pointer"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Category Filter Tabs positioned below the main header, above Today's Dispatch */}
      <div className="sticky top-[72px] z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200/80 dark:bg-slate-900/95 dark:border-slate-800/80 py-2 mb-8 shadow-3xs px-4 -mx-4 sm:-mx-8 lg:-mx-8" id="category-filter-header">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto pb-0.5 scroll-smooth no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" id="category-filter-tabs">
          {['All', 'General', 'Politics', 'Tech', 'Sports', 'Opinion', 'Business', 'Health', 'World'].map((cat) => {
            const count = posts.filter(p => {
              if (p.status === 'draft') return false;
              if (cat === 'All') return true;
              const postCategory = p.category || 'General';
              if (cat === 'Jharkhand') {
                return (
                  postCategory.toLowerCase() === 'jharkhand' ||
                  p.title.toLowerCase().includes('jharkhand') ||
                  p.content.toLowerCase().includes('jharkhand') ||
                  p.title.toLowerCase().includes('ranchi') ||
                  p.content.toLowerCase().includes('ranchi') ||
                  p.title.toLowerCase().includes('dhanbad') ||
                  p.title.toLowerCase().includes('jamshedpur') ||
                  p.title.toLowerCase().includes('bokaro') ||
                  (p.hashtags || []).some(h => /jharkhand|ranchi|dhanbad|jamshedpur/i.test(h))
                );
              }
              return postCategory.toLowerCase() === cat.toLowerCase();
            }).length;

            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[44px] py-2.5 px-3 sm:px-4 text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 -mb-px hover:text-black dark:hover:text-white ${
                  isSelected 
                    ? 'bg-amber-100/70 text-black border-amber-600/90 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500 rounded-t-lg' 
                    : 'bg-transparent border-transparent text-black dark:text-slate-100 hover:border-black/30 dark:hover:border-white/30'
                }`}
                id={`cat-tab-${cat.toLowerCase()}`}
              >
                <span className="font-bold text-black dark:text-slate-100">{cat === 'All' ? 'All' : cat}</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-amber-200 text-black dark:bg-amber-900/60 dark:text-amber-300' : 'bg-stone-200/90 dark:bg-stone-800 text-black dark:text-slate-200'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* 🏛️ Professional Editorial Hero Section — Animated Multi-Poster Showcase (Beige, Blue & Brown Theme) */}
      <section 
        aria-label="Featured Story Poster Showcase" 
        className="mb-10" 
        id="editorial-hero-showcase"
      >
        <div 
          className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E5DDD0] dark:border-[#38332B] bg-[#F4EFE6] dark:bg-[#1E1B18] shadow-md group"
          id="hero-feature-poster-carousel"
          onMouseEnter={() => setIsPosterHovered(true)}
          onMouseLeave={() => setIsPosterHovered(false)}
        >
          {activePoster ? (
            <div className="relative w-full aspect-[4/3] xs:aspect-[16/11] sm:aspect-[16/10] md:aspect-[1.618/1] min-h-[290px] sm:min-h-[380px] lg:min-h-[450px] max-h-[540px] flex flex-col justify-end overflow-hidden">
              <AnimatePresence initial={false}>
                <motion.div
                  key={activePoster.id}
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 w-full h-full"
                >
                  <Link
                    to={`/post/${activePoster.id}/${slugify(activePoster.title)}`}
                    className="block w-full h-full cursor-pointer relative"
                    id={`hero-poster-slide-${activePoster.id}`}
                  >
                    {/* Background Poster Image */}
                    {activePoster.imageUrl ? (
                      <img
                        src={cleanImageUrl(activePoster.imageUrl)}
                        alt={activePoster.title}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#2D1F13] via-[#1E293B] to-[#0F172A] flex items-center justify-center p-8">
                        <Newspaper className="w-36 h-36 text-[#B5A490]/25" />
                      </div>
                    )}

                    {/* Rich Multi-Layer Scrim: Guarantees 100% WCAG AA contrast across light, beige, dark, or photographic backgrounds */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1F1914] via-[#1F1914]/70 via-40% to-black/25" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent hidden sm:block" />

                    {/* Content Overlay */}
                    <div className="relative z-10 p-4 sm:p-8 lg:p-12 flex flex-col justify-end h-full max-w-4xl">
                      <div className="flex items-center gap-2 mb-2 sm:mb-3.5">
                        <span className="bg-[#1E3A8A] text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 sm:px-3 py-0.5 sm:py-1 rounded shadow-sm">
                          {activePoster.category || 'Featured Lead'}
                        </span>
                        <span className="text-[10px] sm:text-xs font-mono text-[#E8DEC8] font-medium tracking-wide">
                          Featured Dispatch
                        </span>
                      </div>

                      <h1 className="font-display font-extrabold text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-5xl text-white group-hover:text-blue-100 transition-colors leading-[1.18] mb-2 sm:mb-4 line-clamp-2 sm:line-clamp-3 drop-shadow-sm">
                        {activePoster.title}
                      </h1>

                      <p className="text-xs sm:text-sm lg:text-base text-[#F4EFE6]/90 line-clamp-1 sm:line-clamp-2 max-w-2xl mb-3 sm:mb-6 font-sans leading-relaxed drop-shadow-xs">
                        {getHtmlTextPreview(activePoster.content, 180)}
                      </p>

                      <div className="pt-2.5 sm:pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-xs text-[#E8DEC8]">
                        <div className="flex items-center gap-2 font-mono text-[10px] sm:text-xs">
                          <span className="text-white font-semibold">
                            {activePoster.authorName || 'Current News'}
                          </span>
                          <span>•</span>
                          <span>{safeFormatDate(activePoster.createdAt)}</span>
                        </div>

                        <span className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 bg-white text-[#1E3A8A] font-bold text-[11px] sm:text-xs lg:text-sm rounded-lg sm:rounded-xl group-hover:bg-[#1E3A8A] group-hover:text-white transition-all shadow-md">
                          <span>Read Full Report</span>
                          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            /* Loading Skeleton for Poster */
            <div className="w-full aspect-[4/3] xs:aspect-[16/11] sm:aspect-[16/10] md:aspect-[1.618/1] min-h-[290px] sm:min-h-[380px] lg:min-h-[450px] max-h-[540px] rounded-2xl sm:rounded-3xl bg-[#F4EFE6] dark:bg-[#1E1B18] border border-[#E5DDD0] dark:border-[#38332B] p-4 sm:p-8 lg:p-12 flex flex-col justify-end animate-pulse">
              <div className="h-4 sm:h-5 w-24 sm:w-28 bg-[#E8DEC8] dark:bg-[#2E2820] rounded mb-3" />
              <div className="h-7 sm:h-10 w-4/5 max-w-2xl bg-[#E8DEC8] dark:bg-[#2E2820] rounded mb-3 sm:mb-4" />
              <div className="h-3.5 sm:h-4 w-3/5 max-w-xl bg-[#E8DEC8] dark:bg-[#2E2820] rounded mb-4 sm:mb-6" />
              <div className="h-3 sm:h-4 w-1/3 bg-[#E8DEC8] dark:bg-[#2E2820] rounded" />
            </div>
          )}
        </div>
      </section>

      {/* 🔖 Pick Up Where You Left Off (Saved In Cache Memory) */}
      {inProgressArticles.length > 0 && (
        <section aria-label="Continue Reading" className="mb-10 p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-amber-900/15 dark:to-transparent border border-amber-300/50 dark:border-amber-700/40 rounded-2xl shadow-3xs" id="continue-reading-section">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                <Bookmark className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Pick Up Where You Left Off
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Saved in cache memory
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {inProgressArticles.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3 shadow-xs hover:border-amber-500/60 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {item.category || 'Story'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.progress}% read
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h4>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {/* Visual Progress bar */}
                  <div className="w-full bg-slate-150 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => clearReadingProgress(item.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Remove from saved in-progress"
                    >
                      Clear
                    </button>
                    <Link
                      to={`/post/${item.id}/${item.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      <span>Resume</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div id="loading-skeletons" className="space-y-6">
          <p className="text-slate-400 dark:text-slate-500 text-xs font-mono font-bold uppercase tracking-widest text-center animate-pulse mb-6">
            Connecting to live independent dispatches...
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-8 -mx-4 sm:mx-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <BlogPostCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-8 text-center max-w-2xl mx-auto" id="error-banner">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">Feed Connection Error</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{error}</p>
          <button 
            onClick={fetchPosts}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs max-w-xl mx-auto my-6" id="empty-feed">
          <Newspaper className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-1">No Articles Published</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchTerm ? `No stories match current search query: "${searchTerm}"` : 'The independent ledger is clean. Check back soon for the latest stories.'}
          </p>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
            >
              Clear Search Guard
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-8 -mx-4 sm:mx-0" id="posts-grid">
            {paginatedPosts.map((post, idx) => (
              <React.Fragment key={post.id}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.32,
                    delay: Math.min(idx * 0.045, 0.45),
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  className="flex flex-col h-full"
                >
                  <BlogPostCard 
                    post={post} 
                    globalPenName={globalPenName} 
                    cardStats={statsMap[post.id]} 
                    isLikedByUser={userLikedIds.has(post.id)} 
                  />
                </motion.div>
                {(idx === 2 || idx === 5) && paginatedPosts.length > idx + 1 && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 px-4 sm:px-0 my-2">
                    <AdMobNativeAd slotKey={`feed-card-${currentPage}-${idx}`} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Page-by-Page Dispatch Navigator - Variable dynamic pagination */}
          <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs" id="feed-pagination">
            <div className="text-slate-600 dark:text-slate-300 font-medium pagination-summary">
              Showing <strong className="text-slate-900 dark:text-white font-semibold">{filteredPosts.length > 0 ? (currentPage - 1) * postsPerPage + 1 : 0}</strong>–<strong className="text-slate-900 dark:text-white font-semibold">{Math.min(currentPage * postsPerPage, filteredPosts.length)}</strong> of <strong className="text-slate-900 dark:text-white font-semibold">{filteredPosts.length}</strong> articles{totalPages > 1 ? (
                <> (Page <strong className="text-slate-900 dark:text-white font-semibold">{currentPage}</strong> of <strong className="text-slate-900 dark:text-white font-semibold">{totalPages}</strong>)</>
              ) : ''}
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap justify-center" id="pagination-controls">
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                id="pagination-prev-btn"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </button>

              {getPaginationRange(currentPage, totalPages).map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`dots-${idx}`} className="pagination-dots min-h-[44px] px-2 flex items-center justify-center text-slate-400 dark:text-slate-400 font-mono text-xs select-none font-bold">
                      ...
                    </span>
                  );
                }
                const pageNum = Number(item);
                const isActive = currentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    data-active={isActive ? "true" : "false"}
                    aria-label={`Page ${pageNum}`}
                    aria-current={isActive ? "page" : undefined}
                    className={`min-h-[44px] min-w-[44px] px-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center cursor-pointer ${
                      isActive
                        ? 'pagination-page-active bg-indigo-600 text-white border border-indigo-600 dark:bg-indigo-600 dark:text-white dark:border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                        : 'pagination-page-inactive bg-white text-slate-700 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 dark:hover:text-white shadow-xs'
                    }`}
                    id={`pagination-page-${pageNum}`}
                  >
                    <span className="font-bold text-xs pointer-events-none">{pageNum}</span>
                  </button>
                );
              })}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                id="pagination-next-btn"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Dedicated Tag Filter Area: White background box matching page background, touching both sides of screen, text-only buttons stacked vertically with margin gap from screen */}
          <div 
            className="mt-8 mb-0 py-7 bg-white dark:bg-slate-950 rounded-none border-0 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] box-border" 
            id="tag-filter-box-area"
          >
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
              <div className="flex items-center space-x-2.5 mb-4">
                <span className="w-1 h-3.5 bg-emerald-500 rounded-xs shrink-0"></span>
                <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Categories
                </h3>
              </div>

              <div className="flex flex-col items-start space-y-1 pl-1.5 sm:pl-3" id="stacked-tag-filter-buttons">
                {['All', 'General', 'Politics', 'Tech', 'Sports', 'Opinion', 'Business', 'Health', 'World'].map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setCurrentPage(1);
                        document.getElementById('posts-grid')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`min-h-[44px] w-full text-left bg-transparent border-0 py-2.5 text-xs sm:text-sm transition-colors cursor-pointer inline-flex items-center ${
                        isSelected
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 font-medium'
                      }`}
                      id={`stacked-tag-${cat.toLowerCase()}`}
                    >
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Editorial Navigation (About, Editorial Policy, Contact) positioned between Categories and Footer */}
          <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 py-5 box-border" id="bottom-editorial-nav-section">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
              <nav className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400" id="bottom-editorial-nav">
                <Link to="/about" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  About
                </Link>
                <Link to="/editorial-policy" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Editorial Policy
                </Link>
                <Link to="/contact" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Contact
                </Link>
              </nav>
            </div>
          </div>

          {/* Green colour horizontal line between new filter box area and footer touching both sides of screen */}
          <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-1 sm:h-1.5 bg-emerald-500 shrink-0" id="filter-footer-green-divider"></div>
        </>
      )}

    </div>
  );
}
