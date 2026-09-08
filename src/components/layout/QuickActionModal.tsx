'use client';

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, UserPlus, X } from 'lucide-react';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: 'CREDIT' | 'PAYMENT' | 'CUSTOMER') => void;
}

export function QuickActionModal({ isOpen, onClose, onSelectAction }: QuickActionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
            <p className="text-xs text-slate-500">Record a khata entry or add a customer</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-4 space-y-3">
          {/* Receive Payment Button */}
          <button
            onClick={() => {
              onClose();
              onSelectAction('PAYMENT');
            }}
            className="w-full flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl transition-all group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                <ArrowDownLeft className="w-6 h-6 stroke-[2.5px]" />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900 group-hover:text-emerald-800 text-base">
                  You Received Payment
                </div>
                <div className="text-xs text-emerald-700 font-medium">
                  Customer paid you money (Jama)
                </div>
              </div>
            </div>
            <span className="text-emerald-700 font-bold text-sm bg-white/80 px-3 py-1 rounded-full border border-emerald-200">
              ₹ Receive
            </span>
          </button>

          {/* Give Credit Button */}
          <button
            onClick={() => {
              onClose();
              onSelectAction('CREDIT');
            }}
            className="w-full flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-2xl transition-all group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30">
                <ArrowUpRight className="w-6 h-6 stroke-[2.5px]" />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900 group-hover:text-rose-800 text-base">
                  You Gave Credit
                </div>
                <div className="text-xs text-rose-700 font-medium">
                  Customer owes you money (Udhar)
                </div>
              </div>
            </div>
            <span className="text-rose-700 font-bold text-sm bg-white/80 px-3 py-1 rounded-full border border-rose-200">
              + Credit
            </span>
          </button>

          {/* Add Customer Button */}
          <button
            onClick={() => {
              onClose();
              onSelectAction('CUSTOMER');
            }}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900 group-hover:text-blue-700 text-base">
                  Add New Customer
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Create a new customer khata book
                </div>
              </div>
            </div>
            <span className="text-blue-700 font-bold text-sm bg-white px-3 py-1 rounded-full border border-blue-200">
              + Add
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
