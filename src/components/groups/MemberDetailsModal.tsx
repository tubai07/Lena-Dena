'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Wallet,
  ReceiptText,
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Sparkles,
} from 'lucide-react';
import { generateUpiUrl } from '@/lib/splitwise';

export interface MemberBalanceDetail {
  memberId: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner: boolean;
  isAdmin?: boolean;
  totalPaidPaisa: number;
  totalOwedPaisa: number;
  settlementsPaidPaisa: number;
  settlementsReceivedPaisa: number;
  netBalancePaisa: number;
}

export interface DebtTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  toUpiId?: string | null;
  toPhone?: string | null;
  amountPaisa: number;
}

interface MemberDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberBalanceDetail | null;
  groupName?: string;
  transfers?: DebtTransfer[];
  currentMemberId?: string;
  isCurrentUserAdmin: boolean;
  isCurrentUserCreator: boolean;
  onToggleAdmin: (memberId: string, currentIsAdmin: boolean) => Promise<void> | void;
  onRemoveMember: (memberId: string) => Promise<void> | void;
  onSettleUp?: (preload: { payerId?: string; receiverId?: string; amountPaisa?: number }) => void;
}

const getAvatarBg = (name: string) => {
  if (name.includes('🐰')) return 'bg-pink-100 text-pink-700 border-pink-200';
  const firstChar = name.charAt(0).toUpperCase();
  if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

export function MemberDetailsModal({
  isOpen,
  onClose,
  member,
  groupName = 'Group',
  transfers = [],
  currentMemberId,
  isCurrentUserAdmin,
  isCurrentUserCreator,
  onToggleAdmin,
  onRemoveMember,
  onSettleUp,
}: MemberDetailsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingAdmin, setIsTogglingAdmin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !member) return null;

  const isSelf = currentMemberId === member.memberId;
  const isOwner = member.isOwner;
  const isAdmin = Boolean(member.isAdmin || member.isOwner);

  // Filter transfers involving this member
  const memberTransfersOwed = transfers.filter((t) => t.fromId === member.memberId);
  const memberTransfersReceiving = transfers.filter((t) => t.toId === member.memberId);

  // Check direct debt between current user and this member
  const iOweThisMember = transfers.find(
    (t) => t.fromId === currentMemberId && t.toId === member.memberId
  );
  const thisMemberOwesMe = transfers.find(
    (t) => t.fromId === member.memberId && t.toId === currentMemberId
  );

  const handleAdminClick = async () => {
    try {
      setIsTogglingAdmin(true);
      await onToggleAdmin(member.memberId, Boolean(member.isAdmin));
    } finally {
      setIsTogglingAdmin(false);
    }
  };

  const handleDeleteClick = async () => {
    try {
      setIsDeleting(true);
      await onRemoveMember(member.memberId);
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const netBalance = member.netBalancePaisa;
  const isSettled = netBalance === 0;
  const getsBack = netBalance > 0;
  const owes = netBalance < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 text-base">Member Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-75px)]">
          {/* Member Profile Card */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div
              className={`w-14 h-14 rounded-2xl font-black text-xl flex items-center justify-center border shadow-xs shrink-0 ${getAvatarBg(
                member.name
              )}`}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 truncate">
                  {member.name}
                </h2>
                {isSelf && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 rounded-full">
                    You
                  </span>
                )}
                {isOwner ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Creator & Admin
                  </span>
                ) : member.isAdmin ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-full inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                ) : null}
              </div>

              {member.phone ? (
                <a
                  href={`tel:${member.phone}`}
                  className="text-xs text-slate-600 font-medium inline-flex items-center gap-1.5 mt-1 hover:text-emerald-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>+91 {member.phone}</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400 font-medium block mt-1">
                  No phone number provided
                </span>
              )}
            </div>
          </div>

          {/* Net Standing Hero Card */}
          <div
            className={`p-4 rounded-2xl border text-center space-y-1 ${
              getsBack
                ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                : owes
                ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider block opacity-75">
              Net Balance in {groupName}
            </span>
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                getsBack
                  ? 'text-emerald-600'
                  : owes
                  ? 'text-amber-600'
                  : 'text-slate-600'
              }`}
            >
              {getsBack
                ? `+₹${(netBalance / 100).toFixed(2)}`
                : owes
                ? `-₹${(Math.abs(netBalance) / 100).toFixed(2)}`
                : '₹0.00'}
            </div>
            <p className="text-xs font-semibold opacity-85">
              {getsBack
                ? `${member.name} gets back overall in this group`
                : owes
                ? `${member.name} owes money overall in this group`
                : 'All dues settled up — no pending balance'}
            </p>
          </div>

          {/* Direct Settle Up Shortcut (If applicable) */}
          {!isSelf && onSettleUp && (iOweThisMember || thisMemberOwesMe) && (
            <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  {iOweThisMember
                    ? `You owe ${member.name}`
                    : `${member.name} owes you`}
                </span>
                <span
                  className={`font-black text-sm ${
                    iOweThisMember ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  ₹
                  {(
                    (iOweThisMember
                      ? iOweThisMember.amountPaisa
                      : thisMemberOwesMe?.amountPaisa || 0) / 100
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {iOweThisMember && member.upiId && (
                  <a
                    href={generateUpiUrl({
                      upiId: member.upiId,
                      name: member.name,
                      amountRupees: iOweThisMember.amountPaisa / 100,
                      note: `${groupName} settlement to ${member.name}`,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pay UPI</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (iOweThisMember) {
                      onSettleUp({
                        payerId: currentMemberId,
                        receiverId: member.memberId,
                        amountPaisa: iOweThisMember.amountPaisa,
                      });
                    } else if (thisMemberOwesMe) {
                      onSettleUp({
                        payerId: member.memberId,
                        receiverId: currentMemberId,
                        amountPaisa: thisMemberOwesMe.amountPaisa,
                      });
                    }
                  }}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark as paid</span>
                </button>
              </div>
            </div>
          )}

          {/* Spend & Split Financial Metrics Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
              Financial Breakdown
            </h4>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Total Paid */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Total Spent</span>
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  ₹{(member.totalPaidPaisa / 100).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Paid for group bills
                </span>
              </div>

              {/* Total Share */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <Scale className="w-3.5 h-3.5 text-amber-600" />
                  <span>Total Share</span>
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  ₹{(member.totalOwedPaisa / 100).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Consumed in splits
                </span>
              </div>

              {/* Settlements Paid Out */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>Settled Paid</span>
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  ₹{(member.settlementsPaidPaisa / 100).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Transferred to others
                </span>
              </div>

              {/* Settlements Received */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Settled Received</span>
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  ₹{(member.settlementsReceivedPaisa / 100).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Received from others
                </span>
              </div>
            </div>
          </div>

          {/* Pairwise Debt Transfers (Who owes who) */}
          {(memberTransfersOwed.length > 0 || memberTransfersReceiving.length > 0) && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                Active Debts
              </h4>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                {memberTransfersOwed.map((t, idx) => (
                  <div
                    key={`owed_${idx}`}
                    className="p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900">{member.name}</span>
                      <span className="text-slate-400">owes</span>
                      <span className="font-bold text-emerald-700 truncate">{t.toName}</span>
                    </div>
                    <span className="font-black text-amber-600 text-sm shrink-0">
                      ₹{(t.amountPaisa / 100).toFixed(2)}
                    </span>
                  </div>
                ))}

                {memberTransfersReceiving.map((t, idx) => (
                  <div
                    key={`recv_${idx}`}
                    className="p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900">{t.fromName}</span>
                      <span className="text-slate-400">owes</span>
                      <span className="font-bold text-emerald-700 truncate">{member.name}</span>
                    </div>
                    <span className="font-black text-emerald-600 text-sm shrink-0">
                      ₹{(t.amountPaisa / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin & Member Management Controls */}
          {(isCurrentUserAdmin || isCurrentUserCreator) && !isOwner && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
                Admin Controls
              </h4>

              {/* Toggle Admin Button */}
              {isCurrentUserCreator && (
                <button
                  type="button"
                  disabled={isTogglingAdmin}
                  onClick={handleAdminClick}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                    member.isAdmin
                      ? 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100'
                      : 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isTogglingAdmin
                      ? 'Updating...'
                      : member.isAdmin
                      ? 'Revoke Admin Privileges'
                      : 'Promote to Group Admin'}
                  </span>
                </button>
              )}

              {/* Remove Member Section with Strict Zero-Balance Constraint */}
              {isSettled ? (
                showDeleteConfirm ? (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5 animate-in fade-in">
                    <div className="flex items-start gap-2 text-rose-800 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        Are you sure you want to remove <strong>{member.name}</strong> from the group? All past transaction history will be safely preserved.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={handleDeleteClick}
                        className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeleting ? 'Removing...' : 'Confirm Remove'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2.5 px-4 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Remove from Group</span>
                  </button>
                )
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Cannot remove {member.name} because they have an unsettled balance of ₹
                    {(Math.abs(member.netBalancePaisa) / 100).toFixed(2)}. Settle dues first.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
