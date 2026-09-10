'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Receipt } from 'lucide-react';
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
  onExpenseAdded: () => void;
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
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Synchronize state whenever modal opens or members change
  useEffect(() => {
    if (isOpen && members && members.length > 0) {
      setDescription('');
      setAmountRupees('');
      setError('');
      setLoading(false);

      // Default payer: owner or first member or defaultPayerId
      const targetPayer =
        (defaultPayerId && members.some((m) => m.id === defaultPayerId) && defaultPayerId) ||
        members.find((m) => m.isOwner)?.id ||
        members[0]?.id ||
        '';
      setPayerId(targetPayer);

      // Default split: all members
      setSelectedMemberIds(members.map((m) => m.id));
    }
  }, [isOpen, members, defaultPayerId]);

  const totalAmountPaisa = Math.round(Number(amountRupees || 0) * 100);

  // Distribute equally with zero drift
  const computedSplits = useMemo(() => {
    if (totalAmountPaisa <= 0 || selectedMemberIds.length === 0) return [];
    return distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
  }, [totalAmountPaisa, selectedMemberIds]);

  if (!isOpen) return null;

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
    setError('');

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError('Please enter a description (e.g. Dinner)');
      return;
    }

    if (totalAmountPaisa <= 0 || isNaN(totalAmountPaisa)) {
      setError('Please enter a valid amount');
      return;
    }

    if (!payerId) {
      setError('Please select who paid the bill');
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError('Please select at least one member to split with');
      return;
    }

    const splitsToSend = distributeEqualSplits(totalAmountPaisa, selectedMemberIds);
    if (!splitsToSend.length) {
      setError('Could not calculate splits');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmedDesc,
          totalAmountPaisa,
          category: 'General',
          splitType: 'EQUAL',
          payers: [{ memberId: payerId, amountPaisa: totalAmountPaisa }],
          splits: splitsToSend,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Amount (₹) *
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
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-black text-slate-900 text-lg bg-slate-50/50"
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

          {/* Split Among */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Split Equally ({selectedMemberIds.length}/{members.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                All
              </button>
            </div>

            <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {members.map((m) => {
                const isChecked = selectedMemberIds.includes(m.id);
                const splitItem = computedSplits.find((s) => s.memberId === m.id);

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
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || totalAmountPaisa <= 0}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all text-xs flex items-center justify-center cursor-pointer"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
