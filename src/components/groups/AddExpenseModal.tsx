'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Receipt, ArrowDownRight, Scale, Sparkles } from 'lucide-react';
import { distributeEqualSplits } from '@/lib/splitwise';

interface Member {
  id: string;
  name: string;
  isOwner?: boolean;
}

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: Member[];
  onExpenseAdded: (newExpense?: any) => void;
  defaultPayerId?: string;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  groupId,
  members,
  onExpenseAdded,
  defaultPayerId,
}: AddExpenseModalProps) {
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payerId, setPayerId] = useState<string>('');

  // Mode: 'EQUAL' or 'CUSTOM'
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');

  // Selected members for equal split
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Custom amounts per member in Rupees (string)
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Synchronize state whenever modal opens or members change
  useEffect(() => {
    if (isOpen && members && members.length > 0) {
      setDescription('');
      setAmountRupees('');
      setError('');
      setLoading(false);
      setSplitMode('EQUAL');

      // Default payer
      const targetPayer =
        (defaultPayerId && members.some((m) => m.id === defaultPayerId) && defaultPayerId) ||
        members.find((m) => m.isOwner)?.id ||
        members[0]?.id ||
        '';
      setPayerId(targetPayer);

      // Default selected members
      const allIds = members.map((m) => m.id);
      setSelectedMemberIds(allIds);

      // Reset custom amounts
      setCustomAmounts({});
    }
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

  // When switching to CUSTOM mode, auto-prefill with equal shares if custom amounts are empty
  const handleSwitchToCustom = () => {
    setSplitMode('CUSTOM');
    // If custom amounts are currently empty and we have a total amount, prefill with equal shares
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

  // 1-tap helper to auto-fill remainder for a member in Custom mode
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

  // 1-tap helper to split remaining amount equally among remaining members
  const handleSplitRemainingEqually = () => {
    if (diffPaisa <= 0) return;
    // Find members who have 0 or empty amount
    let targetMembers = members.filter(
      (m) => !customAmounts[m.id] || Number(customAmounts[m.id]) === 0
    );
    if (targetMembers.length === 0) {
      targetMembers = members;
    }
    const splits = distributeEqualSplits(
      diffPaisa,
      targetMembers.map((m) => m.id)
    );
    const updated = { ...customAmounts };
    splits.forEach((s) => {
      const existing = Math.round(Number(updated[s.memberId] || 0) * 100);
      updated[s.memberId] = ((existing + s.amountPaisa) / 100).toFixed(2);
    });
    setCustomAmounts(updated);
  };

  // 1-tap helper to set Total Amount from custom sum
  const handleSyncTotalFromCustom = () => {
    if (customSumPaisa > 0) {
      setAmountRupees((customSumPaisa / 100).toFixed(2));
    }
  };

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length === 1) return; // Keep at least 1
      setSelectedMemberIds(selectedMemberIds.filter((mId) => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSelectAll = () => {
    setSelectedMemberIds(members.map((m) => m.id));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError('Please select at least one member to split with');
        return;
      }
      finalSplits = distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
      finalSplitType = 'EQUAL';
    } else {
      // CUSTOM SPLIT
      if (customSumPaisa !== totalAmountPaisa) {
        const diffRupees = Math.abs(diffPaisa) / 100;
        if (diffPaisa > 0) {
          setError(
            `₹${diffRupees.toFixed(2)} remaining unallocated to match total ₹${(
              totalAmountPaisa / 100
            ).toFixed(2)}`
          );
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
        setError('Please enter custom amounts for at least one member');
        return;
      }
      finalSplitType = 'EXACT';
    }

    // ⚡ INSTANT OPTIMISTIC SUBMIT:
    // Synthesize optimistic expense object so UI updates in 0ms without waiting for network!
    const payerMember = members.find((m) => m.id === payerId) || { id: payerId, name: 'You' };
    const optimisticExpense = {
      id: `temp_exp_${Date.now()}`,
      description: trimmedDesc,
      totalAmountPaisa,
      category: 'General',
      splitType: finalSplitType,
      date: new Date().toISOString(),
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

    // 1. Immediately notify parent with optimistic expense
    onExpenseAdded(optimisticExpense);

    // 2. Immediately close modal (0ms UI latency)
    onClose();

    // 3. Persist to server in background
    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmedDesc,
          totalAmountPaisa,
          category: 'General',
          splitType: finalSplitType,
          payers: [{ memberId: payerId, amountPaisa: totalAmountPaisa }],
          splits: finalSplits,
        }),
      });

      const data = await res.json();
      if (res.ok && data.expense) {
        // Re-notify with confirmed server expense
        onExpenseAdded(data.expense);
      } else {
        console.error('Failed to persist expense:', data.error);
      }
    } catch (err: any) {
      console.error('Error saving expense:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">Add Expense</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl animate-in fade-in">
              {error}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Total Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-black text-slate-900 text-xl bg-slate-50/50"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dinner, Cab, Groceries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-semibold text-slate-900 bg-slate-50/50"
            />
          </div>

          {/* Paid By */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Paid By
            </label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPayerId(m.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    payerId === m.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {payerId === m.id && <Check className="w-3 h-3" />}
                  {m.name} {m.isOwner ? '(You)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Split Mode: Equal vs Custom ₹ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Split Options
              </span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => setSplitMode('EQUAL')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    splitMode === 'EQUAL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Equally
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToCustom}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    splitMode === 'CUSTOM'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Custom (₹)
                </button>
              </div>
            </div>

            {/* EQUAL SPLIT VIEW */}
            {splitMode === 'EQUAL' ? (
              <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200/60 text-[10px] text-slate-400 font-bold">
                  <span>Selected ({selectedMemberIds.length}/{members.length})</span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-indigo-600 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                </div>

                {members.map((m) => {
                  const isChecked = selectedMemberIds.includes(m.id);
                  const splitItem = computedEqualSplits.find((s) => s.memberId === m.id);

                  return (
                    <label
                      key={m.id}
                      className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberSelection(m.id)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                        />
                        <span>{m.name}</span>
                      </div>

                      {isChecked && splitItem && (
                        <span className="text-xs font-bold text-slate-800">
                          ₹{(splitItem.amountPaisa / 100).toFixed(2)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              /* CUSTOM SPLIT VIEW (Customize amount between members) */
              <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-200/60">
                  <span>Member Share</span>
                  <span>Amount (₹)</span>
                </div>

                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {m.name}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={customAmounts[m.id] ?? ''}
                          onChange={(e) =>
                            setCustomAmounts({ ...customAmounts, [m.id]: e.target.value })
                          }
                          className="w-full pl-6 pr-2 py-1 text-xs font-bold text-right border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      {diffPaisa > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillRemainder(m.id)}
                          className="p-1.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
                          title="Assign remaining balance to this person"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Custom Split Helpers & Status */}
                <div className="pt-2 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-500">
                      Allocated: ₹{(customSumPaisa / 100).toFixed(2)} / ₹{(totalAmountPaisa / 100).toFixed(2)}
                    </span>
                    <span
                      className={`font-bold ${
                        diffPaisa === 0 && totalAmountPaisa > 0
                          ? 'text-emerald-600'
                          : diffPaisa > 0
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {diffPaisa === 0 && totalAmountPaisa > 0
                        ? '✓ Exact match'
                        : diffPaisa > 0
                        ? `₹${(diffPaisa / 100).toFixed(2)} left`
                        : `Exceeds by ₹${(Math.abs(diffPaisa) / 100).toFixed(2)}`}
                    </span>
                  </div>

                  {/* 1-tap quick action helpers */}
                  {diffPaisa > 0 && totalAmountPaisa > 0 && (
                    <button
                      type="button"
                      onClick={handleSplitRemainingEqually}
                      className="w-full py-1 px-2 rounded-lg bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Scale className="w-3 h-3" />
                      <span>Split remaining ₹{(diffPaisa / 100).toFixed(2)} equally</span>
                    </button>
                  )}

                  {totalAmountPaisa === 0 && customSumPaisa > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncTotalFromCustom}
                      className="w-full py-1 px-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span>Set Total to ₹{(customSumPaisa / 100).toFixed(2)}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || totalAmountPaisa <= 0}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all text-xs flex items-center justify-center cursor-pointer"
            >
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
