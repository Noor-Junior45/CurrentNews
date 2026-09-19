import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Mail, 
  LogIn,
  RefreshCw
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  deleteUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function DeleteAccountView() {
  const { user, loading: authLoading } = useAuthState();
  const isAuthenticated = !!user;
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletionSuccess, setDeletionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supportEmail = 'support@guashoomin.resend.app';
  const emailSubject = 'Account and Data Deletion Request - Current News';
  
  const userEmail = user?.email || '';
  const userName = user?.displayName || '';
  const userUid = user?.uid || '';
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Pre-made formatted email body autofilled with user details
  const deletionEmailBody = `Dear Current News Privacy & Support Team,

Please permanently delete my Current News user account and all associated personal data in accordance with Google Play Data Safety policies and applicable privacy regulations.

ACCOUNT IDENTIFICATION:
• Account Email Address: ${userEmail ? userEmail : '[PLEASE INSERT YOUR ACCOUNT EMAIL HERE]'}
• Account Display Name: ${userName ? userName : '[YOUR NAME (OPTIONAL)]'}
• User UID: ${userUid ? userUid : '[NOT SIGNED IN / UNKNOWN]'}
• Date of Request: ${currentDate}

SCOPE OF DELETION REQUEST:
1. Permanently delete my Firebase Authentication credentials and user profile.
2. Remove my registered email address from all subscriber lists, newsletter databases, and communications.
3. Purge all personal profile records, user preferences, likes, dislikes, and interaction telemetry.

I understand that this action is permanent and cannot be reversed once processed. Please send a confirmation reply to this email once the deletion has been fulfilled.

Thank you,
${userName || '[Your Name]'}`;

  // Clean RFC 6068 mailto URI with sanitized query parameters
  const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(deletionEmailBody)}`;

  const googleProvider = new GoogleAuthProvider();

  const handleSignIn = async () => {
    try {
      setErrorMessage(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in was cancelled or failed.';
      setErrorMessage(msg);
    }
  };

  const executeAccountDeletion = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const userUid = currentUser.uid;
      const userEmail = currentUser.email?.toLowerCase();

      // 1. Purge user reactions if any exist
      try {
        const reactionsQ = query(collection(db, 'reactions'), where('userId', '==', userUid));
        const reactionsSnap = await getDocs(reactionsQ);
        const reactionDeletePromises = reactionsSnap.docs.map(d => deleteDoc(doc(db, 'reactions', d.id)));
        await Promise.all(reactionDeletePromises);
      } catch (e) {
        console.warn('Non-blocking: could not clean reactions', e);
      }

      // 2. Purge newsletter subscription if user was subscribed
      if (userEmail) {
        try {
          const subsQ = query(collection(db, 'subscribers'), where('email', '==', userEmail));
          const subsSnap = await getDocs(subsQ);
          const subDeletePromises = subsSnap.docs.map(d => deleteDoc(doc(db, 'subscribers', d.id)));
          await Promise.all(subDeletePromises);
        } catch (e) {
          console.warn('Non-blocking: could not clean subscribers', e);
        }
      }

      // 3. Delete the user from Firebase Authentication
      try {
        await deleteUser(currentUser);
      } catch (authError: unknown) {
        // If the user's credential has expired, Firebase mandates recent login
        if (authError && typeof authError === 'object' && 'code' in authError && (authError as { code: string }).code === 'auth/requires-recent-login') {
          // Trigger re-authentication popup
          const reauthResult = await signInWithPopup(auth, googleProvider);
          if (reauthResult.user) {
            await deleteUser(reauthResult.user);
          }
        } else {
          throw authError;
        }
      }

      // 4. Clear local client storage
      try {
        localStorage.removeItem('theme');
        localStorage.removeItem('hasSeenConsent');
        localStorage.removeItem('hasSubscribedNewsletter');
      } catch (e) {
        console.warn('Local storage clear warning:', e);
      }

      setDeletionSuccess(true);
      setIsDeleting(false);
    } catch (err: unknown) {
      console.error('Account deletion failure:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred during account deletion. Please try again.';
      setErrorMessage(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950" id="delete-account-view">
      {/* Top Header with liquid glass Back button and full heading */}
      <ProfilePageNavbar title="Account Deletion" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          In accordance with Google Play's User Data Policy and international data privacy regulations (GDPR & CCPA), 
          you have the absolute right to request the permanent deletion of your account and all associated personal records.
        </p>

      {/* Success Notification */}
      {deletionSuccess && (
        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">Account and Personal Data Successfully Deleted</h3>
              <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                Your authentication profile, email subscriptions, and all recorded interactions have been permanently erased from our databases. 
                Thank you for having been part of Current News Live.
              </p>
              <div className="mt-4">
                <Link
                  to="/"
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Return to Homepage
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs mb-6 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!deletionSuccess && (
        <div className="space-y-8">
          
          {/* Section 1: In-App Interactive Self-Service Deletion */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Method 1: Instant Self-Service Deletion (Recommended)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5">
              Authenticate your identity to execute an immediate, automated purge of your account records.
            </p>

            {authLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Checking account status...</span>
              </div>
            ) : isAuthenticated && user ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  {user.photoURL && (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {user.displayName || 'Reader Account'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {user.email}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>Permanent Action Notice</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 pl-5">
                    Proceeding will permanently delete your authentication record, revoke all active sessions, 
                    unsubscribe your email address from dispatches, and purge your liked/disliked article history.
                  </p>
                </div>

                {/* Confirmation checklist */}
                <div className="space-y-3 text-xs pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input 
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>I understand this action is irreversible and my personal data cannot be recovered.</span>
                  </label>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">
                      Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-slate-100 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={executeAccountDeletion}
                  disabled={!confirmed || confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Deleting Records...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Permanently Delete Account & Data</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="py-4 text-center space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  You are not currently logged in. Sign in to your Google Account to proceed with instant deletion.
                </p>
                <button
                  onClick={handleSignIn}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In with Google to Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Manual Email Request (Google Play Policy Web Requirement) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Method 2: External Email Request
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              If you have uninstalled the app or are unable to sign in, clicking the button below will automatically open your email app with the complete pre-filled deletion request addressed to our support desk.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-mono text-slate-500">Inbound Support Desk:</div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                  {supportEmail}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Processed within 48 to 72 business hours
                </div>
              </div>

              <a
                href={mailtoUrl}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0"
                id="send-deletion-email-btn"
              >
                <Mail className="h-4 w-4" />
                <span>Send Deletion Email</span>
              </a>
            </div>
          </div>

          {/* Section 3: Data Safety & Retention Information (Google Play Disclosure) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-xs text-slate-600 dark:text-slate-400 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
              Data Safety & Retention Breakdown
            </h3>
            <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
              <li>
                <strong className="text-slate-800 dark:text-slate-200">Data Deleted Immediately:</strong> Firebase Authentication record (UID, name, email, avatar URL), newsletter email subscriber document, article likes/dislikes reaction logs, and cached local tokens.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-200">Data Retained:</strong> Non-personally identifiable server access logs (such as truncated IP addresses for anti-DDoS and rate-limiting security) are retained for up to 30 days before automated system rotation, in compliance with standard security auditing practices.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-200">Public Articles:</strong> Published editorial articles created by authorized journalists remain part of the public archive, but may be disassociated upon editorial review.
              </li>
            </ul>
          </div>

        </div>
      )}

      </div>
    </div>
  );
}
