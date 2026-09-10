'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface WheelDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dateStr: string) => void;
  initialDate?: string; // YYYY-MM-DD
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const YEARS = Array.from({ length: 11 }, (_, i) => 2022 + i); // 2022 to 2032

export function WheelDatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialDate,
}: WheelDatePickerModalProps) {
  // Parse initial date
  const parsed = useMemo(() => {
    const d = initialDate ? new Date(`${initialDate}T12:00:00`) : new Date();
    const isValid = !isNaN(d.getTime());
    const validD = isValid ? d : new Date();
    return {
      day: validD.getDate(),
      month: validD.getMonth(), // 0-indexed
      year: validD.getFullYear(),
    };
  }, [initialDate, isOpen]);

  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setDay(parsed.day);
      setMonth(parsed.month);
      setYear(parsed.year);
    }
  }, [isOpen, parsed]);

  // Max days in the selected month & year
  const maxDays = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  // Clamp day if exceeding max days (e.g. Feb 30 -> Feb 28/29)
  useEffect(() => {
    if (day > maxDays) {
      setDay(maxDays);
    }
  }, [maxDays, day]);

  if (!isOpen) return null;

  // Jump to Today
  const handleJumpToToday = () => {
    const now = new Date();
    setDay(now.getDate());
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  // Steppers for Day
  const handlePrevDay = () => {
    setDay((prev) => (prev > 1 ? prev - 1 : maxDays));
  };
  const handleNextDay = () => {
    setDay((prev) => (prev < maxDays ? prev + 1 : 1));
  };

  // Steppers for Month
  const handlePrevMonth = () => {
    setMonth((prev) => (prev > 0 ? prev - 1 : 11));
  };
  const handleNextMonth = () => {
    setMonth((prev) => (prev < 11 ? prev + 1 : 0));
  };

  // Steppers for Year
  const handlePrevYear = () => {
    setYear((prev) => {
      const idx = YEARS.indexOf(prev);
      return idx > 0 ? YEARS[idx - 1] : prev;
    });
  };
  const handleNextYear = () => {
    setYear((prev) => {
      const idx = YEARS.indexOf(prev);
      return idx < YEARS.length - 1 ? YEARS[idx + 1] : prev;
    });
  };

  // Final Confirmation
  const handleConfirm = () => {
    const yStr = year.toString();
    const mStr = (month + 1).toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    onConfirm(`${yStr}-${mStr}-${dStr}`);
    onClose();
  };

  // Touch event handlers for mobile swiping
  const touchStartY = React.useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (
    e: React.TouchEvent,
    onUp: () => void,
    onDown: () => void
  ) => {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 18) {
      onUp();
    } else if (diff < -18) {
      onDown();
    }
  };

  // Wheel event handlers for desktop scrolling
  const onWheelColumn = (
    e: React.WheelEvent,
    onUp: () => void,
    onDown: () => void
  ) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      onUp();
    } else if (e.deltaY > 0) {
      onDown();
    }
  };

  // Previous and next labels for 3-row tumbler effect
  const prevDay = day > 1 ? day - 1 : maxDays;
  const nextDay = day < maxDays ? day + 1 : 1;

  const prevMonth = month > 0 ? month - 1 : 11;
  const nextMonth = month < 11 ? month + 1 : 0;

  const yearIdx = YEARS.indexOf(year);
  const prevYear = yearIdx > 0 ? YEARS[yearIdx - 1] : '';
  const nextYear = yearIdx < YEARS.length - 1 ? YEARS[yearIdx + 1] : '';

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-6 select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Screenshot 1 */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Select Date</h3>
          <button
            type="button"
            onClick={handleJumpToToday}
            className="text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer active:scale-95"
          >
            Today
          </button>
        </div>

        {/* 3-Row Tumbler Wheel Picker matching Screenshot 1 */}
        <div className="relative py-2">
          {/* Active Highlight Capsule in Center */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-14 bg-slate-50/80 border border-slate-200/60 rounded-2xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-3 text-center">
            {/* Column 1: Day */}
            <div
              className="flex flex-col items-center justify-center cursor-pointer select-none"
              onWheel={(e) => onWheelColumn(e, handlePrevDay, handleNextDay)}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, handlePrevDay, handleNextDay)}
            >
              {/* Previous Day */}
              <button
                type="button"
                onClick={handlePrevDay}
                className="h-10 text-lg font-semibold text-slate-300 hover:text-slate-400 transition-colors flex items-center justify-center w-full cursor-pointer"
              >
                {prevDay}
              </button>

              {/* Active Day */}
              <div className="h-14 text-2xl font-bold text-slate-900 flex items-center justify-center w-full">
                {day}
              </div>

              {/* Next Day */}
              <button
                type="button"
                onClick={handleNextDay}
                className="h-10 text-lg font-semibold text-slate-300 hover:text-slate-400 transition-colors flex items-center justify-center w-full cursor-pointer"
              >
                {nextDay}
              </button>
            </div>

            {/* Column 2: Month */}
            <div
              className="flex flex-col items-center justify-center cursor-pointer select-none"
              onWheel={(e) => onWheelColumn(e, handlePrevMonth, handleNextMonth)}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, handlePrevMonth, handleNextMonth)}
            >
              {/* Previous Month */}
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-10 text-lg font-semibold text-slate-300 hover:text-slate-400 transition-colors flex items-center justify-center w-full cursor-pointer"
              >
                {MONTHS[prevMonth]}
              </button>

              {/* Active Month */}
              <div className="h-14 text-2xl font-bold text-slate-900 flex items-center justify-center w-full">
                {MONTHS[month]}
              </div>

              {/* Next Month */}
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-10 text-lg font-semibold text-slate-300 hover:text-slate-400 transition-colors flex items-center justify-center w-full cursor-pointer"
              >
                {MONTHS[nextMonth]}
              </button>
            </div>

            {/* Column 3: Year */}
            <div
              className="flex flex-col items-center justify-center cursor-pointer select-none"
              onWheel={(e) => onWheelColumn(e, handlePrevYear, handleNextYear)}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, handlePrevYear, handleNextYear)}
            >
              {/* Previous Year */}
              <button
                type="button"
                onClick={handlePrevYear}
                className="h-10 text-lg font-semibold text-slate-300 hover:text-slate-400 transition-colors flex items-center justify-center w-full cursor-pointer"
              >
                {prevYear || '\u00A0'}
              </button>

              {/* Active Year */}
              <div className="h-14 text-2xl font-bold text-slate-900 flex items-center justify-center w-full">
                {year}
              </div>

              {/* Next Year */}
              <button
                type="button"
                onClick={handleNextYear}
                className="h-10 text-lg font-semibold text-slate-300 hover:text-slate-400 transition-colors flex items-center justify-center w-full cursor-pointer"
              >
                {nextYear || '\u00A0'}
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Button matching Screenshot 1 */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-base shadow-sm transition-all cursor-pointer"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
