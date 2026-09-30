import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Eye, ScrollText, Mail } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function PrivacyView() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950" id="privacy-policy-view">
      {/* Top Header with liquid glass Back button and full heading */}
      <ProfilePageNavbar title="Privacy Policy" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-8 font-sans leading-relaxed">
          Last updated: June 24, 2026. This Privacy Policy details our protocols surrounding the collection, use, and disclosure of reader data when visiting or installing the Current News Live application.
        </p>

        {/* Grid of Key Privacy Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" id="privacy-highlights">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Lock className="h-5 w-5 text-indigo-500 mb-2" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Zero Sell Policy</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            We never trade, rent, or sell your personal data or newsletter subscriptions to third-party brokers.
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Eye className="h-5 w-5 text-teal-500 mb-2" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Transparent Consent</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Manage your cookie preference and personalized advertising telemetry at any time via our footer consent center.
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Mail className="h-5 w-5 text-amber-500 mb-2" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Secure Subscriptions</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Your email is stored on encrypted Cloud Firestore servers solely to send breaking news dispatch circulars.
          </p>
        </div>
      </div>

      {/* Full Document Body */}
      <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 space-y-6 text-xs sm:text-sm leading-relaxed" id="privacy-document-body">
        
        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">01.</span> Introduction & Scope
          </h2>
          <p>
            Welcome to <strong>Current News Live</strong> ("we," "our," or "us"). We operate as an autonomous press alliance dedicated to transparent, verified, and uncorrupted reporting. Because we respect the constitutional rights of the press and the privacy of our global readership, we maintain rigorous data protections across our web and progressive web application (PWA) environments.
          </p>
          <p>
            This document outlines how we process your information when you access our dispatch platform, interact with our editorial columns, register for newsletter alerts, or utilize administrative accounts.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">02.</span> Information We Collect
          </h2>
          <p>
            We collect the minimum amount of information necessary to deliver high-quality, stable journalism to our readers. This includes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Newsletter Subscriptions:</strong> If you voluntarily enter your email address into our newsletter popup or footer registry, we store that email address securely inside our Google Firebase Cloud Firestore database to send alerts about breaking news.
            </li>
            <li>
              <strong>Curation Cache & Likes:</strong> When you "Like" or "Dislike" dispatches, we store those markers solely on your local device's memory cache (using local storage) for offline tracking. <strong>We do not share any like or dislike data with the admin.</strong> We do not correlate your curated reactions with your physical identity.
            </li>
            <li>
              <strong>Administrative Access Credentials:</strong> For authorized writers and editors logging into the Editorial Portal, we collect and process registration credentials via Firebase Authentication services.
            </li>
            <li>
              <strong>Analytics & Log Data:</strong> Like most premium publishers, we collect server-side metrics, IP addresses, browser agents, and time-stamps to ensure operational integrity and perform audience telemetry.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">03.</span> Advertising, Cookies & Google AdSense Disclosure
          </h2>
          <p>
            To sustain our journalistic operations and fund independent investigative reporting, we display advertisements in strict adherence to the <strong>Google Publisher Policies</strong> and <strong>Google AdSense Program Policies</strong>.
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <p className="font-semibold text-slate-900 dark:text-white">
              Google AdSense & Third-Party Vendor Notice:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Third-party vendors, including Google, use cookies (such as the DoubleClick cookie) to serve ads based on a user's prior visits to our website or other websites on the Internet.
              </li>
              <li>
                Google's use of advertising cookies enables it and its partners to serve ads to our users based on their visit to our sites and/or other sites on the Internet.
              </li>
              <li>
                <strong>Opt-Out Options:</strong> Users may opt out of personalized advertising by visiting Google's <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">Google Ads Settings (adssettings.google.com)</a>. Alternatively, you can opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">AboutAds.info (www.aboutads.info/choices/)</a> or the Network Advertising Initiative at <a href="https://optout.networkadvertising.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-bold">networkadvertising.org</a>.
              </li>
              <li>
                <strong>GDPR / CCPA In-App Consent:</strong> Our application incorporates an active, user-facing consent banner and footer policy toggle. Users can select either Personalized or Non-Personalized contextual ads at any time.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">04.</span> Data Security & Service Providers
          </h2>
          <p>
            We leverage enterprise-grade cloud systems to manage our application safely.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Google Firebase Firestore & Authentication:</strong> Stored under strict cloud policies limiting raw administrative direct table reads.
            </li>
            <li>
              <strong>Progressive Web App (PWA) Caching:</strong> App assets are stored directly on your phone or desktop via a registered service worker to allow instant offline rendering without phoning home.
            </li>
            <li>
              <strong>HTTPS Cryptographic Protocols:</strong> Every single dispatch and administrative transaction is wrapped inside industry-standard SSL encryption.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">05.</span> Your Rights & Access
          </h2>
          <p>
            Depending on your location (such as the European Union or California), you may hold statutory rights regarding your personal information. These include the right to access, rectify, or demand the complete erasure of your email from our newsletter database.
          </p>
          <p>
            To execute any access, data export, or erasure requests, please contact our Editorial and Support desk at the coordinates provided below.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">06.</span> Google Play Store Data Safety: Account & Personal Data Deletion
          </h2>
          <p>
            In compliance with Google Play Store User Data Policy, users of the Current News native application and website can request complete and permanent deletion of their account credentials, registered email address, active newsletter subscriptions, and recorded interactions at any time.
          </p>
          <p>
            You can initiate immediate self-service account deletion or submit an email request via our dedicated portal:
          </p>
          <div className="pt-1">
            <Link 
              to="/delete-account" 
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors"
            >
              <span>Go to Account & Data Deletion Portal</span>
            </Link>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">07.</span> Contact & Desk Details
          </h2>
          <p>
            For privacy inquiries, newsletter removals, or editorial corrections, please reach out to the Current News desk directly:
          </p>
          <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 font-mono text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-sans font-bold text-slate-800 dark:text-slate-250">Current News Editorial Desk</p>
            <p>Email Inquiry: <a href="mailto:Current%20News%20%3Csupport%40guashoomin.resend.app%3E" className="text-indigo-600 hover:underline">Current News &lt;support@guashoomin.resend.app&gt;</a></p>
            <p>Database Authority: Google Firebase Firestore</p>
            <p>Jurisdiction: Standard Federal Privacy Frameworks</p>
          </div>
        </section>

      </div>

      </div>
    </div>
  );
}
