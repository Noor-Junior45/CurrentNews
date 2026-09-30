import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, increment, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Post, slugify } from '../types';
import { cleanImageUrl, getFallbackImageUrl, sanitizePostImages } from '../utils/imageUrl';
import AdSpace from '../components/AdSpace';
import EmbedHandler from '../components/EmbedHandler';
import { Calendar, ChevronLeft, Award, Clock, Send, Copy, Check, Share2, ThumbsUp, ThumbsDown, ArrowRight, WifiOff, Eye, Hash, Bookmark, X } from 'lucide-react';
import { saveReadingProgress, getReadingProgress, ReadingProgressRecord } from '../utils/readingProgress';
import { signInWithGoogleSafe } from '../utils/authHelper';
import { safeFormatDate, safeToIsoString } from '../utils/dateHelper';

function getHtmlTextPreview(htmlString: string, maxLength: number = 160): string {
  if (!htmlString) return '';
  // Strip [fig. N] or [figure N] markers before previewing
  const cleaned = htmlString.replace(/\[fig(?:ure)?(?:\.|\s+)?\s*\d+[^\]]*\]/gi, '');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleaned;
  const excerpt = tempDiv.textContent || tempDiv.innerText || '';
  const clean = excerpt.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).trim() + '...';
}

export default function PostDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [globalPenName, setGlobalPenName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
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

  // Reactions Local States
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [myReaction, setMyReaction] = useState<'liked' | 'disliked' | null>(null);

  // Resume Reading & Cache State
  const [savedResumeProgress, setSavedResumeProgress] = useState<ReadingProgressRecord | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(false);

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
        const postsCol = collection(db, 'posts');
        const q = query(
          postsCol,
          where('status', '==', 'published'),
          where('category', '==', post.category || 'General'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const fetched: Post[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.id !== post.id) {
            fetched.push(sanitizePostImages({ id: docSnap.id, ...docSnap.data() } as Post));
          }
        });
        setRelatedPosts(fetched.slice(0, 3));
      } catch (err) {
        console.warn('Failed to fetch related posts', err);
      }
    };

    fetchRelatedPosts();
  }, [post]);

  useEffect(() => {
    if (post) {
      setLikes(post.likes || 0);
      setDislikes(post.dislikes || 0);
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
          // Keep local state for guests, but if they logged out reset
          setMyReaction(null);
        }
      });

      return () => unsubscribe();
    }
  }, [post]);

  useEffect(() => {
    if (!post) {
      document.title = "Current News Live | Independent Journalism";
      return;
    }

    // 1. Update Title Tag
    document.title = `${post.title} | Current News Live`;

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
    const authorVal = post.authorName || globalPenName || 'Chronicle Staff Report';
    
    const publishedIso = safeToIsoString(post.createdAt);
    const modifiedIso = post.updatedAt ? safeToIsoString(post.updatedAt) : publishedIso;

    const postSlug = slugify(post.title || '');
    const baseOrigin = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? 'https://www.currentnews.blog'
      : (typeof window !== 'undefined' ? window.location.origin : 'https://www.currentnews.blog');
    const canonicalUrl = postSlug ? `${baseOrigin}/post/${post.id}/${postSlug}` : `${baseOrigin}/post/${post.id}`;
    const postKeywords = `current news, news, independent ledger, journalism, ${post.category || 'general'}, ${post.title.toLowerCase().split(' ').slice(0, 6).join(', ')}`;
    const siteLogo = 'https://i.imgur.com/gFgShoZ.jpeg';
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
    setMetaTag('name', 'author', authorVal);
    setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setLinkTag('canonical', canonicalUrl);

    // 3. OpenGraph Tags mapped specifically for individual article social sharing
    setMetaTag('property', 'og:site_name', 'Current News Live');
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
    setMetaTag('property', 'article:publisher', 'https://www.currentnews.blog');

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

    // 5. Schema.org JSON-LD structured microdata NewsArticle
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonicalUrl
      },
      "headline": post.title,
      "description": summary,
      "image": [mainImg, ...(post.imageUrls ? post.imageUrls.map(cleanImageUrl) : [])],
      "datePublished": publishedIso || new Date().toISOString(),
      "dateModified": modifiedIso || new Date().toISOString(),
      "articleSection": post.category || 'General',
      "keywords": post.hashtags && post.hashtags.length ? post.hashtags.join(', ') : postKeywords,
      "author": {
        "@type": "Person",
        "name": authorVal,
        "jobTitle": "Journalist"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Current News Live",
        "logo": {
          "@type": "ImageObject",
          "url": siteLogo
        }
      }
    };
    setJsonLd('post-jsonld-schema', jsonLdData);

    return () => {
      // Restore default application title & canonical on unmount
      document.title = "Current News Live - Independent Ledger";
      setLinkTag('canonical', 'https://www.currentnews.blog/');

      // Revert base SEO tags
      setMetaTag('name', 'description', 'Current News Live - The independent ledger delivering premium uncorrupted journalism, real-time investigative disclosures, opinion dispatches, and geopolitical analysis.');
      setMetaTag('name', 'author', 'Independent Chronicle Staff');

      // Revert OpenGraph tags back to default site metadata
      setMetaTag('property', 'og:site_name', 'Current News');
      setMetaTag('property', 'og:type', 'website');
      setMetaTag('property', 'og:title', 'Current News Live - Independent Ledger');
      setMetaTag('property', 'og:description', 'Premium uncorrupted journalism, real-time investigative disclosures, opinion dispatches, and geopolitical analysis.');
      setMetaTag('property', 'og:url', 'https://www.currentnews.blog/');
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

    const postRef = doc(db, 'posts', post.id);
    const reactionRef = doc(db, 'reactions', `${user.uid}_${post.id}`);

    let newLikes = likes;
    let newDislikes = dislikes;
    let nextReaction: 'liked' | 'disliked' | null = null;

    let likesDiff = 0;
    let dislikesDiff = 0;

    if (myReaction === type) {
      // Undo
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
      // Apply
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
      console.error('Failed to write reaction to cloud', err);
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

  const getCanonicalPostShareUrl = () => {
    if (!post) return 'https://www.currentnews.blog';
    const postSlug = slugify(post.title || '');
    const baseOrigin = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? 'https://www.currentnews.blog'
      : (typeof window !== 'undefined' ? window.location.origin : 'https://www.currentnews.blog');
    return postSlug ? `${baseOrigin}/post/${post.id}/${postSlug}` : `${baseOrigin}/post/${post.id}`;
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
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: post.title,
            text: getHtmlTextPreview(post.content || '', 120),
            url: shareUrl,
          });
        } catch (err) {
          console.error('Error sharing content:', err);
          // Only fallback if not a user cancellation (AbortError)
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
    const fetchPost = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setIsOfflineCached(false);

      // Load global pen name setting
      try {
        const docSettings = await getDoc(doc(db, 'settings', 'editorProfile'));
        if (docSettings.exists()) {
          setGlobalPenName(docSettings.data().penName || '');
        }
      } catch (settingsErr) {
        console.warn('Failed to load global profile settings', settingsErr);
      }

      const docPath = `posts/${id}`;
      try {
        const docRef = doc(db, 'posts', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const rawDoc = docSnap.data();
          let postData = {
            id: docSnap.id,
            ...rawDoc
          } as Post;
          
          postData = sanitizePostImages(postData);

          // If stored document had malformed URLs, auto-repair silently in Firestore
          if (
            (rawDoc.imageUrl && rawDoc.imageUrl !== postData.imageUrl) ||
            (rawDoc.imageUrls && JSON.stringify(rawDoc.imageUrls) !== JSON.stringify(postData.imageUrls))
          ) {
            updateDoc(docRef, {
              imageUrl: postData.imageUrl || '',
              imageUrlFallback: postData.imageUrlFallback || '',
              imageUrls: postData.imageUrls || [],
              imageUrlsFallback: postData.imageUrlsFallback || []
            }).catch((patchErr) => console.warn('Silent auto-repair of post image URLs in Firestore:', patchErr));
          }
          
          // Increment and display views
          const viewedSessionKey = `viewed_post_${id}`;
          const alreadyViewed = sessionStorage.getItem(viewedSessionKey);
          if (!alreadyViewed) {
            sessionStorage.setItem(viewedSessionKey, 'true');
            try {
              await updateDoc(docRef, { views: increment(1) });
              postData.views = (postData.views || 0) + 1;
            } catch (viewErr) {
              console.warn('Failed to update views in Firestore:', viewErr);
            }
          }
          
          setPost(postData);
          try {
            localStorage.setItem('cached_post_' + id, JSON.stringify(postData));
          } catch (cacheErr) {
            console.warn('Failed to save post cache', cacheErr);
          }
        } else {
          setError('Article not found. The article could have been removed by an administrator or has an incorrect web link.');
        }
      } catch (err) {
        console.error('Fetch post failed, checking offline cache:', err);
        try {
          const cached = localStorage.getItem('cached_post_' + id);
          if (cached) {
            setPost(sanitizePostImages(JSON.parse(cached)));
            setIsOfflineCached(true);
          } else {
            setError('Failed to fetch article details. There might be a temporary server disconnection.');
            try {
              handleFirestoreError(err, OperationType.GET, docPath);
            } catch (wrappedErr) {
              // Keep state running for client-side rendering
            }
          }
        } catch (cacheReadErr) {
          setError('Failed to fetch article details. There might be a temporary server disconnection.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
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
              article_author: post.authorName || globalPenName || 'Chronicle Staff Report',
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center" id="post-detail-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-mono font-medium">Downloading full publication content...</p>
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
        return `<div class="my-6 flex justify-center w-full"><img src="${src}" alt="Attached Chronicle Image" class="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm transform hover:scale-[1.005] transition-all duration-300" referrerPolicy="no-referrer" onerror="this.style.display='none'" /></div>`;
      });

      // Handle raw non-imgur direct image links inside paragraphs
      const pDirectImgPattern = /<p>\s*(https?:\/\/[^\s<>'"]+\.(?:png|jpg|jpeg|gif|webp))\s*<\/p>/gi;
      text = text.replace(pDirectImgPattern, (match, url) => {
        return `<div class="my-6 flex justify-center w-full"><img src="${url}" alt="Attached Chronicle Image" class="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm transform hover:scale-[1.005] transition-all duration-300" referrerPolicy="no-referrer" onerror="this.style.display='none'" /></div>`;
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
              <img src="${pUrl}" data-fallback="${fbUrl || ''}" alt="Article Photo" class="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm hover:shadow transition-all duration-300" referrerPolicy="no-referrer" onerror="${errorScript}" />
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
            className="rounded-xl max-w-full w-auto max-h-[360px] sm:max-h-[400px] h-auto object-contain border-0 shadow-sm hover:shadow transition-all duration-300"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              const fb = resolvedFallback;
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

    if (middlePhotos.length > 0) {
      const paragraphs = contentHtml.split('</p>');
      if (paragraphs.length > 2) {
        const middleIndex = Math.floor(paragraphs.length / 2);
        const firstHalf = paragraphs.slice(0, middleIndex).join('</p>') + '</p>';
        const secondHalf = paragraphs.slice(middleIndex).join('</p>');
        return (
          <div>
            {topPhotos}
            <div dangerouslySetInnerHTML={{ __html: firstHalf }} className="article-rich-text prose max-w-none break-word break-words mb-4" />
            {middlePhotos}
            <div dangerouslySetInnerHTML={{ __html: secondHalf }} className="article-rich-text prose max-w-none break-word break-words mt-4" id="article-content" />
            {bottomPhotos}
          </div>
        );
      }
    }

    const paragraphs = contentHtml.split('</p>');
    if (paragraphs.length >= 4) {
      const splitIndex = Math.min(3, Math.floor(paragraphs.length / 2));
      const firstChunk = paragraphs.slice(0, splitIndex).join('</p>') + '</p>';
      const secondChunk = paragraphs.slice(splitIndex).join('</p>');
      return (
        <div>
          {topPhotos}
          <div 
            className="article-rich-text prose max-w-none break-word break-words"
            dangerouslySetInnerHTML={{ __html: firstChunk }}
          />
          {middlePhotos}
          <AdSpace type="in-article" />
          <div 
            className="article-rich-text prose max-w-none break-word break-words mt-4"
            dangerouslySetInnerHTML={{ __html: secondChunk }}
            id="article-content"
          />
          {bottomPhotos}
        </div>
      );
    }

    return (
      <div>
        {topPhotos}
        <div 
          className="article-rich-text prose max-w-none break-word break-words"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          id="article-content"
        />
        {middlePhotos}
        {bottomPhotos}
      </div>
    );
  };

  const dynamicShareUrl = getCanonicalPostShareUrl();

  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" id={`article-page-outer-container-${post.id}`}>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id={`article-${post.id}`}>
        
        {/* Article Breadcrumbs Path */}
        <nav className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-6" id="breadcrumbs-header">
          <button 
            type="button"
            onClick={handleReturnToFeed} 
            className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1 font-bold"
          >
            <ChevronLeft className="h-3.5 w-3.5 -ml-1 text-slate-400" />
            <span>Home</span>
          </button>
          <span className="text-slate-400 font-normal">/</span>
          <Link 
            to={`/?category=${encodeURIComponent(post.category || 'General')}`} 
            className="hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {post.category || 'General'}
          </Link>
          <span className="text-slate-400 font-normal">/</span>
          <span className="text-slate-900 dark:text-white font-extrabold truncate max-w-[160px] xs:max-w-[220px] sm:max-w-xs md:max-w-md">
            Current dispatch
          </span>
        </nav>

        {isOfflineCached && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 rounded-xl p-3 px-4 mb-6 flex items-center gap-2.5 text-amber-900 dark:text-amber-200 text-xs font-medium" id="offline-banner">
            <WifiOff className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
            <span><strong>Offline Mode:</strong> Viewing a saved copy of this dispatch retrieved from local memory.</span>
          </div>
        )}

        {/* Article Heading */}
        <h1 className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
          {post.title}
        </h1>

        {/* Writer Name, Avatar, Tag, Date, Time Read (In single line) */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-xs text-slate-600 dark:text-slate-400 font-sans mb-5" id="article-meta-line">
          <div className="flex items-center space-x-2">
            <img 
              src="https://i.imgur.com/gq2X5nE.jpeg" 
              alt="Current News Avatar" 
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {post.authorName || globalPenName || 'Chronicle Staff Report'}
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700 hidden xs:inline">•</span>

          <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[11px] sm:text-xs">
            {post.category || 'General'}
          </span>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <span className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{publishDate}</span>
          </span>

          <span className="text-slate-300 dark:text-slate-700">•</span>

          <span className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>3 min read</span>
          </span>
        </div>

        {/* Reactions without background box, Views, Share (Twitter, WhatsApp) */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2" id="article-actions-bar">
          <div className="flex items-center gap-5 sm:gap-6 flex-wrap">
            {/* Like Button without background box */}
            <button
              onClick={() => handleReaction('liked')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer bg-transparent border-0 p-0 shadow-none ${
                myReaction === 'liked' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Like this dispatch"
              id="article-like-btn"
            >
              <ThumbsUp className={`h-4 w-4 ${myReaction === 'liked' ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400' : 'text-slate-500'}`} />
              <span className="font-sans">{likes} Likes</span>
            </button>

            {/* Dislike Button without background box */}
            <button
              onClick={() => handleReaction('disliked')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer bg-transparent border-0 p-0 shadow-none ${
                myReaction === 'disliked' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Dislike this dispatch"
              id="article-dislike-btn"
            >
              <ThumbsDown className={`h-4 w-4 ${myReaction === 'disliked' ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : 'text-slate-500'}`} />
              <span className="font-sans">{dislikes} Dislikes</span>
            </button>

            {/* Views */}
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" title="Total article views" id="article-views-count">
              <Eye className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-sans">{post.views || 0} Views</span>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="flex items-center gap-3" id="article-share-buttons">
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                onClick={handleNativeShare}
                className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center bg-transparent border-0"
                title="Share dispatch"
                id="native-share-btn"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}

            <a
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(dynamicShareUrl)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center bg-transparent border-0"
              title="Share on X"
              id="twitter-share-btn"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title + ' ' + dynamicShareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[#25D366] hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center bg-transparent border-0"
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
        <hr className="my-6 border-0 h-px bg-slate-200 dark:bg-slate-700" />

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
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800" id="article-gallery-container">
              <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-4">
                Photo Evidence & Gallery ({galleryGridPhotos.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {galleryGridPhotos.map(({ url: extraUrl, fallback, idx }) => {
                  const rSrc = cleanImageUrl(extraUrl);
                  const rFallback = getFallbackImageUrl(extraUrl, fallback);
                  return (
                    <div 
                      key={idx} 
                      className="group overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900 cursor-pointer"
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
          <div className="mt-8 pt-4 flex flex-wrap items-center gap-1 text-xs text-slate-600 dark:text-slate-400 font-medium" id="article-hashtags">
            <span className="font-bold text-slate-900 dark:text-white mr-1">#tags:</span>
            {post.hashtags.map((tag, idx) => {
              const cleanTag = tag.trim().replace(/^#/, '');
              const isLast = idx === post.hashtags.length - 1;
              return (
                <span key={idx} className="inline-flex items-center">
                  <Link
                    to={`/?search=${encodeURIComponent(cleanTag)}`}
                    className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors"
                  >
                    #{cleanTag}
                  </Link>
                  {!isLast && <span className="text-slate-400 mr-1.5">,</span>}
                </span>
              );
            })}
          </div>
        )}

        {/* AdSense Compliant In-Article Bottom Unit (displayed only when substantive content exists) */}
        {post && post.content && post.content.length > 200 && (
          <AdSpace type="article-bottom" className="my-8" />
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
                myReaction === 'liked'
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title="Like this dispatch"
              id="bottom-like-btn"
            >
              <ThumbsUp className={`h-4 w-4 ${myReaction === 'liked' ? 'fill-emerald-600 text-emerald-600 dark:fill-emerald-400 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300'}`} />
              <span className="font-sans">{likes} Likes</span>
            </button>

            <button
              onClick={() => handleReaction('disliked')}
              className={`min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-xs ${
                myReaction === 'disliked'
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title="Dislike this dispatch"
              id="bottom-dislike-btn"
            >
              <ThumbsDown className={`h-4 w-4 ${myReaction === 'disliked' ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : 'text-slate-500 dark:text-slate-300'}`} />
              <span className="font-sans">{dislikes} Dislikes</span>
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
                    className="group block bg-transparent border-0 p-0 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
                        {relatedPost.category || 'General'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {relatedPost.authorName || globalPenName || 'Staff Report'}
                      </span>
                    </div>
                    <h4 className="font-display font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 text-base sm:text-lg leading-snug line-clamp-2 transition-colors duration-150 mb-2">
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
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md transition-opacity duration-300"
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
            
            <div className="max-w-[90vw] max-h-[80vh] relative flex flex-col justify-center items-center">
              <img 
                src={cleanImageUrl(lightboxImage)} 
                alt="Expanded High Resolution View" 
                className="rounded-xl max-w-full max-h-[75vh] object-contain border border-white/10 shadow-2xl transition-transform duration-300 transform scale-100"
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
            className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-slate-950/95 dark:bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Bookmark className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">Pick up where you left off</p>
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
          </aside>
        )}

      </article>
    </div>
  );
}
