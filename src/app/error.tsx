'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
          <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            An unexpected error occurred while loading this page. Your data is safe in Lena Dena.
          </p>
          {error?.message && (
            <div className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl text-left overflow-auto max-h-40 break-words mt-3">
              <span className="font-bold block mb-1">Error details:</span>
              {error.message}
            </div>
          )}
          {error?.digest && (
            <p className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-md inline-block mt-2">
              Ref: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer tap-effect"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span>Try again</span>
          </button>

          <Link
            href="/groups"
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all tap-effect"
          >
            <Home className="w-4 h-4 stroke-[2]" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
