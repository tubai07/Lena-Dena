'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  Clock,
} from 'lucide-react';
import { AddExpenseScreen } from '@/components/groups/AddExpenseScreen';
import { SettleUpModal } from '@/components/groups/SettleUpModal';
import { TransactionDetailsModal } from '@/components/groups/TransactionDetailsModal';
import {
  generateUpiUrl,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';
import { getGroupCategoryInfo } from '@/lib/groupIcons';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner: boolean;
  isAdmin?: boolean;
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

const getAvatarBg = (name?: string) => {
  if (!name || typeof name !== 'string') return 'bg-slate-100 text-slate-700';
  if (name.includes('🐰')) return 'bg-pink-100 text-pink-700';
  const firstChar = (name.charAt(0) || 'U').toUpperCase();
  if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700';
  if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700';
  return 'bg-emerald-100 text-emerald-700';
};

export default function JoinGroupDetailPage() {
  const urlParams = useParams();
  const paramCode = (urlParams?.code as string) || '';
  const [code, setCode] = useState(paramCode);

  useEffect(() => {
    if (paramCode) {
      setCode(paramCode);
    } else if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/join/');
      if (parts[1]) {
        setCode(decodeURIComponent(parts[1].split('/')[0].split('?')[0]));
      }
    }
  }, [paramCode]);

  const upperCode = (code || '').toUpperCase().trim();

  const [isMounted, setIsMounted] = useState(false);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimedMember, setClaimedMember] = useState<{ id: string; name: string } | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
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
    if (!upperCode) return;
    try {
      if (!isBackground && !group) setLoading(true);
      const res = await fetch(`/api/join/${upperCode}?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Group not found');
      }
      const data = await res.json();
      if (!data?.group) throw new Error('Invalid group data received');

      if (data.group.currentUserMemberId) {
        const all = data.group.allMembers || data.group.members || [];
        const match = all.find((m: any) => m.id === data.group.currentUserMemberId);
        if (match) {
          const ident = { id: match.id, name: match.name };
          setClaimedMember((prev) => prev || ident);
          try {
            if (!localStorage.getItem(storageKey)) {
              localStorage.setItem(storageKey, JSON.stringify(ident));
            }
          } catch {}
        }
      }
      
      setGroup((prev) => {
        const incomingMembers = data.group.members || [];
        const incomingExpenses = data.group.expenses || [];
        const incomingSettlements = data.group.settlements || [];

        if (!prev) {
          return {
            ...data.group,
            members: incomingMembers,
            expenses: incomingExpenses,
            settlements: incomingSettlements,
            balances: data.group.balances || calculateMemberNetBalances(incomingMembers, incomingExpenses, incomingSettlements),
            activeTransfers: data.group.activeTransfers || simplifyDebts(data.group.balances || []),
          };
        }

        const serverExpIds = new Set(incomingExpenses.map((e: any) => e.id));
        const pendingOptimisticExpenses = (prev.expenses || []).filter(
          (e) => e.id.startsWith('temp_exp_') && !serverExpIds.has(e.id)
        );
        const mergedExpenses = [...pendingOptimisticExpenses, ...incomingExpenses];

        const serverStIds = new Set(incomingSettlements.map((s: any) => s.id));
        const pendingOptimisticSettlements = (prev.settlements || []).filter(
          (s) => s.id.startsWith('temp_st_') && !serverStIds.has(s.id)
        );
        const mergedSettlements = [...pendingOptimisticSettlements, ...incomingSettlements];

        const balances = calculateMemberNetBalances(incomingMembers, mergedExpenses, mergedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(incomingMembers, mergedExpenses, mergedSettlements);
        const totalSpendPaisa = mergedExpenses.reduce((sum, e) => sum + (Number(e.totalAmountPaisa) || 0), 0);

        return {
          ...data.group,
          members: incomingMembers,
          expenses: mergedExpenses,
          settlements: mergedSettlements,
          totalSpendPaisa,
          balances: balances || [],
          activeTransfers: (data.group.simplifyDebts ?? true) ? simplifiedTransfers : directTransfers,
        };
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
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

    // Live auto-polling every 2.5 seconds for instant approval detection
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchGroup(true);
      }
    }, 2500);

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

  const recordJoinedCode = () => {
    try {
      const existing = JSON.parse(localStorage.getItem('lena_dena_joined_groups') || '[]');
      if (!existing.includes(upperCode)) {
        localStorage.setItem('lena_dena_joined_groups', JSON.stringify([...existing, upperCode]));
      }
    } catch {
      // Ignore
    }
  };

  const handleClaimExisting = async (member: Member) => {
    const ident = { id: member.id, name: member.name };
    setClaimedMember(ident);
    localStorage.setItem(storageKey, JSON.stringify(ident));
    recordJoinedCode();
    await fetchGroup(true);
  };

  const handleClaimNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setClaiming(true);

    try {
      const res = await fetch(`/api/join/${upperCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newMemberName: newMemberName.trim(),
          phone: newMemberPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join group');

      const ident = { id: data.member.id, name: data.member.name };
      setClaimedMember(ident);
      localStorage.setItem(storageKey, JSON.stringify(ident));
      recordJoinedCode();
      await fetchGroup(true);
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

  if (!isMounted || loading) {
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

  // Find active member record for claimed identity
  const currentMemberRecord = useMemo(() => {
    if (!claimedMember || !group) return null;
    const all = (group as any).allMembers || (group as any).pendingMembers?.concat(group.members || []) || group.members || [];
    return all.find((m: any) => m.id === claimedMember.id);
  }, [claimedMember, group]);

  const isPendingApproval = currentMemberRecord?.status === 'PENDING';
  const isRejected = currentMemberRecord?.status === 'REJECTED';
  const hasValidClaim = Boolean(claimedMember && currentMemberRecord && !isRejected);

  // Rejected View: User was rejected by admin
  if (isRejected) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 select-none">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-6 text-center animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center mx-auto shadow-xs">
            <X className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-700 font-mono tracking-wider">
              Code: {group.joinCode}
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Request Declined</h1>
            <p className="text-sm font-semibold text-slate-600">
              Your request to join <span className="font-bold text-slate-900">{group.name}</span> was not approved by the group admin.
            </p>
            <p className="text-xs text-slate-400 font-medium">
              You can contact the group admin or try joining under another name.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSwitchIdentity}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold transition-colors cursor-pointer"
            >
              Try with another name or code
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Identity selection screen if friend hasn't claimed a valid name yet
  if (!hasValidClaim) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            {(() => {
              const catInfo = getGroupCategoryInfo(group.category);
              const CatIcon = catInfo.icon;
              return (
                <div className="flex justify-center">
                  <div className={`w-14 h-14 rounded-3xl flex items-center justify-center border shadow-xs ${catInfo.bg} ${catInfo.color} ${catInfo.border}`}>
                    <CatIcon className="w-7 h-7" />
                  </div>
                </div>
              );
            })()}
            <div>
              <span className="text-xs font-bold text-amber-700 font-mono tracking-wider">
                Code: {group.joinCode}
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{group.name}</h1>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Who are you in this group?</p>
            </div>
          </div>

          {/* Existing Member List */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-500 text-center uppercase tracking-wider">
              Select Your Name
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto">
              {(group.members || []).map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleClaimExisting(m)}
                  className="w-full p-3 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300 rounded-2xl text-left flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${getAvatarBg(m.name)}`}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-900 text-sm group-hover:text-emerald-800">
                      {m.name}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700" />
                </button>
              ))}
            </div>
          </div>

          {/* Or enter new name */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="text-center space-y-0.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                New to this group? Request to Join
              </label>
              <p className="text-[11px] text-slate-400 font-medium">Enter your details to send a join request to the admin</p>
            </div>
            <form onSubmit={handleClaimNew} className="space-y-2.5">
              <input
                type="text"
                required
                placeholder="Your Name (e.g. Siddharth) *"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 focus:outline-hidden focus:bg-white focus:border-emerald-600 transition-colors placeholder:text-slate-400"
              />
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={newMemberPhone}
                  maxLength={10}
                  onChange={(e) => setNewMemberPhone(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 focus:outline-hidden focus:bg-white focus:border-emerald-600 transition-colors placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={claiming || !newMemberName.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{claiming ? 'Sending...' : 'Request to Join'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Approval Pending View: Joined user waiting for admin approval
  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 select-none">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xl space-y-6 text-center animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto shadow-xs">
            <Clock className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-700 font-mono tracking-wider">
              Code: {group.joinCode}
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Approval Pending</h1>
            <p className="text-sm font-semibold text-slate-600">
              Hi <span className="font-bold text-slate-900">{claimedMember?.name}</span>, your request to join <span className="font-bold text-slate-900">{group.name}</span> has been sent to the group admin.
            </p>
            <p className="text-xs text-slate-400 font-medium">
              You will automatically gain full access as soon as an admin approves your request.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Checking for approval in real-time...</span>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSwitchIdentity}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel or switch name
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Member View
  const myBalance =
    (group.balances || []).find((b) => b.memberId === claimedMember?.id)?.netBalancePaisa || 0;

  // Transfers involving current user
  const activeTransfers = group.activeTransfers || [];
  const transfersIOwe = activeTransfers.filter((t) => t.fromId === claimedMember?.id);
  const transfersOwedToMe = activeTransfers.filter((t) => t.toId === claimedMember?.id);

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
      date: new Date(exp.date || Date.now()),
      category: exp.category || 'General',
      title: exp.description || 'Expense',
      totalAmountPaisa: Number(exp.totalAmountPaisa) || 0,
      payerNames: (exp.payers || [])
        .map((p: any) => p?.member?.name || 'Someone')
        .filter(Boolean)
        .join(', ') || 'Someone',
      payers: exp.payers || [],
      splits: exp.splits || [],
      raw: exp,
    }));

    const stItems = (group.settlements || []).map((st) => ({
      type: 'SETTLEMENT' as const,
      id: st.id,
      date: new Date(st.date || st.createdAt || Date.now()),
      category: 'Settlement',
      title: `${st.payer?.name || 'Someone'} paid ${st.receiver?.name || 'Someone'}`,
      totalAmountPaisa: Number(st.amountPaisa) || 0,
      payerNames: st.payer?.name || '',
      receiverName: st.receiver?.name || '',
      paymentMethod: st.paymentMethod || 'UPI',
      raw: st,
    }));

    const combined = [...expItems, ...stItems].sort((a, b) => b.date.getTime() - a.date.getTime());

    return combined.filter((item) => {
      if (activityFilter === 'expenses' && item.type !== 'EXPENSE') return false;
      if (activityFilter === 'settlements' && item.type !== 'SETTLEMENT') return false;

      if (activitySearch.trim()) {
        const q = activitySearch.toLowerCase().trim();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchPayer = (item.payerNames || '').toLowerCase().includes(q);
        const matchReceiver = item.type === 'SETTLEMENT' && (item.receiverName || '').toLowerCase().includes(q);
        const matchSplitMem = item.type === 'EXPENSE' && (item.splits || []).some((s: any) => (s?.member?.name || '').toLowerCase().includes(q));
        const matchAmount = ((item.totalAmountPaisa || 0) / 100).toString().includes(q);
        return matchTitle || matchPayer || matchReceiver || matchSplitMem || matchAmount;
      }
      return true;
    });
  }, [group?.expenses, group?.settlements, activityFilter, activitySearch]);

  const currentMemberObj = (group?.members || []).find((m) => m.id === claimedMember?.id) || (group?.members || []).find((m) => m.isOwner) || group?.members?.[0];
  const isUserAdmin = Boolean(currentMemberObj?.isOwner || currentMemberObj?.isAdmin);

  const handleDeleteExpense = async (expenseId: string) => {
    if (!isUserAdmin || !group) return;
    const updatedExpenses = group.expenses.filter((e) => e.id !== expenseId);
    const balances = calculateMemberNetBalances(group.members, updatedExpenses, group.settlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(group.members, updatedExpenses, group.settlements);
    const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

    setGroup({
      ...group,
      expenses: updatedExpenses,
      totalSpendPaisa,
      balances,
      activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
    });

    try {
      await fetch(`/api/groups/${group.id}/expenses/${expenseId}`, { method: 'DELETE' });
    } catch {
      fetchGroup(true);
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    if (!isUserAdmin || !group) return;
    const updatedSettlements = group.settlements.filter((s) => s.id !== settlementId);
    const balances = calculateMemberNetBalances(group.members, group.expenses, updatedSettlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(group.members, group.expenses, updatedSettlements);

    setGroup({
      ...group,
      settlements: updatedSettlements,
      balances,
      activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
    });

    try {
      await fetch(`/api/groups/${group.id}/settlements/${settlementId}`, { method: 'DELETE' });
    } catch {
      fetchGroup(true);
    }
  };

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
        <div className="flex items-center gap-3">
          {(() => {
            const catInfo = getGroupCategoryInfo(group.category);
            const CatIcon = catInfo.icon;
            return (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs shrink-0 ${catInfo.bg} ${catInfo.color} ${catInfo.border}`}>
                <CatIcon className="w-4 h-4" />
              </div>
            );
          })()}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900">{group.name}</span>
              <span className="text-[11px] font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">
                {group.joinCode}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
              <span>You are: <strong className="font-bold text-slate-800">{claimedMember?.name || 'Guest'}</strong></span>
              <button
                onClick={handleSwitchIdentity}
                className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                (Switch)
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAddExpenseOpen(true)}
          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          Add Bill
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Pending Join Requests for Group Admins */}
        {isUserAdmin && ((group as any).pendingMembers || []).length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                Pending Join Requests ({((group as any).pendingMembers || []).length})
              </span>
            </div>
            <div className="space-y-2">
              {((group as any).pendingMembers || []).map((pm: any) => (
                <div
                  key={pm.id}
                  className="bg-white p-3 rounded-xl border border-amber-200/80 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{pm.name}</div>
                    {pm.phone && (
                      <div className="text-[10px] text-slate-500 font-semibold">{pm.phone}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={async () => {
                        await fetch(`/api/groups/${group.id}/members/${pm.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'APPROVED', adminMemberId: currentMemberObj?.id }),
                        });
                        fetchGroup(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/groups/${group.id}/members/${pm.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'REJECTED', adminMemberId: currentMemberObj?.id }),
                        });
                        fetchGroup(true);
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Standing Card matching Screenshot 2 */}
        <div className="bg-slate-50/90 p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-center space-y-1">
          <span className="text-xs font-bold text-slate-500">
            Your Balance in this group
          </span>
          <div className="text-3xl font-black tracking-tight">
            {myBalance > 0 ? (
              <span className="text-emerald-700">+₹{(myBalance / 100).toFixed(2)}</span>
            ) : myBalance < 0 ? (
              <span className="text-orange-600">-₹{(Math.abs(myBalance) / 100).toFixed(2)}</span>
            ) : (
              <span className="text-slate-800">₹0.00</span>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-400">
            {myBalance > 0
              ? 'You Get Back'
              : myBalance < 0
              ? 'You Give'
              : 'All Settled Up!'}
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
                      <span className="text-xs font-bold text-slate-400">You pay</span>
                      <h4 className="font-bold text-slate-900 text-base">{t.toName}</h4>
                    </div>
                    <div className="text-xl font-black text-orange-600 tracking-tight">
                      ₹{numRupees.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {upiUrl && (
                      <a
                        href={upiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
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
            <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
              Friends who owe you ({transfersOwedToMe.length})
            </h3>
            {transfersOwedToMe.map((t, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{t.fromName}</h4>
                  <span className="text-xs text-emerald-700 font-bold">owes you</span>
                </div>
                <div className="text-xl font-black text-emerald-700 tracking-tight">
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
                      onClick={() => setSelectedTransaction(item)}
                      className="bg-white p-4 rounded-2xl border border-slate-100/90 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3 text-xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl ${badge.bg} flex items-center justify-center shrink-0`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-base truncate">
                            {item.title}
                          </div>
                          <div className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                            {item.payerNames} paid • {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-slate-900 text-base sm:text-lg block">
                          ₹{totalRupees.toFixed(2)}
                        </span>
                        <span className="text-xs font-semibold text-slate-400 capitalize">
                          {item.raw?.splitType ? String(item.raw.splitType).toLowerCase() : 'equal'}
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedTransaction(item)}
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3 text-xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-base truncate">
                            {item.title}
                          </div>
                          <div className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                            Settlement • {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-emerald-700 text-base sm:text-lg block">
                          ₹{totalRupees.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-emerald-600">
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
      <TransactionDetailsModal
        isOpen={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        item={selectedTransaction}
        members={group.members || []}
        currentUserId={claimedMember?.id}
        isAdmin={isUserAdmin}
        onEdit={(tx) => {
          if (!isUserAdmin) return;
          setSelectedTransaction(null);
          if (tx.type === 'EXPENSE') {
            setEditingExpense(tx.raw);
            setIsAddExpenseOpen(true);
          } else {
            setSettlePreload({
              payerId: tx.raw.payerId,
              receiverId: tx.raw.receiverId,
              amountPaisa: tx.raw.amountPaisa,
            });
            setIsSettleOpen(true);
          }
        }}
        onDelete={(tx) => {
          if (!isUserAdmin) return;
          setSelectedTransaction(null);
          if (tx.type === 'EXPENSE') {
            handleDeleteExpense(tx.id);
          } else {
            handleDeleteSettlement(tx.id);
          }
        }}
      />

      <AddExpenseScreen
        isOpen={isAddExpenseOpen}
        onClose={() => {
          setIsAddExpenseOpen(false);
          setEditingExpense(null);
        }}
        groupId={group.id}
        groupName={group.name}
        members={group.members || []}
        onExpenseAdded={handleExpenseAdded}
        defaultPayerId={claimedMember?.id}
        initialExpense={editingExpense}
      />

      <SettleUpModal
        isOpen={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        groupId={group.id}
        members={group.members || []}
        onSettled={handleSettled}
        initialPayerId={settlePreload.payerId}
        initialReceiverId={settlePreload.receiverId}
        initialAmountPaisa={settlePreload.amountPaisa}
      />
    </div>
  );
}
