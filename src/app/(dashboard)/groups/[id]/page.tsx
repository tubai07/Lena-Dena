'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Receipt,
  ReceiptText,
  ChevronDown,
  ChevronUp,
  Fuel,
  Wine,
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
  Sparkles,
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
import { getGroupCategoryInfo, GROUP_CATEGORIES } from '@/lib/groupIcons';

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
  category?: string;
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
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isStandingExpanded, setIsStandingExpanded] = useState(true);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const lastScrollY = useRef(0);

  // Tracking deleted items so polling never revives them
  const deletedExpenseIdsRef = useRef<Set<string>>(new Set());
  const deletedSettlementIdsRef = useRef<Set<string>>(new Set());
  const deletedMemberIdsRef = useRef<Set<string>>(new Set());

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

        // Preserve in-flight optimistic expenses that server hasn't returned yet (prevents vanishing glitch!)
        const serverExpIds = new Set(data.group.expenses.map((e: any) => e.id));
        const pendingExpenses = prev.expenses.filter((e) => {
          if (deletedExpenseIdsRef.current.has(e.id)) return false;
          if (serverExpIds.has(e.id)) return false;
          return true; // Retain recent local additions
        });
        const mergedExpenses = [...pendingExpenses, ...data.group.expenses].filter(
          (e) => !deletedExpenseIdsRef.current.has(e.id)
        );

        // Preserve in-flight optimistic settlements
        const serverStIds = new Set(data.group.settlements.map((s: any) => s.id));
        const pendingSettlements = prev.settlements.filter((s) => {
          if (deletedSettlementIdsRef.current.has(s.id)) return false;
          if (serverStIds.has(s.id)) return false;
          return true;
        });
        const mergedSettlements = [...pendingSettlements, ...data.group.settlements].filter(
          (s) => !deletedSettlementIdsRef.current.has(s.id)
        );

        // Filter out locally removed members
        const mergedMembers = data.group.members.filter(
          (m: any) => !deletedMemberIdsRef.current.has(m.id)
        );

        const balances = calculateMemberNetBalances(mergedMembers, mergedExpenses, mergedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(mergedMembers, mergedExpenses, mergedSettlements);
        const totalSpendPaisa = mergedExpenses.reduce((sum, e) => sum + e.totalAmountPaisa, 0);

        const updated = {
          ...data.group,
          category: prev.category || data.group.category,
          members: mergedMembers,
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
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 60 && currentScrollY > lastScrollY.current) {
        setIsScrolledDown(true);
      } else if (currentScrollY < lastScrollY.current || currentScrollY <= 40) {
        setIsScrolledDown(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Instant optimistic group category / theme update
  const handleUpdateCategory = async (newCategory: string) => {
    if (!group) return;
    setShowIconPicker(false);
    const updated = {
      ...group,
      category: newCategory,
    };
    setGroup(updated);
    setCachedItem(`group_${id}`, updated);

    try {
      await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
    } catch (e) {
      console.error('Failed to update group category:', e);
    }
  };

  // Instant optimistic expense addition or modification (NO 150ms premature refetch!)
  const handleExpenseAdded = (newExpense?: any) => {
    if (newExpense) {
      // Clear from deleted set in case it was re-added
      deletedExpenseIdsRef.current.delete(newExpense.id);

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
  };

  // Instant optimistic settlement addition (NO 150ms premature refetch!)
  const handleSettled = (newSettlement?: any) => {
    if (newSettlement) {
      deletedSettlementIdsRef.current.delete(newSettlement.id);

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
  };

  // Instant 0ms optimistic expense deletion without thread-blocking confirm popup
  const handleDeleteExpense = async (expenseId: string) => {
    deletedExpenseIdsRef.current.add(expenseId);
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
      deletedExpenseIdsRef.current.delete(expenseId);
      fetchGroup(true);
    }
  };

  // Instant 0ms optimistic settlement deletion without thread-blocking confirm popup
  const handleDeleteSettlement = async (settlementId: string) => {
    deletedSettlementIdsRef.current.add(settlementId);
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
      deletedSettlementIdsRef.current.delete(settlementId);
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

  // Instant optimistic member removal by Creator
  const handleRemoveMember = async (memberId: string) => {
    if (!group) return;
    const target = group.members.find((m) => m.id === memberId);
    if (!target) return;
    if (target.isOwner) {
      return;
    }

    // 0ms optimistic removal
    deletedMemberIdsRef.current.add(memberId);
    const updatedMembers = group.members.filter((m) => m.id !== memberId);
    const balances = calculateMemberNetBalances(updatedMembers, group.expenses, group.settlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(updatedMembers, group.expenses, group.settlements);

    const updated = {
      ...group,
      members: updatedMembers,
      balances,
      simplifiedTransfers,
      directTransfers,
      activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
    };
    setGroup(updated);
    setCachedItem(`group_${id}`, updated);

    try {
      const res = await fetch(`/api/groups/${id}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        deletedMemberIdsRef.current.delete(memberId);
        fetchGroup(true);
      }
    } catch (e) {
      console.error('Failed to remove member:', e);
      deletedMemberIdsRef.current.delete(memberId);
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

  // Calculate what the current user lent or borrowed for an expense
  const getExpenseUserShare = (exp: Expense, currentMemberId?: string) => {
    const myPaid = exp.payers?.find((p) => p.memberId === currentMemberId)?.amountPaisa || 0;
    const mySplit = exp.splits?.find((s) => s.memberId === currentMemberId)?.amountPaisa || 0;
    const diff = myPaid - mySplit;

    if (myPaid === 0 && mySplit === 0) {
      return {
        status: 'not involved',
        color: 'text-slate-500',
        amountColor: 'text-slate-500',
        amountText: '0.00',
      };
    }

    if (diff > 0) {
      return {
        status: 'you lent',
        color: 'text-emerald-400',
        amountColor: 'text-emerald-400',
        amountText: (diff / 100).toFixed(2),
      };
    }

    if (diff < 0) {
      return {
        status: 'you borrowed',
        color: 'text-orange-400',
        amountColor: 'text-orange-400',
        amountText: (Math.abs(diff) / 100).toFixed(2),
      };
    }

    return {
      status: 'no debt',
      color: 'text-slate-400',
      amountColor: 'text-slate-400',
      amountText: '0.00',
    };
  };

  // Settlement user share calculation
  const getSettlementUserShare = (st: Settlement, currentMemberId?: string) => {
    const amount = (st.amountPaisa / 100).toFixed(2);
    if (st.payerId === currentMemberId) {
      return {
        status: 'you paid',
        color: 'text-emerald-400',
        amountColor: 'text-emerald-400',
        amountText: amount,
      };
    }
    if (st.receiverId === currentMemberId) {
      return {
        status: 'paid to you',
        color: 'text-emerald-400',
        amountColor: 'text-emerald-400',
        amountText: amount,
      };
    }
    return {
      status: 'settled',
      color: 'text-slate-400',
      amountColor: 'text-slate-400',
      amountText: amount,
    };
  };

  // Human-friendly subtitle for expenses matching Screenshot 1
  const getExpenseSubtitle = (exp: Expense, currentMemberId?: string) => {
    const payers = exp.payers || [];
    if (payers.length === 1) {
      const p = payers[0];
      const isMe = p.memberId === currentMemberId;
      const name = isMe ? 'You' : p.member?.name || 'Someone';
      return `${name} paid ₹${(p.amountPaisa / 100).toFixed(2)}`;
    }
    if (payers.length > 1) {
      return `${payers.length} people paid ₹${(exp.totalAmountPaisa / 100).toFixed(2)}`;
    }
    return `Total ₹${(exp.totalAmountPaisa / 100).toFixed(2)}`;
  };

  // Category Icon helper matching Screenshot 1 (Fuel, Food, Drinks, etc.)
  const getExpenseItemIcon = (category?: string, description?: string) => {
    const text = `${category || ''} ${description || ''}`.toLowerCase();
    if (text.includes('fuel') || text.includes('petrol') || text.includes('diesel') || text.includes('gas')) {
      return Fuel;
    }
    if (text.includes('drink') || text.includes('wine') || text.includes('beer') || text.includes('alcohol') || text.includes('bar')) {
      return Wine;
    }
    if (text.includes('food') || text.includes('dinner') || text.includes('lunch') || text.includes('breakfast') || text.includes('meal') || text.includes('restaurant') || text.includes('chakna')) {
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

  // Group activity by Month Year (e.g. "October 2024", "September 2026") matching Screenshot 1
  const groupedActivity = useMemo(() => {
    const groups: { monthYear: string; items: typeof activityItems }[] = [];
    const map = new Map<string, typeof activityItems>();

    activityItems.forEach((item) => {
      const key = item.date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      if (!map.has(key)) {
        map.set(key, []);
        groups.push({ monthYear: key, items: map.get(key)! });
      }
      map.get(key)!.push(item);
    });

    return groups;
  }, [activityItems]);

  // Overall standing calculations using the user's plain language dictionary:
  // "You are owed $45" -> "3 people need to pay you back $45"
  const peopleOwingMe = displayedTransfers.filter((t) => t.toId === ownerMember?.id);
  const peopleIOwe = displayedTransfers.filter((t) => t.fromId === ownerMember?.id);

  let standingSentenceNode: React.ReactNode;
  if (userBalance > 0) {
    const count = peopleOwingMe.length;
    const countLabel = count === 1 ? '1 person needs' : `${count} people need`;
    standingSentenceNode = (
      <span>
        {countLabel} to pay you back{' '}
        <span className="text-emerald-400 font-extrabold">
          ₹{(userBalance / 100).toFixed(2)}
        </span>{' '}
        overall
      </span>
    );
  } else if (userBalance < 0) {
    standingSentenceNode = (
      <span>
        You need to pay back{' '}
        <span className="text-orange-400 font-extrabold">
          ₹{(Math.abs(userBalance) / 100).toFixed(2)}
        </span>{' '}
        overall
      </span>
    );
  } else {
    standingSentenceNode = (
      <span className="text-slate-300">
        You are all squared away overall
      </span>
    );
  }

  // Sub-breakdown items matching Screenshot 1 ("Togo owes you ₹501.18", "Mantu owes you ₹501.17")
  const subBalances = useMemo(() => {
    if (userBalance > 0) {
      return peopleOwingMe.map((t) => ({
        text: (
          <span>
            {t.fromName} owes you{' '}
            <span className="text-emerald-400 font-bold">
              ₹{(t.amountPaisa / 100).toFixed(2)}
            </span>
          </span>
        ),
      }));
    }
    if (userBalance < 0) {
      return peopleIOwe.map((t) => ({
        text: (
          <span>
            You owe {t.toName}{' '}
            <span className="text-orange-400 font-bold">
              ₹{(t.amountPaisa / 100).toFixed(2)}
            </span>
          </span>
        ),
      }));
    }
    return [];
  }, [userBalance, peopleOwingMe, peopleIOwe]);

  const displayedSubBalances = subBalances.slice(0, 2);
  const remainingCount = Math.max(0, subBalances.length - displayedSubBalances.length);

  return (
    <div className="w-full min-h-screen bg-[#141416] text-white select-none pb-28 relative">
      {/* Group Header Banner with Emerald Gradient Pattern matching Screenshot 1 */}
      <div className="relative bg-gradient-to-b from-teal-700 via-emerald-700 to-emerald-800 text-white px-4 pt-4 pb-5 overflow-hidden">
        {/* Decorative geometric overlay matching Screenshot 1 */}
        <div className="absolute inset-0 pointer-events-none opacity-15">
          <div className="absolute -top-12 -right-8 w-44 h-44 rounded-3xl bg-white/20 rotate-12" />
          <div className="absolute top-10 left-1/3 w-36 h-8 rounded-full bg-white/30 -rotate-6" />
          <div className="absolute bottom-2 right-12 w-28 h-6 rounded-full bg-white/25 -rotate-6" />
          <div className="absolute bottom-8 left-6 w-20 h-5 rounded-full bg-white/20 -rotate-6" />
        </div>

        {/* Top Navigation Row: Back Button on left (NO SETTING BUTTON AT THE TOP per user constraint) */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/groups"
            className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/40 backdrop-blur-md flex items-center justify-center text-white tap-effect transition-colors"
            aria-label="Back to Groups"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>

          {/* Theme Category Icon with interactive selector */}
          <div className="relative">
            {(() => {
              const catInfo = getGroupCategoryInfo(group.category);
              const GroupCatIcon = catInfo.icon;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/40 backdrop-blur-md flex items-center justify-center text-white tap-effect transition-colors cursor-pointer"
                    title="Change Group Theme"
                  >
                    <GroupCatIcon className="w-5 h-5" />
                  </button>

                  {showIconPicker && (
                    <div className="absolute right-0 top-12 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 grid grid-cols-4 gap-1.5 w-68 animate-in fade-in zoom-in-95">
                      <div className="col-span-4 px-1 py-0.5 flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
                        <span className="text-[11px] font-bold text-white">Select Group Theme</span>
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(false)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {GROUP_CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = (group.category || 'Trip') === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleUpdateCategory(cat.id)}
                            className={`p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-emerald-500 bg-emerald-950/60 shadow-2xs'
                                : 'hover:bg-slate-800'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg} ${cat.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-200 truncate w-full text-center">
                              {cat.id}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Large Title & People Pill matching Screenshot 1 */}
        <div className="relative z-10 mt-4 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight truncate">
            {group.name}
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-white/90 text-xs font-bold">
              <Users className="w-3.5 h-3.5" />
              <span>{group.members.length} people</span>
            </div>

            {/* Tap to copy code pill */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 hover:bg-black/35 backdrop-blur-md text-white/80 text-xs font-semibold tap-effect cursor-pointer"
              title="Tap to copy invite code"
            >
              <span>Code: <span className="font-mono font-bold text-white">{group.joinCode}</span></span>
              {copiedCode ? (
                <span className="text-emerald-300 font-bold flex items-center gap-0.5 text-[11px]">
                  <Check className="w-3 h-3 stroke-[3]" /> Copied
                </span>
              ) : (
                <Copy className="w-3 h-3 opacity-60" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Overall Standing & Action Pills matching Screenshot 1 */}
      <div className="bg-[#18181b] border-b border-slate-800/80 px-4 py-4 text-white">
        {/* Collapsible Standing Sentence */}
        <button
          type="button"
          onClick={() => setIsStandingExpanded(!isStandingExpanded)}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
        >
          <div className="text-base sm:text-lg font-bold text-slate-100">
            {standingSentenceNode}
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-white shrink-0 transition-colors">
            {isStandingExpanded ? (
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            )}
          </div>
        </button>

        {/* Expanded Breakdown with left line matching Screenshot 1 */}
        {isStandingExpanded && subBalances.length > 0 && (
          <div className="mt-3 pl-3 border-l-2 border-slate-700/80 space-y-1 text-xs sm:text-sm">
            {displayedSubBalances.map((b, idx) => (
              <div key={idx} className="text-slate-300 font-medium">
                {b.text}
              </div>
            ))}
            {remainingCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('balances')}
                className="text-xs text-slate-400 hover:text-slate-200 font-semibold pt-0.5 cursor-pointer block"
              >
                Plus {remainingCount} more balances
              </button>
            )}
          </div>
        )}

        {/* Horizontal Action Pills matching Screenshot 1 */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => {
              setSettlePreload({});
              setIsSettleOpen(true);
            }}
            className="px-4 py-2 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
            <span>Mark this as paid</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'balances' ? 'activity' : 'balances')}
            className={`px-4 py-2 rounded-full border font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs ${
              activeTab === 'balances'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-indigo-300 stroke-[2.5]" />
            <span>Who owes who</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleSimplify(!group.simplifyDebts)}
            className={`px-4 py-2 rounded-full border font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs ${
              group.simplifyDebts
                ? 'border-emerald-700 bg-emerald-950/70 text-emerald-300'
                : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Clean up who pays who (minimize transactions)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
            <span>Clean up who pays who: {group.simplifyDebts ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'members' ? 'activity' : 'members')}
            className={`px-4 py-2 rounded-full border font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs ${
              activeTab === 'members'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" />
            <span>People</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 pt-4 pb-28">
        {/* ================= TAB 1: ACTIVITY LIST (Screenshot 1) ================= */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search expenses by title, person..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 text-sm font-medium bg-[#1e1e22] border border-slate-800 rounded-xl focus:outline-hidden focus:border-emerald-500 placeholder:text-slate-500 text-white transition-colors"
              />
              {activitySearch && (
                <button
                  type="button"
                  onClick={() => setActivitySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Empty State */}
            {activityItems.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ReceiptText className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="font-bold text-slate-300 text-base">
                  {activitySearch ? 'No matching expenses' : 'No expenses yet'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {activitySearch
                    ? 'Try searching with a different term.'
                    : 'Tap the button below to record what you spent money on.'}
                </p>
              </div>
            ) : (
              /* Monthly Grouped Activity matching Screenshot 1 */
              <div className="space-y-6">
                {groupedActivity.map((groupMonth) => (
                  <div key={groupMonth.monthYear} className="space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight px-1">
                      {groupMonth.monthYear}
                    </h3>

                    <div className="divide-y divide-slate-800/80">
                      {groupMonth.items.map((item) => {
                        const monthShort = item.date.toLocaleDateString('en-US', { month: 'short' });
                        const dayNum = item.date.getDate();

                        if (item.type === 'EXPENSE') {
                          const exp = item.raw;
                          const share = getExpenseUserShare(exp, ownerMember?.id);
                          const subtitle = getExpenseSubtitle(exp, ownerMember?.id);
                          const ItemIcon = getExpenseItemIcon(exp.category, exp.description);

                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                setEditingExpense(item.raw);
                                setIsAddExpenseOpen(true);
                              }}
                              className="py-3 px-1 flex items-center justify-between gap-3 hover:bg-slate-900/40 rounded-xl transition-colors cursor-pointer group"
                            >
                              {/* Left Column: Date Block + Category Icon Tile */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-9 text-center shrink-0">
                                  <span className="text-[11px] font-bold text-slate-400 block uppercase leading-none">
                                    {monthShort}
                                  </span>
                                  <span className="text-base font-bold text-slate-200 block leading-tight mt-0.5">
                                    {dayNum}
                                  </span>
                                </div>

                                <div className="w-12 h-12 rounded-xl bg-[#222226] border border-slate-700/80 flex items-center justify-center text-slate-200 shrink-0 group-hover:border-emerald-600/60 transition-colors shadow-2xs">
                                  <ItemIcon className="w-6 h-6" />
                                </div>

                                {/* Middle Column: Title & Subtitle */}
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-base font-bold text-white truncate leading-snug">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                                    {subtitle}
                                  </p>
                                </div>
                              </div>

                              {/* Right Column: User Share (you lent / you borrowed) */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right shrink-0">
                                  <span className={`text-[11px] font-semibold block ${share.color}`}>
                                    {share.status}
                                  </span>
                                  <span className={`text-base sm:text-lg font-black block tracking-tight ${share.amountColor}`}>
                                    ₹{share.amountText}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteExpense(item.id);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
                                  title="Delete Expense"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        } else {
                          // Settlement Item
                          const st = item.raw;
                          const share = getSettlementUserShare(st, ownerMember?.id);

                          return (
                            <div
                              key={item.id}
                              className="py-3 px-1 flex items-center justify-between gap-3 hover:bg-slate-900/40 rounded-xl transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-9 text-center shrink-0">
                                  <span className="text-[11px] font-bold text-slate-400 block uppercase leading-none">
                                    {monthShort}
                                  </span>
                                  <span className="text-base font-bold text-slate-200 block leading-tight mt-0.5">
                                    {dayNum}
                                  </span>
                                </div>

                                <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0 shadow-2xs">
                                  <CheckCircle2 className="w-6 h-6" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h4 className="text-base font-bold text-white truncate leading-snug">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                                    Payment recorded
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right shrink-0">
                                  <span className={`text-[11px] font-semibold block ${share.color}`}>
                                    {share.status}
                                  </span>
                                  <span className={`text-base sm:text-lg font-black block tracking-tight ${share.amountColor}`}>
                                    ₹{share.amountText}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSettlement(item.id);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
                                  title="Delete Settlement"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: BALANCES ("Who owes who") ================= */}
        {activeTab === 'balances' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Who owes who</h3>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
              >
                Back to Activity
              </button>
            </div>

            {displayedTransfers.length === 0 ? (
              <div className="bg-[#1e1e22] rounded-2xl p-8 border border-slate-800 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-base">All settled up!</h4>
                <p className="text-xs text-slate-400">Nobody owes anyone anything in this group.</p>
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
                        note: `${group.name} payment to ${t.toName}`,
                      })
                    : null;

                  return (
                    <div
                      key={idx}
                      className="bg-[#1e1e22] p-4 rounded-2xl border border-slate-800 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${getAvatarBg(
                              t.fromName
                            )}`}
                          >
                            {t.fromName.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-sm truncate">
                            <span className="font-bold text-white">{t.fromName}</span>
                            <span className="text-slate-400 mx-1 text-xs">owes</span>
                            <span className="font-bold text-emerald-400">{t.toName}</span>
                          </div>
                        </div>
                        <div className="font-black text-orange-400 text-lg tracking-tight shrink-0">
                          ₹{numRupees.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                        {upiUrl && (
                          <a
                            href={upiUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Pay UPI</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSettlePreload({
                              payerId: t.fromId,
                              receiverId: t.toId,
                              amountPaisa: t.amountPaisa,
                            });
                            setIsSettleOpen(true);
                          }}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark this as paid</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: MEMBERS ("People") ================= */}
        {activeTab === 'members' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">People ({group.members.length})</h3>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
              >
                Back to Activity
              </button>
            </div>

            {/* Quick Add Friend */}
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                placeholder="Friend's name (e.g. Amit)..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-800 bg-[#1e1e22] text-white focus:outline-hidden focus:border-emerald-500 placeholder:text-slate-500 transition-colors"
              />
              <button
                type="submit"
                disabled={addingMember || !newMemberName.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
              >
                {addingMember ? 'Adding...' : 'Add'}
              </button>
            </form>

            {/* Members List */}
            <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-[#1e1e22] overflow-hidden">
              {group.balances.map((b) => (
                <div
                  key={b.memberId}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full font-bold flex items-center justify-center text-sm shrink-0 border border-white/10 ${getAvatarBg(
                        b.name
                      )}`}
                    >
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-base truncate">
                          {b.name}
                        </span>
                        {b.isOwner ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full">
                            Creator & Admin
                          </span>
                        ) : b.isAdmin ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full">
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs font-medium text-slate-400 block mt-0.5">
                        Paid: ₹{(b.totalPaidPaisa / 100).toFixed(0)} • Share: ₹
                        {(b.totalOwedPaisa / 100).toFixed(0)}
                      </span>

                      {/* Creator Admin Controls */}
                      {!b.isOwner && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(b.memberId, Boolean(b.isAdmin))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              b.isAdmin
                                ? 'text-slate-400 border-slate-700 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800'
                                : 'text-indigo-300 border-indigo-800 bg-indigo-950/60 hover:bg-indigo-900'
                            }`}
                          >
                            {b.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveMember(b.memberId)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 border border-rose-800 transition-all cursor-pointer flex items-center gap-1"
                            title={`Remove ${b.name} from group`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    {b.netBalancePaisa > 0 ? (
                      <span className="text-base sm:text-lg font-black text-emerald-400 block">
                        +₹{(b.netBalancePaisa / 100).toFixed(2)}
                      </span>
                    ) : b.netBalancePaisa < 0 ? (
                      <span className="text-base sm:text-lg font-black text-orange-400 block">
                        -₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-base sm:text-lg font-black text-slate-400 block">₹0</span>
                    )}
                    <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
                      {b.netBalancePaisa > 0
                        ? 'Gets back'
                        : b.netBalancePaisa < 0
                        ? 'Owes'
                        : 'Settled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button: smooth animated morphing like ledger fab-add-person */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto pointer-events-none px-4 flex justify-end z-30 animate-fab-enter">
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setIsAddExpenseOpen(true);
          }}
          className={`pointer-events-auto fab-add-person flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm shadow-2xl shadow-black/50 overflow-hidden cursor-pointer ${
            isScrolledDown ? 'w-[52px]' : 'w-[156px]'
          }`}
          title="What did you spend money on?"
          aria-label="What did you spend money on?"
        >
          <div className="w-[52px] h-[52px] flex items-center justify-center shrink-0">
            <ReceiptText className="w-5 h-5 stroke-[2.2px]" />
          </div>
          <span
            className={`whitespace-nowrap fab-text-wrapper overflow-hidden font-bold pr-4 ${
              isScrolledDown ? 'max-w-0 opacity-0 !pr-0' : 'max-w-[110px] opacity-100'
            }`}
          >
            Add expense
          </span>
        </button>
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
        transfers={displayedTransfers}
        currentUserId={ownerMember?.id}
        onSettled={handleSettled}
        initialPayerId={settlePreload.payerId}
        initialReceiverId={settlePreload.receiverId}
        initialAmountPaisa={settlePreload.amountPaisa}
      />
    </div>
  );
}
