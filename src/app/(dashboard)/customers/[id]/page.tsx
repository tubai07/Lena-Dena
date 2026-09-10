'use client';

import React, { useState, useEffect, useRef, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  FileText,
  Phone,
  MessageSquare,
  MoreHorizontal,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Check,
  Download,
  Trash2,
} from 'lucide-react';
import { computeLedgerRunningBalances, formatINR } from '@/lib/ledger';
import { formatDate, pendingCustomerCreations } from '@/lib/utils';
import { generateSmsLink } from '@/lib/reminders';
import { useApp } from '@/components/common/AppContext';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { TransactionDetailModal } from '@/components/transaction/TransactionDetailModal';

function prepareCustomerLedgerData(customer: any, globalTransactions: any[] = []) {
  if (!customer) return null;

  const custTxs = customer.transactions || [];
  const matchingGlobalTxs = (globalTransactions || []).filter(
    (t: any) => t.customerId === customer.id || t.customer?.id === customer.id
  );

  // Merge and deduplicate by transaction id
  const txMap = new Map();
  for (const tx of custTxs) {
    if (tx?.id && !txMap.has(tx.id)) {
      txMap.set(tx.id, tx);
    }
  }
  for (const tx of matchingGlobalTxs) {
    if (tx?.id && !txMap.has(tx.id)) {
      txMap.set(tx.id, tx);
    }
  }

  const allMergedTxs = Array.from(txMap.values());

  // Compute running balance chronologically (ascending)
  const computedChronological = computeLedgerRunningBalances(
    customer.openingBalancePaisa || 0,
    allMergedTxs
  );

  let totalGivenPaisa = 0;
  let totalReceivedPaisa = 0;
  for (const tx of allMergedTxs) {
    if (!tx.isDeleted) {
      if (tx.type === 'CREDIT') totalGivenPaisa += tx.amountPaisa;
      if (tx.type === 'PAYMENT') totalReceivedPaisa += tx.amountPaisa;
    }
  }

  return {
    customer: {
      ...customer,
      transactions: computedChronological,
    },
    stats: {
      totalGivenPaisa,
      totalReceivedPaisa,
      netBalancePaisa: customer.currentBalancePaisa,
      totalTransactions: allMergedTxs.length,
    },
  };
}

export default function PersonChatLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { allCustomers, allTransactions, openTransactionModal, openReminderModal, openCustomerModal, refreshAppData, deleteCustomerFromApp, lastUpdated } = useApp();

  const cachedCustomer = allCustomers.find((c) => c.id === resolvedParams.id);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(() => prepareCustomerLedgerData(cachedCustomer, allTransactions));
  const [loading, setLoading] = useState(!cachedCustomer);
  const [deleteConfirmCust, setDeleteConfirmCust] = useState(false);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<any>(null);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<any>(null);

  // Auto-redirect if URL has a temp ID that has been resolved to a real ID
  useEffect(() => {
    if (resolvedParams.id.startsWith('temp_')) {
      const realCust = allCustomers.find((c) => !c.id.startsWith('temp_') && c.name === cachedCustomer?.name);
      if (realCust) {
        router.replace(`/customers/${realCust.id}`);
      }
    }
  }, [resolvedParams.id, allCustomers, cachedCustomer, router]);

  const fetchCustomerDetails = async () => {
    try {
      if (pendingCustomerCreations.has(resolvedParams.id)) {
        try {
          await pendingCustomerCreations.get(resolvedParams.id);
        } catch (e) {
          console.error('Pending customer creation wait error:', e);
        }
      }

      if (!data) setLoading(true);
      const res = await fetch(`/api/customers/${resolvedParams.id}`);
      const json = await res.json();
      if (json.customer) {
        const prepared = prepareCustomerLedgerData(json.customer, allTransactions);
        if (prepared) {
          setData((prev: any) => ({
            ...(prev || {}),
            ...json,
            ...prepared,
            customer: {
              ...(json.customer || {}),
              ...prepared.customer,
            },
            stats: {
              ...(json.stats || {}),
              ...prepared.stats,
            },
          }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [resolvedParams.id, lastUpdated]);

  // Instant optimistic timeline update when transactions or customer data update
  useEffect(() => {
    if (cachedCustomer) {
      const prepared = prepareCustomerLedgerData(cachedCustomer, allTransactions);
      if (prepared) {
        setData((prev: any) => {
          if (!prev) return prepared;
          return {
            ...prev,
            ...prepared,
            customer: {
              ...(prev.customer || {}),
              ...prepared.customer,
            },
            stats: {
              ...(prev.stats || {}),
              ...prepared.stats,
            },
          };
        });
      }
    }
  }, [cachedCustomer, allTransactions]);

  if (loading && !data) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-white p-4 space-y-4 animate-pulse">
        <div className="h-14 bg-slate-100 rounded-2xl" />
        <div className="h-44 bg-slate-50 rounded-2xl" />
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-white p-8 text-center">
        <h3 className="text-base font-bold text-slate-800">Person not found</h3>
        <Link href="/" className="text-xs text-blue-600 font-bold mt-2 inline-block">
          &larr; Back to Ledger
        </Link>
      </div>
    );
  }

  const { customer, stats } = data;
  const isDue = customer.currentBalancePaisa > 0;
  const isAdvance = customer.currentBalancePaisa < 0;

  // Format time e.g. "9:56 PM"
  const formatTime = (dateInput: string | Date) => {
    return new Date(dateInput).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Group transactions by date for centered date pills
  // Deterministic chronological sorting: oldest at top, newest at bottom
  const chronologicalTx = useMemo(() => {
    return [...(customer.transactions || [])].sort((a: any, b: any) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const createA = new Date(a.createdAt || a.date).getTime();
      const createB = new Date(b.createdAt || b.date).getTime();
      if (createA !== createB) return createA - createB;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [customer.transactions]);

  // Smooth scroll to latest transaction at bottom when entries change
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chronologicalTx.length]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Status', 'Amount (INR)', 'Note', 'Running Balance (INR)'];
    const rows = chronologicalTx.map((tx: any) => [
      new Date(tx.date).toLocaleDateString('en-IN'),
      tx.type,
      tx.isDeleted ? 'CANCELLED' : 'ACTIVE',
      (tx.amountPaisa / 100).toFixed(2),
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.isDeleted ? '-' : (tx.runningBalancePaisa / 100).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `${customer.name}_Statement.csv`;
    link.click();
  };

  const handleDeleteCustomer = async () => {
    try {
      await deleteCustomerFromApp(customer.id);
      router.push('/');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteConfirmTx || deleteConfirmTx.isDeleted) return;
    const txId = deleteConfirmTx.id;
    setDeleteConfirmTx(null);

    // Instant optimistic strike-through and balance recalculation (0ms)
    setData((prev: any) => {
      if (!prev?.customer?.transactions) return prev;
      const updatedTxs = prev.customer.transactions.map((t: any) =>
        t.id === txId ? { ...t, isDeleted: true } : t
      );
      const withBalances = computeLedgerRunningBalances(
        prev.customer.openingBalancePaisa || 0,
        updatedTxs
      );
      return {
        ...prev,
        customer: {
          ...prev.customer,
          transactions: withBalances,
        },
      };
    });

    try {
      await fetch(`/api/transactions?id=${txId}`, { method: 'DELETE' });
      fetchCustomerDetails();
      refreshAppData();
    } catch (e) {
      console.error(e);
      fetchCustomerDetails();
      refreshAppData();
    }
  };

  // Direct SMS Reminder
  const handleSmsReminder = () => {
    openReminderModal(customer);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white flex flex-col justify-between pb-36 relative">
      {/* Top Bar matching Screenshot 1 */}
      <header className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-40 border-b border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1 text-slate-700 hover:text-black tap-effect">
            <ArrowLeft className="w-6 h-6" />
          </Link>

          {/* Avatar with initial or emoji */}
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-base">
            {customer.name.includes('🐰') ? '🐰' : customer.name.slice(0, 1).toUpperCase()}
          </div>

          <div>
            <h2 className="font-bold text-slate-900 text-lg leading-tight">
              {customer.name}
            </h2>
            <button
              onClick={() => openCustomerModal(customer)}
              className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-0.5"
            >
              View Profile
            </button>
          </div>
        </div>

        {/* Right Icons: Statement PDF & Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 tap-effect"
            title="Download Statement"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button
            onClick={() => router.push('/')}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 tap-effect"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Chat-like Transaction Timeline matching Screenshot 1 */}
      <main className="p-4 space-y-6 flex-1">
        {chronologicalTx.length === 0 ? (
          <div className="py-24 text-center text-xs text-slate-400">
            No entries in this ledger yet. Tap &ldquo;Received&rdquo; or &ldquo;Given&rdquo; below.
          </div>
        ) : (
          chronologicalTx.map((tx: any, idx: number) => {
            const isReceived = tx.type === 'PAYMENT';
            const dateStr = formatDate(tx.date);
            const prevTx = idx > 0 ? chronologicalTx[idx - 1] : null;
            const showDateHeader = !prevTx || formatDate(prevTx.date) !== dateStr;

            return (
              <div key={tx.id} className="space-y-2">
                {/* Centered Date Pill matching Screenshot 1 */}
                {showDateHeader && (
                  <div className="flex justify-center my-3">
                    <span className="px-3.5 py-1 bg-slate-500/80 text-white rounded-full text-xs font-semibold tracking-wide shadow-xs">
                      {dateStr}
                    </span>
                  </div>
                )}

                {/* Transaction Bubble matching Screenshot 1 */}
                <div
                  className={`flex flex-col ${
                    isReceived ? 'items-start' : 'items-end'
                  } group ${tx.isDeleted ? 'opacity-65' : ''}`}
                >
                  {/* Bubble Card */}
                  <div
                    onClick={tx.isDeleted ? undefined : () => setSelectedTxForDetail(tx)}
                    className={`border rounded-2xl p-3.5 shadow-xs max-w-[82%] transition-all ${
                      tx.isDeleted
                        ? 'bg-slate-100/90 border-slate-300 cursor-not-allowed select-none'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 cursor-pointer tap-effect'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-lg sm:text-xl font-black flex items-center gap-1 ${
                          tx.isDeleted
                            ? 'text-slate-400 line-through'
                            : isReceived
                            ? 'text-emerald-700'
                            : 'text-orange-600'
                        }`}
                      >
                        {isReceived ? (
                          <ArrowDown className={`w-5 h-5 stroke-[3px] ${tx.isDeleted ? 'text-slate-400' : ''}`} />
                        ) : (
                          <ArrowUp className={`w-5 h-5 stroke-[3px] ${tx.isDeleted ? 'text-slate-400' : ''}`} />
                        )}
                        <span className={tx.isDeleted ? 'line-through' : ''}>
                          {formatINR(tx.amountPaisa, true)}
                        </span>
                      </span>

                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        {formatTime(tx.date)}
                      </span>

                      {tx.isDeleted ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                          Cancelled
                        </span>
                      ) : (
                        <Check className="w-4 h-4 text-slate-400 stroke-[2.5px]" />
                      )}
                    </div>

                    {tx.description && (
                      <div
                        className={`text-sm font-medium mt-1 ${
                          tx.isDeleted ? 'text-slate-400 line-through' : 'text-slate-700'
                        }`}
                      >
                        {tx.description}
                      </div>
                    )}
                  </div>

                  {/* Running Due Balance under Bubble (hidden if cancelled) */}
                  {!tx.isDeleted && (
                    <div className="text-xs text-slate-500 font-semibold px-2 mt-0.5">
                      {formatINR(tx.runningBalancePaisa, true)} Due
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={timelineEndRef} />
      </main>

      {/* Sticky Bottom Action & Balance Tray matching Screenshot 1 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-50 border-t border-slate-200 z-30 shadow-lg">
        {/* Contact Icons Bar: Statement, SMS Text, Call, More */}
        <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-200/60 bg-emerald-50/40">
          <div className="flex items-center gap-4 text-slate-600">
            {/* PDF Statement */}
            <button
              onClick={handleExportCSV}
              className="p-1 hover:text-black tap-effect"
              title="Statement"
            >
              <FileText className="w-5 h-5 text-emerald-800" />
            </button>

            {/* SMS Text Message Reminder */}
            <button
              onClick={handleSmsReminder}
              className="p-1 hover:text-black tap-effect"
              title="Send SMS Text Reminder"
            >
              <MessageSquare className="w-5 h-5 text-emerald-800" />
            </button>

            {/* Phone Call */}
            <a
              href={`tel:${customer.phone}`}
              className="p-1 hover:text-black tap-effect"
              title="Call"
            >
              <Phone className="w-5 h-5 text-emerald-800" />
            </a>
          </div>

          {/* More Menu */}
          <button
            onClick={() => setDeleteConfirmCust(true)}
            className="flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-rose-600 tap-effect"
          >
            <span>More</span>
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Status Row */}
        <div className="px-5 py-2.5 flex items-center justify-between bg-white border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700">
            {isAdvance ? 'Balance Advance' : 'Net Balance'}
          </span>
          <span
            className={`text-base font-black flex items-center gap-1 ${
              customer.currentBalancePaisa === 0
                ? 'text-emerald-600'
                : isDue
                ? 'text-orange-600'
                : 'text-emerald-700'
            }`}
          >
            {customer.currentBalancePaisa === 0
              ? '₹0'
              : `${formatINR(customer.currentBalancePaisa, true)} Due`}
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </div>

        {/* Two Large Bottom Buttons: Received (Green) vs Given (Red) matching Screenshot 1 */}
        <div className="p-3 bg-white grid grid-cols-2 gap-3">
          {/* Received Button */}
          <button
            onClick={() => openTransactionModal(customer, 'PAYMENT')}
            className="py-3 px-4 bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 rounded-2xl font-bold text-base shadow-xs flex items-center justify-center gap-2 tap-effect"
          >
            <ArrowDown className="w-5 h-5 stroke-[2.5px] text-emerald-700" />
            <span>Received</span>
          </button>

          {/* Given Button */}
          <button
            onClick={() => openTransactionModal(customer, 'CREDIT')}
            className="py-3 px-4 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 rounded-2xl font-bold text-base shadow-xs flex items-center justify-center gap-2 tap-effect"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5px] text-orange-600" />
            <span>Given</span>
          </button>
        </div>
      </div>

      {/* Confirmation for Cancelling/Deleting Transaction */}
      <ConfirmationDialog
        isOpen={!!deleteConfirmTx}
        onClose={() => setDeleteConfirmTx(null)}
        onConfirm={handleDeleteTransaction}
        title="Cancel this transaction?"
        message="This entry will be struck through and greyed out, and its amount will be removed from the running balance."
        confirmText="Cancel Entry"
        isDestructive={true}
      />

      {/* Confirmation for Deleting Contact */}
      <ConfirmationDialog
        isOpen={deleteConfirmCust}
        onClose={() => setDeleteConfirmCust(false)}
        onConfirm={handleDeleteCustomer}
        title={`Delete ${customer.name}?`}
        message="This will delete this person and all their transaction history."
        confirmText="Delete Person"
        isDestructive={true}
      />

      {/* Transaction Detail Screen / Modal matching Screenshot */}
      <TransactionDetailModal
        isOpen={!!selectedTxForDetail && !selectedTxForDetail.isDeleted}
        onClose={() => setSelectedTxForDetail(null)}
        transaction={selectedTxForDetail}
        customer={customer}
        onDeleteSuccess={() => {
          setSelectedTxForDetail(null);
          fetchCustomerDetails();
          refreshAppData();
        }}
        onUpdateSuccess={(updatedTx) => {
          setSelectedTxForDetail(null);
          fetchCustomerDetails();
          refreshAppData();
        }}
      />
    </div>
  );
}
