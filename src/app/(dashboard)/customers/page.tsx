'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  UserPlus,
  ArrowUpDown,
  Phone,
  MessageCircle,
  BellRing,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { formatRelativeDate } from '@/lib/utils';
import { useTranslation } from '@/components/common/LanguageContext';
import { useApp } from '@/components/common/AppContext';

export default function CustomersPage() {
  const { t } = useTranslation();
  const { openCustomerModal, openTransactionModal, openReminderModal } = useApp();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, owes_me, i_owe, settled
  const [sort, setSort] = useState('highest_balance'); // highest_balance, oldest_due, recently_active, name

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        q: search,
        filter,
        sort,
      });
      const res = await fetch(`/api/customers?${queryParams.toString()}`);
      const data = await res.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 150);
    return () => clearTimeout(timer);
  }, [search, filter, sort]);

  const filterTabs = [
    { id: 'all', label: t.all },
    { id: 'owes_me', label: `${t.owesMe} (You'll get)` },
    { id: 'i_owe', label: `${t.iOwe} (Advance)` },
    { id: 'settled', label: t.settled },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">{t.customers}</h2>
          <p className="text-xs text-slate-500">
            Manage customer accounts, balances & khata ledgers
          </p>
        </div>

        <button
          onClick={() => openCustomerModal()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.addCustomer}</span>
        </button>
      </div>

      {/* Search & Sort Controls */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone number, notes..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none"
            >
              <option value="highest_balance">Highest Balance</option>
              <option value="oldest_due">Oldest Due</option>
              <option value="recently_active">Recently Active</option>
              <option value="name">Name (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                filter === tab.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Cards Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-3xl border border-slate-200/80 p-4 animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {search ? 'No matching customers found' : "You haven't added any customers yet"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search
              ? 'Try searching with a different name, phone number, or clearing filters.'
              : 'Start by creating your first customer to record credit and track payments.'}
          </p>
          <button
            onClick={() => openCustomerModal()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all"
          >
            {t.addCustomer}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {customers.map((c) => {
            const isReceivable = c.currentBalancePaisa > 0;
            const isPayable = c.currentBalancePaisa < 0;
            const isSettled = c.currentBalancePaisa === 0;

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Header: Avatar, Name, Phone, Balance */}
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/customers/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center text-sm shrink-0 shadow-xs ${
                        isReceivable
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPayable
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors truncate">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Balance Display */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-base sm:text-lg font-black ${
                        isReceivable
                          ? 'text-emerald-700'
                          : isPayable
                          ? 'text-rose-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatINR(c.currentBalancePaisa, true)}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block ${
                        isReceivable
                          ? 'text-emerald-600'
                          : isPayable
                          ? 'text-rose-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {isReceivable ? "You'll Receive" : isPayable ? "You'll Pay" : 'Settled'}
                    </span>
                  </div>
                </div>

                {/* Notes or Last Transaction Snippet */}
                {c.notes && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl mt-3 line-clamp-1 border border-slate-100">
                    {c.notes}
                  </p>
                )}

                {/* Footer Quick Action Buttons */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 gap-2">
                  <Link
                    href={`/customers/${c.id}`}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 py-1"
                  >
                    <span>View Khata</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {isReceivable && (
                      <button
                        onClick={() => openReminderModal(c)}
                        className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors border border-amber-200/80"
                        title="Send Payment Reminder"
                      >
                        <BellRing className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => openTransactionModal(c, 'PAYMENT')}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors border border-emerald-200 flex items-center gap-1"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Receive ₹</span>
                    </button>

                    <button
                      onClick={() => openTransactionModal(c, 'CREDIT')}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors border border-rose-200 flex items-center gap-1"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                      <span>+ Credit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
