'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
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
  Sparkles,
  AlertCircle,
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

  // Add Member inputs with mandatory phone number
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [memberError, setMemberError] = useState('');
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

        // Preserve in-flight optimistic expenses that server hasn't returned yet
        const serverExpIds = new Set(data.group.expenses.map((e: any) => e.id));
        const pendingExpenses = prev.expenses.filter((e) => {
          if (deletedExpenseIdsRef.current.has(e.id)) return false;
          if (serverExpIds.has(e.id)) return false;
          return true;
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
    fetchGroup();

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

  // Instant optimistic expense addition or modification
  const handleExpenseAdded = (newExpense?: any) => {
    if (newExpense) {
      deletedExpenseIdsRef.current.delete(newExpense.id);

      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.expenses.filter((e) => {
          if (e.id === newExpense.id) return false;
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

  // Instant optimistic settlement addition
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

  // Instant 0ms optimistic expense deletion
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

  // Instant 0ms optimistic settlement deletion
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

  // Safe member removal with strict settlement check:
  // "The user cannot delete anyone inside the group unless they have settled everything"
  const handleRemoveMember = async (memberId: string) => {
    if (!group) return;
    const target = group.members.find((m) => m.id === memberId);
    if (!target) return;
    if (target.isOwner) {
      alert('The group creator cannot be removed from the group.');
      return;
    }

    // Check unsettled balance
    const memberBal = group.balances.find((b) => b.memberId === memberId);
    if (memberBal && Math.abs(memberBal.netBalancePaisa) > 0) {
      const amt = (Math.abs(memberBal.netBalancePaisa) / 100).toFixed(2);
      const direction = memberBal.netBalancePaisa > 0 ? 'is owed' : 'owes';
      alert(
        `Cannot remove ${target.name} because they have an unsettled balance (${direction} ₹${amt}). All dues must be settled first.`
      );
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
        const data = await res.json();
        alert(data.error || 'Failed to remove member');
        deletedMemberIdsRef.current.delete(memberId);
        fetchGroup(true);
      }
    } catch (e) {
      console.error('Failed to remove member:', e);
      deletedMemberIdsRef.current.delete(memberId);
      fetchGroup(true);
    }
  };

  // Member addition with MANDATORY phone number
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    const cleanName = newMemberName.trim();
    const cleanPhone = newMemberPhone.replace(/\D/g, '');

    if (!cleanName) {
      setMemberError("Please enter friend's name");
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      setMemberError('Valid 10-digit phone number is mandatory');
      return;
    }
    if (!group) return;

    if (group.members.some((m) => m.name.toLowerCase() === cleanName.toLowerCase())) {
      setMemberError('A member with this name already exists in the group');
      return;
    }
    if (group.members.some((m) => m.phone && m.phone.replace(/\D/g, '') === cleanPhone)) {
      setMemberError('A member with this phone number already exists in the group');
      return;
    }

    setNewMemberName('');
    setNewMemberPhone('');

    const optimisticMember: Member = {
      id: `temp_m_${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      isOwner: false,
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
      const res = await fetch(`/api/groups/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Failed to add member');
        fetchGroup(true);
      } else {
        fetchGroup(true);
      }
    } catch (e: any) {
      console.error(e);
      setMemberError(e.message || 'Error adding member');
      fetchGroup(true);
    } finally {
      setAddingMember(false);
    }
  };

  if (loading && !group) {
    return (
      <div className="p-4 space-y-4 animate-pulse bg-slate-50 min-h-screen">
        <div className="h-12 bg-slate-200 rounded-2xl w-3/4"></div>
        <div className="h-32 bg-slate-200 rounded-3xl"></div>
        <div className="h-44 bg-slate-200 rounded-3xl"></div>
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

  // Calculate user share for an expense
  const getExpenseUserShare = (exp: Expense, currentMemberId?: string) => {
    const myPaid = exp.payers?.find((p) => p.memberId === currentMemberId)?.amountPaisa || 0;
    const mySplit = exp.splits?.find((s) => s.memberId === currentMemberId)?.amountPaisa || 0;
    const diff = myPaid - mySplit;

    if (myPaid === 0 && mySplit === 0) {
      return {
        status: 'not involved',
        color: 'text-slate-400',
        amountColor: 'text-slate-400',
        amountText: '0.00',
      };
    }

    if (diff > 0) {
      return {
        status: 'you lent',
        color: 'text-emerald-600',
        amountColor: 'text-emerald-600',
        amountText: (diff / 100).toFixed(2),
      };
    }

    if (diff < 0) {
      return {
        status: 'you borrowed',
        color: 'text-amber-600',
        amountColor: 'text-amber-600',
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
        color: 'text-emerald-600',
        amountColor: 'text-emerald-600',
        amountText: amount,
      };
    }
    if (st.receiverId === currentMemberId) {
      return {
        status: 'paid to you',
        color: 'text-emerald-600',
        amountColor: 'text-emerald-600',
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

  // Human-friendly subtitle for expenses
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

  // Category Icon helper matching Lena Dena design
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

  // Group activity by Month Year
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

  // Overall standing calculations:
  // "3 people need to pay you back $45" or "You are owed $45 overall" (Never outputs 0 people!)
  const peopleOwingMe = displayedTransfers.filter((t) => t.toId === ownerMember?.id);
  const peopleIOwe = displayedTransfers.filter((t) => t.fromId === ownerMember?.id);
  const membersOwingMe = group.balances.filter(
    (b) => b.memberId !== ownerMember?.id && b.netBalancePaisa < 0
  );
  const membersIowe = group.balances.filter(
    (b) => b.memberId !== ownerMember?.id && b.netBalancePaisa > 0
  );

  let standingSentenceNode: React.ReactNode;
  if (userBalance > 0) {
    const count = peopleOwingMe.length > 0 ? peopleOwingMe.length : membersOwingMe.length;
    if (count > 0) {
      const countLabel = count === 1 ? '1 person needs' : `${count} people need`;
      standingSentenceNode = (
        <span>
          {countLabel} to pay you back{' '}
          <span className="text-emerald-600 font-extrabold">
            ₹{(userBalance / 100).toFixed(2)}
          </span>{' '}
          overall
        </span>
      );
    } else {
      standingSentenceNode = (
        <span>
          You are owed{' '}
          <span className="text-emerald-600 font-extrabold">
            ₹{(userBalance / 100).toFixed(2)}
          </span>{' '}
          overall
        </span>
      );
    }
  } else if (userBalance < 0) {
    const count = peopleIOwe.length > 0 ? peopleIOwe.length : membersIowe.length;
    if (count > 0) {
      standingSentenceNode = (
        <span>
          You need to pay back{' '}
          <span className="text-amber-600 font-extrabold">
            ₹{(Math.abs(userBalance) / 100).toFixed(2)}
          </span>{' '}
          overall
        </span>
      );
    } else {
      standingSentenceNode = (
        <span>
          You need to pay back{' '}
          <span className="text-amber-600 font-extrabold">
            ₹{(Math.abs(userBalance) / 100).toFixed(2)}
          </span>{' '}
          overall
        </span>
      );
    }
  } else {
    standingSentenceNode = (
      <span className="text-slate-600 font-bold">
        You are all squared away overall
      </span>
    );
  }

  // Sub-breakdown items
  const subBalances = useMemo(() => {
    if (userBalance > 0) {
      if (peopleOwingMe.length > 0) {
        return peopleOwingMe.map((t) => ({
          text: (
            <span>
              {t.fromName} owes you{' '}
              <span className="text-emerald-600 font-bold">
                ₹{(t.amountPaisa / 100).toFixed(2)}
              </span>
            </span>
          ),
        }));
      }
      if (membersOwingMe.length > 0) {
        return membersOwingMe.map((m) => ({
          text: (
            <span>
              {m.name} owes{' '}
              <span className="text-emerald-600 font-bold">
                ₹{(Math.abs(m.netBalancePaisa) / 100).toFixed(2)}
              </span>
            </span>
          ),
        }));
      }
    }
    if (userBalance < 0) {
      if (peopleIOwe.length > 0) {
        return peopleIOwe.map((t) => ({
          text: (
            <span>
              You owe {t.toName}{' '}
              <span className="text-amber-600 font-bold">
                ₹{(t.amountPaisa / 100).toFixed(2)}
              </span>
            </span>
          ),
        }));
      }
      if (membersIowe.length > 0) {
        return membersIowe.map((m) => ({
          text: (
            <span>
              You owe {m.name}{' '}
              <span className="text-amber-600 font-bold">
                ₹{(m.netBalancePaisa / 100).toFixed(2)}
              </span>
            </span>
          ),
        }));
      }
    }
    return [];
  }, [userBalance, peopleOwingMe, peopleIOwe, membersOwingMe, membersIowe]);

  const displayedSubBalances = subBalances.slice(0, 2);
  const remainingCount = Math.max(0, subBalances.length - displayedSubBalances.length);

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 select-none pb-28 relative">
      {/* Group Header Banner with Emerald Gradient Pattern */}
      <div className="relative bg-gradient-to-b from-teal-700 via-emerald-700 to-emerald-800 text-white px-4 pt-4 pb-5 overflow-hidden">
        {/* Decorative geometric overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-15">
          <div className="absolute -top-12 -right-8 w-44 h-44 rounded-3xl bg-white/20 rotate-12" />
          <div className="absolute top-10 left-1/3 w-36 h-8 rounded-full bg-white/30 -rotate-6" />
          <div className="absolute bottom-2 right-12 w-28 h-6 rounded-full bg-white/25 -rotate-6" />
          <div className="absolute bottom-8 left-6 w-20 h-5 rounded-full bg-white/20 -rotate-6" />
        </div>

        {/* Top Navigation Row: Back Button on left (NO SETTING BUTTON AT THE TOP) */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/groups"
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/35 backdrop-blur-md flex items-center justify-center text-white tap-effect transition-colors"
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
                    className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/35 backdrop-blur-md flex items-center justify-center text-white tap-effect transition-colors cursor-pointer"
                    title="Change Group Theme"
                  >
                    <GroupCatIcon className="w-5 h-5" />
                  </button>

                  {showIconPicker && (
                    <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 grid grid-cols-4 gap-1.5 w-68 animate-in fade-in zoom-in-95 text-slate-900">
                      <div className="col-span-4 px-1 py-0.5 flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1">
                        <span className="text-[11px] font-bold text-slate-800">Select Group Theme</span>
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(false)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
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
                                ? 'ring-2 ring-emerald-600 bg-emerald-50 shadow-2xs'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg} ${cat.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
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

        {/* Large Title & People Pill */}
        <div className="relative z-10 mt-4 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight truncate">
            {group.name}
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 backdrop-blur-md text-white/90 text-xs font-bold">
              <Users className="w-3.5 h-3.5" />
              <span>{group.members.length} people</span>
            </div>

            {/* Tap to copy code pill */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 hover:bg-black/30 backdrop-blur-md text-white/80 text-xs font-semibold tap-effect cursor-pointer"
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

      {/* Overall Standing & Action Pills (White Theme) */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-4 text-slate-900 shadow-xs">
        {/* Collapsible Standing Sentence */}
        <button
          type="button"
          onClick={() => setIsStandingExpanded(!isStandingExpanded)}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
        >
          <div className="text-base sm:text-lg font-bold text-slate-900">
            {standingSentenceNode}
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-slate-900 shrink-0 transition-colors">
            {isStandingExpanded ? (
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            )}
          </div>
        </button>

        {/* Expanded Breakdown with left line */}
        {isStandingExpanded && subBalances.length > 0 && (
          <div className="mt-3 pl-3 border-l-2 border-slate-200 space-y-1 text-xs sm:text-sm text-slate-600 font-medium">
            {displayedSubBalances.map((b, idx) => (
              <div key={idx}>
                {b.text}
              </div>
            ))}
            {remainingCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('balances')}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold pt-0.5 cursor-pointer block"
              >
                Plus {remainingCount} more balances
              </button>
            )}
          </div>
        )}

        {/* Horizontal Action Pills with scrollbar line removed */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none no-scrollbar text-xs [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              setSettlePreload({});
              setIsSettleOpen(true);
            }}
            className="px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            <span>Mark this as paid</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'balances' ? 'activity' : 'balances')}
            className={`px-4 py-2 rounded-full border font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs ${
              activeTab === 'balances'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-indigo-500 stroke-[2.5]" />
            <span>Who owes who</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleSimplify(!group.simplifyDebts)}
            className={`px-4 py-2 rounded-full border font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs ${
              group.simplifyDebts
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            title="Clean up who pays who (minimize transactions)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 stroke-[2.5]" />
            <span>Clean up who pays who: {group.simplifyDebts ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'members' ? 'activity' : 'members')}
            className={`px-4 py-2 rounded-full border font-bold whitespace-nowrap tap-effect cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs ${
              activeTab === 'members'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-600 stroke-[2.5]" />
            <span>People</span>
          </button>
        </div>
      </div>

      {/* Main Content Area (Clean Light Theme) */}
      <div className="px-4 pt-4 pb-28">
        {/* ================= TAB 1: ACTIVITY LIST ================= */}
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
                className="w-full pl-10 pr-8 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-emerald-600 placeholder:text-slate-400 text-slate-900 shadow-2xs transition-colors"
              />
              {activitySearch && (
                <button
                  type="button"
                  onClick={() => setActivitySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Empty State */}
            {activityItems.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ReceiptText className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="font-bold text-slate-700 text-base">
                  {activitySearch ? 'No matching expenses' : 'No expenses yet'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {activitySearch
                    ? 'Try searching with a different term.'
                    : 'Tap "Add expense" below to record what you spent money on.'}
                </p>
              </div>
            ) : (
              /* Monthly Grouped Activity */
              <div className="space-y-5">
                {groupedActivity.map((groupMonth) => (
                  <div key={groupMonth.monthYear} className="space-y-2">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider px-1">
                      {groupMonth.monthYear}
                    </h3>

                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
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
                              className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            >
                              {/* Left Column: Date Block + Category Icon Tile */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-9 text-center shrink-0">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none">
                                    {monthShort}
                                  </span>
                                  <span className="text-base font-black text-slate-800 block leading-tight mt-0.5">
                                    {dayNum}
                                  </span>
                                </div>

                                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 group-hover:border-emerald-600/60 transition-colors shadow-2xs">
                                  <ItemIcon className="w-5 h-5" />
                                </div>

                                {/* Middle Column: Title & Subtitle */}
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-snug">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                    {subtitle}
                                  </p>
                                </div>
                              </div>

                              {/* Right Column: User Share */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right shrink-0">
                                  <span className={`text-[11px] font-bold block ${share.color}`}>
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
                                  className="p-1.5 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
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
                              className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-9 text-center shrink-0">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase leading-none">
                                    {monthShort}
                                  </span>
                                  <span className="text-base font-black text-slate-800 block leading-tight mt-0.5">
                                    {dayNum}
                                  </span>
                                </div>

                                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
                                  <CheckCircle2 className="w-5 h-5" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-snug">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                    Payment recorded
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right shrink-0">
                                  <span className={`text-[11px] font-bold block ${share.color}`}>
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
                                  className="p-1.5 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer"
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
              <h3 className="text-base font-bold text-slate-900">Who owes who</h3>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
              >
                Back to Activity
              </button>
            </div>

            {displayedTransfers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2 shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-base">All settled up!</h4>
                <p className="text-xs text-slate-500">Nobody owes anyone anything in this group.</p>
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
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
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
                            <span className="font-bold text-slate-900">{t.fromName}</span>
                            <span className="text-slate-500 mx-1 text-xs">owes</span>
                            <span className="font-bold text-emerald-700">{t.toName}</span>
                          </div>
                        </div>
                        <div className="font-black text-amber-600 text-lg tracking-tight shrink-0">
                          ₹{numRupees.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {upiUrl && (
                          <a
                            href={upiUrl}
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
              <h3 className="text-base font-bold text-slate-900">People ({group.members.length})</h3>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
              >
                Back to Activity
              </button>
            </div>

            {/* Quick Add Friend with Mandatory Phone Number */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Add Friend to Group</h4>
              {memberError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{memberError}</span>
                </div>
              )}
              <form onSubmit={handleAddMember} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Friend's name (e.g. Amit)..."
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      if (memberError) setMemberError('');
                    }}
                    className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:bg-white focus:border-emerald-600 placeholder:text-slate-400 transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="10-digit phone number *"
                    value={newMemberPhone}
                    maxLength={10}
                    onChange={(e) => {
                      setNewMemberPhone(e.target.value.replace(/\D/g, ''));
                      if (memberError) setMemberError('');
                    }}
                    className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:bg-white focus:border-emerald-600 placeholder:text-slate-400 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingMember || !newMemberName.trim() || newMemberPhone.trim().length < 10}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{addingMember ? 'Adding Friend...' : 'Add Friend'}</span>
                </button>
              </form>
            </div>

            {/* Members List */}
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              {group.balances.map((b) => (
                <div
                  key={b.memberId}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full font-bold flex items-center justify-center text-sm shrink-0 border border-slate-200 ${getAvatarBg(
                        b.name
                      )}`}
                    >
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-base truncate">
                          {b.name}
                        </span>
                        {b.isOwner ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            Creator & Admin
                          </span>
                        ) : b.isAdmin ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                            Admin
                          </span>
                        ) : null}
                      </div>

                      {b.phone && (
                        <span className="text-xs text-slate-500 block font-medium">
                          {b.phone}
                        </span>
                      )}

                      <span className="text-xs font-medium text-slate-500 block mt-0.5">
                        Paid: ₹{(b.totalPaidPaisa / 100).toFixed(0)} • Share: ₹
                        {(b.totalOwedPaisa / 100).toFixed(0)}
                      </span>

                      {/* Creator Admin Controls & Safe Deletion */}
                      {!b.isOwner && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(b.memberId, Boolean(b.isAdmin))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              b.isAdmin
                                ? 'text-slate-600 border-slate-200 hover:bg-slate-100'
                                : 'text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
                            }`}
                          >
                            {b.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>

                          {/* Deletion constraint: "The user cannot delete anyone inside the group unless they have settled everything" */}
                          {Math.abs(b.netBalancePaisa) === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(b.memberId)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                              title={`Remove ${b.name} from group`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200"
                              title="Member cannot be deleted until all dues are settled"
                            >
                              Settle ₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(0)} to remove
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    {b.netBalancePaisa > 0 ? (
                      <span className="text-base sm:text-lg font-black text-emerald-600 block">
                        +₹{(b.netBalancePaisa / 100).toFixed(2)}
                      </span>
                    ) : b.netBalancePaisa < 0 ? (
                      <span className="text-base sm:text-lg font-black text-amber-600 block">
                        -₹{(Math.abs(b.netBalancePaisa) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-base sm:text-lg font-black text-slate-400 block">₹0</span>
                    )}
                    <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
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

      {/* Floating Action Button: Add expense */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto pointer-events-none px-4 flex justify-end z-30 animate-fab-enter">
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setIsAddExpenseOpen(true);
          }}
          className={`pointer-events-auto fab-add-person flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm shadow-xl shadow-emerald-950/20 overflow-hidden cursor-pointer ${
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

      {/* Group Dedicated Bottom Dock: Different from the global Ledger/Split dock */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 shadow-lg">
        <div className="flex items-center justify-around">
          {/* Tab 1: Activity */}
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-colors ${
                activeTab === 'activity' ? 'bg-emerald-100 text-emerald-800' : ''
              }`}
            >
              <ReceiptText className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">Activity</span>
          </button>

          {/* Tab 2: Who owes who */}
          <button
            type="button"
            onClick={() => setActiveTab('balances')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'balances'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-colors ${
                activeTab === 'balances' ? 'bg-emerald-100 text-emerald-800' : ''
              }`}
            >
              <Scale className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">Who owes who</span>
          </button>

          {/* Tab 3: People */}
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-colors ${
                activeTab === 'members' ? 'bg-emerald-100 text-emerald-800' : ''
              }`}
            >
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">People</span>
          </button>

          {/* Tab 4: Mark as paid */}
          <button
            type="button"
            onClick={() => {
              setSettlePreload({});
              setIsSettleOpen(true);
            }}
            className="flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-emerald-700 font-medium"
          >
            <div className="p-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">Mark as paid</span>
          </button>
        </div>
      </nav>

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
