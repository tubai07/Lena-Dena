'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, Smartphone, X } from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { generatePaymentReceiptMessage, generateSmsLink } from '@/lib/reminders';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    customerName: string;
    phone: string;
    amountPaidPaisa: number;
    oldBalancePaisa: number;
    newBalancePaisa: number;
    paymentMethod?: string;
  } | null;
}

export function PaymentSuccessModal({ isOpen, onClose, data }: PaymentSuccessModalProps) {
  useEffect(() => {
    if (isOpen && data) {
      try {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#16a34a', '#22c55e', '#4ade80', '#0ea5e9'],
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const receiptMsg = generatePaymentReceiptMessage({
    customerName: data.customerName,
    amountPaidPaisa: data.amountPaidPaisa,
    newBalancePaisa: data.newBalancePaisa,
    paymentMethod: data.paymentMethod || 'UPI',
  });

  const handleSendSMS = () => {
    const link = generateSmsLink(data.phone, receiptMsg);
    window.location.href = link;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-6 text-center animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-8 h-8 stroke-[2.5px]" />
        </div>

        <h3 className="text-xl font-black text-slate-900">Payment Recorded!</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Ledger updated for <span className="font-bold text-slate-800">{data.customerName}</span>
        </p>

        {/* Amount */}
        <div className="my-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Amount Received
          </div>
          <div className="text-3xl font-black text-emerald-800 mt-0.5">
            {formatINR(data.amountPaidPaisa, true)}
          </div>
        </div>

        {/* Balance Progression */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-4 text-left">
          <div className="border-r border-slate-200 pr-2">
            <span className="text-[11px] font-bold text-slate-400 block">Previous</span>
            <span className="text-xs font-bold text-slate-700">
              {formatINR(data.oldBalancePaisa, true)}
            </span>
          </div>
          <div className="pl-2">
            <span className="text-[11px] font-bold text-slate-400 block">New Balance</span>
            <span className="text-xs font-black text-emerald-700">
              {data.newBalancePaisa === 0 ? '₹0 Due' : `${formatINR(data.newBalancePaisa, true)} Due`}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleSendSMS}
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Smartphone className="w-4 h-4" />
            <span>Send SMS Confirmation</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
