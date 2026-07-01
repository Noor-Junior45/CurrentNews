import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Post, slugify } from '../types';
import RichTextEditor from '../components/RichTextEditor';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  PlusCircle, 
  Edit3, 
  Trash2, 
  Newspaper, 
  Upload, 
  Youtube, 
  Facebook, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Clock, 
  Lock,
  ArrowUpRight,
  ShieldAlert,
  TrendingUp,
  Users,
  Share2,
  Mail,
  Rss,
  LayoutDashboard,
  Image as ImageIcon
} from 'lucide-react';

export default function AdminView() {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect unauthorized signed-in users
  useEffect(() => {
    if (!loading && user && !isAdmin) {
      console.warn('Unauthorized user blocked from admin console', user.email);
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, loading, navigate]);

  // Dashboard operation state
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [isEditing, setIsEditing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [customLinks, setCustomLinks] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [category, setCategory] = useState('General');
  const [targetStatus, setTargetStatus] = useState<'published' | 'draft'>('published');
  const [sendEmailAlert, setSendEmailAlert] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePosition, setImagePosition] = useState<'top' | 'middle' | 'bottom'>('top');
  const [pubListFilter, setPubListFilter] = useState<'all' | 'published' | 'drafts'>('all');

  // Global Pen Name dynamic profile fields
  const [globalPenName, setGlobalPenName] = useState<string>('');
  const [tempPenName, setTempPenName] = useState<string>('');
  const [isSavingPenName, setIsSavingPenName] = useState<boolean>(false);
  const [showPenNameModal, setShowPenNameModal] = useState<boolean>(false);

  // Audience list state loaded from zero baseline 
  const [subscribers, setSubscribers] = useState<any[]>([]);

  // Test email alert state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    isIpRestriction?: boolean;
    detail?: string;
    solution?: string;
  }>({ status: 'idle', message: '' });

  // Delete safety guard modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load all posts for manage list & profile settings
  const fetchAdminPosts = async () => {
    if (!isAdmin) return;
    setFeedLoading(true);
    const path = 'posts';
    let activePenName = '';
    try {
      // Fetch dynamic editor attribution pen name
      try {
        const emailKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'editorProfile';
        const docSnap = await getDoc(doc(db, 'settings', `profile_${emailKey}`));
        let nameVal = '';
        if (docSnap.exists()) {
          nameVal = docSnap.data().penName || '';
        } else {
          // Fallback to legacy shared editorProfile document if specific one is empty
          const fallbackSnap = await getDoc(doc(db, 'settings', 'editorProfile'));
          if (fallbackSnap.exists()) {
            nameVal = fallbackSnap.data().penName || '';
          }
        }
        activePenName = nameVal;
        setGlobalPenName(nameVal);
        setTempPenName(nameVal);
      } catch (settingsErr) {
        console.warn('Could not query dynamic profile attributes', settingsErr);
      }

      // Fetch dynamic audience list directly from Firestore subscribers collection
      try {
        const subSnap = await getDocs(query(collection(db, 'subscribers'), orderBy('createdAt', 'desc')));
        const fetchedSubs: any[] = [];
        subSnap.forEach((doc) => {
          fetchedSubs.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setSubscribers(fetchedSubs);
      } catch (subErr) {
        console.warn('Could not load subscriber list from database', subErr);
      }

      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetched: Post[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({
          id: doc.id,
          ...doc.data()
        } as Post);
      });

      // Filter publications so each admin only sees their own posts
      const ownPosts = fetched.filter(p => {
        if (p.authorEmail) {
          return p.authorEmail.toLowerCase() === user?.email?.toLowerCase();
        }
        // Fallback for legacy posts (no authorEmail): show only to primary admin mdhassan1738@gmail.com
        // or if the authorName matches their current active pen name
        const primaryAdmin = 'mdhassan1738@gmail.com';
        const isPrimaryAdmin = user?.email?.toLowerCase() === primaryAdmin;
        const matchesPenName = activePenName && p.authorName === activePenName;
        return isPrimaryAdmin || matchesPenName;
      });

      setPosts(ownPosts);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to download existing list of articles.');
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {}
    } finally {
      setFeedLoading(false);
    }
  };

  const handleDeleteSubscriber = async (subId: string) => {
    if (!window.confirm('Are you sure you want to delete this subscriber address?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteDoc(doc(db, 'subscribers', subId));
      setSubscribers(prev => prev.filter(item => item.id !== subId));
      setSuccessMsg('Subscriber address deleted successfully.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete subscriber.');
    }
  };

  const handleSavePenName = async () => {
    if (!tempPenName.trim()) {
      setErrorMsg('Pen name cannot be empty.');
      return;
    }
    setIsSavingPenName(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const emailKey = user?.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'editorProfile';
    const path = `settings/profile_${emailKey}`;
    try {
      await setDoc(doc(db, 'settings', `profile_${emailKey}`), {
        penName: tempPenName.trim(),
        updatedAt: serverTimestamp(),
        email: user?.email || ''
      });

      // Also automatically update all existing posts in Firestore written by this editor to use the new pen name
      try {
        const postsCol = collection(db, 'posts');
        const postsSnap = await getDocs(postsCol);
        const batchPromises: Promise<any>[] = [];
        postsSnap.forEach((postDoc) => {
          const data = postDoc.data();
          const isOwnPost = (data.authorEmail && data.authorEmail.toLowerCase() === user?.email?.toLowerCase()) ||
                            (!data.authorEmail && globalPenName && data.authorName === globalPenName && user?.email?.toLowerCase() === 'mdhassan1738@gmail.com');
          
          if (isOwnPost && data.authorName !== tempPenName.trim()) {
            const postRef = doc(db, 'posts', postDoc.id);
            batchPromises.push(updateDoc(postRef, {
              authorName: tempPenName.trim(),
              authorEmail: user?.email || '',
              authorId: user?.uid || ''
            }));
          }
        });
        if (batchPromises.length > 0) {
          await Promise.all(batchPromises);
          console.log(`Updated ${batchPromises.length} old articles with the new pen name.`);
        }
      } catch (updatePostsErr) {
        console.warn('Failed to update older articles with new pen name', updatePostsErr);
      }

      setGlobalPenName(tempPenName.trim());
      setSuccessMsg('Your custom author Pen Name has been updated successfully! Both your profile settings and older articles have been refreshed with this signature.');
      setShowPenNameModal(false);
      fetchAdminPosts(); // Refresh list to reflect the updated pen names immediately
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to update your custom author pen name signature.');
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (wrap) {}
    } finally {
      setIsSavingPenName(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminPosts();
    }
  }, [isAdmin]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      setErrorMsg('Authentication popup failed to instantiate.');
    }
  };

  const handleParseAndAddHashtags = (rawInput: string) => {
    const tokens = rawInput.split(/[\s,;]+/);
    const addedTags: string[] = [];
    
    tokens.forEach((tok) => {
      let cleaned = tok.trim();
      if (!cleaned) return;
      
      const formatted = cleaned.startsWith('#') ? cleaned : '#' + cleaned;
      if (formatted.length > 1 && !hashtags.includes(formatted) && !addedTags.includes(formatted)) {
        addedTags.push(formatted);
      }
    });

    if (addedTags.length > 0) {
      setHashtags((prev) => [...prev, ...addedTags]);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress.trim()) {
      setTestEmailFeedback({ status: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    
    setIsSendingTestEmail(true);
    setTestEmailFeedback({ status: 'idle', message: '' });

    try {
      const response = await fetch('/api/mail/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmailAddress.trim(),
          title: 'Test Notification: Brevo Email Dispatch Functional Alert Check',
          link: window.location.origin
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestEmailFeedback({ status: 'success', message: `Test email sent successfully to ${testEmailAddress.trim()} via Brevo API!` });
      } else {
        setTestEmailFeedback({ 
          status: 'error', 
          message: data.message || 'API request succeeded but server failed to dispatch.',
          isIpRestriction: data.isIpRestriction,
          detail: data.detail,
          solution: data.solution
        });
      }
    } catch (err: any) {
      console.error('Test email sending error:', err);
      setTestEmailFeedback({ status: 'error', message: err.message || 'Network error occurred while trying to contact mail server.' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setContent('');
    setYoutubeUrl('');
    setFacebookUrl('');
    setCustomLinks([]);
    setHashtags([]);
    setHashtagInput('');
    setAuthorName('');
    setCategory('General');
    setImageUrl('');
    setImageUrls([]);
    setImagePosition('top');
    setEditingPostId(null);
    setIsEditing(false);
    setSendEmailAlert(true);
    setErrorMsg(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    // Validate inputs
    if (!title.trim()) {
      setErrorMsg('Please specify an editorial heading/title.');
      return;
    }
    if (!content.trim() || content === '<p><br></p>') {
      setErrorMsg('An article must contain report or content text.');
      return;
    }

    setSubmitLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const filteredCustomLinks = customLinks.filter(lnk => lnk && lnk.trim().length > 0);
    const filteredImageUrls = imageUrls.filter(url => url && url.trim().length > 0);
    const filteredHashtags = hashtags
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag : '#' + tag);

    const postPayload: any = {
      title: title.trim(),
      content: content,
      youtubeUrl: youtubeUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      customLinks: filteredCustomLinks,
      hashtags: filteredHashtags,
      authorName: globalPenName.trim() || 'Current News Staff Report',
      authorEmail: user?.email || '',
      authorId: user?.uid || '',
      category: category,
      status: targetStatus,
      imageUrl: imageUrl.trim(),
      imageUrls: filteredImageUrls,
      imagePosition: imagePosition,
    };

    const path = 'posts';

    try {
      if (isEditing && editingPostId) {
        // Preserve original author information if editing
        const originalPost = posts.find(p => p.id === editingPostId);
        if (originalPost) {
          postPayload.authorEmail = originalPost.authorEmail || user?.email || '';
          postPayload.authorId = originalPost.authorId || user?.uid || '';
        }
        // Perform update
        const docRef = doc(db, 'posts', editingPostId);
        await updateDoc(docRef, {
          ...postPayload,
          updatedAt: serverTimestamp()
        });
        setSuccessMsg(targetStatus === 'draft' ? 'Draft saved successfully!' : 'Story file updated and published successfully!');

        // Dispatch alert to subscribers if checked and published
        if (targetStatus === 'published' && sendEmailAlert) {
          try {
            const subsSnap = await getDocs(collection(db, 'subscribers'));
            const emails: string[] = [];
            subsSnap.forEach((subDoc) => {
              const subData = subDoc.data();
              if (subData.email) {
                emails.push(subData.email);
              }
            });

            if (emails.length > 0) {
              const postLink = `${window.location.origin}/post/${editingPostId}/${slugify(title.trim())}`;
              const emailPromises = emails.map(emailAddr => 
                fetch('/api/mail/send-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: emailAddr,
                    title: `Breaking Update: ${title.trim()}`,
                    link: postLink
                  })
                }).catch(err => console.warn(`Failed to send email alert to ${emailAddr}`, err))
              );
              await Promise.all(emailPromises);
            }
          } catch (emailErr) {
            console.warn('Failed to dispatch alerts to subscribers:', emailErr);
          }
        }
      } else {
        // Perform creation
        const collectionRef = collection(db, path);
        const newDocRef = await addDoc(collectionRef, {
          ...postPayload,
          likes: 0,
          dislikes: 0,
          createdAt: serverTimestamp()
        });
        setSuccessMsg(targetStatus === 'draft' ? 'Draft manuscript saved successfully!' : 'Story file published successfully on the feed!');

        // Dispatch alert to subscribers if checked and published
        if (targetStatus === 'published' && sendEmailAlert) {
          try {
            const subsSnap = await getDocs(collection(db, 'subscribers'));
            const emails: string[] = [];
            subsSnap.forEach((subDoc) => {
              const subData = subDoc.data();
              if (subData.email) {
                emails.push(subData.email);
              }
            });

            if (emails.length > 0) {
              const postLink = `${window.location.origin}/post/${newDocRef.id}/${slugify(title.trim())}`;
              const emailPromises = emails.map(emailAddr => 
                fetch('/api/mail/send-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: emailAddr,
                    title: `Breaking News: ${title.trim()}`,
                    link: postLink
                  })
                }).catch(err => console.warn(`Failed to send email alert to ${emailAddr}`, err))
              );
              await Promise.all(emailPromises);
            }
          } catch (emailErr) {
            console.warn('Failed to dispatch alerts to subscribers:', emailErr);
          }
        }
      }

      handleResetForm();
      fetchAdminPosts();
      
      // Auto redirect to publications overview tab
      navigate('/admin?focus=publications');
    } catch (err) {
      console.error(err);
      setErrorMsg('Form submission rejection: Check record formats.');
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (wrapped) {}
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleTriggerEdit = (post: Post) => {
    setTitle(post.title);
    setContent(post.content);
    setYoutubeUrl(post.youtubeUrl || '');
    setFacebookUrl(post.facebookUrl || '');
    setCustomLinks(post.customLinks || []);
    setHashtags(post.hashtags || []);
    setAuthorName(post.authorName || '');
    setCategory(post.category || 'General');
    setTargetStatus(post.status || 'published');
    setImageUrl(post.imageUrl || '');
    setImageUrls(post.imageUrls || []);
    setImagePosition(post.imagePosition || 'top');
    setEditingPostId(post.id);
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    // Smoothly route admin to the 'draft' composer tab Segment 
    navigate('/admin?focus=draft');
  };

  const handleDeletePost = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const path = `posts/${id}`;
    try {
      await deleteDoc(doc(db, 'posts', id));
      setPosts(prev => prev.filter(p => p.id !== id));
      setSuccessMsg('Record deleted successfully from index.');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete live file. Authority required.');
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (wrapped) {}
    }
  };

  // 1. Loading screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mb-4" />
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Accessing Administrator authorization context...</span>
      </div>
    );
  }

  // 2. Unauthenticated screen
  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white border border-slate-200 rounded-3xl text-center shadow-lg" id="unauthorized-slate">
        <div className="bg-red-50 text-red-650 inline-flex p-4 rounded-full border border-red-150 mb-4">
          <ShieldAlert className="h-8 w-8 animate-bounce" />
        </div>
        <h2 className="text-xl font-display font-black text-slate-900 mb-2 uppercase tracking-tight">Access Prohibited</h2>
        <p className="text-xs text-slate-500 leading-relaxed font-sans mb-6">
          This portal strictly registers and authorizes Ledger news architects. Please authenticate with credentials verified in the system directory.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-slate-950 hover:bg-slate-900 active:scale-95 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all duration-150 shadow-md cursor-pointer inline-flex items-center justify-center space-x-2"
          >
            <span>Authenticate Secure Operator Access</span>
          </button>

          <button
            onClick={() => signOut(auth)}
            className="w-full text-slate-500 hover:text-slate-800 text-[11px] font-mono hover:underline cursor-pointer block"
          >
            Sign Out & Try Another Account
          </button>
        </div>
      </div>
    );
  }

  // 3. Fully authorized admin dashboard layout
  const params = new URLSearchParams(location.search);
  const currentSegment = params.get('focus') || 'dashboard';

  const segments = [
    { id: 'dashboard', label: 'Admin Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard, count: null },
    { id: 'draft', label: isEditing ? 'Edit Story' : 'Draft New Publication', shortLabel: isEditing ? 'Edit' : 'Draft', icon: PlusCircle, count: null },
    { id: 'publications', label: 'Current Publications', shortLabel: 'Stories', icon: Newspaper, count: posts.length },
    { id: 'audience', label: 'Audience Registry', shortLabel: 'Audience', icon: Mail, count: subscribers.length }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="admin-board-view">
      
      {/* Title Panel */}
      <div className="border-b-4 border-double border-slate-900 pb-6 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <div>
          <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-widest block mb-1">Editor-In-Chief Console</span>
          <h1 className="font-display font-extrabold text-3xl text-slate-950 tracking-tight leading-none uppercase">
            Ledger Content Architect
          </h1>
        </div>
        
        {/* Connection health visual indicator and close button */}
        <div className="flex items-center gap-3.5" id="admin-header-controls">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold rounded-lg font-mono">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Firestore Real-Time Authorized</span>
          </div>

          <button
            onClick={() => navigate('/')}
            className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 border-2 border-red-500 hover:border-red-600 rounded-lg bg-red-50 transition-all duration-200 cursor-pointer flex items-center justify-center font-bold"
            id="close-admin-portal-btn"
            title="Close page and exit portal"
          >
            <X className="h-5 w-5 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* 🧭 Segment Switcher Navigation Deck */}
      <div className="mb-10 bg-white/45 dark:bg-slate-900/40 backdrop-blur-md p-1.5 border border-white/60 dark:border-white/10 rounded-2xl md:rounded-full flex flex-col md:flex-row gap-2 shadow-lg shadow-slate-150/40 dark:shadow-none md:items-center w-full" id="segment-deck">
        {segments.map((seg) => {
          const isActive = currentSegment === seg.id;
          const Icon = seg.icon;
          return (
            <button
              key={seg.id}
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                navigate(`/admin?focus=${seg.id}`);
              }}
              className={`w-full md:flex-1 px-4 py-3 md:px-6 md:py-3.5 rounded-xl md:rounded-full text-xs font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center justify-between md:justify-center gap-2 ${
                isActive
                  ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-md scale-[1.01]'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{seg.label}</span>
              </div>
              {seg.count !== null && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black shrink-0 ${isActive ? 'bg-slate-800 dark:bg-slate-100 text-slate-200 dark:text-slate-800' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  {seg.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Line message overlays */}
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-800 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-sans font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm font-sans font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SECTION SEGMENT RENDERER */}
      
      {/* SEGMENT 1: ADMIN DASHBOARD AND INTEGRATION */}
      {currentSegment === 'dashboard' && (
        <div className="space-y-10" id="segment-dashboard-body">
          {/* Standalone Global Editor Profile Configuration */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6" id="editor-global-config">
            <div className="flex-1">
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold font-mono px-2 py-0.5 rounded-sm uppercase tracking-wider mb-2 inline-block">
                Global Content Attribution
              </span>
              <h3 className="font-display font-bold text-lg text-slate-900 mb-1 flex flex-wrap items-center gap-2">
                Active Pen Name Attribution: <span className="text-indigo-600 font-black decoration-indigo-200">{globalPenName || 'Chronicle Staff Report'}</span>
              </h3>
              <p className="text-xs text-slate-500 max-w-2xl font-sans leading-relaxed">
                Your configured Editor Pen Name is handled globally code-wide instead of being re-typed in form submissions. Changing your active Pen Name signature instantly updates the author attribution rendered on <strong>all past, current, and future</strong> news articles.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
              <input
                type="text"
                placeholder="e.g. Hassan Ahmed, Senior Editor"
                value={tempPenName}
                required
                onChange={(e) => setTempPenName(e.target.value)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 w-full sm:min-w-[240px] font-sans font-medium h-10"
                maxLength={60}
              />
              <button
                onClick={() => {
                  if (!tempPenName.trim()) {
                    setErrorMsg('Please specify a valid Pen Name.');
                    return;
                  }
                  setShowPenNameModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs py-2 px-4 rounded-lg cursor-pointer transition-all duration-150 shadow-xs h-10 flex items-center justify-center font-mono shrink-0 font-bold w-full sm:w-auto"
              >
                Update Name
              </button>
            </div>
          </div>

          {/* Safety Confirmation Renaming modal */}
          {showPenNameModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs" id="pen-name-prompt-modal">
              <div className="relative bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-lg font-display font-bold text-slate-950 mb-3 flex items-center gap-2">
                  ⚠️ Confirm Signature Re-Key
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 font-sans">
                  Are you sure you want to change your dynamic global Editor Pen Name signature to <strong className="text-slate-905 border-b border-dashed border-indigo-400">"{tempPenName}"</strong>?
                </p>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs leading-normal text-indigo-700 font-sans mb-6">
                  * By confirming, reader profiles viewing any live article published previously or in the future will automatically fetch and display this updated signature attribution.
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTempPenName(globalPenName);
                      setShowPenNameModal(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                    id="discard-rename-btn"
                  >
                    No, Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePenName}
                    disabled={isSavingPenName}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer"
                    id="confirm-rename-btn"
                  >
                    {isSavingPenName ? 'Updating...' : 'Yes, Change Name'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Metrics Panel */}
          <div id="editorial-analytics-dashboard">
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500 animate-bounce" /> Dynamic Database Metrics (From Zero Baseline)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Total Live Stories */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Total Live Stories</span>
                  <span className="text-2xl font-display font-black text-slate-900 mt-1 block">
                    {posts.filter(p => p.status !== 'draft').length}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                    Public index published
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600">
                  <Newspaper className="h-5 w-5 animate-pulse" />
                </div>
              </div>

              {/* Card 2: Draft Stories */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Internal Drafts</span>
                  <span className="text-2xl font-display font-black text-slate-900 mt-1 block">
                    {posts.filter(p => p.status === 'draft').length}
                  </span>
                  <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
                    Saved queue pending
                  </span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-amber-600">
                  <Clock className="h-5 w-5 animate-pulse" />
                </div>
              </div>

              {/* Card 3: Media Broadcasts */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-slate-400 tracking-wider block">Media Broadcasts</span>
                  <span className="text-2xl font-display font-black text-slate-900 mt-1 block">
                    {posts.filter(p => (!!p.youtubeUrl && p.youtubeUrl.trim() !== '') || (!!p.facebookUrl && p.facebookUrl.trim() !== '')).length}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                    Natively embed feeds
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-600">
                  <Share2 className="h-5 w-5" />
                </div>
              </div>

              {/* Card 4: Active Subscribers */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between" id="metric-card-subscribers">
                <div>
                  <span className="text-[10px] uppercase font-bold font-mono text-indigo-500 tracking-wider block">Audience Subscribers</span>
                  <span className="text-2xl font-display font-black text-slate-900 mt-1 block">
                    {subscribers.length}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">
                    Natively registered audience
                  </span>
                </div>
                <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-100/60 text-indigo-600">
                  <Mail className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Real Dynamic database indicator */}
            <div className="mt-5 p-4 bg-slate-50/50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold font-mono uppercase text-slate-500 tracking-wider block mb-1">
                  Firestore Stream Verification
                </span>
                <p className="text-xs text-slate-400 leading-normal font-sans">
                  All metric parameters on this dashboard are computed natively starting from a pristine baseline value of zero, directly derived from real active records.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded-md px-2 py-1">
                  Authentic Ledger Feed
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 2: DRAFT NEW PUBLICATION */}
      {currentSegment === 'draft' && (
        <div className="max-w-4xl mx-auto" id="story-form-section">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h2 className="font-display font-extrabold text-xl text-slate-900 flex items-center space-x-2">
                <PlusCircle className="h-5 w-5 text-indigo-600 animate-pulse" />
                <span>{isEditing ? 'Modify Story Publication' : 'Draft New Publication'}</span>
              </h2>
              {isEditing && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">
                  Editing Mode
                </span>
              )}
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 font-mono" htmlFor="post-title">
                  Editorial Heading / Title *
                </label>
                <input
                  type="text"
                  id="post-title"
                  placeholder="e.g. BREAKING: New Environmental Act Passed by Assembly"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-950 block placeholder:text-slate-400 font-sans font-medium"
                  maxLength={200}
                  required
                />
              </div>

              {/* Category selector dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 font-mono" htmlFor="post-category">
                  Article Category Taxonomy *
                </label>
                <select
                  id="post-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-950 block font-sans font-medium text-slate-800"
                >
                  <option value="General">General News</option>
                  <option value="Politics">Politics & Government</option>
                  <option value="Tech">Technology & Science</option>
                  <option value="Sports">Sports</option>
                  <option value="Opinion">Editorial & Opinion</option>
                  <option value="Business">Business & Finance</option>
                  <option value="Health">Health & Lifestyle</option>
                  <option value="World">World Dispatches</option>
                </select>
              </div>

              {/* Image Attachment Options group */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5" id="image-attachment-group">
                <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1 font-mono flex items-center space-x-1.5">
                  <ImageIcon className="h-4 w-4" />
                  <span>Attach Feature Illustration / Imgur / Image URL</span>
                </label>
                <span className="block text-[10px] text-slate-400 mb-3 leading-relaxed">
                  Paste a direct photo URL or Imgur link (e.g., <code>https://i.imgur.com/xxxxx.jpg</code>).
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 font-mono">
                      Image Web URL
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://i.imgur.com/aBcDeFg.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 font-sans font-medium text-slate-850 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 font-mono">
                      Photo Flow Placement
                    </label>
                    <select
                      value={imagePosition}
                      onChange={(e) => setImagePosition(e.target.value as 'top' | 'middle' | 'bottom')}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 font-sans font-medium text-slate-800"
                    >
                      <option value="top">🏞️ Top of Article</option>
                      <option value="middle">🏞️ Middle of Article</option>
                      <option value="bottom">🏞️ Last (Bottom of Article)</option>
                    </select>
                  </div>
                </div>

                {/* Additional photo gallery links list */}
                <div className="mt-4 pt-4 border-t border-slate-200/60">
                  <div className="mb-3">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">
                      Additional Photo Links / Gallery ({imageUrls.length})
                    </label>
                  </div>

                  {imageUrls.length === 0 ? (
                    <div className="text-center py-5 border border-dashed border-slate-200 bg-white/35 rounded-lg mb-3">
                      <span className="text-[11px] font-mono text-slate-400 block">No additional photos attached yet.</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
                      {imageUrls.map((lnk, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500 font-mono w-4 text-center">{idx + 1}</span>
                          <input
                            type="text"
                            placeholder="e.g. https://i.imgur.com/anotherImageUrl.jpg"
                            value={lnk}
                            onChange={(e) => {
                              const updated = [...imageUrls];
                              updated[idx] = e.target.value;
                              setImageUrls(updated);
                            }}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setImageUrls(imageUrls.filter((_, i) => i !== idx));
                            }}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
                            title="Remove image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setImageUrls([...imageUrls, ''])}
                    className="w-full justify-center px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white/45 dark:bg-slate-900/45 backdrop-blur-md text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:bg-white/70 dark:hover:bg-slate-800/70 shadow-2xs"
                    id="add-extra-photo-button"
                  >
                    <PlusCircle className="h-4 w-4 text-indigo-500" />
                    <span>Add Image Link</span>
                  </button>
                </div>
              </div>

              {/* Rich-Text content editor block */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 font-mono" htmlFor="post-content">
                  Article Content Prose *
                </label>
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <RichTextEditor value={content} onChange={setContent} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono leading-relaxed">
                  Provide rich formats, quotes, and layouts for reader retention.
                </p>
              </div>

              {/* YouTube Media integration embeds (Supports raw link or full iframe embed tags) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5" id="youtube-integration-group">
                <label className="block text-xs font-semibold text-red-650 uppercase tracking-wider mb-1 font-mono flex items-center space-x-1.5">
                  <Youtube className="h-4 w-4" />
                  <span>YouTube Media Integration (Paste URL or raw embed iframe code)</span>
                </label>
                <span className="block text-[10px] text-slate-400 mb-3 leading-relaxed">
                  Paste a simple YouTube video URL (e.g. <code>https://youtube.com/watch?v=...</code>) <strong>or</strong> paste the entire copied <code>&lt;iframe&gt;</code> embed block code directly.
                </span>
                <input
                  type="text"
                  placeholder="Paste YouTube watch link, short, or iframe embed code"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-red-500 font-sans font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Facebook Media integration embeds */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5" id="facebook-integration-group">
                <label className="block text-xs font-semibold text-blue-650 uppercase tracking-wider mb-1 font-mono flex items-center space-x-1.5">
                  <Facebook className="h-4 w-4" />
                  <span>Facebook Resource integration (Paste URL or raw embed iframe code)</span>
                </label>
                <span className="block text-[10px] text-slate-400 mb-3 leading-relaxed">
                  Embed a Facebook feed reference. Paste a post link (e.g. <code>https://facebook.com/...</code>) <strong>or</strong> paste the full Facebook <code>&lt;iframe&gt;</code> embed layout code.
                </span>
                <input
                  type="text"
                  placeholder="Paste Facebook item link, page reference, view, or iframe code block"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 font-sans font-medium text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Custom Social Embed Integration with dynamic add/remove inputs */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5" id="custom-embed-integration-group">
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-indigo-600 uppercase tracking-wider font-mono">
                    Social Embed Integration Links
                  </label>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-sans">
                    Add custom external hyperlinks or situational reference URLs below.
                  </span>
                </div>

                {customLinks.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-250 bg-white rounded-lg mb-4">
                    <span className="text-[11px] font-mono text-slate-400 block">No custom social hyperlinks added yet.</span>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {customLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 font-mono w-4 text-center">{idx + 1}</span>
                        <input
                          type="url"
                          placeholder="https://twitter.com/user/status/... or website URL link"
                          value={link}
                          onChange={(e) => {
                            const updated = [...customLinks];
                            updated[idx] = e.target.value;
                            setCustomLinks(updated);
                          }}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-slate-950 font-sans"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = customLinks.filter((_, i) => i !== idx);
                            setCustomLinks(updated);
                          }}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title="Remove link row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Horizontal Add Row button positioned below, matching Save Draft style */}
                <button
                  type="button"
                  onClick={() => setCustomLinks([...customLinks, ''])}
                  className="w-full justify-center px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white/45 dark:bg-slate-900/45 backdrop-blur-md text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:bg-white/70 dark:hover:bg-slate-800/70 shadow-2xs"
                >
                  <PlusCircle className="h-4 w-4 text-indigo-500" />
                  <span>Add Social/Hyperlink Row</span>
                </button>
              </div>

              {/* Hashtag Integration Group */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-5" id="hashtag-integration-group">
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-indigo-600 uppercase tracking-wider font-mono">
                    Trending Hashtags
                  </label>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-sans">
                    Categorize your story with Instagram-style trending tags. Readers can explore related articles by tapping them.
                  </span>
                </div>

                {/* Tag Pills List (shown above the add/input trigger) */}
                {hashtags.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-250 bg-white rounded-lg mb-4">
                    <span className="text-[11px] font-mono text-slate-400 block">No hashtags attached to this article.</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-4 bg-white p-3 border border-slate-200 rounded-lg">
                    {hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-150"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => setHashtags(hashtags.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-0.5 rounded-full transition-colors cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Trending quick suggestions */}
                <div className="mb-4">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Popular Suggestions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['#breaking', '#exclusive', '#politics', '#crime', '#investigation', '#localnews', '#community', '#sports'].map((sug) => {
                      const isAdded = hashtags.includes(sug);
                      return (
                        <button
                          type="button"
                          key={sug}
                          onClick={() => {
                            if (isAdded) {
                              setHashtags(hashtags.filter(t => t !== sug));
                            } else {
                              setHashtags([...hashtags, sug]);
                            }
                          }}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            isAdded
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {sug}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Hashtag input / button */}
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      id="custom-hashtag-input"
                      placeholder="Enter custom tag (e.g. #technology)"
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 font-sans"
                      onPaste={(e) => {
                        const pasteText = e.clipboardData.getData('text');
                        if (
                          pasteText.trim().includes(' ') || 
                          pasteText.trim().includes(',') || 
                          (pasteText.trim().match(/#/g) || []).length > 1
                        ) {
                          e.preventDefault();
                          handleParseAndAddHashtags(pasteText);
                          setHashtagInput('');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = hashtagInput.trim();
                          if (val) {
                            handleParseAndAddHashtags(val);
                            setHashtagInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setHashtagInput('')}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 border border-slate-200"
                      title="Clear custom tag box"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const val = hashtagInput.trim();
                      if (val) {
                        handleParseAndAddHashtags(val);
                        setHashtagInput('');
                      }
                    }}
                    className="w-full justify-center px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white/45 dark:bg-slate-900/45 backdrop-blur-md text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:bg-white/70 dark:hover:bg-slate-800/70 shadow-2xs"
                  >
                    <PlusCircle className="h-4 w-4 text-indigo-500" />
                    <span>Add Tag</span>
                  </button>
                </div>
              </div>

              {/* Automated Email Alerts Toggle Option */}
              <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 mb-4">
                <input
                  type="checkbox"
                  id="send-email-alert-checkbox"
                  checked={sendEmailAlert}
                  onChange={(e) => setSendEmailAlert(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-md border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="send-email-alert-checkbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer flex flex-col">
                  <span>Send automated breaking news alert circular to dynamic subscriber list</span>
                  <span className="text-[10px] text-slate-400 font-normal mt-0.5">Currently targeting {subscribers.length} registered recipient(s) securely via your Brevo API</span>
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-4 pt-5 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  {/* Red Discard Button */}
                  <button
                    type="button"
                    onClick={() => {
                      handleResetForm();
                      navigate('/admin?focus=dashboard');
                    }}
                    className="w-full sm:w-auto justify-center px-5 py-2.5 border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>{isEditing ? 'Discard Changes' : 'Discard Draft'}</span>
                  </button>

                  {/* Save Draft Button */}
                  <button
                    type="submit"
                    disabled={submitLoading}
                    onClick={() => setTargetStatus('draft')}
                    className="w-full sm:w-auto justify-center px-5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white/45 dark:bg-slate-900/45 backdrop-blur-md text-slate-800 dark:text-slate-200 text-xs font-bold rounded-full transition-all duration-200 cursor-pointer flex items-center gap-2 hover:bg-white/70 dark:hover:bg-slate-800/70"
                  >
                    <Clock className="h-4 w-4 text-slate-500 font-bold" />
                    <span>Save as Draft</span>
                  </button>

                  {/* Publish Button */}
                  <button
                    type="submit"
                    disabled={submitLoading}
                    onClick={() => setTargetStatus('published')}
                    className="w-full sm:w-auto justify-center bg-slate-950 hover:bg-slate-900 disabled:bg-slate-400 text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-xs"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{isEditing ? 'Publish Modification' : 'Publish Article'}</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* SEGMENT 3: CURRENT PUBLICATIONS */}
      {currentSegment === 'publications' && (
        <div className="max-w-4xl mx-auto" id="current-publications-list">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-150 pb-5 mb-6">
              <div>
                <h2 className="font-display font-extrabold text-xl text-slate-900 flex items-center space-x-2">
                  <Newspaper className="h-5 w-5 text-indigo-600" />
                  <span>Current Publications ({posts.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Manage, edit or delete your posted articles and draft manuscripts.</p>
              </div>

              {/* Status filter switcher buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto shrink-0">
                {(['all', 'published', 'drafts'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPubListFilter(mode)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                      pubListFilter === mode
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'text-slate-550 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'all' && 'All'}
                    {mode === 'published' && 'Published'}
                    {mode === 'drafts' && 'Drafts'}
                  </button>
                ))}
              </div>
            </div>

            {feedLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mb-2" />
                <span className="text-xs text-slate-500 font-mono">Loading dynamic reports ledger...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-205 rounded-xl bg-slate-50/50">
                <Newspaper className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-xs text-slate-500">No active publications compiled.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts
                  .filter(postItem => {
                    if (pubListFilter === 'published') return postItem.status !== 'draft';
                    if (pubListFilter === 'drafts') return postItem.status === 'draft';
                    return true;
                  })
                  .map((postItem) => {
                    let formattedDate = 'Recent';
                    if (postItem.createdAt) {
                      const d = typeof postItem.createdAt.toDate === 'function' ? postItem.createdAt.toDate() : new Date(postItem.createdAt);
                      formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                    const isDraftStatus = postItem.status === 'draft';
                    
                    return (
                      <div 
                        key={postItem.id} 
                        className={`p-4 border rounded-xl flex items-start justify-between gap-3 transition-all ${editingPostId === postItem.id ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-100' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-205'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold font-mono tracking-wider uppercase">
                              <Clock className="h-3.5 w-3.5" /> {formattedDate}
                            </span>
                            <span className="inline-block bg-slate-100 text-slate-650 text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border border-slate-200">
                              {postItem.category || 'General'}
                            </span>
                            {isDraftStatus ? (
                              <span className="inline-block bg-amber-50 text-amber-800 text-[9px] font-black font-mono tracking-wider uppercase px-1.5 py-0.5 rounded border border-amber-250">
                                DRAFT
                              </span>
                            ) : (
                              <span className="inline-block bg-emerald-50 text-emerald-800 text-[9px] font-black font-mono tracking-wider uppercase px-1.5 py-0.5 rounded border border-emerald-250">
                                PUBLISHED
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-905 font-display leading-snug" title={postItem.title}>
                            {postItem.title}
                          </h4>
                          <div className="flex items-center space-x-3 mt-2 text-[10px] text-slate-400 font-mono">
                            {postItem.youtubeUrl && <span className="flex items-center text-red-500 gap-0.5"><Youtube className="h-3.5 w-3.5" /> Video</span>}
                            {postItem.facebookUrl && <span className="flex items-center text-blue-500 gap-0.5"><Facebook className="h-3.5 w-3.5" /> Social</span>}
                          </div>
                        </div>

                        {/* Editing actions handles */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleTriggerEdit(postItem)}
                            title="Edit publication"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          
                          {/* Safety confirm trigger */}
                          {deleteConfirmId === postItem.id ? (
                            <div className="flex items-center bg-red-100 border border-red-200 rounded-lg px-2 py-0.5 space-x-2">
                              <span className="text-[10px] font-bold text-red-700 font-mono">Are you sure?</span>
                              <button
                                onClick={() => handleDeletePost(postItem.id)}
                                className="text-xs font-black text-red-800 hover:text-red-950 uppercase cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer font-bold"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(postItem.id)}
                              title="Delete publication"
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                          <Link 
                            to={`/post/${postItem.id}/${slugify(postItem.title)}`}
                            title="Open published article"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all cursor-pointer"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEGMENT 4: AUDIENCE REGISTRY */}
      {currentSegment === 'audience' && (
        <div className="max-w-4xl mx-auto" id="audience-subscribers-list">
          {/* Subscriber Registry audience list */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm font-sans mx-auto">
            <div className="border-b border-slate-100 pb-5 mb-6">
              <h2 className="font-display font-extrabold text-xl text-slate-900 flex items-center space-x-2">
                <Mail className="h-5 w-5 text-indigo-600" />
                <span>Audience Registry ({subscribers.length})</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Real-time directory of citizens registered via the footer's news subscription form. Use this audience list to gauge active subscriber engagement.
              </p>
            </div>

            {/* Brevo API Test Section */}
            <div className="mb-8 p-5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
                Brevo API Live Test Console
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Verify your Brevo transactional email setup in real time. Send a test news alert immediately to any address.
              </p>
              
              <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3.5 py-2 pl-9 border border-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg text-xs bg-white text-slate-800"
                    required
                  />
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <button
                  type="submit"
                  disabled={isSendingTestEmail}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all duration-150 flex items-center justify-center gap-2 disabled:bg-indigo-400 cursor-pointer"
                >
                  {isSendingTestEmail ? (
                    <>
                      <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <span>Send Test Mail</span>
                  )}
                </button>
              </form>

              {testEmailFeedback.status !== 'idle' && (
                <div className={`mt-3 p-3.5 rounded-lg text-xs flex flex-col gap-2 ${
                  testEmailFeedback.status === 'success' 
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-100 text-rose-800'
                }`}>
                  <div className="flex items-start gap-2.5">
                    {testEmailFeedback.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <span className="font-semibold">{testEmailFeedback.message}</span>
                  </div>

                  {testEmailFeedback.isIpRestriction && (
                    <div className="mt-1.5 pl-6 text-slate-700 space-y-2">
                      <div className="bg-white/80 border border-rose-200/50 p-2.5 rounded-md font-mono text-[10px] text-rose-900 break-all leading-relaxed">
                        <strong>Raw Brevo Response:</strong> {testEmailFeedback.detail}
                      </div>
                      <div className="bg-white/90 border border-indigo-100 p-3 rounded-lg text-indigo-900 shadow-xs">
                        <p className="font-bold mb-1">💡 Resolution Steps:</p>
                        <p className="leading-relaxed mb-2 text-slate-600">
                          Brevo has blocked the transaction because the cloud hosting environment's IP is not whitelisted. Because cloud IPs are dynamic, you should:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 text-slate-600 font-medium">
                          <li>Click this link to open your <a href="https://app.brevo.com/security/authorised_ips" target="_blank" rel="noopener noreferrer" className="underline text-indigo-600 hover:text-indigo-800 font-semibold">Brevo Authorised IPs settings</a>.</li>
                          <li>You can temporarily add the IP shown above or, to prevent future issues, <strong>disable IP whitelisting restriction</strong> altogether inside your Brevo Account settings (recommended for containerized previews).</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {subscribers.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Rss className="h-8 w-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                <p className="text-xs text-slate-400">Your subscriber ledger is currently empty.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscribers.map((sub) => {
                  let formattedDate = 'Recent signup';
                  if (sub.createdAt) {
                    const d = typeof sub.createdAt.toDate === 'function' ? sub.createdAt.toDate() : new Date(sub.createdAt);
                    formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  }
                  return (
                    <div key={sub.id} className="p-3.5 bg-slate-50 hover:bg-indigo-50/30 border border-slate-200 rounded-xl flex items-center justify-between transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 block truncate" title={sub.email}>
                          {sub.email}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          Registered: {formattedDate}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteSubscriber(sub.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg transition-colors cursor-pointer"
                        title="Delete subscriber address"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
