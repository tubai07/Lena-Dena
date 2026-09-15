'use client';

import React from 'react';

interface StraightLineLoaderProps {
  isLoading: boolean;
  label?: string;
  className?: string;
}

export function StraightLineLoader({
  isLoading,
  label = 'Loading...',
  className = '',
}: StraightLineLoaderProps) {
  if (!isLoading) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto touch-none select-none cursor-wait bg-slate-900/15 backdrop-blur-[1px] p-4 transition-all duration-200 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      aria-label="Loading..."
      role="progressbar"
      aria-busy={isLoading}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Centered Glass Capsule with straight line loader */}
      <div 
        className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 px-6 py-4 flex flex-col items-center gap-2.5 w-60 max-w-[85vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-bold text-slate-700 tracking-wide select-none">
          {label}
        </span>
        {/* Straight line bar */}
        <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          {/* Primary animated beam */}
          <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-full animate-linear-loader shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          {/* Secondary trailing shimmer */}
          <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-teal-300/40 via-emerald-400 to-transparent rounded-full animate-linear-loader-secondary" />
        </div>
      </div>
    </div>
  );
}

