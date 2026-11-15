import React from 'react';
import { HEADER_THEME_META, HeaderBgTheme } from '../types/siteSettings';

interface NavbarProps {
  activeView: 'catalog' | 'admin';
  onNavigateView: (view: 'catalog' | 'admin') => void;
  isAdminSignedIn: boolean;
  headerBgTheme: HeaderBgTheme;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onNavigateView,
  isAdminSignedIn,
  headerBgTheme,
}) => {
  const theme = HEADER_THEME_META[headerBgTheme] || HEADER_THEME_META.navy;

  const scrollToSection = (sectionId: string) => {
    if (activeView !== 'catalog') {
      onNavigateView('catalog');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-sm transition-colors duration-200 ${theme.headerClass}`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Zone 1: Compact Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            onNavigateView('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`font-display text-base font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 rounded ${
            theme.isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          জননী টেলিকম
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="প্রধান নেভিগেশন"
          className={`hidden md:flex items-center gap-6 text-xs font-medium ${
            theme.isDark ? 'text-slate-200' : 'text-slate-600'
          }`}
        >
          <button
            type="button"
            onClick={() => scrollToSection('catalog')}
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              theme.isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}
          >
            ফাইল ক্যাটালগ
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('search-menu')}
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              theme.isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}
          >
            ফাইল খুঁজুন
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('servicing')}
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              theme.isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}
          >
            সার্ভিসিং
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('guide')}
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              theme.isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}
          >
            গাইড ও FAQ
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              theme.isDark ? 'hover:text-white' : 'hover:text-slate-900'
            }`}
          >
            যোগাযোগ
          </button>
        </nav>

        {/* Zone 3: Compact Single Primary Action */}
        <div className="flex items-center shrink-0">
          {activeView === 'catalog' ? (
            <button
              type="button"
              onClick={() => onNavigateView('admin')}
              className={`inline-flex items-center justify-center rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                theme.isDark
                  ? 'bg-sky-500 text-white hover:bg-sky-400'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isAdminSignedIn ? 'অ্যাডমিন প্যানেল' : 'অ্যাডমিন লগইন'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateView('catalog')}
              className={`inline-flex items-center justify-center rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                theme.isDark
                  ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                  : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
              }`}
            >
              ফাইল তালিকায় ফিরুন
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
