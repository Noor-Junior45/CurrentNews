import React, { useEffect, useState, useLayoutEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { api } from '../utils/api';
import { onAuthStateChanged } from 'firebase/auth';
import { Post, slugify } from '../types';
import { cleanImageUrl, getFallbackImageUrl, sanitizePostImages } from '../utils/imageUrl';
import AdSpace from '../components/AdSpace';
import AdMobNativeAd from '../components/AdMobNativeAd';
import ProgressiveArticleBody from '../components/ProgressiveArticleBody';
import EmbedHandler from '../components/EmbedHandler';
import { Calendar, ChevronLeft, Award, Clock, Send, Copy, Check, Share2, ThumbsUp, ThumbsDown, ArrowRight, WifiOff, Eye, Hash, Bookmark, X } from 'lucide-react';
import { saveReadingProgress, getReadingProgress, ReadingProgressRecord } from '../utils/readingProgress';
import { signInWithGoogleSafe } from '../utils/authHelper';
import { safeFormatDate, safeToIsoString } from '../utils/dateHelper';
import { getCanonicalPostUrl } from '../utils/shareUrl';
import { getCompressedStory, getCompressedStories, saveCompressedStory } from '../utils/compressedStorage';
import { clientLoadBalancer } from '../utils/clientLoadBalancer';
import { reactionStore } from '../utils/reactionStore';

function getHtmlTextPreview(htmlString: string, maxLength: number = 160): string {
  if (!htmlString) return '';
  // Strip [fig. N] or [figure N] markers before previewing
  let text = htmlString.replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[^"'\s]+/g, '');
  text = text
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&#160;?/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-z0-9#]{1,7};?/gi, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export default function PostDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [post, setPost] = useState<Post | null>(() => {
    // 1. Instant preview passed from previous card click (0ms render)
    const preview = (location.state as any)?.previewPost;
    if (preview && (!id || preview.id === id)) {
      return sanitizePostImages(preview);
    }
    // 2. Instant cache lookup from user cache memory
    if (id) {
      const cached = getCompressedStory(id);
      if (cached) return sanitizePostImages(cached);
      // 3. Fallback to stories in feed memory cache
      const feed = getCompressedStories();
      const inFeed = feed?.find(p => p.id === id);
      if (inFeed) return sanitizePostImages(inFeed);
    }
    return null;
  });

  const [globalPenName, setGlobalPenName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(() => {
    const preview = (location.state as any)?.previewPost;
    if (preview && (!id || preview.id === id)) return false;
    if (id && getCompressedStory(id)) return false;
    if (id && getCompressedStories()?.some(p => p.id === id)) return false;
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(() => {
    return Boolean(id && (getCompressedStory(id) || getCompressedStories()?.some(p => p.id === id)));
  });
  const [copied, setCopied] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleReturnToFeed = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const returnSearch = sessionStorage.getItem('current_news_return_search');
    const returnPage = sessionStorage.getItem('current_news_return_page');
    if (returnSearch && returnSearch.trim().length > 0) {
      navigate('/' + (returnSearch.startsWith('?') ? returnSearch : '?' + returnSearch));
    } else if (returnPage && returnPage !== '1') {
      navigate(`/?page=${returnPage}`);
    } else {
      navigate('/');
    }
  };

  // Reactions State using reactionStore
  const [baseLikes, setBaseLikes] = useState(0);
  const [baseDislikes, setBaseDislikes] = useState(0);
  const [isHeartPopping, setIsHeartPopping] = useState(false);
  const [, setTick] = useState(0);

  // Subscribe to reactionStore for instant updates across the app
  useEffect(() => {
    return reactionStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Always reset reader viewport to top whenever an article is opened or switched before paint
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  // Resume Reading & Cache State
  const [savedResumeProgress, setSavedResumeProgress] = useState<ReadingProgressRecord | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(false);
  const [bannerTimeLeft, setBannerTimeLeft] = useState<number>(8);
  const [isBannerHovered, setIsBannerHovered] = useState<boolean>(false);

  // Check saved reading progress when post is loaded
  useEffect(() => {
    if (post && post.id) {
      const saved = getReadingProgress(post.id);
      if (saved && saved.progress >= 5 && saved.progress < 92 && saved.scrollY > 150) {
        setSavedResumeProgress(saved);
        setShowResumeBanner(true);
      }
    }
  }, [post?.id]);

  // Auto-dismiss timer for "Pick up where you left off" popup
  useEffect(() => {
    if (!showResumeBanner) return;
    setBannerTimeLeft(8);

    const interval = setInterval(() => {
      if (isBannerHovered) return;
      setBannerTimeLeft((prev) => {
        if (prev <= 1) {
          setShowResumeBanner(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showResumeBanner, isBannerHovered]);

  // Track scrolling progress in background cache
  useEffect(() => {
    if (!post) return;
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const totalHeight = document.documentElement.scrollHeight;
        const maxScroll = totalHeight - window.innerHeight;
        if (maxScroll > 150) {
          saveReadingProgress(
            post.id,
            post.title,
            slugify(post.title || ''),
            window.scrollY,
            maxScroll,
            post.imageUrl,
            post.category,
            getHtmlTextPreview(post.content || '', 120)
          );
        }
      }, 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [post]);

  const handleJumpToSavedPosition = () => {
    if (savedResumeProgress && savedResumeProgress.scrollY) {
      window.scrollTo({
        top: savedResumeProgress.scrollY,
        behavior: 'smooth'
      });
      setShowResumeBanner(false);
    }
  };

  // Close lightbox with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    if (lightboxImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxImage]);

  useEffect(() => {
    const fetchRelatedPosts = async () => {
      if (!post) return;
      try {
        // Use light feed from client load balancer / local cache (zero Firestore reads)
        const { posts: feedPosts } = await clientLoadBalancer.fetchArticlesFeed({
          category: post.category || 'General',
        });
        const matched = feedPosts.filter(p => p.id !== post.id);
        if (matched.length > 0) {
          setRelatedPosts(matched.slice(0, 3));
          return;
        }

        const { posts: allPosts } = await clientLoadBalancer.fetchArticlesFeed();
        const generalMatched = allPosts.filter(p => p.id !== post.id);
        setRelatedPosts(generalMatched.slice(0, 3));
      } catch (err) {
        console.debug('Failed to fetch related posts from light feed:', err);
      }
    };

    fetchRelatedPosts();
  }, [post?.id, post?.category]);

  // Record view count only if cn_viewed_${postId} is missing or older than 24h
  useEffect(() => {
    if (!post?.id) return;
    const viewKey = `cn_viewed_${post.id}`;
    const lastViewed = localStorage.getItem(viewKey);
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (!lastViewed || now - Number(lastViewed) > ONE_DAY_MS) {
      localStorage.setItem(viewKey, String(now));
      api.recordPostView(post.id).catch((err) => {
        console.debug('Failed to record post view:', err);
      });
    }
  }, [post?.id]);

  useEffect(() => {
    if (post) {
      if (!reactionStore.hasPendingOrRecentChange(post.id)) {
        setBaseLikes(post.likes || 0);
        setBaseDislikes(post.dislikes || 0);
      }

      // Refresh real-time stats from Cloudflare Worker D1
      api.getPostStats([post.id]).then((statsMap) => {
        const currentStats = statsMap[post.id];
        if (currentStats) {
          if (!reactionStore.hasPendingOrRecentChange(post.id)) {
            if (currentStats.likes !== undefined) setBaseLikes(currentStats.likes);
            if (currentStats.dislikes !== undefined) setBaseDislikes(currentStats.dislikes);
          }
          if (currentStats.views !== undefined && post) {
            setPost((prev) => (prev ? { ...prev, views: currentStats.views } : null));
          }
        }
      }).catch(() => {});
    }
  }, [post?.id]);

  const { likes: displayedLikes, dislikes: displayedDislikes, myReaction: currentReaction } =
    post ? reactionStore.getCalculatedCounts(post.id, baseLikes, baseDislikes) : { likes: 0, dislikes: 0, myReaction: null };

  useEffect(() => {
    if (!post) {
      document.title = "Current News — Breaking News Near Me & Live Updates";
      return;
    }

    // 1. Update Title Tag (Clean site name format for search SERPs)
    document.title = `${post.title} | Current News`;

    // Helpers to manage HTML head tags
    const setMetaTag = (attribute: 'property' | 'name', attrVal: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${attrVal}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, attrVal);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    const setJsonLd = (id: string, data: object) => {
      let element = document.getElementById(id) as HTMLScriptElement;
      if (!element) {
        element = document.createElement('script');
        element.type = 'application/ld+json';
        element.id = id;
        document.head.appendChild(element);
      }
      element.textContent = JSON.stringify(data);
    };

    // Calculate metadata values
    const rawExcerpt = getHtmlTextPreview(post.content || '', 160);
    const summary = rawExcerpt.replace(/\s+/g, ' ').trim();
    const authorVal = post.authorName || globalPenName || 'Current News';
    
    const publishedIso = safeToIsoString(post.createdAt);
    const modifiedIso = post.updatedAt ? safeToIsoString(post.updatedAt) : publishedIso;

    const canonicalUrl = getCanonicalPostUrl(post.id, post.title);
    const isJharkhand = /jharkhand|ranchi|dhanbad|jamshedpur|bokaro|deoghar|hazaribagh/i.test(`${post.title} ${post.category || ''} ${post.content || ''}`);
    const postKeywords = isJharkhand
      ? `news near Jharkhand, Jharkhand news, Jharkhand breaking news, Ranchi news, ${post.category || 'Jharkhand'}, ${post.title.toLowerCase().split(' ').slice(0, 6).join(', ')}, Current News Jharkhand, news near me`
      : `current news, news near me, breaking news, news, independent ledger, journalism, ${post.category || 'general'}, ${post.title.toLowerCase().split(' ').slice(0, 6).join(', ')}`;
    const siteLogo = 'https://currentnews.blog/CurrentNews.png';
    const mainImg = cleanImageUrl(post.imageUrl || siteLogo);
    const secureImg = mainImg.startsWith('http:') ? mainImg.replace('http:', 'https:') : mainImg;
    const imgType = mainImg.toLowerCase().endsWith('.png')
      ? 'image/png'
      : mainImg.toLowerCase().endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

    // 2. Base SEO Tags & Canonical Mappings
    setMetaTag('name', 'description', summary);
    setMetaTag('name', 'keywords', postKeywords);
    setMetaTag('name', 'news_keywords', isJharkhand ? 'news near Jharkhand, Jharkhand news, Ranchi news, Jharkhand breaking news, news near me' : 'breaking news, current news, live reporting, news near me');
    setMetaTag('name', 'author', authorVal);
    setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMetaTag('name', 'geo.region', 'IN-JH');
    setMetaTag('name', 'geo.placename', isJharkhand ? 'Jharkhand, India' : 'India');
    setMetaTag('name', 'geo.position', '23.6102;85.2799');
    setMetaTag('name', 'ICBM', '23.6102, 85.2799');
    setLinkTag('canonical', canonicalUrl);

    // 3. OpenGraph Tags mapped specifically for individual article social sharing
    setMetaTag('property', 'og:site_name', 'Current News');
    setMetaTag('property', 'og:type', 'article');
    setMetaTag('property', 'og:title', post.title);
    setMetaTag('property', 'og:description', summary);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:locale', 'en_US');
    
    // Rich Image Specifications for OpenGraph (Facebook, LinkedIn, WhatsApp, iMessage)
    setMetaTag('property', 'og:image', mainImg);
    setMetaTag('property', 'og:image:secure_url', secureImg);
    setMetaTag('property', 'og:image:type', imgType);
    setMetaTag('property', 'og:image:width', '1200');
    setMetaTag('property', 'og:image:height', '630');
    setMetaTag('property', 'og:image:alt', `Illustration for ${post.title}`);

    // Core Article Metadata Specifications
    if (publishedIso) {
      setMetaTag('property', 'article:published_time', publishedIso);
    }
    if (modifiedIso) {
      setMetaTag('property', 'article:modified_time', modifiedIso);
    }
    setMetaTag('property', 'article:author', authorVal);
    if (post.category) {
      setMetaTag('property', 'article:section', post.category);
    }
    setMetaTag('property', 'article:publisher', 'https://currentnews.blog');

    // Individual tags/hashtags
    if (Array.isArray(post.hashtags) && post.hashtags.length > 0) {
      post.hashtags.slice(0, 8).forEach((tag, idx) => {
        setMetaTag('property', `article:tag:${idx}`, tag.replace(/^#/, ''));
      });
    }

    // 4. Twitter Card Specific Tags (X / Twitter rich social cards)
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:site', '@currentnewsblog');
    setMetaTag('name', 'twitter:creator', authorVal || '@currentnewsblog');
    setMetaTag('name', 'twitter:url', canonicalUrl);
    setMetaTag('name', 'twitter:title', post.title);
    setMetaTag('name', 'twitter:description', summary);
    setMetaTag('name', 'twitter:image', mainImg);
    setMetaTag('name', 'twitter:image:alt', `Illustration for ${post.title}`);

    // 5. Schema.org JSON-LD structured microdata NewsArticle & BreadcrumbList for Google SERP
    const jsonLdData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "NewsArticle",
          "@id": `${canonicalUrl}#article`,
          "isPartOf": {
            "@type": "WebPage",
            "@id": canonicalUrl
          },
          "headline": post.title,
          "description": summary,
          "image": [mainImg, ...(post.imageUrls ? post.imageUrls.map(cleanImageUrl) : [])],
          "datePublished": publishedIso || new Date().toISOString(),
          "dateModified": modifiedIso || new Date().toISOString(),
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": canonicalUrl
          },
          "articleSection": post.category || 'General',
          "inLanguage": "en-US",
          "isAccessibleForFree": true,
          "keywords": post.hashtags && post.hashtags.length ? post.hashtags.join(', ') : postKeywords,
          "author": [
            {
              "@type": "Person",
              "name": authorVal,
              "jobTitle": "Investigative Journalist",
              "url": "https://currentnews.blog/about"
            }
          ],
          "publisher": {
            "@type": "NewsMediaOrganization",
            "name": "Current News",
            "url": "https://currentnews.blog",
            "logo": {
              "@type": "ImageObject",
              "url": siteLogo,
              "width": 512,
              "height": 512
            },
            "publishingPrinciples": "https://currentnews.blog/editorial-policy"
          },
          ...(isJharkhand ? {
            "spatialCoverage": {
              "@type": "Place",
              "name": "Jharkhand, India",
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": 23.6102,
                "longitude": 85.2799
              }
            },
            "contentLocation": {
              "@type": "AdministrativeArea",
              "name": "Jharkhand"
            }
          } : {})
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://currentnews.blog/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": post.category || "General",
              "item": `https://currentnews.blog/?category=${encodeURIComponent(post.category || "General")}`
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": post.title,
              "item": canonicalUrl
            }
          ]
        }
      ]
    };
    setJsonLd('post-jsonld-schema', jsonLdData);

    return () => {
      // Revert base SEO tags if navigating away
      document.title = "Current News — Breaking News Near Me, Jharkhand & Global Ledger";
      const targetCanonical = window.location.pathname === '/' 
        ? 'https://currentnews.blog/' 
        : `https://currentnews.blog${window.location.pathname}`;
      setLinkTag('canonical', targetCanonical);

      // Revert base SEO tags
      setMetaTag('name', 'description', 'Current News — Verified breaking news near Jharkhand, India, finance, geopolitics, and global dispatches updated 24/7.');
      setMetaTag('name', 'author', 'Current News');

      // Revert OpenGraph tags back to default site metadata
      setMetaTag('property', 'og:site_name', 'Current News');
      setMetaTag('property', 'og:type', 'website');
      setMetaTag('property', 'og:title', 'Current News — Breaking News Near Me, Jharkhand & Global Ledger');
      setMetaTag('property', 'og:description', 'Verified breaking news near Jharkhand, India, finance, geopolitics, and global dispatches updated 24/7.');
      setMetaTag('property', 'og:url', 'https://currentnews.blog/');
      setMetaTag('property', 'og:image', 'https://i.imgur.com/gFgShoZ.jpeg');
      setMetaTag('property', 'og:image:secure_url', 'https://i.imgur.com/gFgShoZ.jpeg');
      setMetaTag('property', 'og:image:width', '1200');
      setMetaTag('property', 'og:image:height', '630');
      setMetaTag('property', 'og:image:alt', 'Current News Live Independent Ledger Emblem');

      // Revert Twitter Card tags
      setMetaTag('name', 'twitter:card', 'summary_large_image');
      setMetaTag('name', 'twitter:title', 'Current News Live - Independent Ledger');
      setMetaTag('name', 'twitter:description', 'Premium uncorrupted journalism, real-time investigative disclosures, opinion dispatches, and geopolitical analysis.');
      setMetaTag('name', 'twitter:image', 'https://i.imgur.com/gFgShoZ.jpeg');
      setMetaTag('name', 'twitter:image:alt', 'Current News Live Independent Ledger Emblem');
      setMetaTag('name', 'twitter:creator', '@currentnewsblog');

      // Clean up dynamic article:* meta tags
      const articleMetas = document.querySelectorAll('meta[property^="article:"]');
      articleMetas.forEach(el => el.remove());

      // Clean up JSON-LD tag
      const staleLd = document.getElementById('post-jsonld-schema');
      if (staleLd) staleLd.remove();
    };
  }, [post, globalPenName]);

  const handleReaction = async (type: 'liked' | 'disliked') => {
    if (!post) return;
    const user = auth.currentUser;
    if (!user) {
      const confirmSignIn = window.confirm("To react to this article, you must be logged in. Would you like to sign in with your Google account now?");
      if (confirmSignIn) {
        await signInWithGoogleSafe();
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

  const getCanonicalPostShareUrl = () => {
    if (!post) return 'https://currentnews.blog';
    return getCanonicalPostUrl(post.id, post.title);
  };

  const handleCopyLink = () => {
    if (post) {
      const shareUrl = getCanonicalPostShareUrl();
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (post) {
      const shareUrl = getCanonicalPostShareUrl();
      const previewText = getHtmlTextPreview(post.content || '', 100);
      const shareText = previewText 
        ? `${post.title} — ${previewText}\n\n${shareUrl}`
        : `${post.title}\n\n${shareUrl}`;

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: post.title,
            text: shareText,
            url: shareUrl,
          });
        } catch (err) {
          // If not user cancellation, fallback to clipboard copy
          if (err instanceof Error && err.name !== 'AbortError') {
            handleCopyLink();
          }
        }
      } else {
        handleCopyLink();
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const ensureReadableBody = (candidate: Post): Post => {
      if (candidate.content && candidate.content.trim().length > 0) {
        return candidate;
      }
      if (candidate.excerpt && candidate.excerpt.trim().length > 0) {
        return {
          ...candidate,
          content: `<p>${candidate.excerpt}</p>`,
        };
      }
      return candidate;
    };

    const fetchPost = async () => {
      if (!id) return;
      if (!post) {
        setLoading(true);
      }
      setError(null);

      // 1. Multi-Origin Client Load Balancer (CapacitorHttp Native Bridge <-> Cloud Run API <-> R2 CDN <-> APK Bundle)
      try {
        const { post: balancedPost, source } = await clientLoadBalancer.fetchArticleById(id);
        if (cancelled) return;
        if (balancedPost && balancedPost.title) {
          const readable = ensureReadableBody(balancedPost);
          setPost(readable);
          setLoading(false);
          setIsOfflineCached(source.includes('Offline') || source.includes('Preview') || source.includes('Bundled Story Feed'));

          // Increment views without reading the document
          const viewedSessionKey = `viewed_post_${id}`;
          const alreadyViewed = sessionStorage.getItem(viewedSessionKey);
          if (!alreadyViewed) {
            sessionStorage.setItem(viewedSessionKey, 'true');
            api.recordPostView(id).catch((viewErr) => {
              console.debug('Views counter update notice:', viewErr);
            });
          }
          return;
        }
      } catch (lbErr) {
        console.debug('[ClientLB] Article fetch deferred to local cache:', lbErr);
      }

      if (cancelled) return;

      // 2. Local compressed story or feed fallback (instant offline render)
      try {
        const compressed = getCompressedStory(id) || getCompressedStories()?.find((p) => p && p.id === id) || null;
        if (compressed && compressed.title) {
          const sanitized = ensureReadableBody(sanitizePostImages(compressed));
          setPost(sanitized);
          setLoading(false);
          setIsOfflineCached(true);
          return;
        }
      } catch {}

      // 3. Preserve in-memory router previewPost if passed from card click rather than showing a dead-end error screen
      const previewFromRouter = (location.state as any)?.previewPost as Post | undefined;
      if (previewFromRouter && previewFromRouter.id === id && previewFromRouter.title) {
        setPost(ensureReadableBody(sanitizePostImages(previewFromRouter)));
        setLoading(false);
        setIsOfflineCached(true);
        return;
      }

      // Only show error screen if no article exists in remote API, R2 CDN, APK bundle, local cache, or router state
      setError('Article not found. The article could have been removed by an administrator or has an incorrect web link.');
      setLoading(false);
    };

    fetchPost();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (post) {
      // Trigger a Google Analytics view event dynamically for this particular article!
      if (typeof window !== 'undefined') {
        const anyWindow = window as any;
        if (anyWindow.gtag) {
          try {
            // Standard GA page view event customized with page path and title
            anyWindow.gtag('config', 'G-7XETKW0Q7M', {
              page_title: post.title,
              page_path: `/post/${post.id}`,
              page_location: window.location.href
            });
            // Detailed engagement event
            anyWindow.gtag('event', 'news_item_view', {
              article_id: post.id,
              article_title: post.title,
              article_author: post.authorName || globalPenName || 'Current News',
              engagement_time_msec: Date.now()
            });
            console.log(`[Google Analytics] Dynamic view tracked for item: ${post.title}`);
          } catch (gaError) {
            console.warn('[Google Analytics] Failed to execute gtag event tracking', gaError);
          }
        }
      }
    }
  }, [post, globalPenName]);

  if (loading && !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center" id="post-detail-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-mono font-medium">Opening independent publication...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center" id="post-detail-error">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl p-8" id="error-box">
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">Failed to Load Article</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{error || 'Unknown error occurred.'}</p>
          <button 
            type="button"
            onClick={handleReturnToFeed} 
            className="inline-flex items-center space-x-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Public Feed</span>
          </button>
        </div>
      </div>
    );
  }

  // Format publication date safely
  const publishDate = safeFormatDate(post?.createdAt, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const renderArticleContent = () => {
    if (!post) return null;
    let contentHtml = post.content || '';

    // Map all available post photos: fig. 1 = imageUrl, fig. 2+ = imageUrls[0+]
    const allPhotos: string[] = [];
    const allFallbackPhotos: (string | undefined)[] = [];

    if (post.imageUrl && post.imageUrl.trim().length > 0) {
      allPhotos.push(post.imageUrl.trim());
      allFallbackPhotos.push(post.imageUrlFallback?.trim());
    }
    if (post.imageUrls && Array.isArray(post.imageUrls)) {
      post.imageUrls.forEach((u, i) => {
        if (u && u.trim().length > 0) {
          allPhotos.push(u.trim());
          allFallbackPhotos.push(post.imageUrlsFallback?.[i]?.trim());
        }
      });
    }

    const inlineFiguresRendered = new Set<number>();

    // Parse bare Imgur URLs or raw image links pasted in copy/text
    const replaceBareUrls = (htmlText: string) => {
      let text = htmlText;
      
      // Replace bare imgur links inside paragraphs
      const pLinkPattern = /<p>\s*((?:https?:\/\/)?(?:i\.)?imgur\.com\/[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?)\s*<\/p>/gi;
      text = text.replace(pLinkPattern, (match, url) => {
        let src = url;
        if (!src.startsWith('http')) src = 'https://' + src;
        if (src.includes('imgur.com') && !/\.(png|jpg|jpeg|gif|webp)$/i.test(src)) {
          src = src.replace('imgur.com', 'i.imgur.com') + '.jpg';
        }
        return `<div class="my-6 flex justify-center w-full"><img src="${src}" alt="Attached Chronicle Image" loading="lazy" decoding="async" class="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm transform hover:scale-[1.005] transition-[transform,box-shadow] duration-200" referrerPolicy="no-referrer" onerror="this.style.display='none'" /></div>`;
      });

      // Handle raw non-imgur direct image links inside paragraphs
      const pDirectImgPattern = /<p>\s*(https?:\/\/[^\s<>'"]+\.(?:png|jpg|jpeg|gif|webp))\s*<\/p>/gi;
      text = text.replace(pDirectImgPattern, (match, url) => {
        return `<div class="my-6 flex justify-center w-full"><img src="${url}" alt="Attached Chronicle Image" loading="lazy" decoding="async" class="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm transform hover:scale-[1.005] transition-[transform,box-shadow] duration-200" referrerPolicy="no-referrer" onerror="this.style.display='none'" /></div>`;
      });

      // Handle inline [fig. N] or [fig N] markers in prose
      // Completely remove the code word and render only the photo cleanly
      const figPattern = /(?:<p(?:\s+[^>]*)?>\s*(?:<(?:strong|em|code|span)(?:\s+[^>]*)?>\s*)?)?\[fig(?:ure)?(?:\.|\s+)?\s*(\d+)\](?:\s*<\/(?:strong|em|code|span)>)?(?:\s*<\/p>)?/gi;
      text = text.replace(figPattern, (match, numStr) => {
        const figNum = parseInt(numStr, 10);
        const photoIdx = figNum - 1;
        if (photoIdx >= 0 && photoIdx < allPhotos.length) {
          inlineFiguresRendered.add(photoIdx);
          const pUrl = cleanImageUrl(allPhotos[photoIdx]);
          const fbUrl = getFallbackImageUrl(allPhotos[photoIdx], allFallbackPhotos[photoIdx]);
          const errorScript = fbUrl
            ? `if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; } else { this.style.display = 'none'; }`
            : `this.style.display = 'none';`;
          return `
            <div class="my-6 flex justify-center w-full not-prose" id="article-figure-${figNum}">
              <img src="${pUrl}" data-fallback="${fbUrl || ''}" alt="Article Photo" loading="lazy" decoding="async" class="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm hover:shadow transition-shadow duration-200" referrerPolicy="no-referrer" onerror="${errorScript}" />
            </div>
          `;
        }
        // Remove unassociated code words completely so readers never see [fig. N]
        return '';
      });

      // Cleanup any remaining [fig. N] or [figure N] tags anywhere in the prose
      text = text.replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '');

      return text;
    };

    contentHtml = replaceBareUrls(contentHtml);

    // Self-heal and clean all embedded <img src="..."> tags in contentHtml
    contentHtml = contentHtml.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (imgTag, srcUrl) => {
      const cleanSrc = cleanImageUrl(srcUrl);
      if (cleanSrc && cleanSrc !== srcUrl) {
        return imgTag.replace(srcUrl, cleanSrc);
      }
      return imgTag;
    });

    // Sanitize any hardcoded inline dark colors (e.g. black text from Quill or pasted content)
    // and inline white background colors so the article is guaranteed visible in dark mode
    contentHtml = contentHtml
      .replace(/color\s*:\s*(?:rgb\(\s*(?:[0-9]|[1-4][0-9]|5[0-9])\s*,\s*(?:[0-9]|[1-4][0-9]|5[0-9])\s*,\s*(?:[0-9]|[1-4][0-9]|5[0-9])\s*\)|#000000|#000|#111111|#111|#222222|#222|#333333|#333|#444444|#444|black|#1c1917|#0f172a)\s*;?/gi, '')
      .replace(/background(?:-color)?\s*:\s*(?:rgb\(\s*(?:24[0-9]|25[0-5])\s*,\s*(?:24[0-9]|25[0-5])\s*,\s*(?:24[0-9]|25[0-5])\s*\)|#ffffff|#fff|#fafafa|#f8f9fa|white)\s*;?/gi, '');

    // Primary photo placement check: rendered inline if explicit fig tag, imagePosition is 'inline', or already embedded in content
    const isPrimaryRenderedInline = inlineFiguresRendered.has(0) || 
      post.imagePosition === 'inline' || 
      Boolean(post.imageUrl && post.content && (post.content.includes(post.imageUrl) || post.content.includes(cleanImageUrl(post.imageUrl))));

    const isGalleryItemInline = (u: string, i: number) => {
      if (inlineFiguresRendered.has(i + 1)) return true;
      if (post.galleryPositions?.[i] === 'inline') return true;
      if (u && post.content && (post.content.includes(u) || post.content.includes(cleanImageUrl(u)))) return true;
      return false;
    };

    // Reusable photo block generator - compact, borderless, full photo visible without cropping
    const renderPhotoBlock = (url: string, fallback?: string, key?: string | number) => {
      const resolvedSrc = cleanImageUrl(url);
      const resolvedFallback = getFallbackImageUrl(url, fallback);

      return (
        <div key={key} className="my-6 flex justify-center w-full" id="featured-article-photo-container">
          <img
            src={resolvedSrc}
            alt="Dispatch Feature Photo"
            decoding="async"
            className="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm hover:shadow transition-shadow duration-200"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              const fb = resolvedFallback;
              if (fb && target.src !== fb && !fb.startsWith('data:')) {
                target.src = fb;
              } else {
                // Never substitute an editorial photograph with the application brand emblem/logo!
                target.style.display = 'none';
                const parent = target.closest('#featured-article-photo-container') as HTMLElement | null;
                if (parent) {
                  parent.style.display = 'none';
                }
              }
            }}
          />
        </div>
      );
    };

    // Flow items: Top photos
    const topPhotos: React.ReactNode[] = [];
    if (!isPrimaryRenderedInline && post.imageUrl && (post.imagePosition === 'top' || !post.imagePosition)) {
      topPhotos.push(renderPhotoBlock(post.imageUrl, post.imageUrlFallback, 'primary-top'));
    }
    if (post.imageUrls && Array.isArray(post.imageUrls)) {
      post.imageUrls.forEach((u, i) => {
        if (!isGalleryItemInline(u, i) && post.galleryPositions?.[i] === 'top') {
          topPhotos.push(renderPhotoBlock(u, post.imageUrlsFallback?.[i], `gallery-top-${i}`));
        }
      });
    }

    // Flow items: Middle photos
    const middlePhotos: React.ReactNode[] = [];
    if (!isPrimaryRenderedInline && post.imageUrl && post.imagePosition === 'middle') {
      middlePhotos.push(renderPhotoBlock(post.imageUrl, post.imageUrlFallback, 'primary-middle'));
    }
    if (post.imageUrls && Array.isArray(post.imageUrls)) {
      post.imageUrls.forEach((u, i) => {
        if (!isGalleryItemInline(u, i) && post.galleryPositions?.[i] === 'middle') {
          middlePhotos.push(renderPhotoBlock(u, post.imageUrlsFallback?.[i], `gallery-middle-${i}`));
        }
      });
    }

    // Flow items: Bottom photos
    const bottomPhotos: React.ReactNode[] = [];
    if (!isPrimaryRenderedInline && post.imageUrl && post.imagePosition === 'bottom') {
      bottomPhotos.push(renderPhotoBlock(post.imageUrl, post.imageUrlFallback, 'primary-bottom'));
    }
    if (post.imageUrls && Array.isArray(post.imageUrls)) {
      post.imageUrls.forEach((u, i) => {
        if (!isGalleryItemInline(u, i) && post.galleryPositions?.[i] === 'bottom') {
          bottomPhotos.push(renderPhotoBlock(u, post.imageUrlsFallback?.[i], `gallery-bottom-${i}`));
        }
      });
    }

    return (
      <ProgressiveArticleBody
        contentHtml={contentHtml}
        topPhotos={topPhotos.length > 0 ? <div className="space-y-4">{topPhotos}</div> : undefined}
        middlePhotos={middlePhotos.length > 0 ? <div className="space-y-4">{middlePhotos}</div> : undefined}
        bottomPhotos={bottomPhotos.length > 0 ? <div className="space-y-4">{bottomPhotos}</div> : undefined}
        slotKey="article-middle"
        loadingMore={loading && (!post.content || post.content.length <= 160)}
      />
    );
  };


  const dynamicShareUrl = getCanonicalPostShareUrl();

  return (
    <div className="w-full min-h-screen bg-[#f7f4ed] dark:bg-[#161412] text-black dark:text-slate-100 transition-colors" id={`article-page-outer-container-${post.id}`}>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id={`article-${post.id}`}>
        
        {/* Article Breadcrumbs Path */}
        <nav className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-black dark:text-slate-200 mb-6" id="breadcrumbs-header">
          <button 
            type="button"
            onClick={handleReturnToFeed} 
            className="hover:text-emerald-800 dark:hover:text-white text-black dark:text-slate-100 transition-colors cursor-pointer inline-flex items-center gap-1 font-extrabold"
          >
            <ChevronLeft className="h-3.5 w-3.5 -ml-1 text-black dark:text-slate-200" />
            <span>Home</span>
          </button>
          <span className="text-black/50 dark:text-slate-500 font-bold">/</span>
          <Link 
            to={`/?category=${encodeURIComponent(post.category || 'General')}`} 
            className="hover:text-emerald-700 dark:hover:text-emerald-400 text-black dark:text-slate-100 font-bold transition-colors"
          >
            {post.category || 'General'}
          </Link>
          <span className="text-black/50 dark:text-slate-500 font-bold">/</span>
          <span className="text-black dark:text-white font-black truncate max-w-[160px] xs:max-w-[220px] sm:max-w-xs md:max-w-md">
            Current dispatch
          </span>
        </nav>

        {isOfflineCached && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 rounded-xl p-3 px-4 mb-6 flex items-center gap-2.5 text-black dark:text-amber-200 text-xs font-bold" id="offline-banner">
            <WifiOff className="h-4 w-4 text-amber-600 shrink-0 animate-pulse" />
            <span><strong>Offline Mode:</strong> Viewing a saved copy of this dispatch retrieved from local memory.</span>
          </div>
        )}

        {/* Article Heading */}
        <h1 className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-black dark:text-white tracking-tight leading-tight mb-4">
          {post.title}
        </h1>

        {/* Writer Name, Avatar, Tag, Date, Time Read (In single line) */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-xs text-black dark:text-slate-200 font-sans mb-5 font-semibold" id="article-meta-line">
          <div className="flex items-center space-x-2">
            <img 
              src="https://i.imgur.com/gq2X5nE.jpeg" 
              alt="Current News Avatar" 
              decoding="async"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0 border border-stone-300 dark:border-stone-700"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.src = '/CurrentNews.png'; }}
            />
            <span className="font-bold text-black dark:text-white">
              {post.authorName || globalPenName || 'Current News'}
            </span>
          </div>

          <span className="text-black/40 dark:text-slate-600 hidden xs:inline">•</span>

          <span className="font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-[11px] sm:text-xs">
            {post.category || 'General'}
          </span>

          <span className="text-black/40 dark:text-slate-600">•</span>

          <span className="flex items-center space-x-1 text-black dark:text-slate-200 font-medium">
            <Calendar className="h-3.5 w-3.5 text-black dark:text-slate-300 shrink-0" />
            <span>{publishDate}</span>
          </span>

          <span className="text-black/40 dark:text-slate-600">•</span>

          <span className="flex items-center space-x-1 text-black dark:text-slate-200 font-medium">
            <Clock className="h-3.5 w-3.5 text-black dark:text-slate-300 shrink-0" />
            <span>3 min read</span>
          </span>
        </div>

        {/* Reactions without background box, Views, Share (Twitter, WhatsApp) */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 py-2" id="article-actions-bar">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {/* Like Button without background box */}
            <button
              onClick={() => handleReaction('liked')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer bg-transparent border-0 p-0 shadow-none ${
                currentReaction === 'like' ? 'text-emerald-700 dark:text-emerald-400' : 'text-black dark:text-slate-100 hover:text-emerald-800 dark:hover:text-white'
              }`}
              title="Like this dispatch"
              id="article-like-btn"
            >
              <ThumbsUp
                className={`h-4 w-4 transition-transform duration-150 ease-out ${
                  isHeartPopping ? 'scale-125' : 'scale-100'
                } ${
                  currentReaction === 'like'
                    ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400'
                    : 'text-black dark:text-slate-200'
                }`}
              />
              <span className="font-sans text-black dark:text-slate-100 font-bold">{displayedLikes} Likes</span>
            </button>

            {/* Dislike Button without background box */}
            <button
              onClick={() => handleReaction('disliked')}
              className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer bg-transparent border-0 p-0 shadow-none ${
                currentReaction === 'dislike' ? 'text-rose-700 dark:text-rose-400' : 'text-black dark:text-slate-100 hover:text-rose-800 dark:hover:text-white'
              }`}
              title="Dislike this dispatch"
              id="article-dislike-btn"
            >
              <ThumbsDown
                className={`h-4 w-4 ${
                  currentReaction === 'dislike'
                    ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400'
                    : 'text-black dark:text-slate-200'
                }`}
              />
              <span className="font-sans text-black dark:text-slate-100 font-bold">{displayedDislikes} Dislikes</span>
            </button>

            {/* Views */}
            <div className="inline-flex items-center gap-1.5 text-xs text-black dark:text-slate-100 font-bold" title="Total article views" id="article-views-count">
              <Eye className="h-4 w-4 text-black dark:text-slate-300 shrink-0" />
              <span className="font-sans text-black dark:text-slate-100 font-bold">{post.views || 0} Views</span>
            </div>
          </div>

          {/* Social Share Buttons (Guaranteed visible and touch-friendly on phone app & web) */}
          <div className="flex items-center gap-2 xs:gap-2.5 sm:gap-3 shrink-0" id="article-share-buttons">
            {/* Universal Native Share & Fallback Copy */}
            <button
              onClick={handleNativeShare}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white/90 dark:bg-stone-900/90 text-black dark:text-white hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-extrabold shadow-3xs"
              title="Share dispatch"
              id="native-share-btn"
            >
              <Share2 className="h-3.5 w-3.5 text-black dark:text-white" />
              <span className="text-[11px] font-black">{copied ? 'Copied!' : 'Share'}</span>
            </button>

            {/* X [Twitter] Share Button */}
            <a
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(dynamicShareUrl)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white/90 dark:bg-stone-900/90 text-black dark:text-white hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-3xs"
              title="Share on X (Twitter)"
              id="twitter-share-btn"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* WhatsApp Share Button */}
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${post.title}\n\n${dynamicShareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800/70 bg-[#25D366]/10 dark:bg-emerald-950/40 text-[#25D366] hover:bg-[#25D366]/20 dark:hover:bg-emerald-900/60 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-3xs"
              title="Share on WhatsApp"
              id="whatsapp-share-btn"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.966a9.9 9.9 0 0 0-6.98-2.82c-5.443 0-9.874 4.372-9.878 9.802-.001 1.77.463 3.5 1.34 5.023l-.99 3.616 3.704-.971zm11.367-6.405c-.31-.156-1.834-.905-2.119-1.008-.285-.104-.493-.156-.7.156-.207.312-.802 1.008-.984 1.217-.181.21-.362.235-.672.079-.31-.156-1.31-.483-2.496-1.542-.923-.824-1.546-1.841-1.727-2.153-.182-.312-.02-.481.136-.636.14-.139.31-.363.466-.546.156-.182.208-.312.31-.52.105-.209.052-.39-.026-.547-.078-.156-.7-1.691-.958-2.315-.252-.607-.51-.523-.7-.533l-.597-.01c-.207 0-.544.078-.83.39-.285.312-1.088 1.066-1.088 2.602 0 1.537 1.114 3.02 1.27 3.228.155.208 2.192 3.348 5.31 4.697.741.321 1.32.513 1.77.656.745.236 1.423.203 1.958.123.596-.089 1.834-.75 2.093-1.437.26-.687.26-1.277.182-1.402-.078-.125-.285-.208-.595-.364z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Horizontal Line Dividing Heading and Description */}
        <hr className="my-6 border-0 h-px bg-stone-300 dark:bg-stone-800" />

        {/* YouTube and Facebook Embeds: stacked on phone, side-by-side on large screen */}
        <EmbedHandler youtubeUrl={post.youtubeUrl} facebookUrl={post.facebookUrl} isHeader={true} />

        {/* Whole Story Content (No box design) */}
        <div 
          className="w-full bg-transparent border-0 p-0 shadow-none overflow-hidden" 
          id="article-main-box"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
              const src = target.getAttribute('src');
              if (src) {
                setLightboxImage(src);
              }
            }
          }}
        >
          {renderArticleContent()}

          {/* Custom References if any */}
          {post.customLinks && post.customLinks.length > 0 && (
            <EmbedHandler customLinks={post.customLinks} isHeader={false} />
          )}
        </div>

        {/* Additional Gallery if present */}
        {(() => {
          const galleryGridPhotos = (post.imageUrls || []).map((extraUrl, idx) => {
            const flow = post.galleryPositions?.[idx] || 'gallery';
            const isInline = flow === 'inline' ||
              Boolean(post.content?.match(new RegExp(`\\[fig(?:ure)?(?:\\.|\\s+)?\\s*${idx + 2}\\]`, 'i'))) ||
              Boolean(extraUrl && post.content && (post.content.includes(extraUrl) || post.content.includes(cleanImageUrl(extraUrl))));
            return {
              url: extraUrl,
              fallback: post.imageUrlsFallback?.[idx],
              idx,
              flow,
              isInline: Boolean(isInline)
            };
          }).filter(item => !item.isInline && item.flow === 'gallery');

          if (galleryGridPhotos.length === 0) return null;

          return (
            <div className="mt-8 pt-6 border-t border-stone-300 dark:border-stone-800" id="article-gallery-container">
              <h4 className="text-xs font-mono font-black text-black dark:text-slate-200 uppercase tracking-widest mb-4">
                Photo Evidence & Gallery ({galleryGridPhotos.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {galleryGridPhotos.map(({ url: extraUrl, fallback, idx }) => {
                  const rSrc = cleanImageUrl(extraUrl);
                  const rFallback = getFallbackImageUrl(extraUrl, fallback);
                  return (
                    <div 
                      key={idx} 
                      className="group overflow-hidden rounded-xl bg-stone-200/50 dark:bg-slate-900 cursor-pointer"
                      onClick={() => setLightboxImage(rSrc)}
                    >
                      <img 
                        src={rSrc} 
                        alt={`Evidence Image #${idx + 1}`} 
                        className="w-full h-44 sm:h-52 object-cover transition-transform duration-300 hover:scale-105 pointer-events-none" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (rFallback && target.src !== rFallback) {
                            target.src = rFallback;
                          } else {
                            target.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Tags Section without pill shapes, with comma between tags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-8 pt-4 flex flex-wrap items-center gap-1 text-xs text-black dark:text-slate-200 font-bold" id="article-hashtags">
            <span className="font-black text-black dark:text-white mr-1">#tags:</span>
            {post.hashtags.map((tag, idx) => {
              const cleanTag = tag.trim().replace(/^#/, '');
              const isLast = idx === post.hashtags.length - 1;
              return (
                <span key={idx} className="inline-flex items-center">
                  <Link
                    to={`/?search=${encodeURIComponent(cleanTag)}`}
                    className="text-black dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline transition-colors font-bold"
                  >
                    #{cleanTag}
                  </Link>
                  {!isLast && <span className="text-black/60 dark:text-slate-400 mr-1.5 font-bold">,</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* AdMob Native Advanced In-Article Bottom Unit */}
        {post && post.content && post.content.length > 200 && (
          <AdMobNativeAd slotKey="article-bottom" className="my-8" />
        )}

        {/* Bottom Reactions Section with message */}
        <div className="mt-12 sm:mt-16 pt-6 pb-4 flex flex-col items-center justify-center text-center space-y-3.5 w-full mx-auto" id="article-bottom-reactions">
          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white text-center">
            Enjoyed this article? Give a reaction below.
          </p>
          <div className="flex items-center justify-center gap-3.5">
            <button
              onClick={() => handleReaction('liked')}
              className={`min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-xs ${
                currentReaction === 'like'
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title="Like this dispatch"
              id="bottom-like-btn"
            >
              <ThumbsUp
                className={`h-4 w-4 transition-transform duration-150 ease-out ${
                  isHeartPopping ? 'scale-125' : 'scale-100'
                } ${
                  currentReaction === 'like'
                    ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-300'
                }`}
              />
              <span className="font-sans">{displayedLikes} Likes</span>
            </button>

            <button
              onClick={() => handleReaction('disliked')}
              className={`min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-xs ${
                currentReaction === 'dislike'
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title="Dislike this dispatch"
              id="bottom-dislike-btn"
            >
              <ThumbsDown
                className={`h-4 w-4 ${
                  currentReaction === 'dislike'
                    ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-300'
                }`}
              />
              <span className="font-sans">{displayedDislikes} Dislikes</span>
            </button>
          </div>
        </div>

        {/* Distinct Space Gap & End-of-Article Boundary */}
        <div className="my-16 sm:my-24 flex items-center justify-center gap-4 select-none" aria-hidden="true" id="article-end-boundary">
          <div className="h-px bg-slate-200 dark:bg-slate-700 grow" />
          <span className="text-slate-400 dark:text-slate-400 text-[11px] sm:text-xs tracking-widest font-mono uppercase px-2 font-semibold">
            End of Article
          </span>
          <div className="h-px bg-slate-200 dark:bg-slate-700 grow" />
        </div>

        {/* Editorial Disclaimer and Description (No box design) */}
        <div className="py-2" id="editorial-disclaimer-section">
          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            Editorial Disclaimer
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans max-w-3xl">
            The views, positions, and contents disclosed inside this publication correspond directly to raw press reportings and are filed on our secure servers under autonomous, zero-bias journalism guidelines.
          </p>
        </div>

        {/* Again Horizontal Grey Colour Line */}
        <hr className="my-8 border-0 h-px bg-slate-200 dark:bg-slate-700" />

        {/* Related Coverage Section (No box design, articles divided by horizontal grey lines) */}
        {relatedPosts.length > 0 && (
          <div className="mt-4" id="related-articles-section">
            <h3 className="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-500 rounded-xs"></span>
              <span>Related Coverage</span>
            </h3>
            <div className="flex flex-col" id="related-articles-list">
              {relatedPosts.map((relatedPost, idx) => (
                <div key={relatedPost.id} id={`related-article-item-${relatedPost.id}`}>
                  <Link
                    to={`/post/${relatedPost.id}/${slugify(relatedPost.title)}`}
                    onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}
                    className="group block bg-transparent border-0 p-0 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
                        {relatedPost.category || 'General'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {relatedPost.authorName || globalPenName || 'Current News'}
                      </span>
                    </div>
                    <h4 className="font-display font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 text-base sm:text-lg leading-[1.42] py-0.5 line-clamp-2 transition-colors duration-150 mb-2">
                      {relatedPost.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 sm:line-clamp-3 leading-relaxed mb-3 grow font-sans">
                      {getHtmlTextPreview(relatedPost.content, 140)}
                    </p>
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline inline-flex items-center gap-1">
                      <span>Read article</span>
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                  {idx < relatedPosts.length - 1 && (
                    <hr className="my-6 border-0 h-px bg-slate-200 dark:bg-slate-700" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Lightbox Modal Overlay */}
        {lightboxImage && (
          <div 
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md animate-fade-in"
            id="image-lightbox-overlay"
            onClick={() => setLightboxImage(null)}
          >
            <button 
              onClick={() => setLightboxImage(null)}
              className="absolute top-6 right-6 p-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white font-mono transition-colors border border-white/10 cursor-pointer flex items-center justify-center shadow-lg"
              aria-label="Close lightbox"
              title="Close zoom mode (Esc)"
            >
              <span className="text-xs font-bold tracking-wider mr-1.5 pl-1.5">CLOSE</span>
              <span className="text-xl leading-none pr-1.5">×</span>
            </button>
            
            <div className="max-w-[90vw] max-h-[80vh] relative flex flex-col justify-center items-center animate-scale-up">
              <img 
                src={cleanImageUrl(lightboxImage)} 
                alt="Expanded High Resolution View" 
                decoding="async"
                className="rounded-xl max-w-full max-h-[75vh] object-contain border border-white/10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fb = getFallbackImageUrl(target.src);
                  if (fb && target.src !== fb) {
                    target.src = fb;
                  }
                }}
              />
              
              <div className="mt-4 flex justify-center text-xs font-mono">
                <span className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-md text-xs tracking-wide">
                  Ground Report Image
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Quick Resume Banner when returning to an in-progress article */}
        {showResumeBanner && savedResumeProgress && (
          <aside 
            aria-label="Resume reading notification" 
            onMouseEnter={() => setIsBannerHovered(true)}
            onMouseLeave={() => setIsBannerHovered(false)}
            className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-slate-950/95 dark:bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700/80 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white truncate">Pick up where you left off</p>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 shrink-0">
                      {bannerTimeLeft}s
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">You read {savedResumeProgress.progress}% of this story</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleJumpToSavedPosition}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => setShowResumeBanner(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  aria-label="Dismiss reading resume notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Subtle animated auto-dismiss progress bar */}
            <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(bannerTimeLeft / 8) * 100}%` }}
              />
            </div>
          </aside>
        )}

      </article>
    </div>
  );
}
