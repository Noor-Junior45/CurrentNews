import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import { LogIn, LogOut, Shield, Newspaper, User, Rss, ArrowRight, PlusCircle, Users, Search, ThumbsUp, X } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

export default function Header() {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [headerSearch, setHeaderSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Sync search input with URL search param
  useEffect(() => {
    setHeaderSearch(searchParams.get('search') || '');
  }, [searchParams]);

  // Handle escape key to close search pop-up overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setIsDropdownOpen(false);
    } catch (e) {
      console.error('Login error', e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsDropdownOpen(false);
      navigate('/');
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs" id="main-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center space-x-2.5 sm:space-x-3 text-slate-900 hover:opacity-90 transition-opacity min-w-0" id="header-brand-link">
          <img 
            src="https://i.imgur.com/gq2X5nE.jpeg" 
            alt="Current News Logo" 
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg object-cover border border-slate-200 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-display font-bold text-base sm:text-lg md:text-xl tracking-tight leading-none uppercase text-slate-950">
              Current News
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold font-mono uppercase tracking-wider truncate">
              Independent Ledger
            </span>
          </div>
        </Link>

        {/* Global Action Controls */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          
          {/* Elegant Magnifying Glass Button triggers overlay like YouTube */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 sm:p-2.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            id="header-search-trigger"
            title="Open dispatch search panel"
          >
            <Search className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          </button>
          
          <div className="relative" id="header-profile-dropdown-container">
            {/* Click catcher overlay when dropdown is open */}
            {isDropdownOpen && (
              <div 
                className="fixed inset-0 z-45 bg-transparent cursor-default" 
                onClick={() => setIsDropdownOpen(false)}
              />
            )}

            {loading ? (
              <div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse border border-slate-200" />
            ) : (
              /* The trigger circle button - always a round thumbnail like Gmail */
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 hover:border-indigo-500 overflow-hidden text-slate-600 hover:text-slate-900 shadow-xs transition-all duration-200 flex items-center justify-center cursor-pointer relative z-50 focus:outline-hidden"
                id="header-profile-trigger"
                title={user ? `Account: ${user.displayName || user.email}` : "Editorial Portal Access"}
              >
                {user ? (
                  user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile Avatar" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full bg-indigo-650 text-white flex items-center justify-center font-bold text-sm">
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )
                ) : (
                  <User className="h-5 w-5 text-slate-500" />
                )}
              </button>
            )}

            {/* Gmail-Style Dropdown Menu */}
            {isDropdownOpen && (
              <div 
                className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-[28px] shadow-2xl py-6 px-5 z-55 animate-in fade-in slide-in-from-top-3 duration-200 origin-top-right font-sans max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                id="gmail-style-account-dropdown"
              >
                {/* Close Button */}
                <button
                  onClick={() => setIsDropdownOpen(false)}
                  className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors cursor-pointer z-10"
                  title="Close menu"
                  id="close-dropdown-button"
                >
                  <X className="h-4 w-4" />
                </button>

                {user ? (
                  <div className="flex flex-col items-center text-center">
                    {/* User Profile Header */}
                    <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-600 uppercase mb-3 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full border border-indigo-100/30">
                      {isAdmin ? '🛡️ AUTHORIZED EDITOR' : '👤 PUBLIC READER'}
                    </span>
                    
                    {/* Large profile avatar */}
                    <div className="h-16 w-16 rounded-full border border-slate-200 overflow-hidden mb-3 shadow-xs">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt="Large Avatar" 
                          className="h-full w-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-full w-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl">
                          {user.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>

                    <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate max-w-full">
                      {user.displayName || 'Chronicle Reader'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-full mb-4">
                      {user.email}
                    </p>

                    {/* Navigation Actions List */}
                    <div className="w-full border-t border-slate-100 dark:border-slate-800 py-3 space-y-1.5 align-left text-left">
                      <button
                        onClick={() => { setIsDropdownOpen(false); navigate('/'); }}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                      >
                        <Newspaper className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="flex flex-col text-left min-w-0">
                          <span>Public News Feed</span>
                          <span className="text-[10px] text-slate-400 font-normal">Return to the original homepage</span>
                        </div>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=dashboard'); }}
                            className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                          >
                            <Shield className="h-4 w-4 text-indigo-500 shrink-0" />
                            <div className="flex flex-col text-left min-w-0">
                              <span>Admin Dashboard</span>
                              <span className="text-[10px] text-slate-400 font-normal">View editor metrics and global pen name settings</span>
                            </div>
                          </button>

                          <button
                            onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=draft'); }}
                            className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                          >
                            <PlusCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <div className="flex flex-col text-left min-w-0">
                              <span>Draft New Publication</span>
                              <span className="text-[10px] text-slate-400 font-normal">Compose a fresh article with custom embeds</span>
                            </div>
                          </button>

                          <button
                            onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=publications'); }}
                            className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                          >
                            <Newspaper className="h-4 w-4 text-blue-500 shrink-0" />
                            <div className="flex flex-col text-left min-w-0">
                              <span>Current Publications</span>
                              <span className="text-[10px] text-slate-400 font-normal">Modify, update, or remove active articles</span>
                            </div>
                          </button>

                          <button
                            onClick={() => { setIsDropdownOpen(false); navigate('/admin?focus=audience'); }}
                            className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                          >
                            <Users className="h-4 w-4 text-purple-500 shrink-0" />
                            <div className="flex flex-col text-left min-w-0">
                              <span>Audience Registry</span>
                              <span className="text-[10px] text-slate-400 font-normal">Registered emails and subscriber tracking</span>
                            </div>
                          </button>
                        </>
                      )}

                      {/* RSS Feed Resource Shortcut */}
                      <a
                        href="/rss.xml"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Rss className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex flex-col text-left min-w-0">
                          <span>Follow via RSS Feed</span>
                          <span className="text-[10px] text-slate-400 font-normal">Subscribe with feed reader apps</span>
                        </div>
                      </a>
                    </div>

                    {/* ❤️ Dynamic Liked Articles Link Button */}
                    <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 mt-2 text-left" id="liked-posts-history-container">
                      <Link
                        to="/liked"
                        onClick={() => setIsDropdownOpen(false)}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                        id="liked-dispatches-button"
                      >
                        <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                        <div className="flex flex-col text-left min-w-0">
                          <span>My Liked Dispatches</span>
                          <span className="text-[10px] text-slate-400 font-normal">Previously liked and bookmarked articles</span>
                        </div>
                      </Link>
                    </div>

                    <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-4 mt-1">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-800 rounded-full cursor-pointer transition-colors"
                        id="signout-button"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    {/* Guest Login Layout */}
                    <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      Chronicle Editorial Access
                    </h4>
                    <p className="text-[11px] text-slate-500 max-w-[220px] mb-4 leading-normal">
                      Log in with authorized editor account to compose, edit, or delete live world dispatches.
                    </p>

                    <button 
                      onClick={handleLogin}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-950 text-white hover:bg-slate-800 text-xs font-semibold rounded-full cursor-pointer transition-colors shadow-xs mb-3"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span>Sign In</span>
                    </button>

                    <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-2.5">
                      <Link
                        to="/liked"
                        onClick={() => setIsDropdownOpen(false)}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                        id="liked-dispatches-guest-button"
                      >
                        <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                        <div className="flex flex-col text-left min-w-0">
                          <span>My Liked Dispatches</span>
                          <span className="text-[10px] text-slate-400 font-normal">Previously liked and bookmarked articles</span>
                        </div>
                      </Link>

                      <a 
                        href="/rss.xml" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-amber-600 hover:text-amber-700 font-semibold font-mono uppercase tracking-wide flex items-center justify-center gap-1 hover:underline"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Rss className="h-3 w-3" /> Get RSS Feed XML
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* YouTube-style Search Overlay Pop-up Modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 z-55 bg-[#faf8f2]/98 dark:bg-[#121211]/98 backdrop-blur-md flex flex-col pt-16 sm:pt-24 px-4 sm:px-6 transition-all duration-300"
          id="search-overlay"
        >
          {/* Inner Search Box */}
          <div className="max-w-2xl w-full mx-auto" id="search-modal-box">
            <div className="flex items-center justify-between border-b-2 border-amber-900/10 dark:border-slate-800 pb-3 mb-6">
              <h3 className="font-display font-black text-xl text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span>Search Chronicles</span>
              </h3>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 px-3 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-lg font-mono text-xs font-black transition-all cursor-pointer shadow-3xs"
                title="Close search [Esc]"
              >
                ESC ×
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/?search=${encodeURIComponent(headerSearch)}`);
                if (location.pathname === '/' || location.pathname === '') {
                  const nextParams = new URLSearchParams(searchParams);
                  if (!headerSearch) {
                    nextParams.delete('search');
                  } else {
                    nextParams.set('search', headerSearch);
                  }
                  setSearchParams(nextParams);
                }
                setIsSearchOpen(false);
              }}
              className="relative w-full mb-8 animate-fade-in"
            >
              <input
                type="text"
                placeholder="Search report titles, tags, or topics..."
                autoFocus
                value={headerSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setHeaderSearch(val);
                  if (location.pathname === '/' || location.pathname === '') {
                    const nextParams = new URLSearchParams(searchParams);
                    if (!val) {
                      nextParams.delete('search');
                    } else {
                      nextParams.set('search', val);
                    }
                    setSearchParams(nextParams);
                  }
                }}
                className="w-full pl-12 pr-12 py-3.5 text-base sm:text-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 dark:focus:ring-indigo-500/30 transition-all placeholder-slate-400 font-medium"
                id="overlay-search-input"
              />
              <Search className="absolute left-4 top-4.5 h-5 w-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
              {headerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setHeaderSearch('');
                    if (location.pathname === '/' || location.pathname === '') {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete('search');
                      setSearchParams(nextParams);
                    }
                  }}
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
                >
                  ×
                </button>
              )}
            </form>

            {/* Suggested Popular Topics */}
            <div>
              <h4 className="text-[10px] font-mono font-bold tracking-widest text-slate-500 dark:text-slate-450 uppercase mb-4">
                Popular Search Terms
              </h4>
              <div className="flex flex-wrap gap-2.5" id="search-suggested-topics">
                {[
                  'Politics',
                  'Finance',
                  'Technology',
                  'Artificial Intelligence',
                  'Climate Emergency',
                  'Global Affairs',
                  'Elections',
                  'Sports Dispatches',
                  'Wall Street'
                ].map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setHeaderSearch(topic);
                      navigate(`/?search=${encodeURIComponent(topic)}`);
                      if (location.pathname === '/' || location.pathname === '') {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set('search', topic);
                        setSearchParams(nextParams);
                      }
                      setIsSearchOpen(false);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl border border-slate-205 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-3xs cursor-pointer transition-all active:scale-98"
                  >
                    <span className="text-amber-600 dark:text-amber-500 font-bold mr-1">#</span>{topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
