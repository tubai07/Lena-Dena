'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Phone, IndianRupee, Loader2 } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
  initialData?: any;
}

export function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CustomerFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'OWES_ME' | 'I_OWE'>('OWES_ME');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setPhone(initialData.phone || '');
      setOpeningBalance('');
    } else {
      setName('');
      setPhone('');
      setOpeningBalance('');
      setBalanceType('OWES_ME');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter contact name');
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim() || '9999999999';
    const numOpening = openingBalance ? parseFloat(openingBalance) : 0;
    const openingPaisa = Math.round(numOpening * 100) * (balanceType === 'I_OWE' ? -1 : 1);

    // 0ms INSTANT OPTIMISTIC FEEDBACK FOR NEW CUSTOMERS
    if (!initialData) {
      const optimisticCustomer = {
        id: `temp_${Date.now()}`,
        name: trimmedName,
        phone: trimmedPhone,
        openingBalancePaisa: openingPaisa,
        currentBalancePaisa: openingPaisa,
        status: openingPaisa === 0 ? 'SETTLED' : 'ACTIVE',
        transactions:
          openingPaisa !== 0
            ? [
                {
                  id: `temp_tx_${Date.now()}`,
                  type: openingPaisa > 0 ? 'CREDIT' : 'PAYMENT',
                  amountPaisa: Math.abs(openingPaisa),
                  date: new Date().toISOString(),
                  description: 'Opening Balance',
                },
              ]
            : [],
      };
      onSuccess(optimisticCustomer);
      onClose();
    } else {
      setLoading(true);
    }

    try {
      setError('');

      const url = initialData ? `/api/customers/${initialData.id}` : '/api/customers';
      const method = initialData ? 'PUT' : 'POST';

      const body = {
        name: trimmedName,
        phone: trimmedPhone,
        ...(!initialData && {
          openingBalance: numOpening,
          balanceType,
        }),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save contact');
      }

      onSuccess(data.customer || data);
      if (initialData) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Screenshot 3 */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <button
            onClick={onClose}
            className="p-2 text-slate-700 hover:text-black rounded-full hover:bg-slate-100 tap-effect"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="text-base font-bold text-slate-900">
            {initialData ? 'Edit Contact' : 'Add Person'}
          </h3>
          <div className="w-8" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Name Field matching Screenshot 3 */}
          <div className="relative">
            <div className="absolute -top-2.5 left-4 bg-white px-1.5 text-xs font-bold text-emerald-700">
              Name *
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-2 border-emerald-600 rounded-2xl bg-white shadow-xs">
              <User className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter person's name"
                className="w-full text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          {/* Mobile Field matching Screenshot 3 */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 border border-slate-300 rounded-2xl bg-white">
            <Phone className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile (Optional)"
              className="w-full text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Opening Balance (Optional) */}
          {!initialData && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Starting Balance (Optional)</span>
                <div className="flex items-center gap-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setBalanceType('OWES_ME')}
                    className={`px-2 py-0.5 rounded-md ${
                      balanceType === 'OWES_ME'
                        ? 'bg-rose-100 text-rose-700'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    They owe
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceType('I_OWE')}
                    className={`px-2 py-0.5 rounded-md ${
                      balanceType === 'I_OWE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    I owe
                  </button>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-bold text-base shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>{name.trim() ? (initialData ? 'Save Changes' : 'Add to Ledger') : 'Enter Name'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
