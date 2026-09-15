'use client';

import React from 'react';

interface StraightLineLoaderProps {
  isLoading: boolean;
  className?: string;
}

export function StraightLineLoader({ isLoading, className = '' }: StraightLineLoaderProps) {
  if (!isLoading) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 pointer-events-none transition-opacity duration-300 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      aria-label="Loading..."
      role="progressbar"
      aria-busy={isLoading}
    >
      <div className="relative h-[3px] w-full bg-emerald-950/10 overflow-hidden">
        {/* Primary animated beam */}
        <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-full animate-linear-loader shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        {/* Secondary trailing shimmer */}
        <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-teal-300/40 via-emerald-400 to-transparent rounded-full animate-linear-loader-secondary" />
      </div>
    </div>
  );
}
