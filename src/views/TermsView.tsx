import { useEffect } from 'react';
import { AlertTriangle, Scale, ShieldAlert, CheckCircle } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function TermsView() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950" id="terms-of-service-view">
      {/* Top Header with liquid glass Back button and full heading */}
      <ProfilePageNavbar title="Terms of Service" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs sm:text-sm text-slate-500 mb-8 font-sans leading-relaxed">
          Last updated: June 24, 2026. By utilizing or installing the Current News Live progressive web application, you agree to be bound by the following comprehensive terms. Please review them carefully.
        </p>

        {/* Grid of Key Terms Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" id="terms-highlights">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <Scale className="h-5 w-5 text-indigo-500 mb-2" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Fair Use & Syndication</h3>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Short snippets may be curated with proper journalistic attribution to Current News.
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <ShieldAlert className="h-5 w-5 text-rose-500 mb-2" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Editor Integrity</h3>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Administrative editorial keys must be guarded. Any breach of credentials results in instant revocation.
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <CheckCircle className="h-5 w-5 text-emerald-500 mb-2" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">User Eligibility</h3>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            You agree to interact with the ledger solely for general, lawful, and peaceful inquiry.
          </p>
        </div>
      </div>

      {/* Full Document Body */}
      <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 space-y-6 text-xs sm:text-sm leading-relaxed" id="terms-document-body">
        
        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">01.</span> Agreement to Terms
          </h2>
          <p>
            By reading, installing, downloading, or registering on the <strong>Current News Live</strong> website or application, you declare that you have read and understood these Terms of Service. If you disagree with any portion of these agreements, you are requested to immediately disconnect from the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">02.</span> Intellectual Property & Attribution
          </h2>
          <p>
            All original dispatches, investigative disclosures, graphics, images, logos, and custom structural elements published on Current News Live are protected under copyright laws.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Journalistic Fair Use:</strong> You are permitted to share links, screenshot layouts, or quote text segments of up to 150 words for academic, reviews, social sharing, or journalistic commentary, provided that a clear hyperlinked attribution is provided back to the original article on Current News.
            </li>
            <li>
              <strong>Scraping Ban:</strong> You may not use automated bots, scrapers, crawlers, or algorithmic extractors to harvest our post collections, databases, or subscriber registries without express written authorization.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">03.</span> Administrative & Editorial Accounts
          </h2>
          <p>
            Access to our back-end editorial system (the Editorial Portal) is restricted exclusively to authorized journalists, investigators, and editors.
          </p>
          <p>
            Authorized users must keep their login details completely secure. You agree to instantly inform the principal administrator of any unauthorized administrative entry, password leak, or system exploit.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">04.</span> Disclaimer of Warranties
          </h2>
          <p>
            Current News Live strives for absolute factual integrity. However, due to the dynamic and fluid nature of geopolitical affairs and breaking investigations, all materials and publications are served on an "as is" and "as available" basis without warranties of any kind.
          </p>
          <p>
            Opinions voiced in commentary or guest column sections reflect the perspectives of the respective contributors and do not necessarily represent the unified stance of the Autonomous Press Alliance.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">05.</span> Limitation of Liability
          </h2>
          <p>
            Under no circumstances shall Current News, its editors, journalists, publishers, or affiliates be liable for any direct, indirect, incidental, or consequential damages resulting from your use of the application, network congestion, database delays, or reliance on information presented within the dispatches.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">06.</span> Updates to This Agreement
          </h2>
          <p>
            We reserves the exclusive right to alter these Terms of Service at any time. When modifications occur, we will adjust the "Last updated" date at the top of this document. Continued visitation or installation of the app indicates active acceptance of the modified Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-50 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center gap-2">
            <span className="text-indigo-600 font-mono">07.</span> Contact Information
          </h2>
          <p>
            For any queries or formal notices concerning these Terms, please send a detailed dispatch to:
          </p>
          <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 font-mono text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-sans font-bold text-slate-800 dark:text-slate-250">Current News Legal Desk</p>
            <p>Email Inquiry: <a href="mailto:Current%20News%20%3Csupport%40guashoomin.resend.app%3E" className="text-indigo-600 hover:underline">Current News &lt;support@guashoomin.resend.app&gt;</a></p>
            <p>Platform Provider: Independent Progressive Web Stack</p>
          </div>
        </section>

      </div>

      </div>
    </div>
  );
}
