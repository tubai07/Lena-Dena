'use client';

import React, { useState, useEffect } from 'react';
import { Search, Globe, Plus, Store, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { NotificationTray } from '../common/NotificationTray';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { useTranslation } from '../common/LanguageContext';
import { Language } from '@/lib/i18n';

interface TopNavBarProps {
  businessName?: string;
  onOpenQuickAction?: (action?: 'CREDIT' | 'PAYMENT' | 'CUSTOMER') => void;
}

export function TopNavBar({ businessName = 'Tubai General Store', onOpenQuickAction }: TopNavBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { lang, setLang, t } = useTranslation();

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Store Name (Mobile & Tablet) */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-blue-500/20">
              LD
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-blue-600" />
                <h1 className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate max-w-[160px] sm:max-w-[220px]">
                  {businessName}
                </h1>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Digital Khata Active
              </span>
            </div>
          </div>

          {/* Search Trigger (Center) */}
          <div className="flex-1 max-w-md mx-2 hidden sm:block">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-slate-500 text-sm border border-slate-200/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <span>{t.searchPlaceholder}</span>
              </span>
              <kbd className="text-[10px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded shadow-xs font-mono font-semibold">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Action Icons & Controls */}
          <div className="flex items-center gap-2">
            {/* Mobile Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="sm:hidden p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Quick Action Buttons (Desktop) */}
            {onOpenQuickAction && (
              <div className="hidden lg:flex items-center gap-2 mr-2">
                <button
                  onClick={() => onOpenQuickAction('PAYMENT')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-colors border border-emerald-200"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Receive ₹</span>
                </button>
                <button
                  onClick={() => onOpenQuickAction('CREDIT')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors border border-rose-200"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                  <span>+ Give Credit</span>
                </button>
              </div>
            )}

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/60">
              {(['en', 'hi', 'bn'] as Language[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                    lang === code
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={code === 'en' ? 'English' : code === 'hi' ? 'हिन्दी' : 'বাংলা'}
                >
                  {code === 'en' ? 'EN' : code === 'hi' ? 'हि' : 'বাং'}
                </button>
              ))}
            </div>

            {/* Notifications Tray */}
            <NotificationTray />
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
