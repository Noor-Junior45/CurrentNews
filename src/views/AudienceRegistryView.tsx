import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from '../hooks/useAuthState';
import { api } from '../utils/api';
import { safeFormatDate } from '../utils/dateHelper';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import AdminAuthGuard from '../components/AdminAuthGuard';
import { updateDocumentSEO } from '../utils/seo';
import { 
  Mail, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Bell, 
  Send, 
  Users, 
  RefreshCw 
} from 'lucide-react';

export default function AudienceRegistryView(): React.JSX.Element {
  const { user, isAdmin } = useAuthState();
  const navigate = useNavigate();

  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Push notification device counter
  const [pushDeviceCount, setPushDeviceCount] = useState<number | null>(null);

  // Resend API test email console state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  useEffect(() => {
    updateDocumentSEO({
      title: 'Audience Registry — Current News Live',
      description: 'Citizen subscribers directory, push device listeners, and alert dispatch console.',
      canonicalPath: '/admin/audience',
      robots: 'noindex, nofollow'
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const loadSubscribers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await api.getSubscribersAdmin();
      const list = rows.map(r => ({
        id: r.email,
        email: r.email,
        createdAt: r.created_at
      }));
      setSubscribers(list);
    } catch (err: any) {
      console.warn('Subscribers load notice:', err);
      setErrorMsg('Could not load subscriber list from database.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPushCount = async () => {
    try {
      const count = await api.getPushSubscriberCount();
      setPushDeviceCount(count);
    } catch (e) {
      console.debug('Failed to fetch push count:', e);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadSubscribers();
      fetchPushCount();
    }
  }, [user, isAdmin]);

  const handleDeleteSubscriber = async (subId: string) => {
    if (!window.confirm('Are you sure you want to delete this subscriber address?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const targetSub = subscribers.find(s => s.id === subId);
      const emailToDelete = targetSub ? targetSub.email : subId;
      await api.deleteSubscriberAdmin(emailToDelete);
      setSubscribers(prev => prev.filter(item => item.id !== subId && item.email !== emailToDelete));
      setSuccessMsg('Subscriber address deleted successfully.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete subscriber.');
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress.trim()) return;

    setIsSendingTestEmail(true);
    setTestEmailFeedback({ status: 'idle', message: '' });

    try {
      const response = await fetch('/api/mail/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmailAddress.trim(),
          title: 'Test Circular: Newsroom Alert Dispatch',
          link: window.location.origin
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestEmailFeedback({
          status: 'success',
          message: `Test email successfully dispatched to ${testEmailAddress.trim()} via Resend SMTP.`
        });
        setTestEmailAddress('');
      } else {
        setTestEmailFeedback({
          status: 'error',
          message: data.error || 'Failed to dispatch test circular.'
        });
      }
    } catch (err: any) {
      setTestEmailFeedback({
        status: 'error',
        message: err.message || 'Network error encountered during email transmission.'
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-white dark:bg-slate-950 font-sans" id="audience-registry-view">
        <ProfilePageNavbar 
          title="Audience Registry" 
          fallbackUrl="/profile" 
          onBack={() => navigate('/profile')} 
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Notifications */}
          {successMsg && (
            <div className="p-4 bg-green-50 dark:bg-green-950/40 border-l-4 border-green-500 text-green-800 dark:text-green-200 rounded-lg flex items-center justify-between shadow-xs">
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
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-800 dark:text-red-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-800 dark:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Description */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1">
              Subscriber & Device Directory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Real-time directory of citizens and connected mobile devices registered for news dispatches and editorial alerts.
            </p>
          </div>

          {/* Background Push Device Status Card */}
          <div className="p-5 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2 mb-1">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                Automated Background Push System (Android & Web)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Subscribed devices automatically receive push notifications whenever you release any article—<strong>even if the app is closed</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-xl shrink-0 self-start sm:self-auto shadow-xs">
              <Bell className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {pushDeviceCount !== null ? `${pushDeviceCount} Active Device(s)` : 'Checking devices...'}
              </span>
            </div>
          </div>

          {/* Resend API Live Test Console */}
          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
            <h3 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Resend Transactional Email Test Console
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Verify your Resend transactional email setup in real time. Dispatches a live test alert immediately to any inbox.
            </p>

            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="Enter email address for test circular"
                  className="w-full px-4 py-2.5 pl-9 border border-indigo-200 dark:border-indigo-800 focus:ring-2 focus:ring-indigo-500 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  required
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              </div>
              <button
                type="submit"
                disabled={isSendingTestEmail}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400 cursor-pointer shadow-xs"
              >
                {isSendingTestEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Mail</span>
                  </>
                )}
              </button>
            </form>

            {testEmailFeedback.status !== 'idle' && (
              <div className={`mt-3 p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                testEmailFeedback.status === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200' 
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              }`}>
                {testEmailFeedback.status === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span>{testEmailFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Subscribers Directory Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Registered Citizens ({subscribers.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={loadSubscribers}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                Loading subscribers...
              </div>
            ) : subscribers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No subscribers registered in directory yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {subscribers.map((sub) => (
                  <div key={sub.id} className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {sub.email}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Registered: {safeFormatDate(sub.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubscriber(sub.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete Subscriber"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
