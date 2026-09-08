'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  FileText,
  Camera,
  Check,
  Delete,
  Loader2,
  ChevronRight,
  Plus,
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
  const [amountStr, setAmountStr] = useState('200');
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
      }, 100);
    }
  }, [isOpen, defaultType]);

  const handleKeyPress = (char: string) => {
    if (char === 'backspace') {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }
    if (char === '.' && amountStr.includes('.')) return;
    if (amountStr.length >= 8) return;
    setAmountStr((prev) => prev + char);
  };

  const handleConfirm = async () => {
    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          type,
          amount: numAmount,
          paymentMethod: 'UPI',
          date: selectedDate ? new Date(selectedDate) : undefined,
          description: note || (type === 'CREDIT' ? 'Given' : 'Received'),
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

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error recording transaction');
    } finally {
      setLoading(false);
    }
  };

  // Physical Computer Keyboard support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is currently typing in the amount input itself, let native input handle it
      if (document.activeElement === amountInputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      // If user is typing in notes or date, don't intercept digits
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        if (e.key === 'Escape') {
          onClose();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleKeyPress('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('backspace');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, amountStr, note, type, customer, selectedDate]);

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header matching Screenshot 4 */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <button
            onClick={onClose}
            className="p-2 text-slate-700 hover:text-black rounded-full hover:bg-slate-100 tap-effect"
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
        <div className="px-5 pt-3 flex items-center justify-center">
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

        {/* Big Amount Display with Input */}
        <div className="py-4 text-center">
          <div className="inline-flex items-baseline justify-center border-b-2 border-orange-600 pb-1 px-4 min-w-[140px]">
            <span className="text-2xl font-bold text-orange-600 mr-1.5">₹</span>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              autoFocus
              value={amountStr}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*\.?[0-9]*$/.test(val) && val.length <= 8) {
                  setAmountStr(val);
                }
              }}
              placeholder="0"
              className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight bg-transparent text-center outline-none w-40 sm:w-48 placeholder:text-slate-300"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-bold mt-2">{error}</p>}
        </div>

        {/* Action Cards matching Screenshot 4 */}
        <div className="px-5 space-y-2 pb-3">
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
                className="w-full flex items-center gap-2.5 text-slate-700 font-semibold"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>{note ? note : 'Add Notes'}</span>
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

          {/* Add Bills Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-700 font-semibold">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-slate-500" />
              <span>Add Bills (Optional)</span>
            </div>
            <Plus className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        {/* Confirm Button */}
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !amountStr || parseFloat(amountStr) <= 0}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-bold text-base shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
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

        {/* In-App Tactile Numeric Keypad matching Screenshot 4 */}
        <div className="p-3 bg-slate-100/80 border-t border-slate-200 grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <button onClick={() => handleKeyPress('1')} className="keypad-button">1</button>
          <button onClick={() => handleKeyPress('2')} className="keypad-button">2</button>
          <button onClick={() => handleKeyPress('3')} className="keypad-button">3</button>
          <button
            onClick={() => handleKeyPress('backspace')}
            className="keypad-button bg-rose-50 text-rose-700 hover:bg-rose-100"
          >
            <Delete className="w-5 h-5" />
          </button>

          {/* Row 2 */}
          <button onClick={() => handleKeyPress('4')} className="keypad-button">4</button>
          <button onClick={() => handleKeyPress('5')} className="keypad-button">5</button>
          <button onClick={() => handleKeyPress('6')} className="keypad-button">6</button>
          <button onClick={() => handleKeyPress('*')} className="keypad-button text-slate-500">&times;</button>

          {/* Row 3 */}
          <button onClick={() => handleKeyPress('7')} className="keypad-button">7</button>
          <button onClick={() => handleKeyPress('8')} className="keypad-button">8</button>
          <button onClick={() => handleKeyPress('9')} className="keypad-button">9</button>
          <button onClick={() => handleKeyPress('-')} className="keypad-button text-slate-500">&minus;</button>

          {/* Row 4 */}
          <button onClick={() => handleKeyPress('.')} className="keypad-button">.</button>
          <button onClick={() => handleKeyPress('0')} className="keypad-button">0</button>
          <button onClick={handleConfirm} className="keypad-button bg-emerald-100 text-emerald-800 font-black">=</button>
          <button onClick={() => handleKeyPress('+')} className="keypad-button text-slate-500">+</button>
        </div>
      </div>
    </div>
  );
}
