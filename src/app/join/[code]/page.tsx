'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import {
  Users,
  Smartphone,
  CheckCircle2,
  Plus,
  Receipt,
  Scale,
  ArrowRight,
  Sparkles,
  ArrowLeft,
  UserCheck,
  Search,
  X,
  Car,
  Utensils,
  ShoppingCart,
  Coffee,
  Hotel,
  ShoppingBag,
  Activity,
  Trash2,
} from 'lucide-react';
import { AddExpenseScreen } from '@/components/groups/AddExpenseScreen';
import { SettleUpModal } from '@/components/groups/SettleUpModal';
import {
  generateUpiUrl,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner: boolean;
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

interface GroupData {
  id: string;
  name: string;
  category: string;
  currencySymbol: string;
  joinCode: string;
  simplifyDebts: boolean;
  totalSpendPaisa: number;
  members: Member[];
  balances: MemberBalance[];
  activeTransfers: DebtTransfer[];
  expenses: any[];
  settlements: any[];
}

export default function JoinGroupDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const upperCode = code.toUpperCase();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimedMember, setClaimedMember] = useState<{ id: string; name: string } | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePreload, setSettlePreload] = useState<{
    payerId?: string;
    receiverId?: string;
    amountPaisa?: number;
  }>({});
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'expenses' | 'settlements'>('all');

  const storageKey = `lena_dena_member_${upperCode}`;

  const fetchGroup = async (isBackground = false) => {
    try {
      if (!isBackground && !group) setLoading(true);
      const res = await fetch(`/api/join/${upperCode}?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Group not found');
      const data = await res.json();
      
      setGroup((prev) => {
        if (!prev) return data.group;
        const serverExpIds = new Set(data.group.expenses.map((e: any) => e.id));
        const pendingOptimisticExpenses = prev.expenses.filter(
          (e) => e.id.startsWith('temp_exp_') && !serverExpIds.has(e.id)
        );
        const mergedExpenses = [...pendingOptimisticExpenses, ...data.group.expenses];

        const serverStIds = new Set(data.group.settlements.map((s: any) => s.id));
        const pendingOptimisticSettlements = prev.settlements.filter(
          (s) => s.id.startsWith('temp_st_') && !serverStIds.has(s.id)
        );
        const mergedSettlements = [...pendingOptimisticSettlements, ...data.group.settlements];

        const balances = calculateMemberNetBalances(data.group.members, mergedExpenses, mergedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(data.group.members, mergedExpenses, mergedSettlements);
        const totalSpendPaisa = mergedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

        return {
          ...data.group,
          expenses: mergedExpenses,
          settlements: mergedSettlements,
          totalSpendPaisa,
          balances,
          activeTransfers: data.group.simplifyDebts ? simplifiedTransfers : directTransfers,
        };
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();

    // Check localStorage for claimed identity
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setClaimedMember(JSON.parse(saved));
      }
    } catch {
      // ignore
    }

    // Live auto-polling every 3.5 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchGroup(true);
      }
    }, 3500);

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
  }, [upperCode]);

  const handleClaimExisting = (member: Member) => {
    const ident = { id: member.id, name: member.name };
    setClaimedMember(ident);
    localStorage.setItem(storageKey, JSON.stringify(ident));
  };

  const handleClaimNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setClaiming(true);

    try {
      const res = await fetch(`/api/join/${upperCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMemberName: newMemberName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join group');

      const ident = { id: data.member.id, name: data.member.name };
      setClaimedMember(ident);
      localStorage.setItem(storageKey, JSON.stringify(ident));
      fetchGroup();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleSwitchIdentity = () => {
    localStorage.removeItem(storageKey);
    setClaimedMember(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-slate-400 font-semibold">
        Loading group...
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4">
        <h2 className="text-xl font-extrabold text-slate-800">Group Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'Please check the join code and try again.'}</p>
        <Link
          href="/join"
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
        >
          Try Another Code
        </Link>
      </div>
    );
  }

  // Identity selection screen if friend hasn't claimed their name yet
  if (!claimedMember) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-normal text-amber-700 font-mono tracking-wider">
              Code: {group.joinCode}
            </span>
            <h1 className="text-2xl font-normal text-slate-900">{group.name}</h1>
            <p className="text-xs text-slate-400">Who are you in this group?</p>
          </div>

          {/* Existing Member List */}
          <div className="space-y-2">
            <label className="block text-xs font-normal text-slate-400 text-center">
              Select Your Name
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto">
              {group.members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleClaimExisting(m)}
                  className="w-full p-3 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/70 hover:border-emerald-300 rounded-2xl text-left flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-normal text-xs flex items-center justify-center">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-normal text-slate-800 text-sm group-hover:text-emerald-700">
                      {m.name}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                </button>
              ))}
            </div>
          </div>

          {/* Or enter new name */}
          <div className="pt-2 border-t border-slate-100">
            <form onSubmit={handleClaimNew} className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Not listed? Add yourself
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Your Name (e.g. Siddharth)"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-slate-50/50"
                />
                <button
                  type="submit"
                  disabled={claiming || !newMemberName.trim()}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {claiming ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Active Member View
  const myBalance =
    group.balances.find((b) => b.memberId === claimedMember.id)?.netBalancePaisa || 0;

  // Transfers involving current user
  const transfersIOwe = group.activeTransfers.filter((t) => t.fromId === claimedMember.id);
  const transfersOwedToMe = group.activeTransfers.filter((t) => t.toId === claimedMember.id);

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
      date: new Date(st.date || st.createdAt || Date.now()),
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

  const handleExpenseAdded = (newExpense?: any) => {
    if (newExpense) {
      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.expenses.filter((e) => {
          if (e.id === newExpense.id) return false;
          if (!newExpense.id.startsWith('temp_') && e.id.startsWith('temp_')) return false;
          return true;
        });
        const updatedExpenses = [newExpense, ...filtered];
        const balances = calculateMemberNetBalances(prev.members, updatedExpenses, prev.settlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(prev.members, updatedExpenses, prev.settlements);
        const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

        return {
          ...prev,
          expenses: updatedExpenses,
          totalSpendPaisa,
          balances,
          activeTransfers: prev.simplifyDebts ? simplifiedTransfers : directTransfers,
        };
      });
    }
    if (newExpense && !newExpense.id.startsWith('temp_')) {
      setTimeout(() => fetchGroup(true), 150);
    }
  };

  const handleSettled = (newSettlement?: any) => {
    if (newSettlement) {
      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.settlements.filter((s) => {
          if (s.id === newSettlement.id) return false;
          if (!newSettlement.id.startsWith('temp_') && s.id.startsWith('temp_')) return false;
          return true;
        });
        const updatedSettlements = [newSettlement, ...filtered];
        const balances = calculateMemberNetBalances(prev.members, prev.expenses, updatedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(prev.members, prev.expenses, updatedSettlements);

        return {
          ...prev,
          settlements: updatedSettlements,
          balances,
          activeTransfers: prev.simplifyDebts ? simplifiedTransfers : directTransfers,
        };
      });
    }
    if (newSettlement && !newSettlement.id.startsWith('temp_')) {
      setTimeout(() => fetchGroup(true), 150);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Mobile Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-normal text-slate-900">{group.name}</span>
            <span className="text-[10px] font-mono font-normal bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">
              {group.joinCode}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-normal mt-0.5">
            <span>You are: <strong className="font-medium text-slate-700">{claimedMember.name}</strong></span>
            <button
              onClick={handleSwitchIdentity}
              className="text-[10px] text-emerald-600 font-normal hover:underline cursor-pointer"
            >
              (Switch)
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsAddExpenseOpen(true)}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Bill
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Personal Standing Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs text-center space-y-1">
          <span className="text-xs font-normal text-slate-400">
            Your Balance in this group
          </span>
          <div className="text-3xl font-light tracking-tight">
            {myBalance > 0 ? (
              <span className="text-emerald-600">+₹{(myBalance / 100).toFixed(2)}</span>
            ) : myBalance < 0 ? (
              <span className="text-rose-600">-₹{(Math.abs(myBalance) / 100).toFixed(2)}</span>
            ) : (
              <span className="text-slate-800">₹0.00</span>
            )}
          </div>
          <p className="text-xs font-normal text-slate-400">
            {myBalance > 0
              ? 'You are owed money back'
              : myBalance < 0
              ? 'You need to settle up with friends'
              : 'You are all settled up!'}
          </p>
        </div>

        {/* Debts you owe with 1-tap UPI launch */}
        {transfersIOwe.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-normal text-slate-400 block px-1">
              Payments you need to make ({transfersIOwe.length})
            </h3>
            {transfersIOwe.map((t, idx) => {
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
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-normal text-slate-400">You pay</span>
                      <h4 className="font-normal text-slate-900 text-base">{t.toName}</h4>
                    </div>
                    <div className="text-xl font-light text-rose-600 tracking-tight">
                      ₹{numRupees.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {upiUrl && (
                      <a
                        href={upiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        Pay via UPI
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
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Mark as Paid
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Debts owed to you */}
        {transfersOwedToMe.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Friends who owe you ({transfersOwedToMe.length})
            </h3>
            {transfersOwedToMe.map((t, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <h4 className="font-normal text-slate-900 text-base">{t.fromName}</h4>
                  <span className="text-xs text-emerald-600 font-normal">owes you</span>
                </div>
                <div className="text-xl font-light text-emerald-600 tracking-tight">
                  ₹{(t.amountPaisa / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group Activity Feed */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-normal text-slate-400 block px-1">
              Group Activity ({group.expenses.length + group.settlements.length})
            </h3>
            <button
              onClick={() => setIsAddExpenseOpen(true)}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              + Add Bill
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search activity by name, description, amount..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="w-full pl-9.5 pr-8 py-2.5 text-sm font-normal bg-slate-50/70 border border-slate-200/60 rounded-xl focus:outline-hidden focus:border-emerald-500 placeholder:text-slate-400 transition-colors"
              />
              {activitySearch && (
                <button
                  onClick={() => setActivitySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
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
                      ? 'bg-slate-800 text-white font-medium'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70 font-normal'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          {activityItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center space-y-2 shadow-2xs">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-normal text-slate-800 text-sm">
                {activitySearch ? 'No matching activity found' : 'No activity yet'}
              </h4>
              <p className="text-xs text-slate-400 font-normal">
                {activitySearch ? 'Try a different search query.' : "Tap '+ Add Bill' above to record a bill."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityItems.map((item) => {
                const dateStr = item.date.toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                });
                const totalRupees = item.totalAmountPaisa / 100;

                if (item.type === 'EXPENSE') {
                  const badge = getCategoryBadge(item.category);
                  const CategoryIcon = badge.icon;

                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-2xs hover:border-slate-200 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl ${badge.bg} flex items-center justify-center shrink-0`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-normal text-slate-900 text-base truncate">
                            {item.title}
                          </div>
                          <div className="text-xs font-normal text-slate-400 truncate mt-0.5">
                            {item.payerNames} paid • {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-normal text-slate-900 text-base block">
                          ₹{totalRupees.toFixed(2)}
                        </span>
                        <span className="text-xs font-normal text-slate-400 capitalize">
                          {item.raw.splitType.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-2xs hover:border-slate-200 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-normal text-slate-900 text-base truncate">
                            {item.title}
                          </div>
                          <div className="text-xs font-normal text-slate-400 truncate mt-0.5">
                            Settlement • {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-normal text-emerald-600 text-base block">
                          ₹{totalRupees.toFixed(2)}
                        </span>
                        <span className="text-xs font-normal text-slate-400">
                          Settled
                        </span>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals for Friend */}
      <AddExpenseScreen
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        groupId={group.id}
        groupName={group.name}
        members={group.members}
        onExpenseAdded={handleExpenseAdded}
        defaultPayerId={claimedMember.id}
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
