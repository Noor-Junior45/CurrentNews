import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Users, BookOpen, Globe2, Compass, CheckCircle2, ChevronRight, Mail, Building, FileCheck } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';

export default function AboutView() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'About Us | Current News Live — Independent Ledger';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" id="about-us-view">
      {/* Top Header Navigation */}
      <ProfilePageNavbar title="About Current News Live" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* Hero Section */}
        <div className="mb-10 sm:mb-12 border-b border-slate-200 dark:border-slate-800 pb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider mb-4 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Autonomous Press Alliance</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            Independent, Verified & Transparent Journalism for the Modern Era
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
            <strong>Current News Live</strong> is a premier independent digital publication dedicated to uncorrupted public-interest journalism, investigative reporting, geopolitical dispatches, technology breakthroughs, and in-depth cultural analysis.
          </p>
        </div>

        {/* Core Principles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12" id="about-principles-grid">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white mb-1.5">Uncompromising Independence</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              We operate without commercial or political bias. Our journalists report facts without fear, favor, or corporate influence.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white mb-1.5">Rigorous Fact-Checking</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every story undergoes two-source corroboration and cross-checking against official archives and primary public records.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Globe2 className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white mb-1.5">Global Perspective</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              From global policy summits to local grassroots breakthroughs, we bridge international events with clear, accessible commentary.
            </p>
          </div>
        </div>

        {/* Editorial Masthead & Leadership */}
        <section className="mb-12">
          <div className="flex items-center space-x-2 mb-6">
            <span className="w-1 h-4 bg-emerald-500 rounded-xs shrink-0"></span>
            <h2 className="font-display font-extrabold text-base sm:text-lg uppercase tracking-wider text-slate-900 dark:text-white">
              Editorial Masthead & Staff
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5">
              <img 
                src="https://i.imgur.com/gq2X5nE.jpeg" 
                alt="Editor-in-Chief" 
                className="w-12 h-12 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0" 
              />
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">Managing Editorial Desk</h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Chronicle Staff Report & Desk Leads</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Supervising daily coverage, factual attribution, investigative accuracy, and geopolitical analysis.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 text-sm">
                FC
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">Fact-Checking & Research Unit</h4>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Independent Verification Team</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Conducting primary source audits, statistical sanity checks, and timestamped corrections.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 text-sm">
                TECH
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">Technology & Science Bureau</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Digital Innovation & Security</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Analyzing artificial intelligence, cloud architectures, cybersecurity, and technological shifts.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 text-sm">
                POL
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white">Public Policy & Economics Desk</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Legislative & Market Analysis</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Covering international diplomacy, governance, monetary decisions, and constitutional law.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ethics & Commercial Independence Charter */}
        <section className="mb-12 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Commercial Independence & Advertising Firewall</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
            Current News Live operates with an absolute firewall between our editorial desk and commercial advertising partners. Advertisements displayed on our site (including Google AdSense units) do not influence our editorial choices, investigations, or headlines.
          </p>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            All sponsored units are clearly marked with standard identifiers ("ADVERTISEMENT"). We reject native ads disguised as editorial copy and adhere strictly to Google Publisher Policies.
          </p>
        </section>

        {/* Navigation Quick Links */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <Link
            to="/editorial-policy"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <FileCheck className="w-4 h-4" />
            <span>Read our Editorial & Corrections Policy</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Mail className="w-4 h-4" />
            <span>Contact the Newsroom</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
