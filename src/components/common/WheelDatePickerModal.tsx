'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface WheelDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dateStr: string) => void;
  initialDate?: string; // YYYY-MM-DD or ISO string
  disableFuture?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseSafeDate(dateInput?: string | null) {
  if (dateInput && typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: Math.max(0, Math.min(11, m)), day: Math.max(1, Math.min(31, d)) };
      }
    }
    const dObj = new Date(dateInput);
    if (!isNaN(dObj.getTime())) {
      return {
        year: dObj.getFullYear(),
        month: dObj.getMonth(),
        day: dObj.getDate(),
      };
    }
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  };
}

export function WheelDatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
  disableFuture = false,
}: WheelDatePickerModalProps) {
  const parsed = useMemo(() => parseSafeDate(initialDate), [initialDate, isOpen]);

  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }, [isOpen]);

  const yesterday = useMemo(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return {
      year: yest.getFullYear(),
      month: yest.getMonth(),
      day: yest.getDate(),
    };
  }, [isOpen]);

  // View state for browsing months/years
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);

  // Selected date state
  const [selectedDay, setSelectedDay] = useState(parsed.day);
  const [selectedMonth, setSelectedMonth] = useState(parsed.month);
  const [selectedYear, setSelectedYear] = useState(parsed.year);

  // Reset/sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      let y = parsed.year;
      let m = parsed.month;
      let d = parsed.day;

      if (disableFuture) {
        if (
          y > today.year ||
          (y === today.year && m > today.month) ||
          (y === today.year && m === today.month && d > today.day)
        ) {
          y = today.year;
          m = today.month;
          d = today.day;
        }
      }

      setSelectedDay(d);
      setSelectedMonth(m);
      setSelectedYear(y);
      setViewMonth(m);
      setViewYear(y);
    }
  }, [isOpen, parsed, disableFuture, today]);

  if (!isOpen) return null;

  // Jump shortcuts
  const handleSelectToday = () => {
    setSelectedDay(today.day);
    setSelectedMonth(today.month);
    setSelectedYear(today.year);
    setViewMonth(today.month);
    setViewYear(today.year);
  };

  const handleSelectYesterday = () => {
    setSelectedDay(yesterday.day);
    setSelectedMonth(yesterday.month);
    setSelectedYear(yesterday.year);
    setViewMonth(yesterday.month);
    setViewYear(yesterday.year);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (disableFuture && viewYear === today.year && viewMonth >= today.month) {
      return;
    }
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (d: number) => {
    setSelectedDay(d);
    setSelectedMonth(viewMonth);
    setSelectedYear(viewYear);
  };

  const handleConfirm = () => {
    const yStr = selectedYear.toString();
    const mStr = (selectedMonth + 1).toString().padStart(2, '0');
    const dStr = selectedDay.toString().padStart(2, '0');
    onConfirm(`${yStr}-${mStr}-${dStr}`);
    onClose();
  };

  // Calendar grid calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const isTodaySelected =
    selectedDay === today.day &&
    selectedMonth === today.month &&
    selectedYear === today.year;

  const isYesterdaySelected =
    selectedDay === yesterday.day &&
    selectedMonth === yesterday.month &&
    selectedYear === yesterday.year;

  const isNextMonthDisabled =
    disableFuture && (viewYear > today.year || (viewYear === today.year && viewMonth >= today.month));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 select-none animate-in zoom-in-95 duration-150 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title & Quick Chips */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Select Date</h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectYesterday}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                isYesterdaySelected
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                isTodaySelected
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
              }`}
            >
              Today
            </button>
          </div>
        </div>

        {/* Month / Year Navigator */}
        <div className="flex items-center justify-between bg-slate-50/90 rounded-2xl p-1.5 border border-slate-200/70">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 shadow-2xs transition-colors cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <span className="text-sm font-black text-slate-800">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isNextMonthDisabled}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center text-slate-600 shadow-2xs transition-colors cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Calendar Day Grid */}
        <div className="space-y-1.5">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center">
            {WEEK_DAYS.map((wd, i) => (
              <span
                key={wd}
                className={`text-[11px] font-bold py-1 ${
                  i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous month filler days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const fillerDay = prevMonthDays - firstDayOfWeek + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="h-9 flex items-center justify-center text-xs font-semibold text-slate-300 pointer-events-none"
                >
                  {fillerDay}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                selectedDay === dayNum &&
                selectedMonth === viewMonth &&
                selectedYear === viewYear;

              const isCurrentDay =
                dayNum === today.day &&
                viewMonth === today.month &&
                viewYear === today.year;

              const isFuture =
                disableFuture &&
                (viewYear > today.year ||
                  (viewYear === today.year && viewMonth > today.month) ||
                  (viewYear === today.year && viewMonth === today.month && dayNum > today.day));

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={isFuture}
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center relative cursor-pointer ${
                    isFuture
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-emerald-600 text-white font-black shadow-xs scale-105'
                      : isCurrentDay
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-black hover:bg-emerald-100'
                      : 'hover:bg-slate-100 text-slate-800 active:scale-95'
                  }`}
                >
                  <span>{dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Confirm Action Button */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Confirm Date</span>
        </button>
      </div>
    </div>
  );
}
