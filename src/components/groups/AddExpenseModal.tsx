'use client';

import React, { useState, useMemo } from 'react';
import { X, Check, Plus, Receipt, IndianRupee, Users } from 'lucide-react';
import { distributeEqualSplits, distributeSharesSplits } from '@/lib/splitwise';

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
  onExpenseAdded: () => void;
  defaultPayerId?: string;
}

const EXPENSE_CATEGORIES = [
  { label: 'Food 🍕', value: 'FOOD' },
  { label: 'Travel 🚖', value: 'TRAVEL' },
  { label: 'Stay 🏨', value: 'STAY' },
  { label: 'Shopping 🛍️', value: 'SHOPPING' },
  { label: 'Other ⚡', value: 'GENERAL' },
];

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
  const [category, setCategory] = useState('FOOD');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Payer state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState<string>(
    defaultPayerId || members.find((m) => m.isOwner)?.id || members[0]?.id || ''
  );
  const [customPayerAmounts, setCustomPayerAmounts] = useState<Record<string, string>>({});

  // Split state
  const [splitType, setSplitType] = useState<'EQUAL' | 'EXACT' | 'SHARES'>('EQUAL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    members.map((m) => m.id)
  );
  const [customExactAmounts, setCustomExactAmounts] = useState<Record<string, string>>({});
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const totalAmountPaisa = Math.round(Number(amountRupees || 0) * 100);

  // Compute calculated splits
  const computedSplits = useMemo(() => {
    if (totalAmountPaisa <= 0 || selectedMemberIds.length === 0) return [];

    if (splitType === 'EQUAL') {
      return distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
    }

    if (splitType === 'SHARES') {
      const shareItems = selectedMemberIds.map((id) => ({
        memberId: id,
        shareValue: Math.max(1, Number(customShares[id] || 1)),
      }));
      return distributeSharesSplits(totalAmountPaisa, shareItems);
    }

    if (splitType === 'EXACT') {
      return selectedMemberIds.map((id) => ({
        memberId: id,
        amountPaisa: Math.round(Number(customExactAmounts[id] || 0) * 100),
      }));
    }

    return [];
  }, [totalAmountPaisa, selectedMemberIds, splitType, customShares, customExactAmounts]);

  // Compute calculated payers
  const computedPayers = useMemo(() => {
    if (!isMultiPayer) {
      return [{ memberId: singlePayerId, amountPaisa: totalAmountPaisa }];
    }
    return members
      .map((m) => ({
        memberId: m.id,
        amountPaisa: Math.round(Number(customPayerAmounts[m.id] || 0) * 100),
      }))
      .filter((p) => p.amountPaisa > 0);
  }, [isMultiPayer, singlePayerId, totalAmountPaisa, members, customPayerAmounts]);

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length === 1) return; // keep at least 1
      setSelectedMemberIds(selectedMemberIds.filter((mId) => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSelectAll = () => {
    setSelectedMemberIds(members.map((m) => m.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (totalAmountPaisa <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    // Validate payers sum
    const payersSum = computedPayers.reduce((acc, p) => acc + p.amountPaisa, 0);
    if (payersSum !== totalAmountPaisa) {
      setError(`Payers total (₹${(payersSum / 100).toFixed(2)}) must equal bill total (₹${(totalAmountPaisa / 100).toFixed(2)})`);
      return;
    }

    // Validate splits sum
    const splitsSum = computedSplits.reduce((acc, s) => acc + s.amountPaisa, 0);
    if (splitsSum !== totalAmountPaisa) {
      setError(`Split amounts (₹${(splitsSum / 100).toFixed(2)}) must equal bill total (₹${(totalAmountPaisa / 100).toFixed(2)})`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          totalAmountPaisa,
          category,
          splitType,
          notes: notes.trim() || undefined,
          payers: computedPayers,
          splits: computedSplits,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add expense');
      }

      onExpenseAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">Add Group Expense</h3>
              <p className="text-[11px] text-slate-500">Split bill with friends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {/* Amount & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-extrabold text-slate-900 text-lg bg-slate-50/50"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner, Cab, Beach Shack"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm font-semibold text-slate-900 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    category === cat.value
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paid By */}
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Paid By
              </span>
              <button
                type="button"
                onClick={() => setIsMultiPayer(!isMultiPayer)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                {isMultiPayer ? '← Single Payer' : 'Multiple Payers?'}
              </button>
            </div>

            {!isMultiPayer ? (
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSinglePayerId(m.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      singlePayerId === m.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {singlePayerId === m.id && <Check className="w-3.5 h-3.5" />}
                    {m.name} {m.isOwner ? '(You)' : ''}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {m.name} {m.isOwner ? '(You)' : ''}
                    </span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={customPayerAmounts[m.id] || ''}
                        onChange={(e) =>
                          setCustomPayerAmounts({ ...customPayerAmounts, [m.id]: e.target.value })
                        }
                        className="w-full pl-6 pr-2 py-1 text-xs font-bold border border-slate-200 rounded-xl bg-white text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Mode */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Split Type
              </span>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
                {(['EQUAL', 'EXACT', 'SHARES'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      splitType === type
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {type === 'EQUAL' ? 'Equal' : type === 'EXACT' ? 'Exact ₹' : 'Shares'}
                  </button>
                ))}
              </div>
            </div>

            {/* Member Checklist */}
            <div className="space-y-1.5 border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 mb-2">
                <span className="text-[11px] font-bold text-slate-400">
                  Included Members ({selectedMemberIds.length}/{members.length})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                >
                  Select All
                </button>
              </div>

              {members.map((m) => {
                const isChecked = selectedMemberIds.includes(m.id);
                const splitItem = computedSplits.find((s) => s.memberId === m.id);

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-1 px-1 rounded-xl hover:bg-slate-100/60"
                  >
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMemberSelection(m.id)}
                        className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 border-slate-300"
                      />
                      <span>{m.name}</span>
                    </label>

                    {/* Split Details Input or Preview */}
                    {isChecked && (
                      <div className="flex items-center gap-2">
                        {splitType === 'EXACT' && (
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                              ₹
                            </span>
                            <input
                              type="number"
                              placeholder="0"
                              value={customExactAmounts[m.id] || ''}
                              onChange={(e) =>
                                setCustomExactAmounts({
                                  ...customExactAmounts,
                                  [m.id]: e.target.value,
                                })
                              }
                              className="w-full pl-5 pr-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white text-right"
                            />
                          </div>
                        )}

                        {splitType === 'SHARES' && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              placeholder="1"
                              value={customShares[m.id] || '1'}
                              onChange={(e) =>
                                setCustomShares({
                                  ...customShares,
                                  [m.id]: e.target.value,
                                })
                              }
                              className="w-14 px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white text-center"
                            />
                            <span className="text-[10px] text-slate-400">shares</span>
                          </div>
                        )}

                        {splitItem && splitType !== 'EXACT' && (
                          <span className="text-xs font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-2xs">
                            ₹{(splitItem.amountPaisa / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid cash at counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || totalAmountPaisa <= 0}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Recording...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
