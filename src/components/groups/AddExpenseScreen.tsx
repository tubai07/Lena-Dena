'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Check,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Car,
  Utensils,
  ShoppingCart,
  Coffee,
  Hotel,
  ShoppingBag,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { distributeEqualSplits } from '@/lib/splitwise';
import { WheelDatePickerModal } from '@/components/common/WheelDatePickerModal';

const getAvatarBg = (name: string) => {
  if (name.includes('🐰')) return 'bg-pink-100 text-pink-700';
  const firstChar = name.charAt(0).toUpperCase();
  if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700';
  if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700';
  return 'bg-emerald-100 text-emerald-700';
};

// Safe local date string formatter (YYYY-MM-DD) that never shifts due to UTC offset
export const getLocalDateString = (dInput?: Date | string) => {
  const d = dInput ? new Date(dInput) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface Member {
  id: string;
  name: string;
  isOwner?: boolean;
}

interface AddExpenseScreenProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
  members: Member[];
  onExpenseAdded: (newExpense?: any) => void;
  defaultPayerId?: string;
  initialExpense?: any | null; // For editing existing expense
}

const CATEGORIES = [
  { id: 'General', label: 'General', icon: FileText, color: 'bg-slate-100 text-slate-700' },
  { id: 'Food', label: 'Food & Dining', icon: Utensils, color: 'bg-amber-100 text-amber-700' },
  { id: 'Transport', label: 'Taxi / Fuel', icon: Car, color: 'bg-blue-100 text-blue-700' },
  { id: 'Groceries', label: 'Groceries', icon: ShoppingCart, color: 'bg-emerald-100 text-emerald-700' },
  { id: 'Drinks', label: 'Cafe & Drinks', icon: Coffee, color: 'bg-rose-100 text-rose-700' },
  { id: 'Stay', label: 'Hotel & Stay', icon: Hotel, color: 'bg-purple-100 text-purple-700' },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, color: 'bg-indigo-100 text-indigo-700' },
];

export function AddExpenseScreen({
  isOpen,
  onClose,
  groupId,
  groupName = 'Group',
  members,
  onExpenseAdded,
  defaultPayerId,
  initialExpense = null,
}: AddExpenseScreenProps) {
  const isEditing = Boolean(initialExpense?.id);
  const [step, setStep] = useState<1 | 2>(1);
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payerId, setPayerId] = useState<string>('');
  const [category, setCategory] = useState('General');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Date selection (default today YYYY-MM-DD using local time)
  const [expenseDate, setExpenseDate] = useState(() => getLocalDateString());
  const [showWheelDatePicker, setShowWheelDatePicker] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // Split configurations
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Track previous state to avoid losing typing on re-renders
  const prevIsOpenRef = useRef(false);
  const prevExpenseIdRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldReset = isOpen && (!prevIsOpenRef.current || prevExpenseIdRef.current !== (initialExpense?.id || null));

    if (shouldReset) {
      setStep(1);
      setError('');
      setLoading(false);
      setShowCategoryPicker(false);
      setShowWheelDatePicker(false);

      if (initialExpense) {
        // Edit mode pre-population
        setDescription(initialExpense.description || '');
        setAmountRupees(((initialExpense.totalAmountPaisa || 0) / 100).toFixed(2));
        setCategory(initialExpense.category || 'General');
        setExpenseDate(getLocalDateString(initialExpense.date));
        setNotes(initialExpense.notes || '');

        const editPayer = initialExpense.payers?.[0]?.memberId || defaultPayerId || members[0]?.id || '';
        setPayerId(editPayer);

        const isCustom = initialExpense.splitType === 'EXACT' || initialExpense.splitType === 'CUSTOM';
        setSplitMode(isCustom ? 'CUSTOM' : 'EQUAL');

        const splitMembers = (initialExpense.splits || []).map((s: any) => s.memberId);
        setSelectedMemberIds(splitMembers.length > 0 ? splitMembers : members.map((m) => m.id));

        if (isCustom) {
          const customs: Record<string, string> = {};
          (initialExpense.splits || []).forEach((s: any) => {
            customs[s.memberId] = (s.amountPaisa / 100).toFixed(2);
          });
          setCustomAmounts(customs);
        } else {
          setCustomAmounts({});
        }
      } else {
        // Create mode fresh state
        setDescription('');
        setAmountRupees('');
        setSplitMode('EQUAL');
        setCategory('General');
        setExpenseDate(getLocalDateString());
        setNotes('');

        const targetPayer =
          (defaultPayerId && members.some((m) => m.id === defaultPayerId) && defaultPayerId) ||
          members.find((m) => m.isOwner)?.id ||
          members[0]?.id ||
          '';
        setPayerId(targetPayer);

        setSelectedMemberIds(members.map((m) => m.id));
        setCustomAmounts({});
      }
    }

    prevIsOpenRef.current = isOpen;
    prevExpenseIdRef.current = initialExpense?.id || null;
  }, [isOpen, members, defaultPayerId, initialExpense]);

  const totalAmountPaisa = Math.round(Number(amountRupees || 0) * 100);

  // Equal splits calculation
  const computedEqualSplits = useMemo(() => {
    if (totalAmountPaisa <= 0 || selectedMemberIds.length === 0) return [];
    return distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
  }, [totalAmountPaisa, selectedMemberIds]);

  // Sum of custom amounts in paise
  const customSumPaisa = useMemo(() => {
    return Object.values(customAmounts).reduce(
      (sum, val) => sum + Math.round(Number(val || 0) * 100),
      0
    );
  }, [customAmounts]);

  const diffPaisa = totalAmountPaisa - customSumPaisa;

  // Formatted date string for button
  const formattedDateLabel = useMemo(() => {
    if (!expenseDate) return 'Today';
    const today = getLocalDateString();
    if (expenseDate === today) return 'Today';

    const [y, m, d] = expenseDate.split('-').map(Number);
    if (!y || !m || !d) return expenseDate;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }, [expenseDate]);

  const activeCategory = useMemo(() => {
    return CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  }, [category]);

  const CategoryIcon = activeCategory.icon;

  const handleSwitchToCustom = () => {
    setSplitMode('CUSTOM');
    const currentCustomPaisa = Object.values(customAmounts).reduce(
      (s, v) => s + Math.round(Number(v || 0) * 100),
      0
    );
    if (currentCustomPaisa === 0 && totalAmountPaisa > 0 && selectedMemberIds.length > 0) {
      const splits = distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
      const newCustoms: Record<string, string> = {};
      members.forEach((m) => {
        const match = splits.find((s) => s.memberId === m.id);
        newCustoms[m.id] = match ? (match.amountPaisa / 100).toFixed(2) : '0.00';
      });
      setCustomAmounts(newCustoms);
    }
  };

  const handleAutoFillRemainder = (targetMemberId: string) => {
    const otherSum = Object.entries(customAmounts)
      .filter(([id]) => id !== targetMemberId)
      .reduce((sum, [, val]) => sum + Math.round(Number(val || 0) * 100), 0);
    const remainderPaisa = Math.max(0, totalAmountPaisa - otherSum);
    setCustomAmounts({
      ...customAmounts,
      [targetMemberId]: (remainderPaisa / 100).toFixed(2),
    });
  };

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length === 1) return;
      setSelectedMemberIds(selectedMemberIds.filter((mId) => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSelectAll = () => {
    setSelectedMemberIds(members.map((m) => m.id));
  };

  const handleGoToStep2 = () => {
    setError('');
    const trimmed = description.trim();
    if (!trimmed) {
      setError('Please enter a description');
      return;
    }
    if (totalAmountPaisa <= 0 || isNaN(totalAmountPaisa)) {
      setError('Please enter a valid bill amount');
      return;
    }
    setStep(2);
  };

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError('');

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError('Please enter a description');
      setStep(1);
      return;
    }

    if (totalAmountPaisa <= 0 || isNaN(totalAmountPaisa)) {
      setError('Please enter a valid bill amount');
      setStep(1);
      return;
    }

    if (!payerId) {
      setError('Please select who paid');
      return;
    }

    let finalSplits: { memberId: string; amountPaisa: number }[] = [];
    let finalSplitType = 'EQUAL';

    if (splitMode === 'EQUAL') {
      if (selectedMemberIds.length === 0) {
        setError('Please select at least one person to split with');
        return;
      }
      finalSplits = distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
      finalSplitType = 'EQUAL';
    } else {
      if (Math.abs(diffPaisa) > 2) {
        const diffRupees = Math.abs(diffPaisa) / 100;
        if (diffPaisa > 0) {
          setError(`₹${diffRupees.toFixed(2)} remaining unallocated to match total ₹${(totalAmountPaisa / 100).toFixed(2)}`);
        } else {
          setError(`Custom amounts exceed total by ₹${diffRupees.toFixed(2)}`);
        }
        return;
      }

      finalSplits = members
        .map((m) => ({
          memberId: m.id,
          amountPaisa: Math.round(Number(customAmounts[m.id] || 0) * 100),
        }))
        .filter((s) => s.amountPaisa > 0);

      if (finalSplits.length === 0) {
        setError('Please enter custom amounts for at least one person');
        return;
      }
      finalSplitType = 'EXACT';
    }

    // Build local date object without timezone day shifting
    const [y, m, d] = expenseDate.split('-').map(Number);
    const selectedDateObj = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
    const payerMember = members.find((m) => m.id === payerId) || { id: payerId, name: 'You' };

    // ⚡ INSTANT OPTIMISTIC SUBMIT (0ms latency!)
    const optimisticExpense = {
      ...(initialExpense || {}),
      id: isEditing ? initialExpense.id : `temp_exp_${Date.now()}`,
      description: trimmedDesc,
      totalAmountPaisa,
      category,
      splitType: finalSplitType,
      date: selectedDateObj.toISOString(),
      notes: notes.trim() || null,
      payers: [
        {
          id: isEditing ? initialExpense.payers?.[0]?.id || `temp_p_${Date.now()}` : `temp_p_${Date.now()}`,
          memberId: payerId,
          amountPaisa: totalAmountPaisa,
          member: { id: payerMember.id, name: payerMember.name },
        },
      ],
      splits: finalSplits.map((s, idx) => {
        const mem = members.find((m) => m.id === s.memberId) || { id: s.memberId, name: 'Member' };
        return {
          id: isEditing ? initialExpense.splits?.[idx]?.id || `temp_s_${Date.now()}_${idx}` : `temp_s_${Date.now()}_${idx}`,
          memberId: s.memberId,
          amountPaisa: s.amountPaisa,
          member: { id: mem.id, name: mem.name },
        };
      }),
    };

    onExpenseAdded(optimisticExpense);
    onClose();

    // Background server save/update
    try {
      setLoading(true);
      const endpoint = isEditing
        ? `/api/groups/${groupId}/expenses/${initialExpense.id}`
        : `/api/groups/${groupId}/expenses`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmedDesc,
          totalAmountPaisa,
          category,
          splitType: finalSplitType,
          date: selectedDateObj.toISOString(),
          notes: notes.trim() || undefined,
          payers: [{ memberId: payerId, amountPaisa: totalAmountPaisa }],
          splits: finalSplits,
        }),
      });

      const data = await res.json();
      if (res.ok && data.expense) {
        onExpenseAdded(data.expense);
      }
    } catch (err: any) {
      console.error('Error saving expense:', err);
    } finally {
      setLoading(false);
    }
  };

  const isStep1Ready = description.trim().length > 0 && Number(amountRupees) > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-slate-900/40 backdrop-blur-xs sm:py-6 animate-in fade-in duration-200 select-none">
      {/* Centered canvas matching web app width (max-w-md) */}
      <div className="w-full max-w-md bg-white h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom duration-250 ease-out border-slate-100">
        {/* ================= STEP 1: BILL DETAILS ================= */}
        {step === 1 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Navigation Header */}
            <header className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <button
                onClick={onClose}
                type="button"
                aria-label="Close"
                className="p-1 -ml-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <h2 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Edit Expense' : 'Add an Expense'}
                </h2>
                <span className="text-[11px] text-slate-400 font-semibold">Step 1 of 2: Details</span>
              </div>

              <button
                onClick={handleGoToStep2}
                type="button"
                disabled={!isStep1Ready}
                className={`text-sm font-bold transition-colors cursor-pointer ${
                  isStep1Ready ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </header>

            {/* Sub-Header: Group tag */}
            <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-2 flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-bold">Group:</span>
              <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                {groupName}
              </span>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Icon + Description */}
              <div className="flex items-center gap-3 pt-1">
                {/* Category Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-2xs cursor-pointer hover:scale-105 ${activeCategory.color}`}
                    title="Change Category"
                  >
                    <CategoryIcon className="w-6 h-6" />
                  </button>

                  {/* Popover */}
                  {showCategoryPicker && (
                    <div className="absolute left-0 top-14 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-2 z-20 grid grid-cols-3 gap-1.5 w-60 animate-in fade-in zoom-in-95">
                      {CATEGORIES.map((c) => {
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCategory(c.id);
                              setShowCategoryPicker(false);
                            }}
                            className={`p-2 rounded-xl flex flex-col items-center gap-1 hover:bg-slate-50 transition-colors cursor-pointer ${
                              category === c.id ? 'ring-2 ring-emerald-500 bg-emerald-50/40' : ''
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] text-slate-800 font-bold truncate w-full text-center">
                              {c.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Description Input */}
                <div className="flex-1 border-b border-slate-200 focus-within:border-emerald-600 transition-colors pb-1">
                  <input
                    type="text"
                    placeholder="Enter a description (e.g. Dinner, Taxi)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoFocus
                    className="w-full text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:outline-hidden bg-transparent"
                  />
                </div>
              </div>

              {/* Currency Symbol + Amount */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 font-bold text-2xl flex items-center justify-center border border-slate-200">
                  ₹
                </div>

                <div className="flex-1 border-b border-slate-200 focus-within:border-emerald-600 transition-colors pb-1">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    className="w-full text-3xl font-black text-slate-900 placeholder:text-slate-300 focus:outline-hidden bg-transparent tracking-tight"
                  />
                </div>
              </div>

              {/* Transaction Date Row */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowWheelDatePicker(true)}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-sm font-semibold transition-all cursor-pointer shadow-2xs hover:border-slate-300"
                >
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span>
                    Date: <strong className="font-bold text-slate-900">{formattedDateLabel}</strong>
                  </span>
                </button>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-slate-500 font-semibold">
                  Notes or Bill # (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Add details, invoice number..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-200/80 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-hidden focus:border-emerald-600 bg-slate-50/40 resize-none"
                />
              </div>
            </div>

            {/* Bottom Button matching Screenshot 1 */}
            <footer className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleGoToStep2}
                disabled={!isStep1Ready}
                className={`w-full py-3.5 rounded-full text-base font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isStep1Ready
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20 active:scale-[0.99]'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                <span>Next: Choose who paid & split</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </footer>
          </div>
        )}

        {/* ================= STEP 2: WHO PAID & SPLIT ================= */}
        {step === 2 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Navigation Header */}
            <header className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <button
                onClick={() => setStep(1)}
                type="button"
                aria-label="Back to Step 1"
                className="p-1 -ml-1 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Back</span>
              </button>

              <div className="text-center">
                <h2 className="text-base font-bold text-slate-900">Who paid & split</h2>
                <span className="text-[11px] text-slate-400 font-semibold">Step 2 of 2: Allocation</span>
              </div>

              <button
                onClick={handleSubmit}
                type="button"
                disabled={loading}
                className="text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {isEditing ? 'Update' : 'Save'}
              </button>
            </header>

            {/* Vibrant Summary Banner */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${activeCategory.color} shrink-0 shadow-2xs`}>
                  <CategoryIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-900 truncate block">
                    {description}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    {activeCategory.label} • {formattedDateLabel}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-lg font-black text-slate-900 block tracking-tight">
                  ₹{Number(amountRupees || 0).toFixed(2)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Total Bill
                </span>
              </div>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: Who Paid? */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Who paid for this bill?
                  </label>
                  <span className="text-xs font-semibold text-slate-400">Single payer</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const isSelected = payerId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayerId(m.id)}
                        className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px] ${
                            isSelected ? 'bg-white/20 text-white' : getAvatarBg(m.name)
                          }`}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{m.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Split Mode */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    How should it be split?
                  </label>

                  <div className="bg-slate-100/90 p-1 rounded-2xl flex gap-1 border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setSplitMode('EQUAL')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        splitMode === 'EQUAL'
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/50'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Equally
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchToCustom}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        splitMode === 'CUSTOM'
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/50'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Custom (₹)
                    </button>
                  </div>
                </div>

                {/* EQUAL SPLIT LIST */}
                {splitMode === 'EQUAL' && (
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 text-xs font-bold">
                      <span className="text-slate-600">
                        Included ({selectedMemberIds.length} of {members.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer font-bold"
                      >
                        Select All
                      </button>
                    </div>

                    <div className="space-y-2 pt-0.5">
                      {members.map((m) => {
                        const isSelected = selectedMemberIds.includes(m.id);
                        const equalSplit = computedEqualSplits.find((s) => s.memberId === m.id);
                        const shareRupees = equalSplit ? (equalSplit.amountPaisa / 100).toFixed(2) : '0.00';

                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleMemberSelection(m.id)}
                            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                                : 'bg-white/40 border-slate-100 text-slate-400 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Styled Checkbox */}
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'border-2 border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>

                              {/* Avatar */}
                              <div
                                className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                                  m.name
                                )}`}
                              >
                                {m.name.charAt(0).toUpperCase()}
                              </div>

                              <span className="text-sm font-bold text-slate-900">{m.name}</span>
                            </div>

                            {isSelected && totalAmountPaisa > 0 && (
                              <div className="bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl text-xs font-black text-emerald-800">
                                ₹{shareRupees}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CUSTOM SPLIT LIST */}
                {splitMode === 'CUSTOM' && (
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 text-xs font-bold">
                      <span className="text-slate-600">
                        Allocated: <strong className="text-slate-900">₹{(customSumPaisa / 100).toFixed(2)}</strong> of ₹{(totalAmountPaisa / 100).toFixed(2)}
                      </span>
                      {diffPaisa !== 0 ? (
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${diffPaisa > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {diffPaisa > 0 ? `₹${(diffPaisa / 100).toFixed(2)} left` : `₹${(Math.abs(diffPaisa) / 100).toFixed(2)} over`}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" /> Balanced
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {members.map((m) => {
                        const val = customAmounts[m.id] || '';
                        return (
                          <div key={m.id} className="flex items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                            <div
                              className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                                m.name
                              )}`}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>

                            <span className="text-sm font-bold text-slate-800 w-24 truncate">
                              {m.name}
                            </span>

                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={val}
                                onChange={(e) => {
                                  setCustomAmounts({
                                    ...customAmounts,
                                    [m.id]: e.target.value,
                                  });
                                }}
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-slate-50/50"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAutoFillRemainder(m.id)}
                              className="px-2.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors shrink-0 cursor-pointer active:scale-95"
                              title="Fill Remaining"
                            >
                              Fill rest
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Save Button matching Screenshot 1 pill button */}
            <footer className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3.5 rounded-full text-base font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20 transition-all cursor-pointer active:scale-[0.99]"
              >
                {isEditing ? 'Update Expense' : 'Save Expense'}
              </button>
            </footer>
          </div>
        )}
      </div>

      {/* Standalone Wheel Date Picker Modal at highest z-index */}
      <WheelDatePickerModal
        isOpen={showWheelDatePicker}
        onClose={() => setShowWheelDatePicker(false)}
        onConfirm={(d) => setExpenseDate(d)}
        initialDate={expenseDate}
      />
    </div>
  );
}
