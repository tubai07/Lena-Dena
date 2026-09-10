'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Share2,
  Receipt,
  Scale,
  Users,
  Smartphone,
  CheckCircle2,
  Trash2,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AddExpenseModal } from '@/components/groups/AddExpenseModal';
import { SettleUpModal } from '@/components/groups/SettleUpModal';
import { generateUpiUrl, generateWhatsAppSummary } from '@/lib/splitwise';
import { useTranslation } from '@/components/common/LanguageContext';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner: boolean;
}

interface ExpensePayer {
  id: string;
  memberId: string;
  amountPaisa: number;
  member: { id: string; name: string };
}

interface ExpenseSplit {
  id: string;
  memberId: string;
  amountPaisa: number;
  shareValue?: number | null;
  member: { id: string; name: string };
}

interface Expense {
  id: string;
  description: string;
  totalAmountPaisa: number;
  category: string;
  splitType: string;
  notes?: string | null;
  date: string;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
}

interface Settlement {
  id: string;
  payerId: string;
  receiverId: string;
  amountPaisa: number;
  paymentMethod: string;
  notes?: string | null;
  date: string;
  payer: { id: string; name: string };
  receiver: { id: string; name: string; upiId?: string | null; phone?: string | null };
}

interface MemberBalance {
  memberId: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner: boolean;
  totalPaidPaisa: number;
  totalOwedPaisa: number;
  settlementsPaidPaisa: number;
  settlementsReceivedPaisa: number;
  netBalancePaisa: number;
}

interface DebtTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  toUpiId?: string | null;
  toPhone?: string | null;
  amountPaisa: number;
}

interface GroupDetail {
  id: string;
  name: string;
  category: string;
  joinCode: string;
  simplifyDebts: boolean;
  totalSpendPaisa: number;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: MemberBalance[];
  simplifiedTransfers: DebtTransfer[];
  directTransfers: DebtTransfer[];
  activeTransfers: DebtTransfer[];
}

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useTranslation();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members'>('expenses');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePreload, setSettlePreload] = useState<{
    payerId?: string;
    receiverId?: string;
    amountPaisa?: number;
  }>({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/groups/${id}`);
      if (!res.ok) throw new Error('Group not found');
      const data = await res.json();
      setGroup(data.group);
    } catch (e) {
      console.error(e);
      router.push('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleToggleSimplify = async (enabled: boolean) => {
    if (!group) return;
    try {
      await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simplifyDebts: enabled }),
      });
      fetchGroup();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense? Group balances will recalculate.')) {
      return;
    }
    try {
      const res = await fetch(`/api/groups/${id}/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      if (res.ok) fetchGroup();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    if (!confirm('Are you sure you want to delete this settlement record?')) {
      return;
    }
    try {
      const res = await fetch(`/api/groups/${id}/settlements/${settlementId}`, {
        method: 'DELETE',
      });
      if (res.ok) fetchGroup();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName.trim() }),
      });
      if (res.ok) {
        setNewMemberName('');
        fetchGroup();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAddingMember(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!group) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = generateWhatsAppSummary({
      groupName: group.name,
      joinCode: group.joinCode,
      totalSpendPaisa: group.totalSpendPaisa,
      transfers: group.simplifyDebts ? group.simplifiedTransfers : group.directTransfers,
      baseUrl: origin,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-slate-400 font-semibold">
        Loading group details...
      </div>
    );
  }

  if (!group) return null;

  const ownerMember = group.members.find((m) => m.isOwner) || group.members[0];
  const userBalance = ownerMember
    ? group.balances.find((b) => b.memberId === ownerMember.id)?.netBalancePaisa || 0
    : 0;

  const displayedTransfers = group.simplifyDebts
    ? group.simplifiedTransfers
    : group.directTransfers;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/groups"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {group.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                {group.category}
              </span>
            </div>

            {/* 5-Character Join Code Badge */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 transition-colors"
                title="Tap to copy invite code for friends"
              >
                <span>Code: {group.joinCode}</span>
                {copiedCode ? (
                  <span className="text-[10px] text-emerald-600 font-sans font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : (
                  <Copy className="w-3 h-3 opacity-60" />
                )}
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/60"
              >
                <Share2 className="w-3 h-3" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSettlePreload({});
              setIsSettleOpen(true);
            }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs sm:text-sm shadow-2xs transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settle Up</span>
          </button>

          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Group Spend
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            ₹
            {(group.totalSpendPaisa / 100).toLocaleString('en-IN', {
              maximumFractionDigits: 2,
            })}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Across {group.expenses.length} bills
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Your Standing
          </span>
          <div className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
            {userBalance > 0 ? (
              <span className="text-emerald-600">
                +₹{(userBalance / 100).toFixed(2)}{' '}
                <span className="text-xs font-bold">(You get back)</span>
              </span>
            ) : userBalance < 0 ? (
              <span className="text-rose-600">
                -₹{(Math.abs(userBalance) / 100).toFixed(2)}{' '}
                <span className="text-xs font-bold">(You owe)</span>
              </span>
            ) : (
              <span className="text-slate-600">₹0.00 (All settled)</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Strictly isolated from 1-on-1 Khata
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Members
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            {group.members.length} Friends
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Can join with code <strong>{group.joinCode}</strong>
          </span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { key: 'expenses', label: `Expenses (${group.expenses.length})`, icon: Receipt },
          { key: 'balances', label: `Balances & Settle (${displayedTransfers.length})`, icon: Scale },
          { key: 'members', label: `Members (${group.members.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          {group.expenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200/80 text-center space-y-3 shadow-xs">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-extrabold text-slate-800 text-sm">No expenses added yet</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Add a bill, dinner, or travel fare to start splitting expenses among members.
              </p>
              <button
                onClick={() => setIsAddExpenseOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Add First Expense
              </button>
            </div>
          ) : (
            group.expenses.map((exp) => {
              const payersText =
                exp.payers.length === 1
                  ? `${exp.payers[0].member.name} paid`
                  : `${exp.payers.length} members co-paid`;

              return (
                <div
                  key={exp.id}
                  className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                      ₹
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {exp.description}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {payersText} • Split among {exp.splits.length} members •{' '}
                        {new Date(exp.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      {exp.notes && (
                        <p className="text-[11px] text-slate-400 italic mt-0.5">{exp.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-base sm:text-lg">
                        ₹{(exp.totalAmountPaisa / 100).toFixed(2)}
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {exp.splitType}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: BALANCES & SETTLE UP */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          {/* Simplify Debts Toggle Box */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Simplify Debts
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  {group.simplifyDebts ? 'Min Cash Flow Solver' : 'Direct Pairwise'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {group.simplifyDebts
                  ? 'Active: Minimizes total transfers so friends pay the least number of times.'
                  : 'Active: Shows exact pairwise debts between people who shared bills directly.'}
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={group.simplifyDebts}
                onChange={(e) => handleToggleSimplify(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Pending Debt Transfers */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              Suggested Settlements ({displayedTransfers.length})
            </h3>

            {displayedTransfers.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-200/80 text-center space-y-2 shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="font-extrabold text-slate-900 text-sm">Everyone is all settled up!</h4>
                <p className="text-xs text-slate-500">There are no pending debts in this group.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayedTransfers.map((t, idx) => {
                  const numRupees = t.amountPaisa / 100;
                  const upiUrl = t.toUpiId
                    ? generateUpiUrl({
                        upiId: t.toUpiId,
                        name: t.toName,
                        amountRupees: numRupees,
                        note: `${group.name} share to ${t.toName}`,
                      })
                    : null;

                  return (
                    <div
                      key={idx}
                      className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{t.fromName}</span>
                          <span className="text-slate-400 text-xs">pays</span>
                          <span className="font-extrabold text-indigo-700 text-sm">{t.toName}</span>
                        </div>
                        <div className="font-black text-slate-900 text-lg">
                          ₹{numRupees.toFixed(2)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {upiUrl && (
                          <a
                            href={upiUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pay via UPI</span>
                          </a>
                        )}

                        <button
                          onClick={() => {
                            setSettlePreload({
                              payerId: t.fromId,
                              receiverId: t.toId,
                              amountPaisa: t.amountPaisa,
                            });
                            setIsSettleOpen(true);
                          }}
                          className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Record Settle</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical Settlements */}
          {group.settlements.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                Settlement History ({group.settlements.length})
              </h3>
              <div className="space-y-2">
                {group.settlements.map((st) => (
                  <div
                    key={st.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-800">
                        {st.payer.name} paid {st.receiver.name}
                      </span>
                      <span className="text-slate-400">
                        via {st.paymentMethod} •{' '}
                        {new Date(st.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-slate-900">
                        ₹{(st.amountPaisa / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteSettlement(st.id)}
                        className="text-slate-300 hover:text-rose-600"
                        title="Delete settlement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Add member form */}
          <form
            onSubmit={handleAddMember}
            className="bg-white p-4 rounded-2xl border border-slate-200/80 flex gap-2 shadow-xs"
          >
            <input
              type="text"
              placeholder="Add another friend (e.g. Amit)..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50"
            />
            <button
              type="submit"
              disabled={addingMember || !newMemberName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
            >
              {addingMember ? 'Adding...' : 'Add Friend'}
            </button>
          </form>

          {/* Members Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {group.balances.map((b) => (
                <div
                  key={b.memberId}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-sm">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{b.name}</span>
                        {b.isOwner && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            Creator
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Paid ₹{(b.totalPaidPaisa / 100).toFixed(2)} • Consumed ₹
                        {(b.totalOwedPaisa / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {b.netBalancePaisa > 0 ? (
                      <div className="text-sm font-black text-emerald-600">
                        +₹{(b.netBalancePaisa / 100).toFixed(2)}
                        <span className="text-[10px] font-bold text-emerald-700 block">
                          Gets back
                        </span>
                      </div>
                    ) : b.netBalancePaisa < 0 ? (
                      <div className="text-sm font-black text-rose-600">
                        -₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(2)}
                        <span className="text-[10px] font-bold text-rose-700 block">Owes</span>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-400">Settled (₹0)</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        groupId={group.id}
        members={group.members}
        onExpenseAdded={fetchGroup}
      />

      <SettleUpModal
        isOpen={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        groupId={group.id}
        members={group.members}
        onSettled={fetchGroup}
        initialPayerId={settlePreload.payerId}
        initialReceiverId={settlePreload.receiverId}
        initialAmountPaisa={settlePreload.amountPaisa}
      />
    </div>
  );
}
