'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ArrowRight, Smartphone } from 'lucide-react';
import { generateUpiUrl } from '@/lib/splitwise';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner?: boolean;
}

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: Member[];
  onSettled: (settlement?: any) => void;
  initialPayerId?: string;
  initialReceiverId?: string;
  initialAmountPaisa?: number;
}

export function SettleUpModal({
  isOpen,
  onClose,
  groupId,
  members,
  onSettled,
  initialPayerId,
  initialReceiverId,
  initialAmountPaisa,
}: SettleUpModalProps) {
  const [payerId, setPayerId] = useState<string>('');
  const [receiverId, setReceiverId] = useState<string>('');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Synchronize and prefill whenever modal opens or props change
  useEffect(() => {
    if (isOpen && members && members.length > 0) {
      setError('');
      setLoading(false);
      setNotes('');

      // Prefill Payer (Who owes / is paying)
      const pId =
        (initialPayerId && members.some((m) => m.id === initialPayerId) && initialPayerId) ||
        members[0]?.id ||
        '';
      setPayerId(pId);

      // Prefill Receiver (Who is owed / receives)
      const rId =
        (initialReceiverId && members.some((m) => m.id === initialReceiverId) && initialReceiverId) ||
        members.find((m) => m.id !== pId)?.id ||
        members[1]?.id ||
        '';
      setReceiverId(rId);

      // Prefill Amount
      if (initialAmountPaisa && initialAmountPaisa > 0) {
        setAmountRupees((initialAmountPaisa / 100).toFixed(2));
      } else {
        setAmountRupees('');
      }
    }
  }, [isOpen, initialPayerId, initialReceiverId, initialAmountPaisa, members]);

  if (!isOpen) return null;

  const receiver = members.find((m) => m.id === receiverId);
  const payer = members.find((m) => m.id === payerId);
  const numAmount = Number(amountRupees || 0);

  // UPI deep link if receiver has upiId or phone
  const upiLink =
    receiver?.upiId && numAmount > 0
      ? generateUpiUrl({
          upiId: receiver.upiId,
          name: receiver.name,
          amountRupees: numAmount,
          note: `Lena Dena Settlement to ${receiver.name}`,
        })
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerId || !receiverId || payerId === receiverId) {
      setError('Please select two different members');
      return;
    }
    const amountPaisa = Math.round(numAmount * 100);
    if (amountPaisa <= 0 || isNaN(amountPaisa)) {
      setError('Please enter a valid payment amount');
      return;
    }

    // ⚡ INSTANT OPTIMISTIC SUBMIT
    const optimisticSettlement = {
      id: `temp_st_${Date.now()}`,
      payerId,
      receiverId,
      amountPaisa,
      paymentMethod,
      notes: notes.trim() || undefined,
      date: new Date().toISOString(),
      payer: { id: payer?.id || payerId, name: payer?.name || 'Payer' },
      receiver: {
        id: receiver?.id || receiverId,
        name: receiver?.name || 'Receiver',
        upiId: receiver?.upiId,
        phone: receiver?.phone,
      },
    };

    onSettled(optimisticSettlement);
    onClose();

    // Persist to server in background
    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          receiverId,
          amountPaisa,
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.settlement) {
        onSettled(data.settlement);
      }
    } catch (err: any) {
      console.error('Error recording settlement:', err);
    }
  };

  const isPreloadedDebt = Boolean(initialPayerId && initialReceiverId && initialAmountPaisa);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header with larger text */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Settle Up</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preloaded Debt Highlight Banner with prominent text */}
        {isPreloadedDebt && payer && receiver && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-sm">
            <div className="text-emerald-950 font-bold">
              <span>{payer.name}</span>
              <span className="text-emerald-600 font-normal mx-1.5">pays</span>
              <span>{receiver.name}</span>
            </div>
            <span className="font-black text-emerald-800 text-base">
              ₹{(Number(initialAmountPaisa || 0) / 100).toFixed(2)}
            </span>
          </div>
        )}

        {/* Form Body with larger, clear inputs */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          {/* Payer and Receiver prefilled selector */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                Payer (Who Paid)
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 bg-slate-50/50 truncate"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isOwner ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-6 text-slate-300">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                Receiver (Got Money)
              </label>
              <select
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 bg-slate-50/50 truncate"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isOwner ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount (Prefilled from debt transfer) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Settlement Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-black text-slate-900 text-2xl bg-slate-50/50"
                autoFocus={!isPreloadedDebt}
              />
            </div>
          </div>

          {/* Payment Method: Bank removed! Only UPI & Cash */}
          <div>
            <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { label: 'UPI 📱', value: 'UPI' },
                  { label: 'Cash 💵', value: 'CASH' },
                ] as const
              ).map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all text-center cursor-pointer ${
                    paymentMethod === method.value
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instant UPI Launch Button if receiver upiId available */}
          {upiLink && paymentMethod === 'UPI' && (
            <a
              href={upiLink}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Launch UPI App (GPay / PhonePe)</span>
            </a>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || numAmount <= 0}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xs transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Record Settle Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
