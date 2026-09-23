import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-200 border-t border-slate-700 text-[10px] sm:text-xs" id="main-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 divide-x divide-slate-700 items-center">
          
          {/* Brand & Mission Column */}
          <div className="flex flex-col justify-center space-y-1 pr-3 sm:pr-6">
            <Link to="/" className="flex items-center space-x-1.5 text-white">
              <img 
                src="https://i.imgur.com/gq2X5nE.jpeg" 
                alt="Current News Logo" 
                className="h-4 w-4 sm:h-5 sm:w-5 rounded object-cover border border-slate-600 shrink-0"
                referrerPolicy="no-referrer"
              />
              <span className="font-display font-bold text-[10px] sm:text-xs tracking-tight uppercase truncate">Current News</span>
            </Link>
            <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">
              Serving public interest with transparent, accurate journalism.
            </p>
          </div>

          {/* Useful Reader Information & Nav */}
          <div className="flex flex-col justify-center space-y-1 pl-3 sm:pl-6">
            <div className="flex items-center space-x-2">
              <span className="w-0.5 sm:w-1 h-3.5 sm:h-4 bg-emerald-500 rounded-xs shrink-0"></span>
              <h4 className="font-display font-extrabold text-[10px] sm:text-xs uppercase tracking-wider text-white">
                Policy & Legal
              </h4>
            </div>
            <div className="flex flex-col space-y-0.5 mt-0.5" id="footer-resources-container">
              <Link 
                to="/privacy" 
                className="inline-flex items-center space-x-1.5 py-1.5 text-[10px] sm:text-xs font-semibold text-white hover:text-emerald-400 transition-colors group"
                id="footer-privacy-link"
              >
                <ChevronRight className="h-3 w-3 text-emerald-400 shrink-0 stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                <span>Privacy Policy</span>
              </Link>
              <Link 
                to="/terms" 
                className="inline-flex items-center space-x-1.5 py-1.5 text-[10px] sm:text-xs font-semibold text-white hover:text-emerald-400 transition-colors group"
                id="footer-terms-link"
              >
                <ChevronRight className="h-3 w-3 text-emerald-400 shrink-0 stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                <span>Terms of Service</span>
              </Link>
              <Link 
                to="/delete-account" 
                className="inline-flex items-center space-x-1.5 py-1.5 text-[10px] sm:text-xs font-semibold text-rose-300 hover:text-rose-400 transition-colors group"
                id="footer-delete-account-link"
              >
                <ChevronRight className="h-3 w-3 text-rose-400 shrink-0 stroke-[3] group-hover:translate-x-0.5 transition-transform" />
                <span>Delete Account & Data</span>
              </Link>
            </div>
          </div>

        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between text-[8px] sm:text-[9px] text-slate-400">
          <p>© {currentYear} Current News.</p>
          <span className="mt-0.5 sm:mt-0 font-mono text-[7px] sm:text-[8px] text-slate-400">Autonomous Press Alliance</span>
        </div>
      </div>
    </footer>
  );
}
