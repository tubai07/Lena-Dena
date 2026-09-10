'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

interface WheelDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
  maxDate?: Date;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ITEM_HEIGHT = 48; // px

interface WheelColumnProps {
  items: { label: string; value: number }[];
  selectedValue: number;
  onSelect: (value: number) => void;
}

function WheelColumn({ items, selectedValue, onSelect }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedIndex = useMemo(() => {
    const idx = items.findIndex((it) => it.value === selectedValue);
    return idx >= 0 ? idx : 0;
  }, [items, selectedValue]);

  // Scroll to selected item on mount or when selectedValue/items change externally
  useEffect(() => {
    if (!containerRef.current || isScrollingRef.current) return;
    const targetScrollTop = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(containerRef.current.scrollTop - targetScrollTop) > 2) {
      containerRef.current.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, items]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));

      // Snap precisely to item
      const exactScrollTop = clampedIndex * ITEM_HEIGHT;
      if (Math.abs(containerRef.current.scrollTop - exactScrollTop) > 1) {
        containerRef.current.scrollTo({
          top: exactScrollTop,
          behavior: 'smooth',
        });
      }

      const item = items[clampedIndex];
      if (item && item.value !== selectedValue) {
        onSelect(item.value);
      }
      isScrollingRef.current = false;
    }, 100);
  };

  const handleItemClick = (index: number, val: number) => {
    if (!containerRef.current) return;
    onSelect(val);
    containerRef.current.scrollTo({
      top: index * ITEM_HEIGHT,
      behavior: 'smooth',
    });
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[144px] overflow-y-auto snap-y snap-mandatory scrollbar-none relative select-none w-full text-center"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* Top spacer so index 0 can be centered */}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />

      {items.map((item, idx) => {
        const isSelected = item.value === selectedValue;
        return (
          <div
            key={item.value}
            onClick={() => handleItemClick(idx, item.value)}
            style={{ height: ITEM_HEIGHT }}
            className={`snap-center flex items-center justify-center cursor-pointer transition-all duration-150 ${
              isSelected
                ? 'text-slate-900 font-bold text-lg sm:text-xl scale-105'
                : 'text-slate-400 font-medium text-base hover:text-slate-600'
            }`}
          >
            {item.label}
          </div>
        );
      })}

      {/* Bottom spacer so last index can be centered */}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
    </div>
  );
}

export function WheelDatePickerModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  maxDate = new Date(),
}: WheelDatePickerModalProps) {
  // Parse incoming date or default to today
  const today = useMemo(() => new Date(), []);
  const maxYear = maxDate.getFullYear();
  const maxMonth = maxDate.getMonth();
  const maxDay = maxDate.getDate();

  const [year, setYear] = useState<number>(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      if (parts[0]) return Math.min(parts[0], maxYear);
    }
    return today.getFullYear();
  });

  const [month, setMonth] = useState<number>(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      if (!isNaN(parts[1])) return parts[1] - 1;
    }
    return today.getMonth();
  });

  const [day, setDay] = useState<number>(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      if (parts[2]) return parts[2];
    }
    return today.getDate();
  });

  // Sync internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      const d = selectedDate ? new Date(selectedDate) : today;
      const initYear = Math.min(isNaN(d.getFullYear()) ? today.getFullYear() : d.getFullYear(), maxYear);
      let initMonth = isNaN(d.getMonth()) ? today.getMonth() : d.getMonth();
      if (initYear === maxYear && initMonth > maxMonth) {
        initMonth = maxMonth;
      }
      let initDay = isNaN(d.getDate()) ? today.getDate() : d.getDate();
      const daysInM = new Date(initYear, initMonth + 1, 0).getDate();
      const capDay = (initYear === maxYear && initMonth === maxMonth) ? Math.min(daysInM, maxDay) : daysInM;
      initDay = Math.min(initDay, capDay);

      setYear(initYear);
      setMonth(initMonth);
      setDay(initDay);
    }
  }, [isOpen, selectedDate, maxYear, maxMonth, maxDay, today]);

  // Generate Year options (e.g. past 15 years up to maxYear; no future years)
  const yearItems = useMemo(() => {
    const startYear = maxYear - 15;
    const list = [];
    for (let y = startYear; y <= maxYear; y++) {
      list.push({ label: y.toString(), value: y });
    }
    return list;
  }, [maxYear]);

  // Generate Month options (Jan..Dec, capped at maxMonth if current year)
  const monthItems = useMemo(() => {
    const list = [];
    const limitMonth = year === maxYear ? maxMonth : 11;
    for (let m = 0; m <= limitMonth; m++) {
      list.push({ label: MONTH_NAMES[m], value: m });
    }
    return list;
  }, [year, maxYear, maxMonth]);

  // Clamp month if user changes year to maxYear and current month > maxMonth
  useEffect(() => {
    if (year === maxYear && month > maxMonth) {
      setMonth(maxMonth);
    }
  }, [year, maxYear, maxMonth, month]);

  // Generate Day options (1..max allowable day for the selected year & month)
  const dayItems = useMemo(() => {
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const limitDay = (year === maxYear && month === maxMonth)
      ? Math.min(daysInCurrentMonth, maxDay)
      : daysInCurrentMonth;

    const list = [];
    for (let d = 1; d <= limitDay; d++) {
      list.push({ label: d.toString(), value: d });
    }
    return list;
  }, [year, month, maxYear, maxMonth, maxDay]);

  // Clamp day if days in month changed or capped by today
  useEffect(() => {
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const limitDay = (year === maxYear && month === maxMonth)
      ? Math.min(daysInCurrentMonth, maxDay)
      : daysInCurrentMonth;

    if (day > limitDay) {
      setDay(limitDay);
    }
  }, [year, month, maxYear, maxMonth, maxDay, day]);

  const handleSelectToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setDay(today.getDate());
  };

  const handleConfirm = () => {
    const yStr = year.toString();
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const formatted = `${yStr}-${mStr}-${dStr}`;
    onSelectDate(formatted);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching user's design */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Select Date
          </h3>
          <button
            type="button"
            onClick={handleSelectToday}
            className="text-emerald-700 hover:text-emerald-800 active:scale-95 font-bold text-sm tracking-wide tap-effect transition-transform cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Roller Drum Wheels Container */}
        <div className="px-6 py-4 relative">
          {/* Subtle center row selection highlight */}
          <div
            className="absolute inset-x-6 top-[64px] h-[48px] pointer-events-none rounded-xl bg-slate-50/70 border-y border-slate-200/60"
            aria-hidden="true"
          />

          {/* Top and Bottom Fades for Roller Effect */}
          <div
            className="absolute inset-x-6 top-4 h-10 pointer-events-none bg-gradient-to-b from-white via-white/80 to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-6 bottom-4 h-10 pointer-events-none bg-gradient-to-t from-white via-white/80 to-transparent z-10"
            aria-hidden="true"
          />

          {/* 3 Columns: Day, Month, Year */}
          <div className="grid grid-cols-3 gap-2 relative z-0">
            {/* Day Column */}
            <WheelColumn
              items={dayItems}
              selectedValue={day}
              onSelect={setDay}
            />

            {/* Month Column */}
            <WheelColumn
              items={monthItems}
              selectedValue={month}
              onSelect={setMonth}
            />

            {/* Year Column */}
            <WheelColumn
              items={yearItems}
              selectedValue={year}
              onSelect={setYear}
            />
          </div>
        </div>

        {/* Confirm Button */}
        <div className="px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white rounded-full font-bold text-base shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center tap-effect cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
