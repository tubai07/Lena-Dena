'use client';

import React from 'react';
import { MobileBottomNav } from './MobileBottomNav';

export function ClientLayoutShell({
  businessName,
  children,
}: {
  businessName: string;
  children: React.ReactNode;
}) {
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
