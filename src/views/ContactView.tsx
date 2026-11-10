import React, { useEffect } from 'react';
import { Mail, Clock, ShieldAlert, FileText, Send, CheckCircle2 } from 'lucide-react';
import ProfilePageNavbar from '../components/ProfilePageNavbar';
import { updateDocumentSEO } from '../utils/seo';

export default function ContactView() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateDocumentSEO({
      title: 'Contact Newsroom & Editorial Desk | Current News Live',
      description: 'Contact Current News Live editorial staff, newsroom tip line, press inquiries, corrections desk, or legal and copyright representatives.',
      canonicalPath: '/contact'
    });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" id="contact-us-view">
      <ProfilePageNavbar title="Contact the Newsroom" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* Intro Header */}
        <div className="mb-10 border-b border-slate-200 dark:border-slate-800 pb-8">
          <h1 className="font-display font-black text-2xl sm:text-4xl text-slate-900 dark:text-white tracking-tight leading-tight mb-3">
            Get in Touch with Our Editorial Team
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
            We value feedback, verified leads, corrections, and inquiries from our global readership. Our editorial and fact-checking desks review communications promptly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Contact Details Directory */}
          <div className="md:col-span-1 space-y-6">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Editorial Desk</span>
                </h3>
                <a 
                  href="mailto:help@currentnews.blog" 
                  className="text-xs font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 break-all"
                >
                  help@currentnews.blog
                </a>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  General inquiries, press releases & commentary
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Corrections Desk</span>
                </h3>
                <a
                  href="mailto:corrections@currentnews.blog"
                  className="text-xs font-semibold text-slate-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400"
                >
                  corrections@currentnews.blog
                </a>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Factual discrepancies & attribution updates
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Newsroom Hours</span>
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Monday – Friday: 08:00 – 20:00 UTC
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Breaking desk operates 24/7 on monitored feeds
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
              <strong className="block font-bold mb-1">Confidential Whistleblower Tips:</strong>
              We uphold reporter-source confidentiality under standard shield frameworks. Please specify in your email subject if your transmission requires encrypted channels.
            </div>
          </div>

          {/* Direct Editorial Communication Channels */}
          <div className="md:col-span-2">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">
                  Direct Inquiries & Dispatches
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                  To ensure verification and integrity, our newsroom accepts story submissions, corrections, and press releases exclusively through direct email to our editorial team.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Story Leads & Press Releases</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    Include source documents, media assets, and verified citations.
                  </p>
                  <a
                    href="mailto:help@currentnews.blog?subject=Editorial%20Submission"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>Email Editorial Desk</span>
                    <Send className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Corrections & Attribution</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    Cite the specific headline, published date, and requested correction.
                  </p>
                  <a
                    href="mailto:corrections@currentnews.blog?subject=Correction%20Request"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <span>Email Corrections Desk</span>
                    <Send className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <strong className="block font-bold">Newsroom SLA:</strong>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  All correspondence sent to <strong className="font-mono">help@currentnews.blog</strong> is logged and routed to our editors. Verified inquiries receive an acknowledgement within 24 to 48 business hours.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
