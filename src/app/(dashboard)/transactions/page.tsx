'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDown, ArrowUp, Search, Trash2 } from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { formatDate } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useApp } from '@/components/common/AppContext';

export default function ActivityPage() {
  const { allTransactions, setAllTransactions, refreshAppData } = useApp();
  const [typeFilter, setTypeFilter] = useState(''); // '', PAYMENT, CREDIT
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<any>(null);

  // Instant in-memory filtering (0ms latency!)
  const filteredTransactions = useMemo(() => {
    if (!typeFilter) return allTransactions;
    return allTransactions.filter((tx) => tx.type === typeFilter);
  }, [allTransactions, typeFilter]);

  // Background sync on mount without blocking the UI
  useEffect(() => {
    fetch('/api/transactions')
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) {
          setAllTransactions(data.transactions);
        }
      })
      .catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirmTx) return;
    const txId = deleteConfirmTx.id;
    setDeleteConfirmTx(null);

    // Instant optimistic strike-through (0ms delay)
    setAllTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, isDeleted: true } : t))
    );

    try {
      await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
      refreshAppData();
    } catch (e) {
      console.error(e);
      refreshAppData();
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
        {filteredTransactions.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">
            No activity recorded yet.
          </div>
        ) : (
          filteredTransactions.map((tx: any) => {
            const isReceived = tx.type === 'PAYMENT';
            return (
              <div
                key={tx.id}
                className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  tx.isDeleted ? 'bg-slate-50/70 opacity-65' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      tx.isDeleted
                        ? 'bg-slate-200 text-slate-400'
                        : isReceived
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-orange-100 text-orange-700'
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
                      className={`font-bold text-sm truncate block ${
                        tx.isDeleted
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900 hover:text-emerald-700'
                      }`}
                    >
                      {tx.customer?.name}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                      <span className={tx.isDeleted ? 'line-through' : ''}>
                        {formatDate(tx.date)} {tx.description ? `• ${tx.description}` : ''}
                      </span>
                      {tx.isDeleted && (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-2 shrink-0">
                  <span
                    className={`text-sm font-black ${
                      tx.isDeleted
                        ? 'text-slate-400 line-through'
                        : isReceived
                        ? 'text-emerald-700'
                        : 'text-orange-600'
                    }`}
                  >
                    {isReceived ? '↓ ' : '↑ '}
                    {formatINR(tx.amountPaisa, true)}
                  </span>

                  {!tx.isDeleted && (
                    <button
                      onClick={() => setDeleteConfirmTx(tx)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg tap-effect cursor-pointer"
                      title="Cancel transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete / Cancel Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deleteConfirmTx}
        onClose={() => setDeleteConfirmTx(null)}
        onConfirm={handleDelete}
        title="Cancel this transaction?"
        message="This entry will be struck through and greyed out, and its amount will be removed from customer balances."
        confirmText="Cancel Entry"
        isDestructive={true}
      />
    </div>
  );
}
