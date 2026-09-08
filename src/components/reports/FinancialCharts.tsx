'use client';

import React from 'react';
import { formatINRShort, formatINR } from '@/lib/ledger';

interface ChartPoint {
  month: string;
  credit: number;
  payment: number;
}

interface FinancialChartsProps {
  data: ChartPoint[];
}

export function FinancialCharts({ data }: FinancialChartsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        No transaction history available for the chart yet.
      </div>
    );
  }

  // Calculate highest value for relative scaling
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.credit, d.payment, 1000))
  );

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Collections vs Credit Given</h3>
          <p className="text-xs text-slate-500">Monthly breakdown of cashflow</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500" />
            <span className="text-slate-600">Collected (Jama)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500" />
            <span className="text-slate-600">Credit Given (Udhar)</span>
          </div>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="h-60 flex items-end justify-between gap-3 sm:gap-6 pt-6 border-b border-slate-100">
        {data.map((item, idx) => {
          const paymentHeight = Math.max(4, Math.round((item.payment / maxVal) * 100));
          const creditHeight = Math.max(4, Math.round((item.credit / maxVal) * 100));

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
              <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                {/* Collected Bar */}
                <div
                  style={{ height: `${paymentHeight}%` }}
                  className="w-full max-w-[18px] sm:max-w-[28px] bg-emerald-500 group-hover:bg-emerald-600 rounded-t-lg transition-all duration-300 relative"
                >
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20">
                    {formatINR(item.payment)}
                  </div>
                </div>

                {/* Credit Bar */}
                <div
                  style={{ height: `${creditHeight}%` }}
                  className="w-full max-w-[18px] sm:max-w-[28px] bg-rose-500 group-hover:bg-rose-600 rounded-t-lg transition-all duration-300 relative"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20">
                    {formatINR(item.credit)}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-500 mt-2 block">
                {item.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
