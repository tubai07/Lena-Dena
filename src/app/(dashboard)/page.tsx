'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Share2,
  Search,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Check,
  UserPlus,
  X,
} from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { useApp } from '@/components/common/AppContext';
import { GlobalSearchModal } from '@/components/common/GlobalSearchModal';
import { SwipeableCustomerRow } from '@/components/customer/SwipeableCustomerRow';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

export default function SimplifiedDashboardPage() {
  const { openCustomerModal, allCustomers, deleteCustomerFromApp, business } = useApp();

  const [showBalance, setShowBalance] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'due' | 'advance' | 'settled'>('all');
  const [sortOption, setSortOption] = useState<'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc'>('amount_desc');
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<any>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const lastScrollY = useRef(0);

  // Scroll detection: collapse Add Person button to icon-only smoothly on scroll down
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollY.current;

          // Natural scroll behavior:
          // Scroll down past 35px -> collapse smoothly
          // Scroll up or near top (<= 15px) -> expand smoothly
          if (currentScrollY > 35 && diff > 1) {
            setIsScrolledDown(true);
          } else if (diff < -2 || currentScrollY <= 15) {
            setIsScrolledDown(false);
          }
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDeleteCustomer = async () => {
    if (!deleteCustomerTarget) return;
    const target = deleteCustomerTarget;
    setDeleteCustomerTarget(null);

    setDeletingCustomer(true);
    try {
      await deleteCustomerFromApp(target.id);
    } catch (e) {
      console.error('Failed to delete customer:', e);
    } finally {
      setDeletingCustomer(false);
    }
  };

  const customers = allCustomers;
  const loading = false;

  // Memoize Filter & Sort
  const filteredCustomers = useMemo(() => {
    const list = customers.filter((c) => {
      if (filterType === 'due') return c.currentBalancePaisa > 0;
      if (filterType === 'advance') return c.currentBalancePaisa < 0;
      if (filterType === 'settled') return c.currentBalancePaisa === 0;
      return true;
    });

    list.sort((a, b) => {
      if (sortOption === 'amount_desc') {
        return Math.abs(b.currentBalancePaisa) - Math.abs(a.currentBalancePaisa);
      }
      if (sortOption === 'amount_asc') {
        return Math.abs(a.currentBalancePaisa) - Math.abs(b.currentBalancePaisa);
      }
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });

    return list;
  }, [customers, filterType, sortOption]);

  // Memoize Net Balance
  const netBalancePaisa = useMemo(() => {
    let sum = 0;
    for (const c of customers) {
      sum += c.currentBalancePaisa;
    }
    return sum;
  }, [customers]);

  const isPositive = netBalancePaisa >= 0;
  const isFilterActive = filterType !== 'all' || sortOption !== 'amount_desc';

  // Avatar background colors based on letter
  const getAvatarBg = (name: string) => {
    if (name.includes('🐰')) return 'bg-pink-100 text-pink-700';
    const firstChar = name.charAt(0).toUpperCase();
    if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700';
    if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const getSubtext = (c: any) => {
    const tx = c.transactions && c.transactions[0];
    if (!tx) {
      return c.currentBalancePaisa > 0
        ? '📅 Pending Collection'
        : 'Account settled';
    }
    if (tx.type === 'PAYMENT') {
      return `✓ ${formatINR(tx.amountPaisa, true)} Payment Added`;
    }
    return `✓ ${formatINR(tx.amountPaisa, true)} Credit Added`;
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white pb-32 relative">
      {/* Top Header matching Screenshot 2 */}
      <header className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-slate-100">
        {/* Profile Avatar & App Version */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/settings"
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-600 text-white font-bold flex items-center justify-center text-sm shadow-xs border border-white hover:opacity-90 active:scale-95 transition-all tap-effect shrink-0"
            title="Account & Settings"
          >
            <span>{business?.name ? business.name.slice(0, 1).toUpperCase() : 'T'}</span>
          </Link>
          <div className="leading-tight select-none">
            <span className="text-sm font-bold text-slate-700 block">
              Lena Dena App
            </span>
            <span className="text-xs font-medium text-slate-400 block">
              Ver 1.0
            </span>
          </div>
        </div>

        {/* Right Header Icons: Share, Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'Lena Dena', text: 'My Personal Digital Khata' });
              }
            }}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center tap-effect"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center tap-effect"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Net Balance Card matching Screenshot 2 */}
      <div className="mx-4 my-3 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between">
          {/* Left: Net Balance Title & Eye Toggle */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-800">Net Balance</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full tap-effect"
                title={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {filteredCustomers.length !== customers.length
                ? `${filteredCustomers.length} of ${customers.length} Accounts`
                : `${customers.length} Accounts`}
            </span>
          </div>

          {/* Right: Net Amount & You Get/You Give + Filter Button */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div
                className={`text-xl font-black ${
                  isPositive ? 'text-orange-600' : 'text-emerald-700'
                }`}
              >
                {showBalance ? formatINR(Math.abs(netBalancePaisa), true) : '••••••'}
              </div>
              <span className="text-[11px] font-bold text-slate-400 block">
                {isPositive ? 'You Get' : 'You Give'}
              </span>
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setFilterMenuOpen(true)}
              className={`p-2 rounded-xl transition-all relative tap-effect ${
                isFilterActive
                  ? 'bg-emerald-100 text-emerald-800 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Filter & Sort accounts"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {isFilterActive && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-600" />
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Indicator Badge (if filtered) */}
        {isFilterActive && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Filtered: <strong className="text-slate-800">{filterType.toUpperCase()}</strong>
            </span>
            <button
              onClick={() => {
                setFilterType('all');
                setSortOption('amount_desc');
              }}
              className="text-xs text-rose-600 font-bold hover:underline"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Contact List matching Screenshot 2 */}
      <div className="divide-y divide-slate-100">
        {loading && customers.length === 0 ? (
          <div className="p-4 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs px-6">
            <p className="font-semibold text-slate-600 text-sm">No accounts found</p>
            <p className="mt-1">
              {customers.length === 0
                ? 'Your personal ledger is empty. Tap "Add Person" to start.'
                : 'No accounts match the current filter criteria.'}
            </p>
            {isFilterActive && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setSortOption('amount_desc');
                }}
                className="mt-3 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold"
              >
                Clear Filter
              </button>
            )}
          </div>
        ) : (
          filteredCustomers.map((c) => (
            <SwipeableCustomerRow
              key={c.id}
              customer={c}
              getAvatarBg={getAvatarBg}
              getSubtext={getSubtext}
              onDeleteRequest={(cust) => setDeleteCustomerTarget(cust)}
            />
          ))
        )}
      </div>

      {/* Floating Action Button: smooth animated morphing */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto pointer-events-none px-4 flex justify-end z-30 animate-fab-enter">
        <button
          onClick={() => openCustomerModal()}
          className={`pointer-events-auto fab-add-person flex items-center bg-emerald-700 hover:bg-emerald-800 text-white rounded-full font-bold text-sm shadow-xl shadow-emerald-900/30 overflow-hidden cursor-pointer ${
            isScrolledDown ? 'w-[52px]' : 'w-[146px]'
          }`}
          title="Add Person"
          aria-label="Add Person"
        >
          <div className="w-[52px] h-[52px] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 stroke-[2.2px]" />
          </div>
          <span
            className={`whitespace-nowrap fab-text-wrapper overflow-hidden font-bold pr-4 ${
              isScrolledDown ? 'max-w-0 opacity-0 !pr-0' : 'max-w-[90px] opacity-100'
            }`}
          >
            Add Person
          </span>
        </button>
      </div>

      {/* Filter & Sort Bottom Sheet Modal */}
      {filterMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setFilterMenuOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Filter & Sort Accounts
                </h3>
              </div>
              <button
                onClick={() => setFilterMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 tap-effect"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Filter By Status */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Show Accounts
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'All Accounts' },
                    { id: 'due', label: "You'll Get (Pending)" },
                    { id: 'advance', label: "You'll Give (Advance)" },
                    { id: 'settled', label: 'Settled (₹0)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilterType(opt.id as any)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        filterType === opt.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {filterType === opt.id && (
                        <Check className="w-4 h-4 text-emerald-600 stroke-[3px]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Sort By
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'amount_desc', label: 'Highest Amount Due' },
                    { id: 'amount_asc', label: 'Lowest Amount Due' },
                    { id: 'name_asc', label: 'Name (A to Z)' },
                    { id: 'name_desc', label: 'Name (Z to A)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortOption(opt.id as any)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        sortOption === opt.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortOption === opt.id && (
                        <Check className="w-4 h-4 text-emerald-600 stroke-[3px]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setSortOption('amount_desc');
                    setFilterMenuOpen(false);
                  }}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMenuOpen(false)}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all text-center"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Dialog */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Delete Customer Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deleteCustomerTarget}
        onClose={() => setDeleteCustomerTarget(null)}
        onConfirm={handleDeleteCustomer}
        title={`Delete ${deleteCustomerTarget?.name}?`}
        message={`Are you sure you want to delete ${deleteCustomerTarget?.name} and all their transaction records? This action cannot be undone.`}
        confirmText="Delete Person"
        loading={deletingCustomer}
        isDestructive={true}
      />
    </div>
  );
}
