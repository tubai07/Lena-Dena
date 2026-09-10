'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Check,
  Calendar,
  Sparkles,
  Users,
  ChevronDown,
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
}: AddExpenseScreenProps) {
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payerId, setPayerId] = useState<string>('');
  const [category, setCategory] = useState('General');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Date selection (default today YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  // Split configurations
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showSplitDrawer, setShowSplitDrawer] = useState(false);

  // CRITICAL BUG FIX: Track previous isOpen state so background auto-polling
  // changing the `members` prop NEVER resets user input while they type!
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    // Only initialize form fields when transition from closed (false) to open (true)
    if (isOpen && !prevIsOpenRef.current) {
      setDescription('');
      setAmountRupees('');
      setError('');
      setLoading(false);
      setSplitMode('EQUAL');
      setCategory('General');
      setShowCategoryPicker(false);
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setShowDatePicker(false);
      setNotes('');
      setShowNotes(false);
      setShowSplitDrawer(false);

      // Default payer: prioritized by defaultPayerId, owner, or first member
      const targetPayer =
        (defaultPayerId && members.some((m) => m.id === defaultPayerId) && defaultPayerId) ||
        members.find((m) => m.isOwner)?.id ||
        members[0]?.id ||
        '';
      setPayerId(targetPayer);

      // Default all members selected
      setSelectedMemberIds(members.map((m) => m.id));
      setCustomAmounts({});
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, members, defaultPayerId]);

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
    const nowStr = new Date().toISOString().split('T')[0];
    if (expenseDate === nowStr) return 'Today';

    const d = new Date(expenseDate);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }, [expenseDate]);

  // Payer display name
  const payerName = useMemo(() => {
    const p = members.find((m) => m.id === payerId);
    return p ? p.name : 'You';
  }, [members, payerId]);

  // Split summary text
  const splitSummaryText = useMemo(() => {
    if (splitMode === 'EQUAL') {
      if (selectedMemberIds.length === members.length) {
        return 'split equally';
      }
      return `split equally (${selectedMemberIds.length}/${members.length})`;
    }
    return 'custom split';
  }, [splitMode, selectedMemberIds, members.length]);

  const perPersonText = useMemo(() => {
    if (splitMode === 'EQUAL' && selectedMemberIds.length > 0 && totalAmountPaisa > 0) {
      const share = totalAmountPaisa / selectedMemberIds.length / 100;
      return `(₹${share.toFixed(2)}/person)`;
    }
    if (splitMode === 'CUSTOM') {
      return `(${Object.values(customAmounts).filter((v) => Number(v) > 0).length} customized)`;
    }
    return '';
  }, [splitMode, selectedMemberIds.length, totalAmountPaisa, customAmounts]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError('Please enter a description');
      return;
    }

    if (totalAmountPaisa <= 0 || isNaN(totalAmountPaisa)) {
      setError('Please enter a valid bill amount');
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
      // Custom split validation with 2-paisa tolerance
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

    // Parse date
    const selectedDateObj = expenseDate ? new Date(`${expenseDate}T12:00:00Z`) : new Date();

    // ⚡ INSTANT OPTIMISTIC SUBMIT
    const payerMember = members.find((m) => m.id === payerId) || { id: payerId, name: 'You' };
    const optimisticExpense = {
      id: `temp_exp_${Date.now()}`,
      description: trimmedDesc,
      totalAmountPaisa,
      category,
      splitType: finalSplitType,
      date: selectedDateObj.toISOString(),
      notes: notes.trim() || null,
      payers: [
        {
          id: `temp_p_${Date.now()}`,
          memberId: payerId,
          amountPaisa: totalAmountPaisa,
          member: { id: payerMember.id, name: payerMember.name },
        },
      ],
      splits: finalSplits.map((s, idx) => {
        const mem = members.find((m) => m.id === s.memberId) || { id: s.memberId, name: 'Member' };
        return {
          id: `temp_s_${Date.now()}_${idx}`,
          memberId: s.memberId,
          amountPaisa: s.amountPaisa,
          member: { id: mem.id, name: mem.name },
        };
      }),
    };

    onExpenseAdded(optimisticExpense);
    onClose();

    // Background server save
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
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
    }
  };

  const isSaveReady = description.trim().length > 0 && Number(amountRupees) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-250 ease-out overflow-hidden select-none">
      {/* Top Splitwise-style Navigation Bar */}
      <header className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-xs">
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          className="p-1 -ml-1 rounded-full hover:bg-emerald-700/60 active:scale-95 transition-all cursor-pointer text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h1 className="text-base font-extrabold tracking-tight">Add an expense</h1>

        <button
          onClick={() => handleSubmit()}
          type="button"
          disabled={!isSaveReady || loading}
          className={`text-sm font-black px-3 py-1 rounded-lg transition-all cursor-pointer ${
            isSaveReady
              ? 'text-white bg-emerald-700/80 hover:bg-emerald-800 active:scale-95'
              : 'text-emerald-200/50 cursor-not-allowed'
          }`}
        >
          Save
        </button>
      </header>

      {/* Sub-Header: Group Identifier */}
      <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-slate-500">With you and:</span>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full shadow-2xs">
          <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">
            {groupName.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
            {groupName}
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 max-w-md mx-auto w-full">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Rows */}
        <div className="space-y-4 pt-2">
          {/* Row 1: Category Icon + Description */}
          <div className="flex items-center gap-3">
            {/* Category Icon Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-2xs cursor-pointer hover:scale-105 active:scale-95 ${activeCategory.color}`}
                title="Change Category"
              >
                <CategoryIcon className="w-6 h-6" />
              </button>

              {/* Category Picker Popover */}
              {showCategoryPicker && (
                <div className="absolute left-0 top-14 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-20 grid grid-cols-3 gap-1.5 w-60 animate-in fade-in zoom-in-95">
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
                        <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">
                          {c.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description Input */}
            <div className="flex-1 border-b-2 border-slate-200 focus-within:border-emerald-600 transition-colors pb-1">
              <input
                type="text"
                placeholder="Enter a description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
                className="w-full text-lg font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus:outline-hidden bg-transparent"
              />
            </div>
          </div>

          {/* Row 2: Currency Symbol + Amount */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 font-black text-xl flex items-center justify-center border border-slate-200/80">
              ₹
            </div>

            <div className="flex-1 border-b-2 border-slate-200 focus-within:border-emerald-600 transition-colors pb-1">
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
        </div>

        {/* Splitwise-style Interactive Payer & Split Bar */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowSplitDrawer(!showSplitDrawer)}
            className="w-full py-3.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-2xl transition-all flex items-center justify-between shadow-2xs group cursor-pointer"
          >
            <div className="text-left space-y-0.5">
              <div className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 flex-wrap">
                <span>Paid by</span>
                <span className="text-emerald-700 underline underline-offset-2 decoration-emerald-400">
                  {payerName}
                </span>
                <span>and</span>
                <span className="text-emerald-700 underline underline-offset-2 decoration-emerald-400">
                  {splitSummaryText}
                </span>
              </div>
              {perPersonText && (
                <div className="text-xs font-semibold text-slate-500">
                  {perPersonText}
                </div>
              )}
            </div>

            <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-slate-700 transition-colors shrink-0 ml-2">
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  showSplitDrawer ? 'rotate-180 text-emerald-600' : ''
                }`}
              />
            </div>
          </button>
        </div>

        {/* Expandable Payer & Split Drawer */}
        {showSplitDrawer && (
          <div className="bg-slate-50/70 border border-slate-200 rounded-3xl p-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Section 1: Who Paid? */}
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                Who Paid?
              </span>
              <div className="flex gap-2 flex-wrap">
                {members.map((m) => {
                  const isSelected = payerId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayerId(m.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Split Options */}
            <div className="space-y-3 pt-1 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Split Mode
                </span>

                <div className="bg-white border border-slate-200 p-1 rounded-xl flex gap-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSplitMode('EQUAL')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      splitMode === 'EQUAL'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Equally
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchToCustom}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      splitMode === 'CUSTOM'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Custom (₹)
                  </button>
                </div>
              </div>

              {/* Mode A: Equal Split with Checkboxes */}
              {splitMode === 'EQUAL' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-500">
                    <span>Selected ({selectedMemberIds.length}/{members.length})</span>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-emerald-700 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {members.map((m) => {
                      const isSelected = selectedMemberIds.includes(m.id);
                      const equalSplit = computedEqualSplits.find((s) => s.memberId === m.id);
                      const shareRupees = equalSplit ? (equalSplit.amountPaisa / 100).toFixed(2) : '0.00';

                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleMemberSelection(m.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-50/40 border-emerald-200 text-slate-900'
                              : 'bg-slate-50/50 border-slate-100 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer pointer-events-none"
                            />
                            <span className="text-xs font-bold">{m.name}</span>
                          </div>

                          {isSelected && totalAmountPaisa > 0 && (
                            <span className="text-xs font-extrabold text-emerald-800">
                              ₹{shareRupees}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mode B: Custom Amount Split */}
              {splitMode === 'CUSTOM' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold">
                    <span className="text-slate-500">
                      Allocated: ₹{(customSumPaisa / 100).toFixed(2)} / ₹{(totalAmountPaisa / 100).toFixed(2)}
                    </span>
                    {diffPaisa !== 0 && (
                      <span className={diffPaisa > 0 ? 'text-amber-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                        {diffPaisa > 0 ? `₹${(diffPaisa / 100).toFixed(2)} left` : `₹${(Math.abs(diffPaisa) / 100).toFixed(2)} over`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {members.map((m) => {
                      const val = customAmounts[m.id] || '';
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 w-24 truncate">
                            {m.name}
                          </span>

                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
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
                              className="w-full pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAutoFillRemainder(m.id)}
                            className="p-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors shrink-0 cursor-pointer"
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
        )}

        {/* Optional Notes */}
        {showNotes ? (
          <div className="space-y-1.5 animate-in fade-in">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Notes or Bill #
            </label>
            <textarea
              rows={2}
              placeholder="Add optional details, invoice no..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>
        ) : null}
      </div>

      {/* Bottom Action Bar (Date Picker & Notes) */}
      <footer className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0 max-w-md mx-auto w-full">
        {/* Date Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all text-xs font-extrabold shadow-2xs cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>{formattedDateLabel}</span>
          </button>

          {/* Date Picker Popover */}
          {showDatePicker && (
            <div className="absolute left-0 bottom-12 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-20 space-y-2 animate-in fade-in zoom-in-95 w-56">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setExpenseDate(new Date().toISOString().split('T')[0]);
                    setShowDatePicker(false);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    setExpenseDate(yesterday);
                    setShowDatePicker(false);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Yesterday
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  Custom Date:
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => {
                    setExpenseDate(e.target.value);
                    setShowDatePicker(false);
                  }}
                  className="w-full text-xs font-bold p-1.5 border border-slate-200 rounded-lg focus:outline-hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes Toggle Button */}
        {!showNotes && (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Add note</span>
          </button>
        )}
      </footer>
    </div>
  );
}
