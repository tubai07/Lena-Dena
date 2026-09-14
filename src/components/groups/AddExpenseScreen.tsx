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
  Users,
  User,
  CheckCircle2,
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

// Safe local date string formatter (YYYY-MM-DD)
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
  onExpenseAdded: (newExpense?: any, replacedTempId?: string) => void;
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('General');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Date selection (defaults to today; cannot be future)
  const [expenseDate, setExpenseDate] = useState(() => getLocalDateString());
  const [showWheelDatePicker, setShowWheelDatePicker] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // Step 2: Who Paid? (Single person OR Multiple people)
  const [payerMode, setPayerMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  const [singlePayerId, setSinglePayerId] = useState<string>('');
  const [multiplePayers, setMultiplePayers] = useState<Record<string, string>>({});

  // Step 3: How should this be split? ("Equal" or "Custom")
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedSplitMemberIds, setSelectedSplitMemberIds] = useState<string[]>([]);
  const [customSplitAmounts, setCustomSplitAmounts] = useState<Record<string, string>>({});

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

        // Payers
        const existingPayers = initialExpense.payers || [];
        if (existingPayers.length > 1) {
          setPayerMode('MULTIPLE');
          const payersMap: Record<string, string> = {};
          existingPayers.forEach((p: any) => {
            payersMap[p.memberId] = (p.amountPaisa / 100).toFixed(2);
          });
          setMultiplePayers(payersMap);
          setSinglePayerId(existingPayers[0]?.memberId || members[0]?.id || '');
        } else {
          setPayerMode('SINGLE');
          setSinglePayerId(existingPayers[0]?.memberId || defaultPayerId || members[0]?.id || '');
          setMultiplePayers({});
        }

        // Splits
        const isCustomSplit = initialExpense.splitType === 'EXACT' || initialExpense.splitType === 'CUSTOM';
        setSplitMode(isCustomSplit ? 'CUSTOM' : 'EQUAL');

        const splitMembers = (initialExpense.splits || []).map((s: any) => s.memberId);
        setSelectedSplitMemberIds(splitMembers.length > 0 ? splitMembers : members.map((m) => m.id));

        if (isCustomSplit) {
          const customs: Record<string, string> = {};
          (initialExpense.splits || []).forEach((s: any) => {
            customs[s.memberId] = (s.amountPaisa / 100).toFixed(2);
          });
          setCustomSplitAmounts(customs);
        } else {
          setCustomSplitAmounts({});
        }
      } else {
        // Create mode fresh state
        setDescription('');
        setAmountRupees('');
        setCategory('General');
        setExpenseDate(getLocalDateString());
        setNotes('');

        const targetPayer =
          (defaultPayerId && members.some((m) => m.id === defaultPayerId) && defaultPayerId) ||
          members.find((m) => m.isOwner)?.id ||
          members[0]?.id ||
          '';
        setPayerMode('SINGLE');
        setSinglePayerId(targetPayer);
        setMultiplePayers({});

        setSplitMode('EQUAL');
        setSelectedSplitMemberIds(members.map((m) => m.id));
        setCustomSplitAmounts({});
      }
    }

    prevIsOpenRef.current = isOpen;
    prevExpenseIdRef.current = initialExpense?.id || null;
  }, [isOpen, members, defaultPayerId, initialExpense]);

  const totalAmountPaisa = Math.round(Number(amountRupees || 0) * 100);

  // Payers sum and difference calculations for Step 2
  const multiplePayersSumPaisa = useMemo(() => {
    return Object.values(multiplePayers).reduce(
      (sum, val) => sum + Math.round(Number(val || 0) * 100),
      0
    );
  }, [multiplePayers]);

  const payersDiffPaisa = totalAmountPaisa - (payerMode === 'SINGLE' ? totalAmountPaisa : multiplePayersSumPaisa);

  // Splits sum and difference calculations for Step 3
  const computedEqualSplits = useMemo(() => {
    if (totalAmountPaisa <= 0 || selectedSplitMemberIds.length === 0) return [];
    return distributeEqualSplits(totalAmountPaisa, selectedSplitMemberIds);
  }, [totalAmountPaisa, selectedSplitMemberIds]);

  const customSplitsSumPaisa = useMemo(() => {
    return Object.values(customSplitAmounts).reduce(
      (sum, val) => sum + Math.round(Number(val || 0) * 100),
      0
    );
  }, [customSplitAmounts]);

  const splitsDiffPaisa = totalAmountPaisa - customSplitsSumPaisa;

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

  // Quick action: switch to multiple payers with equal or default allocation
  const handleSwitchToMultiplePayers = () => {
    setPayerMode('MULTIPLE');
    const currentSum = Object.values(multiplePayers).reduce((s, v) => s + Math.round(Number(v || 0) * 100), 0);
    if (currentSum === 0 && totalAmountPaisa > 0) {
      const initialMap: Record<string, string> = {};
      if (singlePayerId) {
        initialMap[singlePayerId] = (totalAmountPaisa / 100).toFixed(2);
      }
      setMultiplePayers(initialMap);
    }
  };

  // Quick auto-fill remainder for payers
  const handleAutoFillPayerRemainder = (memberId: string) => {
    const otherSum = Object.entries(multiplePayers)
      .filter(([id]) => id !== memberId)
      .reduce((sum, [, val]) => sum + Math.round(Number(val || 0) * 100), 0);
    const remainder = Math.max(0, totalAmountPaisa - otherSum);
    setMultiplePayers({
      ...multiplePayers,
      [memberId]: (remainder / 100).toFixed(2),
    });
  };

  // Quick auto-fill remainder for splits
  const handleAutoFillSplitRemainder = (memberId: string) => {
    const otherSum = Object.entries(customSplitAmounts)
      .filter(([id]) => id !== memberId)
      .reduce((sum, [, val]) => sum + Math.round(Number(val || 0) * 100), 0);
    const remainder = Math.max(0, totalAmountPaisa - otherSum);
    setCustomSplitAmounts({
      ...customSplitAmounts,
      [memberId]: (remainder / 100).toFixed(2),
    });
  };

  // Switch to custom split mode with equal seed
  const handleSwitchToCustomSplits = () => {
    setSplitMode('CUSTOM');
    const currentSum = Object.values(customSplitAmounts).reduce((s, v) => s + Math.round(Number(v || 0) * 100), 0);
    if (currentSum === 0 && totalAmountPaisa > 0 && selectedSplitMemberIds.length > 0) {
      const splits = distributeEqualSplits(totalAmountPaisa, selectedSplitMemberIds);
      const newCustoms: Record<string, string> = {};
      members.forEach((m) => {
        const match = splits.find((s) => s.memberId === m.id);
        newCustoms[m.id] = match ? (match.amountPaisa / 100).toFixed(2) : '0.00';
      });
      setCustomSplitAmounts(newCustoms);
    }
  };

  // Toggle member inclusion in equal split
  const toggleSplitMember = (id: string) => {
    if (selectedSplitMemberIds.includes(id)) {
      if (selectedSplitMemberIds.length === 1) return; // Keep at least one
      setSelectedSplitMemberIds(selectedSplitMemberIds.filter((mId) => mId !== id));
    } else {
      setSelectedSplitMemberIds([...selectedSplitMemberIds, id]);
    }
  };

  // Step 1 -> Step 2 validation
  const handleGoToStep2 = () => {
    setError('');
    const trimmed = description.trim();
    if (!trimmed) {
      setError('Please enter a description for the bill');
      return;
    }
    if (totalAmountPaisa <= 0 || isNaN(totalAmountPaisa)) {
      setError('Please enter a valid bill amount');
      return;
    }
    setStep(2);
  };

  // Step 2 -> Step 3 validation
  const handleGoToStep3 = () => {
    setError('');
    if (payerMode === 'SINGLE') {
      if (!singlePayerId) {
        setError('Please select who paid for this bill');
        return;
      }
    } else {
      if (Math.abs(payersDiffPaisa) > 2) {
        const diffRupees = (Math.abs(payersDiffPaisa) / 100).toFixed(2);
        if (payersDiffPaisa > 0) {
          setError(`₹${diffRupees} remaining to match the total bill of ₹${(totalAmountPaisa / 100).toFixed(2)}`);
        } else {
          setError(`Payer amounts exceed bill total by ₹${diffRupees}`);
        }
        return;
      }
    }
    setStep(3);
  };

  if (!isOpen) return null;

  // Final Submit
  const handleSubmit = async () => {
    setError('');

    const trimmedDesc = description.trim();
    if (!trimmedDesc || totalAmountPaisa <= 0) {
      setStep(1);
      return;
    }

    // Build Payers list
    let finalPayers: { memberId: string; amountPaisa: number }[] = [];
    if (payerMode === 'SINGLE') {
      finalPayers = [{ memberId: singlePayerId, amountPaisa: totalAmountPaisa }];
    } else {
      finalPayers = members
        .map((m) => ({
          memberId: m.id,
          amountPaisa: Math.round(Number(multiplePayers[m.id] || 0) * 100),
        }))
        .filter((p) => p.amountPaisa > 0);

      const pSum = finalPayers.reduce((s, p) => s + p.amountPaisa, 0);
      if (Math.abs(totalAmountPaisa - pSum) > 2) {
        setStep(2);
        setError('Payer amounts must match the total bill amount');
        return;
      }
    }

    // Build Splits list
    let finalSplits: { memberId: string; amountPaisa: number }[] = [];
    let finalSplitType = 'EQUAL';

    if (splitMode === 'EQUAL') {
      if (selectedSplitMemberIds.length === 0) {
        setError('Please select at least one person to split with');
        return;
      }
      finalSplits = distributeEqualSplits(totalAmountPaisa, selectedSplitMemberIds);
      finalSplitType = 'EQUAL';
    } else {
      if (Math.abs(splitsDiffPaisa) > 2) {
        const diffRupees = (Math.abs(splitsDiffPaisa) / 100).toFixed(2);
        if (splitsDiffPaisa > 0) {
          setError(`₹${diffRupees} remaining to match bill total`);
        } else {
          setError(`Split amounts exceed total by ₹${diffRupees}`);
        }
        return;
      }

      finalSplits = members
        .map((m) => ({
          memberId: m.id,
          amountPaisa: Math.round(Number(customSplitAmounts[m.id] || 0) * 100),
        }))
        .filter((s) => s.amountPaisa > 0);

      if (finalSplits.length === 0) {
        setError('Please enter split amounts for at least one person');
        return;
      }
      finalSplitType = 'EXACT';
    }

    // Parse date (ensures no timezone offset)
    const [y, m, d] = expenseDate.split('-').map(Number);
    const selectedDateObj = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();

    // ⚡ Optimistic expense
    const tempId = isEditing
      ? initialExpense.id
      : `temp_exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticExpense = {
      ...(initialExpense || {}),
      id: tempId,
      description: trimmedDesc,
      totalAmountPaisa,
      category,
      splitType: finalSplitType,
      date: selectedDateObj.toISOString(),
      notes: notes.trim() || null,
      payers: finalPayers.map((p) => {
        const mem = members.find((m) => m.id === p.memberId) || { id: p.memberId, name: 'Member' };
        return {
          id: `temp_p_${p.memberId}`,
          memberId: p.memberId,
          amountPaisa: p.amountPaisa,
          member: { id: mem.id, name: mem.name },
        };
      }),
      splits: finalSplits.map((s, idx) => {
        const mem = members.find((m) => m.id === s.memberId) || { id: s.memberId, name: 'Member' };
        return {
          id: `temp_s_${s.memberId}_${idx}`,
          memberId: s.memberId,
          amountPaisa: s.amountPaisa,
          member: { id: mem.id, name: mem.name },
        };
      }),
    };

    onExpenseAdded(optimisticExpense, isEditing ? initialExpense.id : tempId);
    onClose();

    // Background server save
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
          payers: finalPayers,
          splits: finalSplits,
          memberId: defaultPayerId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.expense) {
        onExpenseAdded(data.expense, isEditing ? initialExpense.id : tempId);
      } else {
        // Rollback on server rejection
        if (!isEditing) {
          onExpenseAdded(null, tempId);
        }
      }
    } catch (err: any) {
      console.error('Error saving expense:', err);
      if (!isEditing) {
        onExpenseAdded(null, tempId);
      }
    } finally {
      setLoading(false);
    }
  };

  const isStep1Ready = description.trim().length > 0 && Number(amountRupees) > 0;
  const isStep2Ready = payerMode === 'SINGLE' ? Boolean(singlePayerId) : Math.abs(payersDiffPaisa) <= 2;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-slate-900/40 backdrop-blur-xs sm:py-6 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-white h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom duration-250 ease-out border border-slate-200">
        {/* ================= STEP 1: BILL DETAILS ================= */}
        {step === 1 && (
          <div className="flex flex-col h-full overflow-hidden">
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
                  {isEditing ? 'Edit Details' : 'What did you spend money on?'}
                </h2>
                <span className="text-[11px] text-slate-400 font-semibold">Step 1 of 3: Details</span>
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

            <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-2 flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-bold">Group:</span>
              <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                {groupName}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Icon + Description Input */}
              <div className="flex items-center gap-3 pt-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-2xs cursor-pointer hover:scale-105 ${activeCategory.color}`}
                    title="Change Category"
                  >
                    <CategoryIcon className="w-6 h-6" />
                  </button>

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

                <div className="flex-1 border-b border-slate-200 focus-within:border-emerald-600 transition-colors pb-1">
                  <input
                    type="text"
                    placeholder="Enter a description (e.g. Dinner, Taxi)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoFocus
                    className="w-full text-base sm:text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:outline-hidden bg-transparent"
                  />
                </div>
              </div>

              {/* Amount Input */}
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

              {/* Date Row (cannot be future date) */}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Date</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWheelDatePicker(true)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  {formattedDateLabel}
                </button>
              </div>

              {/* Optional Notes */}
              <div>
                <input
                  type="text"
                  placeholder="Add a note (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs font-medium text-slate-700 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Bottom Button */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleGoToStep2}
                disabled={!isStep1Ready}
                className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Next: Who paid</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: WHO PAID FOR THIS BILL? ================= */}
        {step === 2 && (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <button
                onClick={() => setStep(1)}
                type="button"
                className="p-1 -ml-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-0.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="text-center">
                <h2 className="text-base font-bold text-slate-900">Who paid for this bill?</h2>
                <span className="text-[11px] text-slate-400 font-semibold">Step 2 of 3: Payer</span>
              </div>

              <button
                onClick={handleGoToStep3}
                type="button"
                disabled={!isStep2Ready}
                className={`text-sm font-bold transition-colors cursor-pointer ${
                  isStep2Ready ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </header>

            {/* Bill Summary Strip */}
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-2.5 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-500 truncate">{description}</span>
              <span className="text-sm font-black text-slate-900">₹{(totalAmountPaisa / 100).toFixed(2)}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Mode Toggle: One Person vs Multiple People */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPayerMode('SINGLE')}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    payerMode === 'SINGLE'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>One person</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToMultiplePayers}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    payerMode === 'MULTIPLE'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Multiple people</span>
                </button>
              </div>

              {/* MODE A: Single Payer */}
              {payerMode === 'SINGLE' && (
                <div className="space-y-2">
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {members.map((m) => {
                      const isSelected = singlePayerId === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setSinglePayerId(m.id)}
                          className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                                m.name
                              )}`}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-sm text-slate-900">{m.name}</span>
                          </div>

                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-slate-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE B: Multiple Payers with Custom Amounts */}
              {payerMode === 'MULTIPLE' && (
                <div className="space-y-3">
                  {/* Status Indicator */}
                  <div
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                      Math.abs(payersDiffPaisa) <= 2
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : payersDiffPaisa > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span>
                      Paid: ₹{(multiplePayersSumPaisa / 100).toFixed(2)} of ₹{(totalAmountPaisa / 100).toFixed(2)}
                    </span>
                    <span>
                      {Math.abs(payersDiffPaisa) <= 2
                        ? '✓ All matched'
                        : payersDiffPaisa > 0
                        ? `₹${(payersDiffPaisa / 100).toFixed(2)} left`
                        : `Over by ₹${(Math.abs(payersDiffPaisa) / 100).toFixed(2)}`}
                    </span>
                  </div>

                  {/* List of members with custom payment inputs */}
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {members.map((m) => {
                      const val = multiplePayers[m.id] || '';
                      return (
                        <div key={m.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                                m.name
                              )}`}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {m.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAutoFillPayerRemainder(m.id)}
                              className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                              title="Fill remaining bill amount"
                            >
                              Remainder
                            </button>

                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={val}
                                onChange={(e) =>
                                  setMultiplePayers({
                                    ...multiplePayers,
                                    [m.id]: e.target.value,
                                  })
                                }
                                className="w-full pl-6 pr-2 py-1.5 text-right font-bold text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-600 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Button */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleGoToStep3}
                disabled={!isStep2Ready}
                className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Next: How to split</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: HOW SHOULD THIS BE SPLIT? ================= */}
        {step === 3 && (
          <div className="flex flex-col h-full overflow-hidden">
            <header className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <button
                onClick={() => setStep(2)}
                type="button"
                className="p-1 -ml-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-0.5 text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="text-center">
                <h2 className="text-base font-bold text-slate-900">How should this be split?</h2>
                <span className="text-[11px] text-slate-400 font-semibold">Step 3 of 3: Split</span>
              </div>

              <button
                onClick={handleSubmit}
                type="button"
                disabled={loading}
                className="text-sm font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Save
              </button>
            </header>

            {/* Bill Summary Strip */}
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-2.5 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-500 truncate">{description}</span>
              <span className="text-sm font-black text-slate-900">₹{(totalAmountPaisa / 100).toFixed(2)}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Mode Toggle: "Equal" vs "Custom amounts" */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSplitMode('EQUAL')}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    splitMode === 'EQUAL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Equal</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToCustomSplits}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    splitMode === 'CUSTOM'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Custom amounts</span>
                </button>
              </div>

              {/* MODE A: Equal Split */}
              {splitMode === 'EQUAL' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                    <span>
                      {selectedSplitMemberIds.length > 0
                        ? `₹${((totalAmountPaisa / selectedSplitMemberIds.length) / 100).toFixed(2)} per person`
                        : 'No one selected'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSplitMemberIds.length === members.length) {
                          setSelectedSplitMemberIds([members[0]?.id || '']);
                        } else {
                          setSelectedSplitMemberIds(members.map((m) => m.id));
                        }
                      }}
                      className="text-[11px] underline cursor-pointer text-emerald-900"
                    >
                      {selectedSplitMemberIds.length === members.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {members.map((m) => {
                      const isIncluded = selectedSplitMemberIds.includes(m.id);
                      const shareObj = computedEqualSplits.find((s) => s.memberId === m.id);
                      const shareRupees = shareObj ? (shareObj.amountPaisa / 100).toFixed(2) : '0.00';

                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleSplitMember(m.id)}
                          className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isIncluded ? 'bg-emerald-50/30' : 'hover:bg-slate-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                                m.name
                              )}`}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-slate-900 block">{m.name}</span>
                              <span className="text-xs font-medium text-slate-500">
                                {isIncluded ? `Share: ₹${shareRupees}` : 'Not included'}
                              </span>
                            </div>
                          </div>

                          {isIncluded ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-slate-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE B: Custom Split Amounts */}
              {splitMode === 'CUSTOM' && (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                      Math.abs(splitsDiffPaisa) <= 2
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : splitsDiffPaisa > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span>
                      Split: ₹{(customSplitsSumPaisa / 100).toFixed(2)} of ₹{(totalAmountPaisa / 100).toFixed(2)}
                    </span>
                    <span>
                      {Math.abs(splitsDiffPaisa) <= 2
                        ? '✓ All matched'
                        : splitsDiffPaisa > 0
                        ? `₹${(splitsDiffPaisa / 100).toFixed(2)} left`
                        : `Over by ₹${(Math.abs(splitsDiffPaisa) / 100).toFixed(2)}`}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {members.map((m) => {
                      const val = customSplitAmounts[m.id] || '';
                      return (
                        <div key={m.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                                m.name
                              )}`}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {m.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAutoFillSplitRemainder(m.id)}
                              className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                              title="Fill remaining split amount"
                            >
                              Remainder
                            </button>

                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={val}
                                onChange={(e) =>
                                  setCustomSplitAmounts({
                                    ...customSplitAmounts,
                                    [m.id]: e.target.value,
                                  })
                                }
                                className="w-full pl-6 pr-2 py-1.5 text-right font-bold text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-emerald-600 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Button */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Saving...' : isEditing ? 'Update expense' : 'Save expense'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wheel Date Picker Modal (future date blocked) */}
      <WheelDatePickerModal
        isOpen={showWheelDatePicker}
        onClose={() => setShowWheelDatePicker(false)}
        initialDate={expenseDate}
        disableFuture={true}
        onConfirm={(dStr) => {
          setExpenseDate(dStr);
          setShowWheelDatePicker(false);
        }}
      />
    </div>
  );
}
