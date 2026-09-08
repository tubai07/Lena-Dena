'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Phone, Loader2 } from 'lucide-react';
import { generateEntityId, pendingCustomerCreations } from '@/lib/utils';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setPhone(initialData.phone || '');
    } else {
      setName('');
      setPhone('');
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

    const url = initialData ? `/api/customers/${initialData.id}` : '/api/customers';
    const method = initialData ? 'PUT' : 'POST';

    const body: any = {
      name: trimmedName,
      phone: trimmedPhone,
      openingBalance: 0,
    };

    // For new persons: 0ms INSTANT FEEDBACK using pre-generated database ID
    if (!initialData) {
      const customerId = generateEntityId('c');

      const optimisticCustomer = {
        id: customerId,
        name: trimmedName,
        phone: trimmedPhone,
        currentBalancePaisa: 0,
        openingBalancePaisa: 0,
        status: 'SETTLED',
        transactions: [],
      };

      // Close modal and update UI with 0ms delay!
      onSuccess(optimisticCustomer);
      onClose();

      // Background server creation with the EXACT persistent ID
      const creationPromise = fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, id: customerId }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to save contact');
          return data;
        })
        .catch((err) => {
          console.error('Background customer sync failed:', err);
        })
        .finally(() => {
          pendingCustomerCreations.delete(customerId);
        });

      pendingCustomerCreations.set(customerId, creationPromise);
      return;
    }

    // For edits, await the PUT request
    try {
      setLoading(true);
      setError('');
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
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 pt-8 sm:pt-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] my-auto animate-in zoom-in-95 duration-150"
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
