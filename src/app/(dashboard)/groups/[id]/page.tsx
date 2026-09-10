'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
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
  Search,
  X,
  Car,
  Utensils,
  ShoppingCart,
  Coffee,
  Hotel,
  ShoppingBag,
  Activity,
  Pencil,
} from 'lucide-react';
import { AddExpenseScreen } from '@/components/groups/AddExpenseScreen';
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
  isAdmin?: boolean;
}

const getAvatarBg = (name: string) => {
  if (name.includes('🐰')) return 'bg-pink-100 text-pink-700';
  const firstChar = name.charAt(0).toUpperCase();
  if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700';
  if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700';
  return 'bg-emerald-100 text-emerald-700';
};

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
  isAdmin?: boolean;
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

  const [activeTab, setActiveTab] = useState<'activity' | 'balances' | 'members'>('activity');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'expenses' | 'settlements'>('all');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
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
      const res = await fetch(`/api/groups/${id}?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Group not found');
      const data = await res.json();
      
      setGroup((prev) => {
        if (!prev) return data.group;

        // Preserve in-flight optimistic expenses that server hasn't returned yet
        const serverExpIds = new Set(data.group.expenses.map((e: any) => e.id));
        const pendingOptimisticExpenses = prev.expenses.filter(
          (e) => e.id.startsWith('temp_exp_') && !serverExpIds.has(e.id)
        );
        const mergedExpenses = [...pendingOptimisticExpenses, ...data.group.expenses];

        // Preserve in-flight optimistic settlements
        const serverStIds = new Set(data.group.settlements.map((s: any) => s.id));
        const pendingOptimisticSettlements = prev.settlements.filter(
          (s) => s.id.startsWith('temp_st_') && !serverStIds.has(s.id)
        );
        const mergedSettlements = [...pendingOptimisticSettlements, ...data.group.settlements];

        const balances = calculateMemberNetBalances(data.group.members, mergedExpenses, mergedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(data.group.members, mergedExpenses, mergedSettlements);
        const totalSpendPaisa = mergedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

        const updated = {
          ...data.group,
          expenses: mergedExpenses,
          settlements: mergedSettlements,
          totalSpendPaisa,
          balances,
          simplifiedTransfers,
          directTransfers,
          activeTransfers: data.group.simplifyDebts ? simplifiedTransfers : directTransfers,
        };

        setCachedItem(`group_${id}`, updated);
        return updated;
      });
    } catch (e) {
      console.error(e);
      if (!group) router.push('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchGroup();

    // 1. Silent live polling every 3.5 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchGroup(true);
      }
    }, 3500);

    // 2. Instant re-validation when returning to app/tab
    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        fetchGroup(true);
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
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

  // Instant optimistic expense addition or modification
  const handleExpenseAdded = (newExpense?: any) => {
    if (newExpense) {
      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.expenses.filter((e) => {
          if (e.id === newExpense.id) return false;
          // When real confirmed expense arrives from server, remove the temp one
          if (!newExpense.id.startsWith('temp_') && e.id.startsWith('temp_')) {
            return false;
          }
          return true;
        });
        const updatedExpenses = [newExpense, ...filtered].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        const balances = calculateMemberNetBalances(prev.members, updatedExpenses, prev.settlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(prev.members, updatedExpenses, prev.settlements);
        const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

        const updated = {
          ...prev,
          expenses: updatedExpenses,
          totalSpendPaisa,
          balances,
          simplifiedTransfers,
          directTransfers,
          activeTransfers: prev.simplifyDebts ? simplifiedTransfers : directTransfers,
        };
        setCachedItem(`group_${id}`, updated);
        return updated;
      });
    }
    setEditingExpense(null);
    // Only re-sync with server after confirmed save, avoiding race conditions
    if (newExpense && !newExpense.id.startsWith('temp_')) {
      setTimeout(() => fetchGroup(true), 150);
    }
  };

  // Instant optimistic settlement addition
  const handleSettled = (newSettlement?: any) => {
    if (newSettlement) {
      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.settlements.filter((s) => {
          if (s.id === newSettlement.id) return false;
          if (!newSettlement.id.startsWith('temp_') && s.id.startsWith('temp_')) {
            return false;
          }
          return true;
        });
        const updatedSettlements = [newSettlement, ...filtered].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        const balances = calculateMemberNetBalances(prev.members, prev.expenses, updatedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(prev.members, prev.expenses, updatedSettlements);

        const updated = {
          ...prev,
          settlements: updatedSettlements,
          balances,
          simplifiedTransfers,
          directTransfers,
          activeTransfers: prev.simplifyDebts ? simplifiedTransfers : directTransfers,
        };
        setCachedItem(`group_${id}`, updated);
        return updated;
      });
    }
    if (newSettlement && !newSettlement.id.startsWith('temp_')) {
      setTimeout(() => fetchGroup(true), 150);
    }
  };

  // Instant 0ms optimistic expense deletion without thread-blocking confirm popup
  const handleDeleteExpense = async (expenseId: string) => {
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

  // Instant 0ms optimistic settlement deletion without thread-blocking confirm popup
  const handleDeleteSettlement = async (settlementId: string) => {
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

  // Instant optimistic admin assignment toggle
  const handleToggleAdmin = async (memberId: string, currentIsAdmin: boolean) => {
    if (!group) return;
    const targetStatus = !currentIsAdmin;

    const updatedMembers = group.members.map((m) =>
      m.id === memberId ? { ...m, isAdmin: targetStatus } : m
    );
    const updatedBalances = group.balances.map((b) =>
      b.memberId === memberId ? { ...b, isAdmin: targetStatus } : b
    );
    const updated = {
      ...group,
      members: updatedMembers,
      balances: updatedBalances,
    };
    setGroup(updated);
    setCachedItem(`group_${id}`, updated);

    try {
      const res = await fetch(`/api/groups/${id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: targetStatus }),
      });
      if (!res.ok) {
        fetchGroup(true);
      }
    } catch (e) {
      console.error('Failed to toggle admin status:', e);
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

  function getCategoryBadge(cat?: string) {
    switch (cat) {
      case 'Food':
        return { icon: Utensils, bg: 'bg-amber-50 text-amber-600' };
      case 'Transport':
        return { icon: Car, bg: 'bg-blue-50 text-blue-600' };
      case 'Groceries':
        return { icon: ShoppingCart, bg: 'bg-emerald-50 text-emerald-600' };
      case 'Drinks':
        return { icon: Coffee, bg: 'bg-rose-50 text-rose-600' };
      case 'Stay':
        return { icon: Hotel, bg: 'bg-purple-50 text-purple-600' };
      case 'Shopping':
        return { icon: ShoppingBag, bg: 'bg-indigo-50 text-indigo-600' };
      default:
        return { icon: Receipt, bg: 'bg-slate-100 text-slate-700' };
    }
  }

  const activityItems = useMemo(() => {
    if (!group) return [];

    const expItems = (group.expenses || []).map((exp) => ({
      type: 'EXPENSE' as const,
      id: exp.id,
      date: new Date(exp.date),
      category: exp.category || 'General',
      title: exp.description,
      totalAmountPaisa: exp.totalAmountPaisa,
      payerNames: exp.payers?.map((p: any) => p.member?.name).join(', ') || 'Unknown',
      payers: exp.payers,
      splits: exp.splits,
      raw: exp,
    }));

    const stItems = (group.settlements || []).map((st) => ({
      type: 'SETTLEMENT' as const,
      id: st.id,
      date: new Date(st.date || Date.now()),
      category: 'Settlement',
      title: `${st.payer?.name} paid ${st.receiver?.name}`,
      totalAmountPaisa: st.amountPaisa,
      payerNames: st.payer?.name || '',
      receiverName: st.receiver?.name || '',
      paymentMethod: st.paymentMethod,
      raw: st,
    }));

    const combined = [...expItems, ...stItems].sort((a, b) => b.date.getTime() - a.date.getTime());

    return combined.filter((item) => {
      if (activityFilter === 'expenses' && item.type !== 'EXPENSE') return false;
      if (activityFilter === 'settlements' && item.type !== 'SETTLEMENT') return false;

      if (activitySearch.trim()) {
        const q = activitySearch.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchPayer = item.payerNames.toLowerCase().includes(q);
        const matchReceiver = item.type === 'SETTLEMENT' && (item.receiverName || '').toLowerCase().includes(q);
        const matchSplitMem = item.type === 'EXPENSE' && (item.splits || []).some((s: any) => s.member?.name?.toLowerCase().includes(q));
        const matchAmount = (item.totalAmountPaisa / 100).toString().includes(q);
        return matchTitle || matchPayer || matchReceiver || matchSplitMem || matchAmount;
      }
      return true;
    });
  }, [group?.expenses, group?.settlements, activityFilter, activitySearch]);

  return (
    <div className="w-full pb-28">
      {/* Top Header */}
      <header className="px-4 py-3 sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/groups"
              className="p-1 -ml-1 rounded-xl text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                {group.name}
              </h1>

              {/* Join Code */}
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Tap to copy code"
              >
                <span>Code: <span className="font-mono font-bold text-slate-700">{group.joinCode}</span></span>
                {copiedCode ? (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                    <Check className="w-3 h-3 stroke-[3]" /> Copied
                  </span>
                ) : (
                  <Copy className="w-3 h-3 opacity-50" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons matching Ledger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSettlePreload({});
                setIsSettleOpen(true);
              }}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              <span>Settle</span>
            </button>

            <button
              onClick={() => {
                setEditingExpense(null);
                setIsAddExpenseOpen(true);
              }}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 pt-3.5 space-y-4">
        {/* Net Balance Summary Card matching Screenshot 2 (Ledger) */}
        <div className="p-4 sm:p-5 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-200/60">
            {/* Left: Your Standing */}
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-500 block">
                Your Balance
              </span>
              <div
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  userBalance > 0
                    ? 'text-emerald-700'
                    : userBalance < 0
                    ? 'text-orange-600'
                    : 'text-slate-800'
                }`}
              >
                {userBalance > 0
                  ? `+₹${(userBalance / 100).toFixed(2)}`
                  : userBalance < 0
                  ? `-₹${(Math.abs(userBalance) / 100).toFixed(2)}`
                  : '₹0.00'}
              </div>
              <span className="text-[11px] font-bold text-slate-400 block">
                {userBalance > 0
                  ? 'You Get'
                  : userBalance < 0
                  ? 'You Give'
                  : 'All Settled'}
              </span>
            </div>

            {/* Right: Total Spend */}
            <div className="pl-4 sm:pl-5 space-y-0.5">
              <span className="text-xs font-bold text-slate-500 block">
                Total Spend
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ₹{(group.totalSpendPaisa / 100).toFixed(2)}
              </div>
              <span className="text-[11px] font-bold text-slate-400 block">
                {group.members.length} Members
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/80 gap-6 pt-1">
          {[
            { key: 'activity', label: `Activity (${group.expenses.length + group.settlements.length})` },
            { key: 'balances', label: `Balances (${displayedTransfers.length})` },
            { key: 'members', label: `Members (${group.members.length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-2.5 text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'border-b-2 border-emerald-700 text-emerald-800 font-bold'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: ACTIVITY LIST */}
        {activeTab === 'activity' && (
          <div className="space-y-3 pt-1">
            {/* Search & Filter Bar */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search activity by name, description, amount..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-9.5 pr-8 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600 placeholder:text-slate-400 transition-colors"
                />
                {activitySearch && (
                  <button
                    onClick={() => setActivitySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: `All (${group.expenses.length + group.settlements.length})` },
                  { id: 'expenses', label: `Expenses (${group.expenses.length})` },
                  { id: 'settlements', label: `Settlements (${group.settlements.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActivityFilter(f.id as any)}
                    className={`px-3 py-1 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                      activityFilter === f.id
                        ? 'bg-slate-800 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List items */}
            {loading && activityItems.length === 0 ? (
              <div className="space-y-2.5 pt-1 animate-pulse">
                <div className="h-16 bg-slate-50 rounded-2xl"></div>
                <div className="h-16 bg-slate-50 rounded-2xl"></div>
              </div>
            ) : activityItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center space-y-2 shadow-2xs">
                <Receipt className="w-9 h-9 text-slate-300 mx-auto" />
                <h4 className="font-normal text-slate-800 text-sm">
                  {activitySearch ? 'No matching activity found' : 'No activity yet'}
                </h4>
                <p className="text-xs text-slate-400 font-normal">
                  {activitySearch ? 'Try a different search query.' : "Tap '+ Bill' above to record your first expense."}
                </p>
              </div>
            ) : (
              activityItems.map((item) => {
                const dateStr = item.date.toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                });

                if (item.type === 'EXPENSE') {
                  const badge = getCategoryBadge(item.category);
                  const CategoryIcon = badge.icon;
                  const totalRupees = item.totalAmountPaisa / 100;

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl ${badge.bg} flex items-center justify-center shrink-0 shadow-2xs`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-slate-900 truncate leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                            Paid by <span className="font-bold text-slate-700">{item.payerNames}</span> • {dateStr}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-slate-900 block">
                            ₹{totalRupees.toFixed(2)}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 capitalize">
                            {item.raw.splitType.toLowerCase()}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setEditingExpense(item.raw);
                            setIsAddExpenseOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Expense"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  // Settlement Item with bold Ledger typography
                  const totalRupees = item.totalAmountPaisa / 100;

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-slate-900 truncate">
                            {item.title}
                          </h4>
                          <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                            Settlement • {dateStr}
                            {item.paymentMethod ? ` • via ${item.paymentMethod}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-emerald-700 block">
                            ₹{totalRupees.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-emerald-600">
                            Settled
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteSettlement(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Settlement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        )}

        {/* TAB 2: BALANCES & SETTLE UP */}
        {activeTab === 'balances' && (
          <div className="space-y-3.5 pt-1">
            {/* Simplify Debts Toggle */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-base font-normal text-slate-900 block">Simplify Debts</span>
                <span className="text-xs font-normal text-slate-400 block mt-0.5">
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
                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Suggested Transfers */}
            {displayedTransfers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center space-y-2 shadow-2xs">
                <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
                <h4 className="font-normal text-slate-800 text-sm">All settled up!</h4>
                <p className="text-xs text-slate-400 font-normal">Zero pending dues in this group.</p>
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(t.fromName)}`}>
                            {t.fromName.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-sm sm:text-base truncate">
                            <span className="font-bold text-slate-900">{t.fromName}</span>
                            <span className="text-slate-400 font-medium mx-1.5 text-xs">owes</span>
                            <span className="font-bold text-emerald-700">{t.toName}</span>
                          </div>
                        </div>
                        <div className="font-black text-orange-600 text-lg sm:text-xl tracking-tight shrink-0">
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
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                            <span>Pay UPI</span>
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
                          className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[2.5]" />
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
                <span className="text-xs font-normal text-slate-400 block px-1">
                  Past Settlements ({group.settlements.length})
                </span>
                {group.settlements.map((st) => (
                  <div
                    key={st.id}
                    className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-normal text-slate-600 truncate">
                        <span className="text-slate-800">{st.payer.name}</span> paid{' '}
                        <span className="text-slate-800">{st.receiver.name}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-normal text-slate-900 text-sm">
                        ₹{(st.amountPaisa / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteSettlement(st.id)}
                        className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
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
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200/80 bg-white focus:outline-hidden focus:border-emerald-600 placeholder:text-slate-400 transition-colors"
              />
              <button
                type="submit"
                disabled={addingMember || !newMemberName.trim()}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
              >
                {addingMember ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Members List matching Screenshot 2 (Ledger) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {group.balances.map((b) => (
                <div key={b.memberId} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-12 h-12 rounded-full font-bold flex items-center justify-center text-base shrink-0 shadow-2xs ${getAvatarBg(b.name)}`}>
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-base sm:text-lg truncate">
                          {b.name}
                        </span>
                        {b.isOwner ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full">
                            Creator & Admin
                          </span>
                        ) : b.isAdmin ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full">
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[13px] font-semibold text-slate-500 block mt-0.5">
                        Paid: ₹{(b.totalPaidPaisa / 100).toFixed(0)} • Share: ₹
                        {(b.totalOwedPaisa / 100).toFixed(0)}
                      </span>

                      {/* Admin assignment toggle button for other members */}
                      {!b.isOwner && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(b.memberId, Boolean(b.isAdmin))}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              b.isAdmin
                                ? 'text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                                : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                            }`}
                          >
                            {b.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    {b.netBalancePaisa > 0 ? (
                      <span className="text-lg sm:text-xl font-black text-emerald-700 block">
                        +₹{(b.netBalancePaisa / 100).toFixed(2)}
                      </span>
                    ) : b.netBalancePaisa < 0 ? (
                      <span className="text-lg sm:text-xl font-black text-orange-600 block">
                        -₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-lg sm:text-xl font-black text-emerald-600 block">₹0</span>
                    )}
                    <span className="text-xs font-bold text-slate-400 block mt-0.5">
                      {b.netBalancePaisa > 0 ? 'Gets back' : b.netBalancePaisa < 0 ? 'Owes' : 'Settled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddExpenseScreen
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        groupId={group.id}
        groupName={group.name}
        members={group.members}
        onExpenseAdded={handleExpenseAdded}
        initialExpense={editingExpense}
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
