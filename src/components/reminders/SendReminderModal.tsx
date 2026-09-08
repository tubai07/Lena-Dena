'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Copy, Check, Smartphone, QrCode } from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { generateReminderMessage, generateSmsLink } from '@/lib/reminders';
import { useApp } from '@/components/common/AppContext';

interface SendReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    name: string;
    phone: string;
    currentBalancePaisa: number;
  } | null;
  onReminderLogged?: () => void;
}

export function SendReminderModal({
  isOpen,
  onClose,
  customer,
  onReminderLogged,
}: SendReminderModalProps) {
  const { business } = useApp();
  const [upiAddress, setUpiAddress] = useState(business?.upiId || '');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      const activeUpi = (business?.upiId || '').trim();
      setUpiAddress(activeUpi);

      // If business?.upiId isn't loaded in memory yet, fetch the profile immediately
      if (!activeUpi) {
        fetch('/api/settings')
          .then((res) => res.json())
          .then((data) => {
            const fetchedUpi = (data?.business?.upiId || '').trim();
            if (fetchedUpi) {
              setUpiAddress(fetchedUpi);
              setMessage(
                generateReminderMessage({
                  customerName: customer.name,
                  amountPaisa: customer.currentBalancePaisa,
                  upiId: fetchedUpi,
                })
              );
            }
          })
          .catch(() => {});
      }

      const generated = generateReminderMessage({
        customerName: customer.name,
        amountPaisa: customer.currentBalancePaisa,
        upiId: activeUpi,
      });
      setMessage(generated);
      setCopied(false);
    }
  }, [customer, isOpen, business?.upiId]);

  if (!isOpen || !customer) return null;

  const handleUpiChange = (newUpi: string) => {
    setUpiAddress(newUpi);
    const updated = generateReminderMessage({
      customerName: customer.name,
      amountPaisa: customer.currentBalancePaisa,
      upiId: newUpi.trim(),
    });
    setMessage(updated);
  };

  const handleSendSMS = async () => {
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          channel: 'SMS',
          message,
        }),
      });
      if (onReminderLogged) onReminderLogged();
    } catch (e) {
      console.error(e);
    }

    const link = generateSmsLink(customer.phone, message);
    window.location.href = link;
    onClose();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 pt-8 sm:pt-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Send Payment Reminder</h3>
            <p className="text-xs text-slate-500">
              For <span className="font-semibold text-slate-800">{customer.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 tap-effect"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {/* Pending Due Callout */}
          <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wider block">
                Pending Due
              </span>
              <span className="text-xl font-black text-orange-950">
                {formatINR(customer.currentBalancePaisa, true)}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              {customer.phone || 'No phone'}
            </span>
          </div>

          {/* UPI Address field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              UPI Address
            </label>
            <div className="relative">
              <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={upiAddress}
                onChange={(e) => handleUpiChange(e.target.value)}
                placeholder="e.g. 9830012345@upi"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              SMS Message (Editable)
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-emerald-600 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSendSMS}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 tap-effect"
            >
              <Smartphone className="w-4 h-4" />
              <span>Send SMS Text Message</span>
            </button>

            <button
              onClick={handleCopy}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 tap-effect"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Message Copied!' : 'Copy Text'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
