'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Receipt, Settings, UsersRound } from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();

  // If inside a customer profile (/customers/...), hide the general bottom nav
  // because customer profile has its own sticky Received / Given action tray!
  if (pathname.startsWith('/customers/')) {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Ledger', icon: BookOpen },
    { href: '/groups', label: 'Split', icon: UsersRound },
    { href: '/transactions', label: 'Activity', icon: Receipt },
    { href: '/settings', label: 'More', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all ${
                isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium hover:text-slate-800'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-colors ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className="text-[11px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
