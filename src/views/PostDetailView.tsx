import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Post, slugify } from '../types';
import AdSpace from '../components/AdSpace';
import EmbedHandler from '../components/EmbedHandler';
import { Calendar, ChevronLeft, Award, Clock, Twitter, Send, Copy, Check, Share2, ThumbsUp, ThumbsDown, ArrowRight } from 'lucide-react';

function getHtmlTextPreview(htmlString: string, maxLength: number = 160): string {
  if (!htmlString) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  const excerpt = tempDiv.textContent || tempDiv.innerText || '';
  if (excerpt.length <= maxLength) return excerpt;
  return excerpt.substring(0, maxLength).trim() + '...';
}

export default function PostDetailView() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [globalPenName, setGlobalPenName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Reactions Local States
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [myReaction, setMyReaction] = useState<'liked' | 'disliked' | null>(null);

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
            fetched.push({ id: docSnap.id, ...docSnap.data() } as Post);
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
    const setMetaTag = (attribute: string, attrVal: string, content: string) => {
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
    const summary = getHtmlTextPreview(post.content || '', 160);
    const authorVal = globalPenName || post.authorName || 'Chronicle Staff Report';
    
    let publishedIso = '';
    if (post.createdAt) {
      const d = typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate() : new Date(post.createdAt);
      if (!isNaN(d.getTime())) {
        publishedIso = d.toISOString();
      }
    }
    
    let modifiedIso = publishedIso;
    if (post.updatedAt) {
      const d = typeof post.updatedAt.toDate === 'function' ? post.updatedAt.toDate() : new Date(post.updatedAt);
      if (!isNaN(d.getTime())) {
        modifiedIso = d.toISOString();
      }
    }

    const currentUrl = window.location.href;
    const postKeywords = `current news live, news, independent ledger, journalism, ${post.category || 'general'}, ${post.title.toLowerCase().split(' ').slice(0, 6).join(', ')}`;
    const siteLogo = 'https://i.imgur.com/gFgShoZ.jpeg';
    const mainImg = post.imageUrl || siteLogo;

    // 2. Base SEO Tags & Mappings to Firestore Data
    setMetaTag('name', 'description', summary);
    setMetaTag('name', 'keywords', postKeywords);
    setMetaTag('name', 'author', authorVal);
    setMetaTag('name', 'robots', 'index, follow');
    setLinkTag('canonical', currentUrl);

    // 3. OpenGraph Tags mapped to Firestore / Dynamic values
    setMetaTag('property', 'og:title', post.title);
    setMetaTag('property', 'og:description', summary);
    setMetaTag('property', 'og:type', 'article');
    setMetaTag('property', 'og:url', currentUrl);
    setMetaTag('property', 'og:image', mainImg);
    setMetaTag('property', 'og:image:alt', `Illustration for ${post.title}`);
    setMetaTag('property', 'og:site_name', 'Current News Live');
    
    // Core OpenGraph Social Discovery tags requested by the user
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

    // 4. Twitter Card Tags
    setMetaTag('name', 'twitter:card', post.imageUrl ? 'summary_large_image' : 'summary');
    setMetaTag('name', 'twitter:title', post.title);
    setMetaTag('name', 'twitter:description', summary);
    setMetaTag('name', 'twitter:image', mainImg);

    // 5. Schema.org JSON-LD structured microdata rich-results tag for top Google search indexation!
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": currentUrl
      },
      "headline": post.title,
      "description": summary,
      "image": [mainImg],
      "datePublished": publishedIso || new Date().toISOString(),
      "dateModified": modifiedIso || new Date().toISOString(),
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
      document.title = "Current News Live | Independent Journalism";
      // Remove JSON-LD tag on unmount to prevent stale schema
      const staleLd = document.getElementById('post-jsonld-schema');
      if (staleLd) staleLd.remove();
    };
  }, [post, globalPenName]);

  const handleReaction = async (type: 'liked' | 'disliked') => {
    if (!post) return;
    const postRef = doc(db, 'posts', post.id);
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
      const updates: Record<string, any> = {};
      if (likesDiff !== 0) updates.likes = increment(likesDiff);
      if (dislikesDiff !== 0) updates.dislikes = increment(dislikesDiff);
      if (Object.keys(updates).length > 0) {
        await updateDoc(postRef, updates);
      }
    } catch (err) {
      console.error('Failed to write reaction to cloud', err);
    }
  };

  const handleCopyLink = () => {
    if (post) {
      const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}/${slugify(post.title)}` : `https://currentnewslive.vercel.app/post/${post.id}/${slugify(post.title)}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);

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
          setPost({
            id: docSnap.id,
            ...docSnap.data()
          } as Post);
        } else {
          setError('Article not found. The article could have been removed by an administrator or has an incorrect web link.');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch article details. There might be a temporary server disconnection.');
        try {
          handleFirestoreError(err, OperationType.GET, docPath);
        } catch (wrappedErr) {
          // Keep state running for client-side rendering
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
              article_author: globalPenName || post.authorName || 'Chronicle Staff Report',
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-mono font-medium">Downloading full publication content...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center" id="post-detail-error">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8" id="error-box">
          <h3 className="font-display font-bold text-lg text-slate-900 mb-2">Failed to Load Article</h3>
          <p className="text-sm text-slate-600 mb-6">{error || 'Unknown error occurred.'}</p>
          <Link 
            to="/" 
            className="inline-flex items-center space-x-1 bg-slate-900 text-white hover:bg-slate-800 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Public Feed</span>
          </Link>
        </div>
      </div>
    );
  }

  // Format publication date
  let publishDate = 'Recent Post';
  if (post.createdAt) {
    const d = typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate() : new Date(post.createdAt);
    publishDate = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const renderArticleContent = () => {
    if (!post) return null;
    let contentHtml = post.content || '';

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
        return `<div class="my-8 flex justify-center"><img src="${src}" alt="Attached Chronicle Image" class="rounded-2xl max-w-full h-auto border border-slate-200 shadow-md transform hover:scale-[1.01] transition-all duration-300 md:max-h-[500px]" referrerPolicy="no-referrer" /></div>`;
      });

      // Handle raw non-imgur direct image links inside paragraphs
      const pDirectImgPattern = /<p>\s*(https?:\/\/[^\s<>'"]+\.(?:png|jpg|jpeg|gif|webp))\s*<\/p>/gi;
      text = text.replace(pDirectImgPattern, (match, url) => {
        return `<div class="my-8 flex justify-center"><img src="${url}" alt="Attached Chronicle Image" class="rounded-2xl max-w-full h-auto border border-slate-200 shadow-md transform hover:scale-[1.01] transition-all duration-300 md:max-h-[500px]" referrerPolicy="no-referrer" /></div>`;
      });

      return text;
    };

    contentHtml = replaceBareUrls(contentHtml);

    // Render based on imageUrl and imagePosition configuration
    if (post.imageUrl && post.imageUrl.trim().length > 0) {
      let resolvedSrc = post.imageUrl.trim();
      if (resolvedSrc.includes('imgur.com') && !/\.(png|jpg|jpeg|gif|webp)$/i.test(resolvedSrc)) {
        resolvedSrc = resolvedSrc.replace('imgur.com', 'i.imgur.com') + '.jpg';
      }

      const imageElementHtml = `
        <div class="my-8 flex justify-center" id="featured-article-photo-container">
          <img src="${resolvedSrc}" alt="Dispatch Feature Photo" class="rounded-2xl max-w-full h-auto border border-slate-250 shadow-md hover:shadow-lg transition-all duration-350 md:max-h-[550px]" referrerPolicy="no-referrer" />
        </div>
      `;

      if (post.imagePosition === 'top') {
        return (
          <div>
            <div dangerouslySetInnerHTML={{ __html: imageElementHtml }} />
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} className="article-rich-text prose max-w-none break-word break-words" id="article-content" />
          </div>
        );
      } else if (post.imagePosition === 'bottom') {
        return (
          <div>
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} className="article-rich-text prose max-w-none break-word break-words" id="article-content" />
            <div dangerouslySetInnerHTML={{ __html: imageElementHtml }} />
          </div>
        );
      } else { // 'middle' position split
        const paragraphs = contentHtml.split('</p>');
        if (paragraphs.length > 2) {
          const middleIndex = Math.floor(paragraphs.length / 2);
          const firstHalf = paragraphs.slice(0, middleIndex).join('</p>') + '</p>';
          const secondHalf = paragraphs.slice(middleIndex).join('</p>');
          return (
            <div>
              <div dangerouslySetInnerHTML={{ __html: firstHalf }} className="article-rich-text prose max-w-none break-word break-words mb-4" />
              <div dangerouslySetInnerHTML={{ __html: imageElementHtml }} />
              <div dangerouslySetInnerHTML={{ __html: secondHalf }} className="article-rich-text prose max-w-none break-word break-words mt-4" id="article-content" />
            </div>
          );
        } else {
          return (
            <div>
              <div dangerouslySetInnerHTML={{ __html: imageElementHtml }} />
              <div dangerouslySetInnerHTML={{ __html: contentHtml }} className="article-rich-text prose max-w-none break-word break-words" id="article-content" />
            </div>
          );
        }
      }
    }

    return (
      <div 
        className="article-rich-text prose max-w-none break-word break-words"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
        id="article-content"
      />
    );
  };

  const dynamicShareUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}/${slugify(post.title)}` : `https://currentnewslive.vercel.app/post/${post.id}/${slugify(post.title)}`;

  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id={`article-${post.id}`}>
      
      {/* Editorial Breadcrumbs & Back Trigger */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="breadcrumbs-header">
        <nav className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Link 
            to="/" 
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Home
          </Link>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
          <Link 
            to={`/?category=${encodeURIComponent(post.category || 'General')}`} 
            className="hover:text-indigo-600 text-indigo-500 dark:hover:text-indigo-400 dark:text-indigo-400 transition-colors"
          >
            {post.category || 'General'}
          </Link>
          <span className="text-slate-300 dark:text-slate-700 font-normal">/</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs md:max-w-md">
            Current dispatch
          </span>
        </nav>
        <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400 font-bold font-mono px-2.5 py-1 rounded-sm uppercase tracking-widest shrink-0 self-start sm:self-auto">
          Independent Edition
        </span>
      </div>

      {/* ⚠️ AD PLACEMENT: Leaderboard top cover */}
      <AdSpace type="leaderboard" />

      {/* Main Grid: Left for article detail, Right for sticky sidebar banner */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 mt-8">
        
        {/* Left main area: takes 3/4 layout */}
        <div className="lg:col-span-3">
          
          {/* Article Header */}
          <header className="border-b border-slate-200 pb-6 mb-8">
            <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-slate-950 tracking-tight leading-tight mb-4">
              {post.title}
            </h1>

            {/* Author Meta */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-sans mt-6">
              <div className="flex items-center space-x-2.5">
                <img 
                  src="https://i.imgur.com/gFgShoZ.jpeg" 
                  alt="Current News Live Avatar" 
                  className="h-9 w-9 rounded-full object-cover border border-slate-200/80 shadow-xs"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <span className="font-semibold text-slate-900 block leading-tight">
                    {globalPenName || post.authorName || 'Chronicle Staff Report'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider flex items-center gap-1 uppercase">
                    <Award className="h-3 w-3 text-amber-500" /> Ground Journalism
                  </span>
                </div>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <span className="flex items-center space-x-1">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{publishDate}</span>
              </span>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <span className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>3 min read</span>
              </span>
            </div>

            {/* Share action bar */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              {/* Readers Reaction Buttons */}
              <div className="flex items-center gap-2" id="article-reactions-group">
                <button
                  onClick={() => handleReaction('liked')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all border cursor-pointer ${
                    myReaction === 'liked'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-3xs'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title="Like this dispatch"
                >
                  <ThumbsUp className={`h-4 w-4 ${myReaction === 'liked' ? 'fill-emerald-600 animate-pulse' : ''}`} />
                  <span>{likes} Likes</span>
                </button>

                <button
                  onClick={() => handleReaction('disliked')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all border cursor-pointer ${
                    myReaction === 'disliked'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-3xs'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title="Dislike this dispatch"
                >
                  <ThumbsDown className={`h-4 w-4 ${myReaction === 'disliked' ? 'fill-rose-600' : ''}`} />
                  <span>{dislikes} Dislikes</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Twitter Share */}
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(dynamicShareUrl)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:hover:bg-sky-900/40 dark:text-sky-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Share on Twitter"
                >
                  <Twitter className="h-3.5 w-3.5" />
                  <span>Twitter</span>
                </a>

                {/* WhatsApp Share */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title + ' ' + dynamicShareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Share on WhatsApp"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Copy Link to Clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500 animate-bounce" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* Clean Rendered HTML Article Body & Embed Handler in same box */}
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 sm:p-10 overflow-hidden" 
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
            {/* AUTO-EMBED SECTION: Injects custom YouTube and FaceBook players natively above the text */}
            <EmbedHandler youtubeUrl={post.youtubeUrl} facebookUrl={post.facebookUrl} customLinks={post.customLinks} isHeader={true} />

            {/* Main Rich Text Content & Image Inline integration */}
            {renderArticleContent()}
          </div>

          {/* ⚠️ AD PLACEMENT: Footer bottom ad zone */}
          <AdSpace type="footer" />

        </div>

        {/* Right Area: Sticky sidebar takes 1/4 layout */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            
            {/* ⚠️ AD PLACEMENT: Sidebar ad zone */}
            <AdSpace type="sidebar" />

            {/* Additional informational widgets */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
              <h4 className="font-display font-extrabold text-sm text-slate-950 uppercase tracking-widest border-b border-slate-100 pb-3 mb-3">
                Editorial Disclaimer
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                The views, positions, and contents disclosed inside this publication correspond directly to raw press reportings and are filed on our secure servers under autonomous, zero-bias journalism guidelines.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Related Articles Section */}
      {relatedPosts.length > 0 && (
        <div className="mt-16 pt-10 border-t border-slate-200" id="related-articles-section">
          <h3 className="font-display font-extrabold text-xl text-slate-900 dark:text-white uppercase tracking-wider mb-8 flex items-center gap-2">
            <span className="w-2.5 h-6 bg-indigo-650 rounded-sm"></span>
            <span>Related Coverage</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.id}
                to={`/post/${relatedPost.id}/${slugify(relatedPost.title)}`}
                className="group flex flex-col bg-white hover:bg-slate-50/40 border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-3xs hover:shadow-xs transition-all duration-200"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-2 font-mono">
                  {relatedPost.category || 'General'}
                </span>
                <h4 className="font-display font-black text-slate-900 group-hover:text-indigo-650 text-base leading-snug line-clamp-2 transition-colors duration-150 mb-3">
                  {relatedPost.title}
                </h4>
                <p className="text-xs text-slate-550 line-clamp-3 leading-relaxed mb-4 grow font-sans">
                  {getHtmlTextPreview(relatedPost.content, 120)}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                  <span>{relatedPost.authorName || globalPenName || 'Staff Report'}</span>
                  <span className="font-bold text-indigo-500 group-hover:text-indigo-600 inline-flex items-center gap-1">
                    <span>Read</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
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
          {/* Close button top right */}
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white font-mono transition-colors border border-white/10 cursor-pointer flex items-center justify-center shadow-lg"
            aria-label="Close lightbox"
            title="Close zoom mode (Esc)"
          >
            <span className="text-xs font-bold tracking-wider mr-1.5 pl-1.5">CLOSE</span>
            <span className="text-xl leading-none pr-1.5">×</span>
          </button>
          
          {/* Zoomed-In Image Panel */}
          <div className="max-w-[90vw] max-h-[80vh] relative flex flex-col justify-center items-center">
            <img 
              src={lightboxImage} 
              alt="Expanded High Resolution View" 
              className="rounded-xl max-w-full max-h-[75vh] object-contain border border-white/10 shadow-2xl transition-transform duration-300 transform scale-100"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
            
            {/* Download/Source Option bar */}
            <div className="mt-4 flex gap-3 text-xs font-mono text-slate-300">
              <span className="bg-slate-900/60 px-3 py-1 rounded-full border border-white/5 shadow max-w-[200px] sm:max-w-none truncate">
                Ground Report Image
              </span>
              <a 
                href={lightboxImage} 
                target="_blank" 
                rel="noreferrer" 
                className="bg-indigo-650 hover:bg-indigo-600 font-bold px-3 py-1 rounded-full text-white shadow transition-all cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                Open Original ↗
              </a>
            </div>
          </div>
        </div>
      )}

    </article>
  );
}
