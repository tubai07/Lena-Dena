'use client';

import React, { useEffect } from 'react';
import { MobileBottomNav } from './MobileBottomNav';
import { setCachedItem } from '@/lib/groupCache';

export function ClientLayoutShell({
  businessName,
  children,
}: {
  businessName: string;
  children: React.ReactNode;
}) {
  // Warm up groups cache in background on idle so navigating to Split/Groups is instantaneous (0ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/groups')
        .then((res) => res.json())
        .then((data) => {
          if (data?.groups) {
            setCachedItem('all_groups', data.groups);
          }
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Listen for Supabase confirmation link returns (#access_token=... or ?token_hash=...)
  useEffect(() => {
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      let accessToken = '';

      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        accessToken = params.get('access_token') || '';
      }

      if (accessToken) {
        fetch('/api/settings/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm-token',
            accessToken,
            newEmail: 'auto', // Placeholder to satisfy validator
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              window.history.replaceState(null, '', window.location.pathname);
              window.location.href = '/settings?confirmed=true';
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/70 sm:py-6 flex justify-center">
      {/* Centered Mobile Canvas Frame */}
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[844px] sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-200/80 overflow-x-clip flex flex-col relative">
        <div className="flex-1 w-full">{children}</div>

        {/* Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
