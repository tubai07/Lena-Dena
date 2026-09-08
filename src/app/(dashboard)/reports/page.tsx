'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { FinancialCharts } from '@/components/reports/FinancialCharts';
import { useTranslation } from '@/components/common/LanguageContext';

export default function ReportsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // today, week, month, year

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?range=${timeRange}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [timeRange]);

  const summary = data?.summary || {
    totalReceivablePaisa: 0,
    totalPayablePaisa: 0,
    collectedThisMonthPaisa: 0,
    pendingPaymentsPaisa: 0,
    totalCustomers: 0,
    activePendingCustomersCount: 0,
  };

  const chartData = data?.chartData || [];
  const topDebtors = data?.outstandingCustomers || [];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Debtor Customer', 'Phone', 'Outstanding Amount (INR)', 'Days Overdue'];
    const rows = topDebtors.map((c: any) => [
      `"${c.name}"`,
      c.phone,
      (c.currentBalancePaisa / 100).toFixed(2),
      c.daysOverdue,
    ]);

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = 'Outstanding_Customers_Report.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">{t.reports}</h2>
          <p className="text-xs text-slate-500">
            Cashflow analytics, collection trends & debtors breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Filter */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/60">
            {['today', 'week', 'month', 'year'].map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 text-xs font-bold capitalize rounded-lg transition-all ${
                  timeRange === r ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'This Year'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Highlights Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Outstanding */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Outstanding
            </span>
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5px]" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {formatINR(summary.totalReceivablePaisa, true)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium block mt-1">
            From {summary.activePendingCustomersCount} customers
          </span>
        </div>

        {/* Collected This Month */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Collections
            </span>
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5px]" />
            </span>
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">
            {formatINR(summary.collectedThisMonthPaisa, true)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium block mt-1">
            Settled via Cash & UPI
          </span>
        </div>

        {/* Total Payable */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Advance / Payable
            </span>
            <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 stroke-[2.5px]" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            {formatINR(summary.totalPayablePaisa, true)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium block mt-1">
            Advance customer balance
          </span>
        </div>

        {/* Total Customers */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Accounts
            </span>
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-2">
            {summary.totalCustomers}
          </div>
          <span className="text-[11px] text-slate-400 font-medium block mt-1">
            Registered customer books
          </span>
        </div>
      </div>

      {/* Visual Bar Chart */}
      <FinancialCharts data={chartData} />

      {/* Top Debtors Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Top Customers by Outstanding Amount</h3>
            <p className="text-xs text-slate-500">Highest pending credit balances requiring collection</p>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {topDebtors.length} Customers
          </span>
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          {topDebtors.map((c: any, index: number) => (
            <div
              key={c.id}
              className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 p-2 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-black text-slate-400">
                  #{index + 1}
                </span>
                <Link
                  href={`/customers/${c.id}`}
                  className="font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors"
                >
                  {c.name}
                </Link>
                <span className="text-xs text-slate-400">({c.phone})</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-medium">
                  {c.daysOverdue} days overdue
                </span>
                <div className="text-right font-black text-emerald-700 text-base">
                  {formatINR(c.currentBalancePaisa, true)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
