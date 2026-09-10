'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Receipt, ArrowRight, X, Phone } from 'lucide-react';
import Link from 'next/link';
import { formatINR } from '@/lib/ledger';

import { useApp } from './AppContext';

export function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { allCustomers, allTransactions } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ customers: any[]; transactions: any[] }>({
    customers: [],
    transactions: [],
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ customers: [], transactions: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults({ customers: [], transactions: [] });
      return;
    }

    // Instant local results (0ms)
    const localCustomers = allCustomers.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.notes?.toLowerCase().includes(q)
    );
    const localTransactions = allTransactions.filter((tx) =>
      !tx.isDeleted && (
        tx.description?.toLowerCase().includes(q) ||
        (tx.amountPaisa / 100).toString().includes(q) ||
        tx.billNumber?.toLowerCase().includes(q) ||
        tx.customer?.name?.toLowerCase().includes(q)
      )
    );

    setResults({
      customers: localCustomers,
      transactions: localTransactions,
    });

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.customers || data.transactions) {
          setResults({
            customers: data.customers || localCustomers,
            transactions: (data.transactions || localTransactions).filter((tx: any) => !tx.isDeleted),
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, allCustomers, allTransactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer name, phone number, bill #..."
            className="w-full text-slate-900 placeholder:text-slate-400 text-base outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-medium"
          >
            ESC
          </button>
        </div>

        {/* Results Area */}
        <div className="overflow-y-auto p-3 space-y-4">
          {loading && (
            <div className="py-8 text-center text-sm text-slate-400">Searching khata records...</div>
          )}

          {!loading && query.length >= 2 && results.customers.length === 0 && results.transactions.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Customers Section */}
          {results.customers.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
                Customers
              </div>
              <div className="space-y-1">
                {results.customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    onClick={onClose}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {c.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="w-3 h-3" />
                          <span>{c.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold ${
                          c.currentBalancePaisa > 0
                            ? 'text-emerald-600'
                            : c.currentBalancePaisa < 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {formatINR(c.currentBalancePaisa, true)}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {c.currentBalancePaisa > 0
                          ? 'You will receive'
                          : c.currentBalancePaisa < 0
                          ? 'You will pay'
                          : 'Settled'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Transactions Section */}
          {results.transactions.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
                Transactions
              </div>
              <div className="space-y-1">
                {results.transactions.map((tx) => (
                  <Link
                    key={tx.id}
                    href={`/customers/${tx.customerId}`}
                    onClick={onClose}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          tx.type === 'CREDIT'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {tx.customer?.name} &bull;{' '}
                          <span className="text-xs text-slate-500">{tx.description || 'No note'}</span>
                        </div>
                        {tx.billNumber && (
                          <span className="text-[11px] text-slate-400">Bill: {tx.billNumber}</span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        tx.type === 'CREDIT' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {tx.type === 'CREDIT' ? '+' : '-'}
                      {formatINR(tx.amountPaisa, true)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
