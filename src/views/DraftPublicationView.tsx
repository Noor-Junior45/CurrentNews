import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { api } from '../utils/api';
import { Post, slugify } from '../types';
import { cleanImageUrl, sanitizePostImages } from '../utils/imageUrl';
import RichTextEditor, { RichTextEditorHandle } from '../components/RichTextEditor';
import PhotoAttachmentSection from '../components/PhotoAttachmentSection';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import AdminAuthGuard from '../components/AdminAuthGuard';
import { getCanonicalPostUrl } from '../utils/shareUrl';
import { getAvailableWriters } from '../utils/writers';
import { updateDocumentSEO } from '../utils/seo';
import { 
  CheckCircle, 
  AlertCircle, 
  X, 
  Trash2, 
  Clock, 
  Send, 
  PlusCircle, 
  Youtube, 
  Facebook, 
  Share2, 
  ArrowUpRight 
} from 'lucide-react';

export default function DraftPublicationView(): React.JSX.Element {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');

  const [isEditing, setIsEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [customLinks, setCustomLinks] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');

  const availableWriters = getAvailableWriters();
  const [selectedWriter, setSelectedWriter] = useState<string>(availableWriters[0] || 'Current News');
  const [authorName, setAuthorName] = useState(availableWriters[0] || 'Current News');
  const [category, setCategory] = useState('General');
  const [targetStatus, setTargetStatus] = useState<'published' | 'draft'>('published');
  const [sendEmailAlert, setSendEmailAlert] = useState(true);

  // Images state
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlFallback, setImageUrlFallback] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUrlsFallback, setImageUrlsFallback] = useState<string[]>([]);
  const [imagePosition, setImagePosition] = useState<'top' | 'middle' | 'bottom'>('top');
  const [galleryPositions, setGalleryPositions] = useState<('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[]>([]);

  const editorRef = useRef<RichTextEditorHandle>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);

  useEffect(() => {
    updateDocumentSEO({
      title: isEditing ? 'Edit Publication — Current News Live' : 'Draft New Publication — Current News Live',
      description: 'Current News Live autonomous article composer and publishing desk.',
      canonicalPath: '/admin/draft',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [isEditing]);

  // Load subscriber count for alert notice
  useEffect(() => {
    api.getSubscribersAdmin().then(subs => {
      setSubscribersCount(subs.length);
    }).catch(() => {});
  }, []);

  // If editing an existing article, fetch its record
  useEffect(() => {
    if (!editingId) {
      setIsEditing(false);
      setEditingPost(null);
      return;
    }

    const fetchPostToEdit = async () => {
      try {
        const res = await fetch(`/api/posts/${editingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.post) {
            const p = sanitizePostImages(data.post as Post);
            setEditingPost(p);
            setIsEditing(true);

            setTitle(p.title || '');
            setContent(p.content || '');
            setCategory(p.category || 'General');
            setYoutubeUrl(p.youtubeUrl || '');
            setFacebookUrl(p.facebookUrl || '');
            setCustomLinks(p.customLinks || []);
            setHashtags(p.hashtags || []);
            setImageUrl(p.imageUrl || '');
            setImageUrlFallback(p.imageUrlFallback || '');
            setImageUrls(p.imageUrls || []);
            setImageUrlsFallback(p.imageUrlsFallback || []);
            setImagePosition(p.imagePosition || 'top');
            setGalleryPositions(p.galleryPositions || []);

            if (p.authorName) {
              setAuthorName(p.authorName);
              setSelectedWriter(availableWriters.includes(p.authorName) ? p.authorName : 'custom');
            }
          }
        }
      } catch (err) {
        console.error('Failed to load post for editing:', err);
        setErrorMsg('Failed to load article details.');
      }
    };

    fetchPostToEdit();
  }, [editingId]);

  const handleResetForm = () => {
    setTitle('');
    setContent('');
    setYoutubeUrl('');
    setFacebookUrl('');
    setCustomLinks([]);
    setHashtags([]);
    setHashtagInput('');
    setImageUrl('');
    setImageUrlFallback('');
    setImageUrls([]);
    setImageUrlsFallback([]);
    setImagePosition('top');
    setGalleryPositions([]);
    setIsEditing(false);
    setEditingPost(null);
    setTargetStatus('published');
    setSelectedWriter(availableWriters[0] || 'Current News');
    setAuthorName(availableWriters[0] || 'Current News');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Publication headline cannot be blank.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Publication manuscript cannot be empty.');
      return;
    }

    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const filteredCustomLinks = customLinks.filter(link => link.trim() !== '');
    const filteredHashtags = hashtags.filter(tag => tag.trim() !== '');
    const cleanPrimaryImg = cleanImageUrl(imageUrl);
    const cleanPrimaryFallback = cleanImageUrl(imageUrlFallback);
    const filteredImageUrls = imageUrls.map(cleanImageUrl).filter(url => url.length > 0);
    const filteredImageUrlsFallback = imageUrlsFallback.map(cleanImageUrl).filter(url => url.length > 0);

    const resolvedAuthor = (selectedWriter === 'custom' ? authorName.trim() : selectedWriter) || 'Current News';

    const postPayload: any = {
      title: title.trim(),
      content: content,
      youtubeUrl: youtubeUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      customLinks: filteredCustomLinks,
      hashtags: filteredHashtags,
      authorName: resolvedAuthor,
      authorEmail: user?.email || '',
      authorId: user?.uid || '',
      category: category,
      status: targetStatus,
      imageUrl: cleanPrimaryImg,
      imageUrlFallback: cleanPrimaryFallback,
      imageUrls: filteredImageUrls,
      imageUrlsFallback: filteredImageUrlsFallback,
      imagePosition: imagePosition,
      galleryPositions: galleryPositions,
    };

    let publishedPostId = (isEditing && editingId) ? editingId : (`post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

    try {
      if (isEditing && editingId && editingPost) {
        postPayload.authorEmail = editingPost.authorEmail || user?.email || '';
        postPayload.authorId = editingPost.authorId || user?.uid || '';
      } else {
        postPayload.authorEmail = user?.email || '';
        postPayload.authorId = user?.uid || '';
      }

      const fullPostToSave = {
        id: publishedPostId,
        ...postPayload,
        status: targetStatus,
        createdAt: isEditing ? (editingPost?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likes: editingPost?.likes || 0,
        dislikes: editingPost?.dislikes || 0,
        views: editingPost?.views || 0,
      };

      const saveRes = await fetch('/api/articles/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPostToSave)
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save article to storage repository.');
      }

      setSuccessMsg(targetStatus === 'draft' ? 'Draft saved successfully!' : (isEditing ? 'Story updated and published successfully!' : 'Story published successfully!'));

      // Dispatch alert to subscribers if checked and published
      if (targetStatus === 'published' && sendEmailAlert) {
        try {
          const subs = await api.getSubscribersAdmin();
          const emails = subs.map(s => s.email).filter(Boolean);

          if (emails.length > 0) {
            const postLink = getCanonicalPostUrl(publishedPostId, title.trim());
            const emailPromises = emails.map(emailAddr => 
              fetch('/api/mail/send-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: emailAddr,
                  title: `Breaking News: ${title.trim()}`,
                  link: postLink
                })
              }).catch(() => {})
            );
            await Promise.all(emailPromises);
          }
        } catch (emailErr) {
          console.warn('Failed to dispatch alerts:', emailErr);
        }
      }

      // Dispatch background push notification if published
      if (targetStatus === 'published') {
        try {
          const cleanSnippet = content.replace(/<[^>]*>/g, ' ').replace(/\[fig\.\s*\d+\]/gi, ' ').replace(/\s+/g, ' ').trim();
          const notifBody = cleanSnippet.length > 120 ? cleanSnippet.substring(0, 117) + '...' : (cleanSnippet || 'A new article has just been published on Current News. Tap to read.');
          const notifTitle = `Breaking News: ${title.trim()}`;
          const safeNotifImage = (imageUrl && imageUrl.startsWith('http')) ? imageUrl : undefined;

          fetch('/api/push/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: notifTitle,
              body: notifBody,
              url: `/post/${publishedPostId}/${slugify(title.trim())}`,
              postId: publishedPostId,
              image: safeNotifImage,
              icon: 'https://i.imgur.com/gFgShoZ.jpeg'
            })
          }).catch(() => {});
        } catch {}
      }

      // Mirror article to Cloudflare R2 for instant zero-quota delivery
      try {
        const fullPostToSave = {
          id: publishedPostId,
          ...postPayload,
          status: targetStatus,
          createdAt: isEditing ? (editingPost?.createdAt || new Date().toISOString()) : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          likes: editingPost?.likes || 0,
          dislikes: editingPost?.dislikes || 0,
          views: editingPost?.views || 0,
        };
        await fetch('/api/articles/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPostToSave)
        });
      } catch (r2Err) {
        console.warn('R2 mirror notice:', r2Err);
      }

      handleResetForm();
      navigate('/admin/publications');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit publication.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans" id="draft-publication-view">
        <ProfilePageNavbar 
          title={isEditing ? 'Edit Story' : 'Draft New Publication'} 
          fallbackUrl="/profile" 
          onBack={() => navigate('/profile')} 
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

          <div className="py-2" id="story-form-inner-container">
            {isEditing && (
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 uppercase tracking-wider">
                  Editing Existing Dispatch
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/admin/publications')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                >
                  Back to Publications
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono" htmlFor="post-title">
                  Editorial Heading / Title *
                </label>
                <input
                  type="text"
                  id="post-title"
                  placeholder="e.g. BREAKING: New Infrastructure Project Approved"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-slate-950 dark:focus:ring-indigo-500 block placeholder:text-slate-400 font-medium"
                  maxLength={200}
                  required
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono" htmlFor="post-category">
                  Article Category Taxonomy *
                </label>
                <select
                  id="post-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-950 dark:focus:ring-indigo-500 block font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="General">General News</option>
                  <option value="Jharkhand">Jharkhand & Regional News</option>
                  <option value="Politics">Politics & Government</option>
                  <option value="Tech">Technology & Science</option>
                  <option value="Sports">Sports</option>
                  <option value="Opinion">Editorial & Opinion</option>
                  <option value="Business">Business & Finance</option>
                  <option value="Health">Health & Lifestyle</option>
                  <option value="World">World Dispatches</option>
                </select>
              </div>

              {/* Byline Writer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center justify-between" htmlFor="post-writer">
                  <span>Editorial Byline / Writer *</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans normal-case font-medium">
                    (Configured via VITE_WRITERS)
                  </span>
                </label>
                <select
                  id="post-writer"
                  value={selectedWriter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedWriter(val);
                    if (val !== 'custom') setAuthorName(val);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-950 dark:focus:ring-indigo-500 block font-medium text-slate-800 dark:text-slate-200 mb-2"
                >
                  {availableWriters.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                  <option value="custom">Other / Custom Author Name...</option>
                </select>

                {selectedWriter === 'custom' && (
                  <input
                    type="text"
                    id="post-author"
                    placeholder="Enter Custom Author Byline"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-slate-950 dark:focus:ring-indigo-500 block placeholder:text-slate-400 font-medium"
                    maxLength={100}
                    required
                  />
                )}
              </div>

              {/* Rich Text Editor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 font-mono">
                  Full Dispatch Manuscript *
                </label>
                <RichTextEditor
                  ref={editorRef}
                  value={content}
                  onChange={setContent}
                  placeholder="Compose your article dispatch..."
                  minHeight="350px"
                  onInsertPhotoMarker={(marker) => {
                    if (editorRef.current) {
                      editorRef.current.insertText(marker);
                    }
                  }}
                />
              </div>

              {/* Media Embeds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                    <Youtube className="w-4 h-4 text-red-500" />
                    <span>YouTube Broadcast URL (Optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono flex items-center gap-1.5">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <span>Facebook Video / Reel URL (Optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.facebook.com/.../videos/..."
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Photo Attachment Section */}
              <PhotoAttachmentSection
                primaryImageUrl={imageUrl}
                onPrimaryImageUrlChange={setImageUrl}
                primaryImageUrlFallback={imageUrlFallback}
                onPrimaryImageUrlFallbackChange={setImageUrlFallback}
                galleryUrls={imageUrls}
                onGalleryUrlsChange={setImageUrls}
                galleryUrlsFallback={imageUrlsFallback}
                onGalleryUrlsFallbackChange={setImageUrlsFallback}
                imagePosition={imagePosition}
                onImagePositionChange={setImagePosition}
                galleryPositions={galleryPositions}
                onGalleryPositionsChange={setGalleryPositions}
                onInsertFigureIntoContent={(figureTag) => {
                  if (editorRef.current) {
                    editorRef.current.insertText(figureTag);
                  }
                }}
              />

              {/* Custom External Links */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Reference & Secondary Links</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomLinks([...customLinks, ''])}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Link</span>
                  </button>
                </div>

                {customLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/source-document"
                      value={link}
                      onChange={(e) => {
                        const copy = [...customLinks];
                        copy[idx] = e.target.value;
                        setCustomLinks(copy);
                      }}
                      className="flex-1 px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomLinks(customLinks.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Hashtags */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                  Topic Hashtags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {hashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    >
                      <span>#{tag.replace(/^#/, '')}</span>
                      <button
                        type="button"
                        onClick={() => setHashtags(hashtags.filter((_, i) => i !== idx))}
                        className="hover:text-red-500 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. BreakingNews, Politics, Jharkhand"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (hashtagInput.trim()) {
                          setHashtags([...hashtags, hashtagInput.trim().replace(/^#/, '')]);
                          setHashtagInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (hashtagInput.trim()) {
                        setHashtags([...hashtags, hashtagInput.trim().replace(/^#/, '')]);
                        setHashtagInput('');
                      }
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-semibold rounded-lg"
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              {/* Automated Email Alert Toggle */}
              <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl p-4">
                <input
                  type="checkbox"
                  id="send-email-alert-checkbox"
                  checked={sendEmailAlert}
                  onChange={(e) => setSendEmailAlert(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-md border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="send-email-alert-checkbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer flex flex-col">
                  <span>Send Breaking News Email & Push Alert</span>
                  <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                    Notify {subscribersCount} active subscribers and connected mobile devices
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    navigate('/admin/publications');
                  }}
                  className="px-5 py-2.5 border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-full hover:bg-red-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>{isEditing ? 'Discard Changes' : 'Discard Draft'}</span>
                </button>

                <button
                  type="submit"
                  disabled={submitLoading}
                  onClick={() => setTargetStatus('draft')}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="h-4 w-4 text-slate-500 font-bold" />
                  <span>Save as Draft</span>
                </button>

                <button
                  type="submit"
                  disabled={submitLoading}
                  onClick={() => setTargetStatus('published')}
                  className="px-6 py-2.5 bg-slate-950 dark:bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-500 text-white text-xs font-bold rounded-full shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-400"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitLoading ? 'Transmitting...' : isEditing ? 'Update & Broadcast' : 'Publish Story'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
