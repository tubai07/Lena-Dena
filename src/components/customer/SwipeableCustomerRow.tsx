'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { formatINR } from '@/lib/ledger';

interface SwipeableCustomerRowProps {
  customer: any;
  getAvatarBg: (name: string) => string;
  getSubtext: (c: any) => string;
  onDeleteRequest: (customer: any) => void;
}

export function SwipeableCustomerRow({
  customer: c,
  getAvatarBg,
  getSubtext,
  onDeleteRequest,
}: SwipeableCustomerRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const currentOffsetRef = useRef(0);

  const DELETE_BTN_WIDTH = 80;

  const setRowTransform = (x: number, animate: boolean = false) => {
    if (!rowRef.current) return;
    if (animate) {
      rowRef.current.style.transition = 'transform 0.32s cubic-bezier(0.18, 0.89, 0.32, 1.05)';
    } else {
      rowRef.current.style.transition = 'none';
    }
    rowRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
    isDraggingRef.current = true;
    currentOffsetRef.current = isOpen ? -DELETE_BTN_WIDTH : 0;
    setRowTransform(currentOffsetRef.current, false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Disambiguate horizontal vs vertical intent
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (!isHorizontalSwipeRef.current) return;

    let newOffset = currentOffsetRef.current + diffX;

    // Resistance when pulling right past 0
    if (newOffset > 0) {
      newOffset = newOffset * 0.15;
    }

    // Resistance when pulling left past revealed delete button
    if (newOffset < -DELETE_BTN_WIDTH) {
      const extra = newOffset + DELETE_BTN_WIDTH;
      newOffset = -DELETE_BTN_WIDTH + extra * 0.2;
    }

    setRowTransform(newOffset, false);
    currentOffsetRef.current = newOffset;
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (!isHorizontalSwipeRef.current) {
      setRowTransform(isOpen ? -DELETE_BTN_WIDTH : 0, true);
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const currentX = currentOffsetRef.current;
    const isQuickFlick = elapsed < 250 && currentX < -25;

    // Snap open to reveal delete button if dragged left past -35px or quick left flick
    if (currentX < -35 || isQuickFlick) {
      setRowTransform(-DELETE_BTN_WIDTH, true);
      setIsOpen(true);
      setOffsetX(-DELETE_BTN_WIDTH);
      currentOffsetRef.current = -DELETE_BTN_WIDTH;
    } else {
      setRowTransform(0, true);
      setIsOpen(false);
      setOffsetX(0);
      currentOffsetRef.current = 0;
    }
  };

  // Mouse handlers for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = true;
    isDraggingRef.current = true;
    currentOffsetRef.current = isOpen ? -DELETE_BTN_WIDTH : 0;
    setRowTransform(currentOffsetRef.current, false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const diffX = e.clientX - startXRef.current;
    let newOffset = currentOffsetRef.current + diffX;

    if (newOffset > 0) newOffset = newOffset * 0.15;
    if (newOffset < -DELETE_BTN_WIDTH) {
      const extra = newOffset + DELETE_BTN_WIDTH;
      newOffset = -DELETE_BTN_WIDTH + extra * 0.2;
    }

    setRowTransform(newOffset, false);
    currentOffsetRef.current = newOffset;
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const currentX = currentOffsetRef.current;

    // Snap open to reveal delete button if dragged left past -35px
    if (currentX < -35) {
      setRowTransform(-DELETE_BTN_WIDTH, true);
      setIsOpen(true);
      setOffsetX(-DELETE_BTN_WIDTH);
      currentOffsetRef.current = -DELETE_BTN_WIDTH;
    } else {
      setRowTransform(0, true);
      setIsOpen(false);
      setOffsetX(0);
      currentOffsetRef.current = 0;
    }
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      handleMouseUp();
    }
  };

  const isDue = c.currentBalancePaisa > 0;
  const isSettled = c.currentBalancePaisa === 0;

  return (
    <div className="relative overflow-hidden bg-rose-600 select-none border-b border-slate-100 last:border-b-0">
      {/* iOS Red Delete Action revealed behind */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDeleteRequest(c);
        }}
        className="absolute right-0 top-0 bottom-0 w-[80px] bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex flex-col items-center justify-center gap-1 z-0 transition-colors cursor-pointer tap-effect"
        aria-label={`Delete ${c.name}`}
      >
        <Trash2 className="w-5 h-5 stroke-[2.2px]" />
        <span className="text-[11px] font-bold tracking-tight">Delete</span>
      </button>

      {/* Main Row Content (Swipes Left) */}
      <div
        ref={rowRef}
        style={{
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="relative bg-white z-10"
      >
        <Link
          href={isOpen || Math.abs(currentOffsetRef.current) > 5 ? '#' : `/customers/${c.id}`}
          onClick={(e) => {
            if (isOpen || Math.abs(currentOffsetRef.current) > 5) {
              e.preventDefault();
              e.stopPropagation();
              setRowTransform(0, true);
              setOffsetX(0);
              currentOffsetRef.current = 0;
              setIsOpen(false);
            }
          }}
          className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/90 transition-colors group tap-effect cursor-pointer"
        >
          {/* Avatar & Contact Details - Enhanced text size */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-full font-bold flex items-center justify-center text-base shrink-0 ${getAvatarBg(
                c.name
              )}`}
            >
              {c.name.includes('🐰') ? '🐰' : c.name.slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0">
              {/* Bigger Customer Name */}
              <div className="font-bold text-slate-900 text-base sm:text-lg group-hover:text-emerald-700 transition-colors truncate leading-snug">
                {c.name}
              </div>
              {/* Bigger Subtext */}
              <div className="flex items-center gap-1 text-[13px] sm:text-sm text-slate-500 font-medium mt-0.5 truncate">
                <span className="truncate">{getSubtext(c)}</span>
              </div>
            </div>
          </div>

          {/* Amount Due on Right - Bigger & Clearer */}
          <div className="text-right shrink-0 pl-3">
            <div
              className={`text-lg sm:text-xl font-black ${
                isDue
                  ? 'text-orange-600'
                  : isSettled
                  ? 'text-emerald-600'
                  : 'text-emerald-700'
              }`}
            >
              {formatINR(c.currentBalancePaisa, true)}
            </div>
            <span className="text-xs font-semibold text-slate-400 block mt-0.5">
              {isSettled ? 'Settled' : isDue ? 'Due' : 'Advance'}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
