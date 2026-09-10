'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, ArrowRight, Smartphone, Banknote } from 'lucide-react';
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
  onSettled: () => void;
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
  const [payerId, setPayerId] = useState(
    initialPayerId || members[0]?.id || ''
  );
  const [receiverId, setReceiverId] = useState(
    initialReceiverId || members[1]?.id || members[0]?.id || ''
  );
  const [amountRupees, setAmountRupees] = useState(
    initialAmountPaisa ? (initialAmountPaisa / 100).toFixed(2) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (amountPaisa <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    setError('');

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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record settlement');
      }

      onSettled();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Settle Up Debt</h3>
              <p className="text-xs text-slate-500">Record a payment between friends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {/* Payer and Receiver visual selector */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Payer (Who paid)
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50/50"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isOwner ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-5 text-slate-400">
              <ArrowRight className="w-4 h-4" />
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Recipient (Who received)
              </label>
              <select
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50/50"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isOwner ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
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
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-extrabold text-slate-900 text-xl bg-slate-50/50"
                autoFocus
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { label: 'UPI 📱', value: 'UPI' },
                  { label: 'Cash 💵', value: 'CASH' },
                  { label: 'Bank 🏦', value: 'BANK_TRANSFER' },
                ] as const
              ).map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                    paymentMethod === method.value
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instant UPI Launch Button if upiId available */}
          {upiLink && paymentMethod === 'UPI' && (
            <a
              href={upiLink}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Open UPI App (GPay / PhonePe / Paytm)</span>
            </a>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Sent via Google Pay"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || numAmount <= 0}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Recording...' : 'Record Settlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
