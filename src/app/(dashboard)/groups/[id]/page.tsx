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
    const cachedFull = getCachedItem<GroupDetail>(`group_${id}`);
    if (cachedFull) return cachedFull;

    // Instant provisional render from groups list summary
    const allGroups = getCachedItem<any[]>('all_groups');
    const summary = allGroups?.find((g: any) => g.id === id);
    if (summary) {
      return {
        id: summary.id,
        name: summary.name,
        joinCode: summary.joinCode,
        simplifyDebts: true,
        totalSpendPaisa: summary.totalSpendPaisa || 0,
        members: [
          {
            id: 'current_user',
            name: 'You',
            isOwner: true,
            phone: null,
            upiId: null,
          },
        ],
        expenses: [],
        settlements: [],
        balances: [
          {
            memberId: 'current_user',
            name: 'You',
            isOwner: true,
            totalPaidPaisa: 0,
            totalOwedPaisa: 0,
            settlementsPaidPaisa: 0,
            settlementsReceivedPaisa: 0,
            netBalancePaisa: summary.ownerBalancePaisa || 0,
          },
        ],
        simplifiedTransfers: [],
        directTransfers: [],
        activeTransfers: [],
      };
    }
    return null;
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
        <div className="h-12 bg-slate-100 rounded-2xl w-3/4"></div>
        <div className="h-32 bg-slate-100 rounded-3xl"></div>
        <div className="h-44 bg-slate-100 rounded-3xl"></div>
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
      {/* Top Header with Larger Typography */}
      <header className="px-4 py-3.5 sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/groups"
              className="p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-900 tracking-tight truncate">
                {group.name}
              </h1>

              {/* Join Code Chip */}
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-900 hover:text-amber-950 transition-colors cursor-pointer"
                title="Tap to copy code"
              >
                <span>Code: {group.joinCode}</span>
                {copiedCode ? (
                  <span className="text-xs text-emerald-600 font-sans font-bold flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Copied
                  </span>
                ) : (
                  <Copy className="w-3 h-3 opacity-60" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSettlePreload({});
                setIsSettleOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settle</span>
            </button>

            <button
              onClick={() => setIsAddExpenseOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 pt-3.5 space-y-3.5">
        {/* Single Unified Summary Card with larger text */}
        <div className="p-4 sm:p-5 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            {/* Left: Your Standing */}
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                Your Standing
              </span>
              <div
                className={`text-3xl font-black tracking-tight mt-1 ${
                  userBalance > 0
                    ? 'text-emerald-600'
                    : userBalance < 0
                    ? 'text-rose-600'
                    : 'text-slate-800'
                }`}
              >
                {userBalance > 0
                  ? `+₹${(userBalance / 100).toFixed(2)}`
                  : userBalance < 0
                  ? `-₹${(Math.abs(userBalance) / 100).toFixed(2)}`
                  : '₹0.00'}
              </div>
              <span className="text-xs font-bold text-slate-500 block mt-1">
                {userBalance > 0
                  ? 'You get back'
                  : userBalance < 0
                  ? 'You owe friends'
                  : 'All settled'}
              </span>
            </div>

            {/* Right: Group Total */}
            <div className="text-right border-l border-slate-200/80 pl-5">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                Total Spend
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                ₹{(group.totalSpendPaisa / 100).toFixed(0)}
              </div>
              <span className="text-xs font-semibold text-slate-500 block mt-1">
                {group.members.length} members
              </span>
            </div>
          </div>
        </div>

        {/* Clean Tabs with larger text */}
        <div className="flex border-b border-slate-200 gap-5 pt-1">
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
                className={`pb-3 text-sm font-extrabold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: EXPENSES LIST */}
        {activeTab === 'expenses' && (
          <div className="space-y-2.5 pt-1">
            {loading && group.expenses.length === 0 ? (
              <div className="space-y-2.5 pt-1 animate-pulse">
                <div className="h-16 bg-slate-100 rounded-2xl"></div>
                <div className="h-16 bg-slate-100 rounded-2xl"></div>
              </div>
            ) : group.expenses.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2.5 shadow-2xs">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-extrabold text-slate-800 text-sm">No expenses yet</h4>
                <p className="text-xs text-slate-500">
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
                    className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-base shrink-0">
                        ₹
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-base truncate">
                          {exp.description}
                        </h4>
                        <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                          Paid by <span className="font-bold text-slate-700">{payerNames}</span> •{' '}
                          {expDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="font-black text-slate-900 text-base block">
                          ₹{totalRupees.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold capitalize">
                          {exp.splitType.toLowerCase()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete"
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
          <div className="space-y-3.5 pt-1">
            {/* Simplify Debts Toggle */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-sm font-extrabold text-slate-900 block">Simplify Debts</span>
                <span className="text-xs font-medium text-slate-500 block mt-0.5">
                  {group.simplifyDebts ? 'Minimizes total payments between group' : 'Exact pairwise debts'}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={group.simplifyDebts}
                  onChange={(e) => handleToggleSimplify(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Suggested Transfers */}
            {displayedTransfers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2 shadow-2xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="font-extrabold text-slate-900 text-sm">All settled up!</h4>
                <p className="text-xs text-slate-500">Zero pending dues in this group.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
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
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-black text-slate-900">{t.fromName}</span>
                          <span className="text-slate-400 font-medium mx-1.5">owes</span>
                          <span className="font-black text-indigo-700">{t.toName}</span>
                        </div>
                        <div className="font-black text-slate-900 text-lg">
                          ₹{numRupees.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {upiUrl && (
                          <a
                            href={upiUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
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
                          className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
              <div className="pt-2 space-y-2">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                  Past Settlements ({group.settlements.length})
                </span>
                {group.settlements.map((st) => (
                  <div
                    key={st.id}
                    className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-600">
                        <strong className="text-slate-900 font-bold">{st.payer.name}</strong> paid{' '}
                        <strong className="text-slate-900 font-bold">{st.receiver.name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">
                        ₹{(st.amountPaisa / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteSettlement(st.id)}
                        className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          <div className="space-y-3.5 pt-1">
            {/* Quick Add Friend */}
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                placeholder="Friend's name (e.g. Amit)..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={addingMember || !newMemberName.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shrink-0 cursor-pointer"
              >
                {addingMember ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Members List with larger text */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {group.balances.map((b) => (
                <div key={b.memberId} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-black text-sm shrink-0">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-sm truncate">
                          {b.name}
                        </span>
                        {b.isOwner && (
                          <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-indigo-50 text-indigo-700 rounded-md">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                        Paid: ₹{(b.totalPaidPaisa / 100).toFixed(0)} • Share: ₹
                        {(b.totalOwedPaisa / 100).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {b.netBalancePaisa > 0 ? (
                      <span className="text-sm font-black text-emerald-600 block">
                        +₹{(b.netBalancePaisa / 100).toFixed(2)}
                      </span>
                    ) : b.netBalancePaisa < 0 ? (
                      <span className="text-sm font-black text-rose-600 block">
                        -₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-400 block">Settled</span>
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
