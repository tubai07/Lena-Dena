'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Check,
  Loader2,
} from 'lucide-react';
import { formatINR } from '@/lib/ledger';

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  currentBalancePaisa: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: {
    transaction: any;
    newBalancePaisa: number;
    customer?: any;
  }) => void;
  preSelectedCustomer?: any;
  defaultType?: 'CREDIT' | 'PAYMENT';
  allCustomers?: CustomerOption[];
}

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedCustomer,
  defaultType = 'PAYMENT',
  allCustomers = [],
}: TransactionModalProps) {
  const [type, setType] = useState<'CREDIT' | 'PAYMENT'>(defaultType);
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);

  const customer =
    preSelectedCustomer ||
    (allCustomers.length > 0 ? allCustomers[0] : null);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setAmountStr('');
      setNote('');
      setShowNoteInput(false);
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setError('');
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, defaultType]);

  const handleConfirm = async () => {
    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter an amount greater than 0');
      amountInputRef.current?.focus();
      return;
    }

    const amountPaisa = Math.round(numAmount * 100);
    const balanceDelta = type === 'CREDIT' ? amountPaisa : -amountPaisa;
    const optimisticBalancePaisa = (customer.currentBalancePaisa || 0) + balanceDelta;
    const now = new Date();
    let txDate = now;
    if (selectedDate) {
      const todayStr = now.toISOString().split('T')[0];
      if (selectedDate !== todayStr) {
        const [y, m, d] = selectedDate.split('-').map(Number);
        txDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      }
    }
    const txDescription = note.trim() || (type === 'CREDIT' ? 'Given' : 'Received');

    // 0ms INSTANT OPTIMISTIC FEEDBACK
    const optimisticTx = {
      id: `temp_tx_${Date.now()}`,
      businessId: customer.businessId || '',
      customerId: customer.id,
      type,
      amountPaisa,
      paymentMethod: 'UPI',
      date: txDate.toISOString(),
      description: txDescription,
      createdAt: now.toISOString(),
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        currentBalancePaisa: optimisticBalancePaisa,
      },
    };

    onSuccess({
      transaction: optimisticTx,
      newBalancePaisa: optimisticBalancePaisa,
      customer: {
        ...customer,
        currentBalancePaisa: optimisticBalancePaisa,
      },
    });

    onClose();

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          type,
          amount: numAmount,
          paymentMethod: 'UPI',
          date: txDate,
          description: txDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save transaction');
      }

      onSuccess({
        transaction: data.transaction,
        newBalancePaisa: data.newBalancePaisa,
        customer,
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Keyboard shortcut listener for Enter and Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        // Only confirm on Enter if not typing a multiline note
        if (document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, amountStr, note, type, customer, selectedDate]);

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-700 hover:text-black rounded-full hover:bg-slate-100 tap-effect"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-sm">
              {customer.name.includes('🐰') ? '🐰' : customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-900 leading-tight">
                {customer.name}
              </div>
              <div className="text-xs font-semibold text-rose-600">
                {formatINR(customer.currentBalancePaisa, true)} Due
              </div>
            </div>
          </div>

          <div className="w-8" />
        </div>

        {/* Transaction Type Indicator */}
        <div className="px-5 pt-3.5 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors bg-slate-50 border-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                type === 'PAYMENT' ? 'bg-emerald-500' : 'bg-orange-500'
              }`}
            />
            <span className={type === 'PAYMENT' ? 'text-emerald-700' : 'text-orange-700'}>
              {type === 'PAYMENT' ? 'You Received Money (Jama)' : 'You Gave Money (Udhar)'}
            </span>
          </div>
        </div>

        {/* Big Amount Input - Direct Typing */}
        <div className="py-5 text-center px-4">
          <div className="inline-flex items-baseline justify-center border-b-2 border-orange-600 pb-1 px-4 min-w-[160px]">
            <span className="text-3xl font-bold text-orange-600 mr-2 select-none">₹</span>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              autoFocus
              value={amountStr}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*\.?[0-9]*$/.test(val) && val.length <= 9) {
                  setAmountStr(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              placeholder="0"
              className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight bg-transparent text-center outline-none w-44 sm:w-52 placeholder:text-slate-300"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-bold mt-2">{error}</p>}
        </div>

        {/* Action Cards */}
        <div className="px-5 space-y-2.5 pb-4">
          {/* Notes Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs transition-colors">
            {showNoteInput ? (
              <input
                type="text"
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What was this for? (e.g. Drink, Dinner, Chai)"
                className="w-full bg-transparent font-medium text-slate-800 outline-none text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowNoteInput(true)}
                className="w-full flex items-center gap-2.5 text-slate-700 font-semibold text-left"
              >
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate">{note ? note : 'Add Notes'}</span>
              </button>
            )}
          </div>

          {/* Date Card with Functional Date Picker */}
          <div className="bg-slate-50 border border-slate-200/80 hover:bg-slate-100 rounded-2xl p-2.5 px-3.5 flex items-center justify-between text-xs text-slate-700 font-semibold transition-colors">
            <label htmlFor="bill-date-input" className="flex items-center gap-2.5 cursor-pointer">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Bill Date</span>
            </label>
            <input
              id="bill-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-300 hover:border-emerald-600 focus:border-emerald-600 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 cursor-pointer outline-none shadow-2xs"
            />
          </div>
        </div>

        {/* Big Clean Confirm Button */}
        <div className="px-5 pb-6 sm:pb-5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !amountStr || parseFloat(amountStr) <= 0}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-bold text-base shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 tap-effect"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 stroke-[2.5px]" />
                <span>Confirm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
