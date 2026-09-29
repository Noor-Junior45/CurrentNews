import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ThumbsUp, 
  Shield, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  FileText, 
  Trash2, 
  LogOut, 
  LogIn, 
  CheckCircle2, 
  User,
  PlusCircle,
  Newspaper,
  Mail 
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import { signInWithGoogleSafe } from '../utils/authHelper';

export default function ProfileView(): React.JSX.Element {
  const { user, loading, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  const handleLogin = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleSafe();
      if (!res.success && !res.cancelled && res.error) {
        setAuthError('Authentication could not be completed. Please check your network and try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Sign out error', err);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col font-sans" id="profile-page-stage">
      {/* Top Navbar with pill shaped liquid glass Back button that returns to Home */}
      <ProfilePageNavbar title="Profile" fallbackUrl="/" />

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-8 flex flex-col items-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700 mb-4" />
            <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md mb-2" />
            <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md" />
          </div>
        ) : user ? (
          /* Logged In User Profile Details */
          <div className="w-full flex flex-col items-center text-center">
            {/* Avatar with single golden ring */}
            <div className="h-22 w-22 sm:h-24 sm:w-24 rounded-full border-2 border-amber-400 overflow-hidden shrink-0 shadow-md bg-slate-100 dark:bg-slate-800 mb-3.5">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile Avatar" 
                  className="h-full w-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-full w-full bg-indigo-700 text-white flex items-center justify-center font-bold text-2xl">
                  {user.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* User Name below avatar */}
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-wide uppercase leading-tight truncate max-w-[320px]">
              {user.displayName || 'Chronicle Reader'}
            </h2>

            {/* Email with verified badge */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mt-1.5 max-w-[320px]">
              <span className="truncate">{user.email}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-500 fill-sky-500 text-white shrink-0" />
            </div>

            {/* Grey / liquid glass horizontal line below email */}
            <div className="w-full border-t border-slate-200/90 dark:border-slate-800/90 mt-5 mb-5" />

            {/* Action Buttons */}
            <div className="w-full space-y-2.5">
              {/* Liked Button */}
              <Link
                to="/liked"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-liked-dispatches-button"
              >
                <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Liked</span>
              </Link>

              {isAdmin && (
                <>
                  <Link
                    to="/admin"
                    className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    id="profile-admin-dashboard-button"
                  >
                    <Shield className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Admin</span>
                  </Link>

                  <Link
                    to="/admin?focus=draft"
                    className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    id="profile-draft-publication-button"
                  >
                    <PlusCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Draft New Publication</span>
                  </Link>

                  <Link
                    to="/admin?focus=publications"
                    className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    id="profile-current-publication-button"
                  >
                    <Newspaper className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Current Publication</span>
                  </Link>

                  <Link
                    to="/admin?focus=audience"
                    className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    id="profile-audience-registry-button"
                  >
                    <Mail className="h-4 w-4 text-cyan-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Audience Registry</span>
                  </Link>
                </>
              )}

              {/* Setting Button */}
              <Link
                to="/settings"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-settings-button"
              >
                <SettingsIcon className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Setting</span>
              </Link>

              {/* Privacy Policy Button */}
              <Link
                to="/privacy"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-privacy-policy-button"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Privacy Policy</span>
              </Link>

              {/* Terms of Service Button */}
              <Link
                to="/terms"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-terms-button"
              >
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Terms of Service</span>
              </Link>

              {/* Account Delete Button */}
              <Link
                to="/delete-account"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-rose-600 dark:text-slate-100 dark:hover:text-rose-400 bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-rose-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-account-delete-button"
              >
                <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-rose-400">Account Delete</span>
              </Link>

              {/* Sign Out Button in last */}
              <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <button 
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 dark:hover:bg-transparent dark:hover:border-red-500 text-white dark:hover:text-red-400 text-xs font-bold rounded-full cursor-pointer transition-all shadow-xs hover:shadow-md border border-red-700"
                  id="profile-signout-button"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="font-bold">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Guest View */
          <div className="w-full flex flex-col items-center text-center">
            <div className="h-20 w-20 rounded-full border-2 border-amber-400 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-md mb-3.5">
              <User className="h-8 w-8 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Chronicle Portal
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 mb-4">
              Guest Reader
            </span>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed max-w-xs">
              Log in with your authorized editor account to compose, edit, or publish live dispatches.
            </p>

            <button 
              type="button"
              onClick={handleLogin}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-slate-950 dark:bg-slate-900 text-white hover:bg-slate-800 dark:hover:bg-transparent dark:hover:border-indigo-500/60 dark:hover:text-white text-xs font-semibold rounded-full cursor-pointer transition-all border border-transparent dark:border-slate-700/80 shadow-xs mb-3 disabled:opacity-60"
              id="profile-signin-button"
            >
              {isSigningIn ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-bold text-white">Opening Google Sign-In...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-3.5 w-3.5 text-white" />
                  <span className="font-bold text-white">Sign In with Google</span>
                </>
              )}
            </button>

            {authError && (
              <div className="w-full mb-4 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400 text-xs text-center">
                {authError}
              </div>
            )}

            {/* Grey / liquid glass horizontal line */}
            <div className="w-full border-t border-slate-200/90 dark:border-slate-800/90 mb-5" />

            <div className="w-full space-y-2.5">
              <Link
                to="/liked"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-guest-liked-button"
              >
                <ThumbsUp className="h-4 w-4 text-rose-550 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Liked</span>
              </Link>

              <Link
                to="/settings"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-guest-settings-button"
              >
                <SettingsIcon className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Setting</span>
              </Link>

              <Link
                to="/privacy"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-guest-privacy-button"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Privacy Policy</span>
              </Link>

              <Link
                to="/terms"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-indigo-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-guest-terms-button"
              >
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-white">Terms of Service</span>
              </Link>

              <Link
                to="/delete-account"
                className="w-full flex items-center space-x-3 py-3 px-4 rounded-full text-slate-700 hover:text-rose-600 dark:text-slate-100 dark:hover:text-rose-400 bg-slate-50/90 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-transparent backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:hover:border-rose-500/60 shadow-xs hover:shadow-sm text-xs font-semibold tracking-wide transition-all cursor-pointer"
                id="profile-guest-delete-button"
              >
                <Trash2 className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-100 dark:hover:text-rose-400">Account Delete</span>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
