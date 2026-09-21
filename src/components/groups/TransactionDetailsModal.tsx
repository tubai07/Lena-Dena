'use client';

import React, { useState } from 'react';
import {
  X,
  Pencil,
  Trash2,
  AlertCircle,
  ReceiptText,
  Fuel,
  Wine,
  Utensils,
  Coffee,
  ShoppingCart,
  Car,
  CheckCircle2,
  ArrowRight,
  FileText,
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner?: boolean;
  isAdmin?: boolean;
}

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  members: Member[];
  currentUserId?: string;
  isAdmin: boolean;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

const getAvatarBg = (name: string) => {
  if (name.includes('🐰')) return 'bg-pink-100 text-pink-700 border-pink-200';
  const firstChar = name.charAt(0).toUpperCase();
  if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

const getExpenseItemIcon = (category?: string, description?: string) => {
  const text = `${category || ''} ${description || ''}`.toLowerCase();
  if (text.includes('fuel') || text.includes('petrol') || text.includes('diesel') || text.includes('gas')) {
    return Fuel;
  }
  if (text.includes('drink') || text.includes('wine') || text.includes('beer') || text.includes('alcohol') || text.includes('bar')) {
    return Wine;
  }
  if (
    text.includes('food') ||
    text.includes('dinner') ||
    text.includes('lunch') ||
    text.includes('breakfast') ||
    text.includes('meal') ||
    text.includes('restaurant') ||
    text.includes('chakna')
  ) {
    return Utensils;
  }
  if (text.includes('coffee') || text.includes('cafe') || text.includes('tea')) {
    return Coffee;
  }
  if (text.includes('grocery') || text.includes('market') || text.includes('supermarket')) {
    return ShoppingCart;
  }
  if (text.includes('cab') || text.includes('taxi') || text.includes('uber') || text.includes('auto') || text.includes('transport')) {
    return Car;
  }
  return ReceiptText;
};

export function TransactionDetailsModal({
  isOpen,
  onClose,
  item,
  members,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
}: TransactionDetailsModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !item) return null;

  const isExpense = item.type === 'EXPENSE';
  const raw = item.raw || {};
  const totalAmountPaisa = item.totalAmountPaisa || raw.totalAmountPaisa || raw.amountPaisa || 0;
  const formattedAmount = (totalAmountPaisa / 100).toFixed(2);

  const rawDate = item.date ? new Date(item.date) : new Date();
  const formattedDate = rawDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const iconComponent = isExpense
    ? getExpenseItemIcon(raw.category, raw.description || item.title)
    : CheckCircle2;

  // Compute user standing for expense
  let userStanding: { text: string; color: string; bg: string; border: string } | null = null;
  if (isExpense) {
    const myPaid = (raw.payers || []).find((p: any) => p.memberId === currentUserId)?.amountPaisa || 0;
    const mySplit = (raw.splits || []).find((s: any) => s.memberId === currentUserId)?.amountPaisa || 0;
    const diff = myPaid - mySplit;

    if (myPaid === 0 && mySplit === 0) {
      userStanding = {
        text: 'You are not involved in this expense',
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
      };
    } else if (diff > 0) {
      userStanding = {
        text: `You lent ₹${(diff / 100).toFixed(2)}`,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    } else if (diff < 0) {
      userStanding = {
        text: `You borrowed ₹${(Math.abs(diff) / 100).toFixed(2)}`,
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
    } else {
      userStanding = {
        text: `You paid your exact share (₹${(myPaid / 100).toFixed(2)})`,
        color: 'text-slate-700',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
      };
    }
  } else {
    // Settlement standing
    const isPayer = raw.payerId === currentUserId;
    const isReceiver = raw.receiverId === currentUserId;
    if (isPayer) {
      userStanding = {
        text: `You paid ₹${formattedAmount}`,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    } else if (isReceiver) {
      userStanding = {
        text: `Paid to you ₹${formattedAmount}`,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    } else {
      userStanding = {
        text: 'Settlement between other group members',
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
      };
    }
  }

  // Payers resolution
  const rawPayers = raw.payers || [];
  const payerList = rawPayers.map((p: any) => {
    const mem = members.find((m) => m.id === p.memberId) || p.member;
    return {
      id: p.memberId,
      name: mem?.name || 'Member',
      amountPaisa: p.amountPaisa,
    };
  });

  // Splits resolution
  const rawSplits = raw.splits || [];
  const splitList = rawSplits.map((s: any) => {
    const mem = members.find((m) => m.id === s.memberId) || s.member;
    return {
      id: s.memberId,
      name: mem?.name || 'Member',
      amountPaisa: s.amountPaisa,
    };
  });

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete(item);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] relative">
        {/* ================= MODAL HEADER ================= */}
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>

          <h3 className="font-bold text-slate-900 text-base">
            {isExpense ? 'Expense Details' : 'Payment Details'}
          </h3>

          {/* Action icons: Edit (Pencil) and Delete (Trash), only shown for admins */}
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Edit transaction"
                  aria-label="Edit transaction"
                >
                  <Pencil className="w-4 h-4 stroke-[2]" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Delete transaction"
                  aria-label="Delete transaction"
                >
                  <Trash2 className="w-4 h-4 stroke-[2]" />
                </button>
              </>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </header>

        {/* ================= MODAL CONTENT ================= */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Top Hero Card */}
          <div className="text-center py-2 space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-800 mx-auto shadow-2xs">
              {React.createElement(iconComponent, { className: 'w-7 h-7 stroke-[1.8]' })}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {isExpense ? raw.description || item.title : item.title}
              </h2>
              <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                ₹{formattedAmount}
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                {formattedDate} {raw.category ? `• ${raw.category}` : ''}
              </p>
            </div>
          </div>

          {/* User Standing Banner */}
          {userStanding && (
            <div
              className={`p-3 rounded-2xl border text-center text-xs font-bold ${userStanding.bg} ${userStanding.color} ${userStanding.border}`}
            >
              {userStanding.text}
            </div>
          )}

          {/* Notes (if any) */}
          {raw.notes && raw.notes.trim() && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
              </div>
              <p className="text-slate-700 font-medium whitespace-pre-wrap">{raw.notes}</p>
            </div>
          )}

          {/* ================= EXPENSE DETAILS ================= */}
          {isExpense && (
            <div className="space-y-4 pt-1">
              {/* Paid By Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Paid by
                </h4>
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                  {payerList.length > 0 ? (
                    payerList.map((payer: any) => (
                      <div
                        key={payer.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarBg(
                              payer.name
                            )}`}
                          >
                            {payer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800 truncate">
                            {payer.id === currentUserId ? 'You' : payer.name}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 shrink-0">
                          ₹{(payer.amountPaisa / 100).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-slate-500">
                      {raw.payerNames || 'Unknown'} paid ₹{formattedAmount}
                    </div>
                  )}
                </div>
              </div>

              {/* Split Breakdown Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Split with ({splitList.length})
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {raw.splitType === 'EXACT' || raw.splitType === 'CUSTOM' ? 'Custom' : 'Equal'}
                  </span>
                </div>
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                  {splitList.map((split: any) => (
                    <div
                      key={split.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarBg(
                            split.name
                          )}`}
                        >
                          {split.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800 truncate">
                          {split.id === currentUserId ? 'You' : split.name}
                        </span>
                      </div>
                      <span className="font-black text-slate-900 shrink-0">
                        ₹{(split.amountPaisa / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= SETTLEMENT DETAILS ================= */}
          {!isExpense && (
            <div className="space-y-4 pt-1">
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 text-center">
                  Payment Transfer
                </h4>

                <div className="flex items-center justify-between gap-2">
                  {/* Payer */}
                  <div className="flex flex-col items-center text-center flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${getAvatarBg(
                        raw.payer?.name || item.payerNames || 'Payer'
                      )}`}
                    >
                      {(raw.payer?.name || item.payerNames || 'P').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-900 text-xs truncate mt-1.5 max-w-[90px]">
                      {raw.payerId === currentUserId ? 'You' : raw.payer?.name || item.payerNames}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">Payer</span>
                  </div>

                  {/* Transfer arrow & amount */}
                  <div className="flex flex-col items-center justify-center shrink-0 px-2">
                    <span className="text-xs font-black text-emerald-700 block mb-0.5">
                      ₹{formattedAmount}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Receiver */}
                  <div className="flex flex-col items-center text-center flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${getAvatarBg(
                        raw.receiver?.name || item.receiverName || 'Receiver'
                      )}`}
                    >
                      {(raw.receiver?.name || item.receiverName || 'R').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-900 text-xs truncate mt-1.5 max-w-[90px]">
                      {raw.receiverId === currentUserId ? 'You' : raw.receiver?.name || item.receiverName}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">Recipient</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Method</span>
                  <span className="font-bold text-slate-700 uppercase">
                    {raw.paymentMethod || 'UPI'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= DELETE CONFIRMATION MODAL OVERLAY ================= */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 text-center space-y-4 max-w-[280px] w-full animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                <AlertCircle className="w-6 h-6 stroke-[2]" />
              </div>

              <div>
                <h4 className="font-black text-slate-900 text-base">
                  {isExpense ? 'Delete Expense?' : 'Delete Payment?'}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <span className="font-bold text-slate-800">
                    &ldquo;{isExpense ? raw.description || item.title : item.title}&rdquo;
                  </span>{' '}
                  (₹{formattedAmount})? This will update group balances.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
