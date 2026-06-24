import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-200 border-t border-slate-800 text-[10px] sm:text-xs" id="main-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-2 gap-4 sm:gap-8 lg:gap-16">
          
          {/* Brand & Mission Column */}
          <div className="flex flex-col space-y-1.5 border-r border-slate-800/80 pr-4 sm:pr-8 lg:pr-16">
            <Link to="/" className="flex items-center space-x-1 sm:space-x-2 text-white">
              <img 
                src="https://i.imgur.com/gq2X5nE.jpeg" 
                alt="Current News Logo" 
                className="h-4.5 w-4.5 sm:h-6 sm:w-6 rounded-md object-cover border border-slate-700 shrink-0"
                referrerPolicy="no-referrer"
              />
              <span className="font-display font-bold text-[9px] sm:text-[11px] md:text-xs tracking-tight uppercase truncate">Current News</span>
            </Link>
            <p className="text-[8px] sm:text-[10px] text-slate-300 leading-tight">
              Serving public interest with transparent, accurate journalism.
            </p>
          </div>

          {/* Useful Reader Information & Nav */}
          <div className="flex flex-col space-y-1.5 pl-4 sm:pl-8 lg:pl-16">
            <h4 className="font-display font-semibold text-[9px] sm:text-[10px] uppercase tracking-wider text-white">Resources</h4>
            <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3 mt-1" id="footer-resources-container">
              <Link 
                to="/" 
                className="inline-flex items-center justify-center px-2.5 py-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-md hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all duration-200"
                id="footer-feed-link"
              >
                Feed
              </Link>
              <Link 
                to="/admin" 
                className="inline-flex items-center justify-center px-2.5 py-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-teal-600 text-white shadow-md hover:shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all duration-200"
                id="footer-portal-link"
              >
                Portal
              </Link>
              <Link 
                to="/privacy" 
                className="inline-flex items-center justify-center px-2.5 py-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white shadow-md hover:shadow-pink-500/25 hover:scale-105 active:scale-95 transition-all duration-200"
                id="footer-privacy-link"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="inline-flex items-center justify-center px-2.5 py-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-md hover:shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all duration-200"
                id="footer-terms-link"
              >
                Terms of Service
              </Link>
            </div>
          </div>

        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[8px] sm:text-[10px] text-slate-400">
          <p>© {currentYear} Current News.</p>
          <span className="mt-0.5 sm:mt-0 font-mono text-[7px] sm:text-[9px] text-slate-400">Autonomous Press Alliance</span>
        </div>
      </div>
    </footer>
  );
}
