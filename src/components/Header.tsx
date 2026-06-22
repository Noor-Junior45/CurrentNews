import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import { LogIn, LogOut, Shield, Newspaper, User, Rss, ArrowRight, PlusCircle, Users } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

export default function Header() {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
            src="https://i.imgur.com/gFgShoZ.jpeg" 
            alt="Current News Live Logo" 
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg object-cover border border-slate-200 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-display font-bold text-base sm:text-lg md:text-xl tracking-tight leading-none uppercase text-slate-950 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none">
              Current News Live
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold font-mono uppercase tracking-wider truncate">
              Independent Ledger
            </span>
          </div>
        </Link>

        {/* Global Action Controls */}
        <div className="flex items-center space-x-4">
          
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
                className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-[28px] shadow-2xl py-6 px-5 z-55 animate-in fade-in slide-in-from-top-3 duration-200 origin-top-right font-sans"
                id="gmail-style-account-dropdown"
              >
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
                      <span>Admin Sign In</span>
                    </button>

                    <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-center">
                      <a 
                        href="/rss.xml" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-amber-600 hover:text-amber-700 font-semibold font-mono uppercase tracking-wide flex items-center gap-1 hover:underline"
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
    </header>
  );
}
