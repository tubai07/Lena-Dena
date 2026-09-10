'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Receipt,
  Scale,
  Users,
  Smartphone,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { AddExpenseModal } from '@/components/groups/AddExpenseModal';
import { SettleUpModal } from '@/components/groups/SettleUpModal';
import {
  generateUpiUrl,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';
import { getCachedItem, setCachedItem } from '@/lib/groupCache';

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

  // Instant render from cache (0ms)
  const [group, setGroup] = useState<GroupDetail | null>(() => {
    return getCachedItem<GroupDetail>(`group_${id}`);
  });
  const [loading, setLoading] = useState(() => {
    return !getCachedItem<GroupDetail>(`group_${id}`);
  });

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

  const fetchGroup = async (isBackground = false) => {
    try {
      if (!isBackground && !group) setLoading(true);
      const res = await fetch(`/api/groups/${id}`);
      if (!res.ok) throw new Error('Group not found');
      const data = await res.json();
      setGroup(data.group);
      setCachedItem(`group_${id}`, data.group);
    } catch (e) {
      console.error(e);
      if (!group) router.push('/groups');
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

  // Instant optimistic simplify toggle
  const handleToggleSimplify = async (enabled: boolean) => {
    if (!group) return;
    const updated = {
      ...group,
      simplifyDebts: enabled,
      activeTransfers: enabled ? group.simplifiedTransfers : group.directTransfers,
    };
    setGroup(updated);
    setCachedItem(`group_${id}`, updated);

    try {
      await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simplifyDebts: enabled }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Instant optimistic expense addition
  const handleExpenseAdded = (newExpense?: any) => {
    if (newExpense && group) {
      const filtered = group.expenses.filter(
        (e) => e.id !== newExpense.id && (!e.id.startsWith('temp_') || newExpense.id.startsWith('temp_'))
      );
      const updatedExpenses = [newExpense, ...filtered];
      const balances = calculateMemberNetBalances(group.members, updatedExpenses, group.settlements);
      const simplifiedTransfers = simplifyDebts(balances);
      const directTransfers = calculateDirectPairwiseDebts(group.members, updatedExpenses, group.settlements);
      const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

      const updated = {
        ...group,
        expenses: updatedExpenses,
        totalSpendPaisa,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      };
      setGroup(updated);
      setCachedItem(`group_${id}`, updated);
    }
    fetchGroup(true);
  };

  // Instant optimistic settlement addition
  const handleSettled = (newSettlement?: any) => {
    if (newSettlement && group) {
      const filtered = group.settlements.filter(
        (s) => s.id !== newSettlement.id && (!s.id.startsWith('temp_') || newSettlement.id.startsWith('temp_'))
      );
      const updatedSettlements = [newSettlement, ...filtered];
      const balances = calculateMemberNetBalances(group.members, group.expenses, updatedSettlements);
      const simplifiedTransfers = simplifyDebts(balances);
      const directTransfers = calculateDirectPairwiseDebts(group.members, group.expenses, updatedSettlements);

      const updated = {
        ...group,
        settlements: updatedSettlements,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      };
      setGroup(updated);
      setCachedItem(`group_${id}`, updated);
    }
    fetchGroup(true);
  };

  // Instant optimistic expense deletion
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Delete this expense? Group balances will recalculate.')) return;
    if (group) {
      const updatedExpenses = group.expenses.filter((e) => e.id !== expenseId);
      const balances = calculateMemberNetBalances(group.members, updatedExpenses, group.settlements);
      const simplifiedTransfers = simplifyDebts(balances);
      const directTransfers = calculateDirectPairwiseDebts(group.members, updatedExpenses, group.settlements);
      const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

      const updated = {
        ...group,
        expenses: updatedExpenses,
        totalSpendPaisa,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      };
      setGroup(updated);
      setCachedItem(`group_${id}`, updated);
    }
    try {
      await fetch(`/api/groups/${id}/expenses/${expenseId}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
      fetchGroup(true);
    }
  };

  // Instant optimistic settlement deletion
  const handleDeleteSettlement = async (settlementId: string) => {
    if (!confirm('Delete this settlement record?')) return;
    if (group) {
      const updatedSettlements = group.settlements.filter((s) => s.id !== settlementId);
      const balances = calculateMemberNetBalances(group.members, group.expenses, updatedSettlements);
      const simplifiedTransfers = simplifyDebts(balances);
      const directTransfers = calculateDirectPairwiseDebts(group.members, group.expenses, updatedSettlements);

      const updated = {
        ...group,
        settlements: updatedSettlements,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      };
      setGroup(updated);
      setCachedItem(`group_${id}`, updated);
    }
    try {
      await fetch(`/api/groups/${id}/settlements/${settlementId}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
      fetchGroup(true);
    }
  };

  // Instant optimistic member addition
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    if (!cleanName || !group) return;
    setNewMemberName('');

    const optimisticMember: Member = {
      id: `temp_m_${Date.now()}`,
      name: cleanName,
      isOwner: false,
      phone: null,
      upiId: null,
    };
    const updatedMembers = [...group.members, optimisticMember];
    const balances = calculateMemberNetBalances(updatedMembers, group.expenses, group.settlements);
    const updated = {
      ...group,
      members: updatedMembers,
      balances,
    };
    setGroup(updated);
    setCachedItem(`group_${id}`, updated);

    setAddingMember(true);
    try {
      await fetch(`/api/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      fetchGroup(true);
    } catch (e) {
      console.error(e);
      fetchGroup(true);
    } finally {
      setAddingMember(false);
    }
  };

  if (loading && !group) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-2xl w-3/4"></div>
        <div className="h-28 bg-slate-100 rounded-3xl"></div>
        <div className="h-40 bg-slate-100 rounded-3xl"></div>
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
    <div className="w-full pb-28">
      {/* Top Header */}
      <header className="px-3.5 py-3 sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/groups"
              className="p-1.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 tracking-tight truncate">
                {group.name}
              </h1>

              {/* Join Code Chip */}
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-[11px] font-mono font-extrabold text-amber-800 hover:text-amber-900 transition-colors cursor-pointer"
                title="Tap to copy code"
              >
                <span>Code: {group.joinCode}</span>
                {copiedCode ? (
                  <span className="text-[10px] text-emerald-600 font-sans font-bold flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Copied
                  </span>
                ) : (
                  <Copy className="w-2.5 h-2.5 opacity-60" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setSettlePreload({});
                setIsSettleOpen(true);
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Settle</span>
            </button>

            <button
              onClick={() => setIsAddExpenseOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 pt-3 space-y-3">
        {/* Single Unified Summary Card */}
        <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            {/* Left: Your Standing */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Your Standing
              </span>
              <div
                className={`text-2xl font-black tracking-tight mt-0.5 ${
                  userBalance > 0
                    ? 'text-emerald-600'
                    : userBalance < 0
                    ? 'text-rose-600'
                    : 'text-slate-700'
                }`}
              >
                {userBalance > 0
                  ? `+₹${(userBalance / 100).toFixed(2)}`
                  : userBalance < 0
                  ? `-₹${(Math.abs(userBalance) / 100).toFixed(2)}`
                  : '₹0.00'}
              </div>
              <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                {userBalance > 0
                  ? 'You get back'
                  : userBalance < 0
                  ? 'You owe friends'
                  : 'All settled'}
              </span>
            </div>

            {/* Right: Group Total */}
            <div className="text-right border-l border-slate-200/80 pl-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Spend
              </span>
              <div className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                ₹{(group.totalSpendPaisa / 100).toFixed(0)}
              </div>
              <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
                {group.members.length} members
              </span>
            </div>
          </div>
        </div>

        {/* Clean Tabs */}
        <div className="flex border-b border-slate-200 gap-4 pt-1">
          {[
            { key: 'expenses', label: `Expenses (${group.expenses.length})`, icon: Receipt },
            { key: 'balances', label: `Balances (${displayedTransfers.length})`, icon: Scale },
            { key: 'members', label: `Members (${group.members.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: EXPENSES LIST */}
        {activeTab === 'expenses' && (
          <div className="space-y-2 pt-1">
            {group.expenses.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2 shadow-2xs">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="font-extrabold text-slate-800 text-xs">No expenses yet</h4>
                <p className="text-[11px] text-slate-400">
                  Tap '+ Bill' above to add dinner, hotel, or groceries.
                </p>
              </div>
            ) : (
              group.expenses.map((exp) => {
                const totalRupees = exp.totalAmountPaisa / 100;
                const payerNames = exp.payers.map((p) => p.member.name).join(', ');
                const expDate = new Date(exp.date).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={exp.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                        ₹
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-900 text-sm truncate">
                          {exp.description}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          Paid by <span className="font-semibold text-slate-600">{payerNames}</span> •{' '}
                          {expDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="font-black text-slate-900 text-sm block">
                          ₹{totalRupees.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium capitalize">
                          {exp.splitType.toLowerCase()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          <div className="space-y-3 pt-1">
            {/* Simplify Debts Toggle */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Simplify Debts</span>
                <span className="text-[10px] text-slate-400 block">
                  {group.simplifyDebts ? 'Minimizes total payments' : 'Exact pairwise debts'}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={group.simplifyDebts}
                  onChange={(e) => handleToggleSimplify(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Suggested Transfers */}
            {displayedTransfers.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 text-center space-y-1.5 shadow-2xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="font-extrabold text-slate-900 text-xs">All settled up!</h4>
                <p className="text-[11px] text-slate-400">Zero pending dues in this group.</p>
              </div>
            ) : (
              <div className="space-y-2">
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
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <span className="font-extrabold text-slate-900">{t.fromName}</span>
                          <span className="text-slate-400 mx-1.5">owes</span>
                          <span className="font-extrabold text-indigo-700">{t.toName}</span>
                        </div>
                        <div className="font-black text-slate-900 text-base">
                          ₹{numRupees.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {upiUrl && (
                          <a
                            href={upiUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                          >
                            <Smartphone className="w-3 h-3 text-emerald-600" />
                            <span>Pay UPI</span>
                          </a>
                        )}

                        {/* Individual Settle button: Prefills debtor, creditor, and exact amount! */}
                        <button
                          onClick={() => {
                            setSettlePreload({
                              payerId: t.fromId,
                              receiverId: t.toId,
                              amountPaisa: t.amountPaisa,
                            });
                            setIsSettleOpen(true);
                          }}
                          className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Settle</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Historical Settlements */}
            {group.settlements.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Past Settlements ({group.settlements.length})
                </span>
                {group.settlements.map((st) => (
                  <div
                    key={st.id}
                    className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        <strong className="text-slate-800">{st.payer.name}</strong> paid{' '}
                        <strong className="text-slate-800">{st.receiver.name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-xs">
                        ₹{(st.amountPaisa / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteSettlement(st.id)}
                        className="text-slate-300 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-3 pt-1">
            {/* Quick Add Friend */}
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                placeholder="Friend's name (e.g. Amit)..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={addingMember || !newMemberName.trim()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer"
              >
                {addingMember ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Members List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {group.balances.map((b) => (
                <div key={b.memberId} className="p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 text-xs truncate">
                          {b.name}
                        </span>
                        {b.isOwner && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-indigo-50 text-indigo-700 rounded-md">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Paid: ₹{(b.totalPaidPaisa / 100).toFixed(0)} • Share: ₹
                        {(b.totalOwedPaisa / 100).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {b.netBalancePaisa > 0 ? (
                      <span className="text-xs font-black text-emerald-600 block">
                        +₹{(b.netBalancePaisa / 100).toFixed(2)}
                      </span>
                    ) : b.netBalancePaisa < 0 ? (
                      <span className="text-xs font-black text-rose-600 block">
                        -₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 block">Settled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        groupId={group.id}
        members={group.members}
        onExpenseAdded={handleExpenseAdded}
      />

      <SettleUpModal
        isOpen={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        groupId={group.id}
        members={group.members}
        onSettled={handleSettled}
        initialPayerId={settlePreload.payerId}
        initialReceiverId={settlePreload.receiverId}
        initialAmountPaisa={settlePreload.amountPaisa}
      />
    </div>
  );
}
