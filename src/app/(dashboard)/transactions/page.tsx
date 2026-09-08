'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDown, ArrowUp, Search, Trash2 } from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { formatDate } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

export default function ActivityPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(''); // '', PAYMENT, CREDIT
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<any>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter]);

  const handleDelete = async () => {
    if (!deleteConfirmTx) return;
    try {
      await fetch(`/api/transactions?id=${deleteConfirmTx.id}`, { method: 'DELETE' });
      setDeleteConfirmTx(null);
      fetchTransactions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 text-slate-700 hover:text-black tap-effect">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h2 className="font-bold text-slate-900 text-lg">Activity</h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center bg-slate-100 rounded-full p-0.5 text-xs font-bold">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-2.5 py-1 rounded-full transition-all ${
              typeFilter === '' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('PAYMENT')}
            className={`px-2.5 py-1 rounded-full transition-all ${
              typeFilter === 'PAYMENT' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
            }`}
          >
            Received
          </button>
          <button
            onClick={() => setTypeFilter('CREDIT')}
            className={`px-2.5 py-1 rounded-full transition-all ${
              typeFilter === 'CREDIT' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-500'
            }`}
          >
            Given
          </button>
        </div>
      </header>

      {/* Transactions List */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">
            No activity recorded yet.
          </div>
        ) : (
          transactions.map((tx: any) => {
            const isReceived = tx.type === 'PAYMENT';
            return (
              <div
                key={tx.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isReceived ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {isReceived ? (
                      <ArrowDown className="w-4 h-4 stroke-[2.5px]" />
                    ) : (
                      <ArrowUp className="w-4 h-4 stroke-[2.5px]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/customers/${tx.customer?.id}`}
                      className="font-bold text-sm text-slate-900 hover:text-emerald-700 transition-colors truncate block"
                    >
                      {tx.customer?.name}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {formatDate(tx.date)} {tx.description ? `• ${tx.description}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-2 shrink-0">
                  <span
                    className={`text-sm font-black ${
                      isReceived ? 'text-emerald-700' : 'text-orange-600'
                    }`}
                  >
                    {isReceived ? '↓ ' : '↑ '}
                    {formatINR(tx.amountPaisa, true)}
                  </span>

                  <button
                    onClick={() => setDeleteConfirmTx(tx)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmationDialog
        isOpen={!!deleteConfirmTx}
        onClose={() => setDeleteConfirmTx(null)}
        onConfirm={handleDelete}
        title="Delete transaction?"
        message="This will adjust the contact's running balance."
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}
