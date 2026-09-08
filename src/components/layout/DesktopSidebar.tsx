'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Receipt,
  BarChart3,
  BellRing,
  Settings,
  RotateCcw,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '../common/LanguageContext';

export function DesktopSidebar({ businessName = 'My Khata' }: { businessName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  const navItems = [
    { href: '/', label: t.dashboard, icon: LayoutDashboard },
    { href: '/customers', label: t.customers, icon: Users },
    { href: '/transactions', label: t.transactions, icon: Receipt },
    { href: '/reports', label: t.reports, icon: BarChart3 },
    { href: '/reminders', label: t.reminders, icon: BellRing },
    { href: '/settings', label: t.settings, icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <img
            src="/app-icon.png"
            alt="Lena Dena"
            className="w-10 h-10 rounded-xl shadow-xs object-cover"
          />
          <div>
            <h2 className="font-extrabold text-slate-900 tracking-tight text-lg">Lena Dena</h2>
            <p className="text-[11px] font-medium text-slate-400">Digital Khata</p>
          </div>
        </div>

        {/* Business Selector Pill */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Account
              </span>
              <p className="text-xs font-bold text-slate-800 truncate max-w-[170px]">{businessName}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              ACTIVE
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-blue-500" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
