'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Check,
  Calendar,
  Trash2,
  Edit2,
  Plus,
} from 'lucide-react';
import { formatINR } from '@/lib/ledger';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  customer: any;
  onDeleteSuccess: () => void;
  onUpdateSuccess?: (updatedTx: any) => void;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  customer,
  onDeleteSuccess,
  onUpdateSuccess,
}: TransactionDetailModalProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(transaction?.description || '');
  const [savingNote, setSavingNote] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInputStr, setAmountInputStr] = useState('');
  const [savingAmount, setSavingAmount] = useState(false);

  if (!isOpen || !transaction || !customer || transaction.isDeleted) return null;

  const isPayment = transaction.type === 'PAYMENT';

  const formatDateTime = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    );
  };

  const handleDelete = async () => {
    if (transaction.isDeleted) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/transactions?id=${transaction.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeleteSuccess();
        setDeleteConfirm(false);
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveAmount = async () => {
    if (transaction.isDeleted) return;
    const num = parseFloat(amountInputStr);
    if (isNaN(num) || num <= 0) return;
    try {
      setSavingAmount(true);
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          amount: num,
        }),
      });
      const data = await res.json();
      if (res.ok && data.transaction) {
        if (onUpdateSuccess) onUpdateSuccess(data.transaction);
        setEditingAmount(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAmount(false);
    }
  };

  const handleSaveNote = async () => {
    if (transaction.isDeleted) return;
    try {
      setSavingNote(true);
      const res = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          description: noteText.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.transaction) {
        if (onUpdateSuccess) onUpdateSuccess(data.transaction);
        setEditingNote(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNote(false);
    }
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
        {/* Header matching Uploaded Screenshot */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-700 hover:text-black rounded-full hover:bg-slate-100 tap-effect"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-sm">
              {customer.name.includes('🐰') ? '🐰' : customer.name.slice(0, 1).toUpperCase()}
            </div>

            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">
                {customer.name}
              </h2>
              <div className="text-xs font-semibold text-rose-600">
                {formatINR(customer.currentBalancePaisa, true)} Due
              </div>
            </div>
          </div>

          <div className="w-6" />
        </div>

        {/* Content Body matching Uploaded Screenshot */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Big Amount with Color & Pencil Icon */}
          <div className="py-6 text-center">
            {editingAmount ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-3xl font-black text-slate-900">₹</span>
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    value={amountInputStr}
                    onChange={(e) => setAmountInputStr(e.target.value)}
                    className="w-36 text-3xl font-black text-slate-900 border-b-2 border-emerald-600 bg-transparent text-center outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => setEditingAmount(false)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAmount}
                    disabled={savingAmount}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                  >
                    {savingAmount ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="inline-flex items-center justify-center gap-2">
                <span
                  className={`text-4xl sm:text-5xl font-black ${
                    transaction.isDeleted
                      ? 'text-slate-400 line-through'
                      : isPayment
                      ? 'text-emerald-700'
                      : 'text-orange-600'
                  }`}
                >
                  {formatINR(transaction.amountPaisa, true)}
                </span>
                {!transaction.isDeleted && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountInputStr((transaction.amountPaisa / 100).toString());
                      setEditingAmount(true);
                    }}
                    className="p-1 hover:opacity-80 tap-effect"
                    title="Edit amount"
                  >
                    <Edit2
                      className={`w-6 h-6 stroke-[2.5px] ${
                        isPayment ? 'text-emerald-700' : 'text-orange-600'
                      }`}
                    />
                  </button>
                )}
              </div>
            )}
            <span className="block text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
              {transaction.isDeleted
                ? 'Cancelled Entry (Excluded from balance)'
                : isPayment
                ? 'Payment Received (Jama)'
                : 'Credit Given (Udhar)'}
            </span>
          </div>

          {/* Add Note Card matching Screenshot */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs font-semibold text-slate-700">
            {editingNote ? (
              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter note description..."
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-emerald-600"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingNote(false)}
                    className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs font-bold"
                  >
                    {savingNote ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setNoteText(transaction.description || '');
                  setEditingNote(true);
                }}
                className="flex items-center justify-between cursor-pointer tap-effect"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-800" />
                  <span className={transaction.description ? 'text-slate-900 font-bold' : ''}>
                    {transaction.description ? transaction.description : 'Add Note'}
                  </span>
                </div>
                <Plus className="w-4 h-4 text-emerald-700" />
              </div>
            )}
          </div>

          {/* Status & Sync Card Group matching Screenshot */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl divide-y divide-slate-200/70 overflow-hidden">
            {/* Sync Successful */}
            <div className="p-3.5 flex items-center gap-3 text-xs font-semibold text-slate-700">
              <Check className="w-5 h-5 text-emerald-600 stroke-[3px]" />
              <span>Sync Successful</span>
            </div>

            {/* Added on Date Time */}
            <div className="p-3.5 flex items-center gap-3 text-xs font-semibold text-slate-700">
              <Calendar className="w-5 h-5 text-emerald-800" />
              <span>Added on {formatDateTime(transaction.createdAt || transaction.date)}</span>
            </div>
          </div>

          {/* Delete / Cancel Entry Card */}
          {transaction.isDeleted ? (
            <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-center gap-2 text-xs font-bold text-rose-700">
              <span>This entry was cancelled (struck through in ledger)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="w-full bg-slate-50 border border-slate-200/80 hover:bg-rose-50 hover:border-rose-200 rounded-2xl p-3.5 flex items-center gap-3 text-xs font-bold text-rose-600 tap-effect transition-colors cursor-pointer"
            >
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Cancel Entry (Strike through)</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete / Cancel Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Cancel this transaction?"
        message="This entry will be struck through and greyed out in the ledger, and its amount will be removed from customer balances."
        confirmText="Cancel Entry"
        loading={deleting}
        isDestructive={true}
      />
    </div>
  );
}
