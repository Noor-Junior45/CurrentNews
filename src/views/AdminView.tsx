import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const [authorName, setAuthorName] = useState('');
  const [category, setCategory] = useState('General');
  const [targetStatus, setTargetStatus] = useState<'published' | 'draft'>('published');
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

  // Delete safety guard modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load all posts for manage list & profile settings
  const fetchAdminPosts = async () => {
    if (!isAdmin) return;
    setFeedLoading(true);
    const path = 'posts';
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
      setPosts(fetched);
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
      setGlobalPenName(tempPenName.trim());
      setSuccessMsg('Your custom author Pen Name has been updated successfully! Future articles you draft/edit will reflect this attribution.');
      setShowPenNameModal(false);
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

  const handleResetForm = () => {
    setTitle('');
    setContent('');
    setYoutubeUrl('');
    setFacebookUrl('');
    setCustomLinks([]);
    setAuthorName('');
    setCategory('General');
    setImageUrl('');
    setImageUrls([]);
    setImagePosition('top');
    setEditingPostId(null);
    setIsEditing(false);
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

    const postPayload = {
      title: title.trim(),
      content: content,
      youtubeUrl: youtubeUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      customLinks: filteredCustomLinks,
      authorName: globalPenName.trim() || 'Chronicle Staff Report',
      category: category,
      status: targetStatus,
      imageUrl: imageUrl.trim(),
      imageUrls: filteredImageUrls,
      imagePosition: imagePosition,
    };

    const path = 'posts';

    try {
      if (isEditing && editingPostId) {
        // Perform update
        const docRef = doc(db, 'posts', editingPostId);
        await updateDoc(docRef, {
          ...postPayload,
          updatedAt: serverTimestamp()
        });
        setSuccessMsg(targetStatus === 'draft' ? 'Draft saved successfully!' : 'Story file updated and published successfully!');
      } else {
        // Perform creation
        const collectionRef = collection(db, path);
        await addDoc(collectionRef, {
          ...postPayload,
          likes: 0,
          dislikes: 0,
          createdAt: serverTimestamp()
        });
        setSuccessMsg(targetStatus === 'draft' ? 'Draft manuscript saved successfully!' : 'Story file published successfully on the feed!');
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
    { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, count: null },
    { id: 'draft', label: isEditing ? 'Edit Story' : 'Draft New Publication', icon: PlusCircle, count: null },
    { id: 'publications', label: 'Current Publications', icon: Newspaper, count: posts.length },
    { id: 'audience', label: 'Audience Registry', icon: Mail, count: subscribers.length }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="admin-board-view">
      
      {/* Title Panel */}
      <div className="border-b-4 border-double border-slate-900 pb-6 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-widest block mb-1">Editor-In-Chief Console</span>
          <h1 className="font-display font-extrabold text-3xl text-slate-950 tracking-tight leading-none uppercase">
            Ledger Content Architect
          </h1>
        </div>
        
        {/* Connection health visual indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold rounded-lg font-mono">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>Firestore Real-Time Authorized</span>
        </div>
      </div>

      {/* 🧭 Segment Switcher Navigation Deck */}
      <div className="mb-10 bg-slate-100 p-1 border border-slate-200/80 rounded-2xl flex flex-col md:flex-row gap-1 shadow-2xs" id="segment-deck">
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
              className={`flex-1 px-4 py-3 sm:py-3.5 rounded-xl text-xs sm:text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{seg.label}</span>
              {seg.count !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-500'}`}>
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono">
                      Additional Photo Links / Gallery ({imageUrls.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setImageUrls([...imageUrls, ''])}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100/60 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                      id="add-extra-photo-button"
                    >
                      <PlusCircle className="h-3 w-3" /> Add Image Link
                    </button>
                  </div>

                  {imageUrls.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic font-medium">
                      No additional photos attached. Click "Add Image Link" above to chain multiple illustrations.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {imageUrls.map((lnk, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 font-mono w-6">#{idx + 1}</span>
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
                            className="p-1 px-2.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-transparent hover:border-rose-700 rounded-lg transition-colors cursor-pointer font-mono font-bold text-xs"
                          >
                            REMOVE
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-600 uppercase tracking-wider font-mono">
                      Social Embed Integration Links
                    </label>
                    <span className="block text-[10px] text-slate-400 mt-0.5 font-sans">
                      Add custom external hyperlinks or situational reference URLs below.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomLinks([...customLinks, ''])}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold"
                  >
                    <span>+ Add Row</span>
                  </button>
                </div>

                {customLinks.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-250 bg-white rounded-lg">
                    <span className="text-[11px] font-mono text-slate-400 block">No custom social hyperlinks added yet.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2">
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
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove link row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-100">
                <div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        handleResetForm();
                        navigate('/admin?focus=publications');
                      }}
                      className="px-4 py-2 text-xs font-bold text-slate-650 hover:bg-slate-100 hover:text-slate-900 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer"
                    >
                      Discard / Cancel Edit
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Save Draft Button */}
                  <button
                    type="submit"
                    disabled={submitLoading}
                    onClick={() => setTargetStatus('draft')}
                    className="px-5 py-2.5 border-2 border-slate-950/80 hover:bg-slate-50 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span>Save as Draft</span>
                  </button>

                  {/* Publish Button */}
                  <button
                    type="submit"
                    disabled={submitLoading}
                    onClick={() => setTargetStatus('published')}
                    className="bg-slate-950 hover:bg-slate-900 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
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
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                          <a 
                            href={`/post/${postItem.id}/${slugify(postItem.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open published article"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all cursor-pointer"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
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
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
