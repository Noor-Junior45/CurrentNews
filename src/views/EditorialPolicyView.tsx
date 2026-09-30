import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Scale, UserCheck, ChevronRight } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function EditorialPolicyView() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'Editorial Standards & Fact-Checking Policy | Current News Live';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" id="editorial-policy-view">
      <ProfilePageNavbar title="Editorial & Fact-Checking Policy" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* Intro */}
        <div className="mb-10 border-b border-slate-200 dark:border-slate-800 pb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold uppercase tracking-wider mb-4 border border-indigo-200 dark:border-indigo-800">
            <Scale className="w-3.5 h-3.5" />
            <span>Journalistic Integrity Charter</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            Our Standards for Truth, Sourcing & Transparent Corrections
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
            At Current News Live, we recognize that the public's trust is our single most valuable asset. This document details our journalistic methodology, fact-checking workflows, verification protocols, and transparent correction procedures.
          </p>
        </div>

        {/* Section 1: Verification & Sourcing */}
        <section className="mb-10 space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-xs shrink-0"></span>
            <h2 className="font-display font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 dark:text-white">
              1. Verification & Sourcing Guidelines
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Every factual assertion published on Current News Live must be grounded in direct evidence. Our reporters and editorial desks adhere to the following standards:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <h3 className="font-display font-bold text-xs uppercase text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Primary Document First</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Reporters review court transcripts, regulatory filings, peer-reviewed scientific studies, and legislative bills directly before citing secondary claims.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <h3 className="font-display font-bold text-xs uppercase text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Two-Source Corroboration</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Anonymous leaks or unverified claims require independent confirmation from at least two distinct, non-affiliated sources before publication.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Fact-Checking Workflow */}
        <section className="mb-10 space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-xs shrink-0"></span>
            <h2 className="font-display font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 dark:text-white">
              2. Fact-Checking Protocols
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Prior to release, dispatches pass through research verification. Fact-checkers audit:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <li><strong>Numerical & Statistical Accuracy:</strong> Validating dataset math, sample sizes, and percent change formulas against primary repositories.</li>
            <li><strong>Chronology & Geolocation:</strong> Confirming timestamps, geopolitical boundaries, and eyewitness photograph authenticity.</li>
            <li><strong>Direct Quotation Context:</strong> Ensuring remarks are presented within full semantic context without manipulative editing or truncation.</li>
            <li><strong>Subject Right of Reply:</strong> Any individual, company, or institution subject to significant allegations is granted reasonable notice and opportunity to respond prior to publishing.</li>
          </ul>
        </section>

        {/* Section 3: Corrections & Retractions Policy */}
        <section className="mb-10 space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-xs shrink-0"></span>
            <h2 className="font-display font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 dark:text-white">
              3. Transparent Corrections & Retractions
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            When factual errors occur, we correct them promptly, prominently, and unreservedly. We do not stealth-edit stories.
          </p>
          <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-3">
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-display font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Correction Notice Protocol
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                  Substantive corrections are marked with a prominent note at the foot of the article indicating what information was revised, the exact nature of the modification, and the UTC timestamp of the update.
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed pl-6">
              To request an editorial review or report an inaccuracy, email our desk directly at <a href="mailto:corrections@currentnews.blog" className="underline font-bold">corrections@currentnews.blog</a> or submit via our <Link to="/contact" className="underline font-bold">Contact Page</Link>.
            </p>
          </div>
        </section>

        {/* Section 4: Human Editorial Oversight & AI Policy */}
        <section className="mb-10 space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-xs shrink-0"></span>
            <h2 className="font-display font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 dark:text-white">
              4. Human Editorial Stewardship & AI Policy
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Current News Live strictly complies with Google's search quality guidelines against thin or automated content. Every dispatch published under our banner is conceived, researched, composed, and fact-verified by professional human journalists.
          </p>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We never publish raw automated output or mass-generated copy. Computational tools are restricted to data visualization, grammar audits, and research assistance, subject to senior desk oversight.
          </p>
        </section>

        {/* Section 5: Editorial Independence & Advertising Firewall */}
        <section className="mb-10 space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-1 h-4 bg-emerald-500 rounded-xs shrink-0"></span>
            <h2 className="font-display font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 dark:text-white">
              5. Editorial Independence & Advertising Firewall
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            No advertiser, sponsor, or corporate partner exercises advance approval or editorial veto over any investigative article or news dispatch. Advertising inventory (including programmatic Google AdSense spaces) is completely separated from reporting and clearly demarcated as sponsored material.
          </p>
        </section>

        {/* Navigation Quick Links */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <span>Learn about our Newsroom & Masthead</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <span>Submit a Correction or Tip</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
