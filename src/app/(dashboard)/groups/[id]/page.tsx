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
  ChevronRight,
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
import { TransactionDetailsModal } from '@/components/groups/TransactionDetailsModal';
import { MemberDetailsModal, MemberBalanceDetail } from '@/components/groups/MemberDetailsModal';
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
  const [editingSettlement, setEditingSettlement] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberBalanceDetail | null>(null);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [claimedMemberId, setClaimedMemberId] = useState<string | null>(null);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePreload, setSettlePreload] = useState<{
    payerId?: string;
    receiverId?: string;
    amountPaisa?: number;
  }>({});
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync claimed identity for joined members
  useEffect(() => {
    if (group?.joinCode) {
      try {
        const saved = localStorage.getItem(`lena_dena_member_${group.joinCode.toUpperCase()}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) {
            setClaimedMemberId(parsed.id);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [group?.joinCode]);

  // Add Member inputs with mandatory phone number
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [memberError, setMemberError] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const [isStandingExpanded, setIsStandingExpanded] = useState(true);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const lastScrollY = useRef(0);

  // Tracking in-flight optimistic expenses and settlements so background polling never drops them prematurely
  const inFlightExpensesRef = useRef<Map<string, { expense: any; timestamp: number }>>(new Map());
  const inFlightSettlementsRef = useRef<Map<string, { settlement: any; timestamp: number }>>(new Map());

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

        // Clean up any in-flight optimistic items that are older than 30s
        const now = Date.now();
        for (const [k, v] of inFlightExpensesRef.current.entries()) {
          if (now - v.timestamp > 30000) inFlightExpensesRef.current.delete(k);
        }
        for (const [k, v] of inFlightSettlementsRef.current.entries()) {
          if (now - v.timestamp > 30000) inFlightSettlementsRef.current.delete(k);
        }

        const serverExpenses = (data.group.expenses || []).filter(
          (e: any) => !deletedExpenseIdsRef.current.has(e.id)
        );

        // If server returned expenses matching in-flight ones, clear them from in-flight ref
        for (const se of serverExpenses) {
          for (const [k, v] of inFlightExpensesRef.current.entries()) {
            if (se.id === k) {
              inFlightExpensesRef.current.delete(k);
            } else if (
              se.description?.trim().toLowerCase() === v.expense.description?.trim().toLowerCase() &&
              se.totalAmountPaisa === v.expense.totalAmountPaisa &&
              Math.abs(new Date(se.date).getTime() - new Date(v.expense.date).getTime()) < 60000
            ) {
              inFlightExpensesRef.current.delete(k);
            }
          }
        }

        // Merge active in-flight optimistic expenses
        const inFlightExpensesList = Array.from(inFlightExpensesRef.current.values())
          .map((v) => v.expense)
          .filter((e) => !deletedExpenseIdsRef.current.has(e.id) && !serverExpenses.some((se: any) => se.id === e.id));

        const mergedExpenses = [...inFlightExpensesList, ...serverExpenses];

        const serverSettlements = (data.group.settlements || []).filter(
          (s: any) => !deletedSettlementIdsRef.current.has(s.id)
        );

        // If server returned settlements matching in-flight ones, clear them from in-flight ref
        for (const ss of serverSettlements) {
          for (const [k, v] of inFlightSettlementsRef.current.entries()) {
            if (ss.id === k) {
              inFlightSettlementsRef.current.delete(k);
            } else if (
              ss.payerId === v.settlement.payerId &&
              ss.receiverId === v.settlement.receiverId &&
              ss.amountPaisa === v.settlement.amountPaisa &&
              Math.abs(new Date(ss.date).getTime() - new Date(v.settlement.date).getTime()) < 60000
            ) {
              inFlightSettlementsRef.current.delete(k);
            }
          }
        }

        // Merge active in-flight optimistic settlements
        const inFlightSettlementsList = Array.from(inFlightSettlementsRef.current.values())
          .map((v) => v.settlement)
          .filter((s) => !deletedSettlementIdsRef.current.has(s.id) && !serverSettlements.some((ss: any) => ss.id === s.id));

        const mergedSettlements = [...inFlightSettlementsList, ...serverSettlements];

        // Filter out locally removed members
        const mergedMembers = (data.group.members || []).filter(
          (m: any) => !deletedMemberIdsRef.current.has(m.id)
        );

        const balances = calculateMemberNetBalances(mergedMembers, mergedExpenses, mergedSettlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(mergedMembers, mergedExpenses, mergedSettlements);
        const totalSpendPaisa = mergedExpenses.reduce((sum, e) => sum + (Number(e.totalAmountPaisa) || 0), 0);

        const updated = {
          ...data.group,
          category: prev.category || data.group.category,
          simplifyDebts:
            typeof prev.simplifyDebts === 'boolean'
              ? prev.simplifyDebts
              : Boolean(data.group.simplifyDebts ?? true),
          members: mergedMembers,
          expenses: mergedExpenses,
          settlements: mergedSettlements,
          totalSpendPaisa,
          balances,
          simplifiedTransfers,
          directTransfers,
          activeTransfers: (typeof prev.simplifyDebts === 'boolean' ? prev.simplifyDebts : Boolean(data.group.simplifyDebts ?? true)) ? simplifiedTransfers : directTransfers,
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
    setGroup((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        simplifyDebts: enabled,
      };
      setCachedItem(`group_${id}`, updated);
      return updated;
    });

    try {
      await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simplifyDebts: enabled }),
      });
    } catch (e) {
      console.error('Error updating simplifyDebts:', e);
    }
  };

  // Instant optimistic expense addition or modification
  const handleExpenseAdded = (newExpense?: any, replacedTempId?: string) => {
    if (replacedTempId) {
      inFlightExpensesRef.current.delete(replacedTempId);
    }

    if (newExpense) {
      deletedExpenseIdsRef.current.delete(newExpense.id);

      if (newExpense.id.startsWith('temp_')) {
        inFlightExpensesRef.current.set(newExpense.id, {
          expense: newExpense,
          timestamp: Date.now(),
        });
      }

      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.expenses.filter((e) => {
          if (e.id === newExpense.id) return false;
          if (replacedTempId && e.id === replacedTempId) return false;
          return true;
        });
        const updatedExpenses = [newExpense, ...filtered].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        const balances = calculateMemberNetBalances(prev.members, updatedExpenses, prev.settlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(prev.members, updatedExpenses, prev.settlements);
        const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + (Number(e.totalAmountPaisa) || 0), 0);

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

        try {
          const allGroups = getCachedItem<any[]>('all_groups');
          if (allGroups && Array.isArray(allGroups)) {
            const idx = allGroups.findIndex((g: any) => g.id === id);
            if (idx !== -1) {
              allGroups[idx].totalSpendPaisa = totalSpendPaisa;
              setCachedItem('all_groups', allGroups);
            }
          }
        } catch {
          // ignore cache write error
        }

        return updated;
      });
    } else if (replacedTempId) {
      // Revert in-flight temp expense on network failure
      setGroup((prev) => {
        if (!prev) return null;
        const updatedExpenses = prev.expenses.filter((e) => e.id !== replacedTempId);
        const balances = calculateMemberNetBalances(prev.members, updatedExpenses, prev.settlements);
        const simplifiedTransfers = simplifyDebts(balances);
        const directTransfers = calculateDirectPairwiseDebts(prev.members, updatedExpenses, prev.settlements);
        const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + (Number(e.totalAmountPaisa) || 0), 0);

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
  const handleSettled = (newSettlement?: any, replacedTempId?: string) => {
    if (replacedTempId) {
      inFlightSettlementsRef.current.delete(replacedTempId);
    }

    if (newSettlement) {
      deletedSettlementIdsRef.current.delete(newSettlement.id);

      if (newSettlement.id.startsWith('temp_')) {
        inFlightSettlementsRef.current.set(newSettlement.id, {
          settlement: newSettlement,
          timestamp: Date.now(),
        });
      }

      setGroup((prev) => {
        if (!prev) return null;
        const filtered = prev.settlements.filter((s) => {
          if (s.id === newSettlement.id) return false;
          if (replacedTempId && s.id === replacedTempId) return false;
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
    } else if (replacedTempId) {
      // Revert in-flight temp settlement on network failure
      setGroup((prev) => {
        if (!prev) return null;
        const updatedSettlements = prev.settlements.filter((s) => s.id !== replacedTempId);
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
    setEditingSettlement(null);
  };

  // Instant 0ms optimistic expense deletion
  const handleDeleteExpense = async (expenseId: string) => {
    if (!isCurrentUserAdmin) {
      alert('Only group admins can delete expenses');
      return;
    }
    deletedExpenseIdsRef.current.add(expenseId);

    setGroup((prev) => {
      if (!prev) return null;
      const updatedExpenses = (prev.expenses || []).filter(
        (e) => e.id !== expenseId && (e as any).raw?.id !== expenseId
      );
      const balances = calculateMemberNetBalances(prev.members, updatedExpenses, prev.settlements);
      const simplifiedTransfers = simplifyDebts(balances);
      const directTransfers = calculateDirectPairwiseDebts(prev.members, updatedExpenses, prev.settlements);
      const totalSpendPaisa = updatedExpenses.reduce((sum, e) => sum + (Number(e.totalAmountPaisa) || 0), 0);

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

      try {
        const allGroups = getCachedItem<any[]>('all_groups');
        if (allGroups && Array.isArray(allGroups)) {
          const idx = allGroups.findIndex((g: any) => g.id === id);
          if (idx !== -1) {
            allGroups[idx].totalSpendPaisa = totalSpendPaisa;
            setCachedItem('all_groups', allGroups);
          }
        }
      } catch {
        // ignore cache write error
      }

      return updated;
    });

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
    if (!isCurrentUserAdmin) {
      alert('Only group admins can delete payments');
      return;
    }
    deletedSettlementIdsRef.current.add(settlementId);

    setGroup((prev) => {
      if (!prev) return null;
      const updatedSettlements = (prev.settlements || []).filter(
        (s) => s.id !== settlementId && (s as any).raw?.id !== settlementId
      );
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

    try {
      await fetch(`/api/groups/${id}/settlements/${settlementId}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
      deletedSettlementIdsRef.current.delete(settlementId);
      fetchGroup(true);
    }
  };

  // Group deletion with full cleanup and confirmation
  const handleDeleteGroup = async () => {
    if (!group) return;
    if (!isCurrentUserAdmin) {
      alert('Only group admins can delete this group.');
      return;
    }

    try {
      setIsDeletingGroup(true);
      const res = await fetch(`/api/groups/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: ownerMember?.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete group');
      }

      // Clear local caches
      try {
        localStorage.removeItem(`lena_dena_group_${id}`);
        localStorage.removeItem(`lena_dena_member_${group.joinCode.toUpperCase()}`);

        const joinedCodes = JSON.parse(localStorage.getItem('lena_dena_joined_groups') || '[]');
        const updatedJoined = joinedCodes.filter(
          (c: string) => c.toUpperCase() !== group.joinCode.toUpperCase()
        );
        localStorage.setItem('lena_dena_joined_groups', JSON.stringify(updatedJoined));

        const allGroups = getCachedItem<any[]>('all_groups');
        if (allGroups && Array.isArray(allGroups)) {
          const filtered = allGroups.filter((g) => g.id !== id);
          setCachedItem('all_groups', filtered);
        }
      } catch {
        // ignore
      }

      router.push('/groups');
    } catch (e: any) {
      console.error('Error deleting group:', e);
      alert(e.message || 'Error deleting group');
    } finally {
      setIsDeletingGroup(false);
      setShowDeleteGroupModal(false);
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

  const ownerMember =
    (claimedMemberId ? group.members.find((m) => m.id === claimedMemberId) : null) ||
    group.members.find((m) => m.isOwner) ||
    group.members[0];
  const isCurrentUserAdmin = Boolean(ownerMember?.isOwner || ownerMember?.isAdmin);

  // Real-time dynamic member net balances (single source of truth for all dues)
  const memberBalances = useMemo(() => {
    if (!group?.members) return [];
    return calculateMemberNetBalances(
      group.members,
      group.expenses || [],
      group.settlements || []
    );
  }, [group?.members, group?.expenses, group?.settlements]);

  const userBalance = useMemo(() => {
    if (!ownerMember) return 0;
    return memberBalances.find((b) => b.memberId === ownerMember.id)?.netBalancePaisa || 0;
  }, [ownerMember, memberBalances]);

  // Real-time dynamic simplified transfers (Splitwise debt minimization algorithm)
  const dynamicSimplifiedTransfers = useMemo(() => {
    return simplifyDebts(memberBalances);
  }, [memberBalances]);

  // Real-time dynamic direct bilateral transfers (pairwise debts)
  const dynamicDirectTransfers = useMemo(() => {
    if (!group?.members) return [];
    return calculateDirectPairwiseDebts(
      group.members,
      group.expenses || [],
      group.settlements || []
    );
  }, [group?.members, group?.expenses, group?.settlements]);

  const isSimplifyEnabled = Boolean(group.simplifyDebts ?? true);

  const displayedTransfers = useMemo(() => {
    const list = isSimplifyEnabled ? dynamicSimplifiedTransfers : dynamicDirectTransfers;
    return list || [];
  }, [isSimplifyEnabled, dynamicSimplifiedTransfers, dynamicDirectTransfers]);

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

  // Derived total group spend - always in 100% real-time lockstep with active expenses
  const totalGroupSpendPaisa = useMemo(() => {
    if (!group) return 0;
    if (Array.isArray(group.expenses) && group.expenses.length > 0) {
      return group.expenses.reduce((sum, e) => sum + (Number(e.totalAmountPaisa) || 0), 0);
    }
    if (Array.isArray(group.expenses) && group.expenses.length === 0) {
      return 0;
    }
    return Number(group.totalSpendPaisa) || 0;
  }, [group?.expenses, group?.totalSpendPaisa]);

  // Overall standing calculations:
  // "3 people need to pay you back $45" or "You are owed $45 overall" (Never outputs 0 people!)
  const peopleOwingMe = displayedTransfers.filter((t) => t.toId === ownerMember?.id);
  const peopleIOwe = displayedTransfers.filter((t) => t.fromId === ownerMember?.id);
  const membersOwingMe = memberBalances.filter(
    (b) => b.memberId !== ownerMember?.id && b.netBalancePaisa < 0
  );
  const membersIowe = memberBalances.filter(
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
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 select-none pb-36 relative">
      {/* Group Header Banner with Emerald Gradient Pattern */}
      <div className="relative bg-gradient-to-b from-teal-700 via-emerald-700 to-emerald-800 text-white px-4 pt-4 pb-5 overflow-hidden">
        {/* Decorative geometric overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-15">
          <div className="absolute -top-12 -right-8 w-44 h-44 rounded-3xl bg-white/20 rotate-12" />
          <div className="absolute top-10 left-1/3 w-36 h-8 rounded-full bg-white/30 -rotate-6" />
          <div className="absolute bottom-2 right-12 w-28 h-6 rounded-full bg-white/25 -rotate-6" />
          <div className="absolute bottom-8 left-6 w-20 h-5 rounded-full bg-white/20 -rotate-6" />
        </div>

        {/* Top Navigation Row: Back Button on left & Delete Group Button on right if Admin */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/groups"
            className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/35 backdrop-blur-md flex items-center justify-center text-white tap-effect transition-colors"
            aria-label="Back to Groups"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>

          {isCurrentUserAdmin && (
            <button
              type="button"
              onClick={() => setShowDeleteGroupModal(true)}
              className="px-3.5 py-2 rounded-full bg-black/25 hover:bg-rose-600/90 border border-white/20 hover:border-rose-500/50 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer tap-effect"
              title="Delete this group"
              aria-label="Delete this group"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-300" />
              <span>Delete Group</span>
            </button>
          )}
        </div>

        {/* Large Title, People Pill & Total Group Spend on right */}
        <div className="relative z-10 mt-4 flex items-end justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
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

          {/* Group Total Spend Badge */}
          <div className="shrink-0 text-right bg-black/25 backdrop-blur-md border border-white/15 px-3.5 py-2 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-emerald-200/90 uppercase tracking-wider block">
              Group spend
            </span>
            <span className="text-base sm:text-xl font-black text-white tracking-tight block">
              ₹{((totalGroupSpendPaisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
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

        {/* Single Primary Action Button (Clean, Non-scrolling, only when balance is pending) */}
        {userBalance !== 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setSettlePreload({});
                setIsSettleOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer tap-effect"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Mark this as paid</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area (Clean Light Theme) */}
      <div className="px-4 pt-4 pb-36">
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
                              onClick={() => setSelectedTransaction(item)}
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
                              onClick={() => setSelectedTransaction(item)}
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

            {/* Clean up who pays who (Simplify debts) toggle switch */}
            <div
              onClick={() => handleToggleSimplify(!isSimplifyEnabled)}
              className="flex items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer select-none group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleSimplify(!isSimplifyEnabled);
                }
              }}
              aria-label={`Clean up who pays who, currently ${isSimplifyEnabled ? 'enabled' : 'disabled'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isSimplifyEnabled
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Sparkles className="w-4.5 h-4.5 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                    Clean up who pays who
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-500 font-medium block truncate mt-0.5">
                    {isSimplifyEnabled
                      ? 'Minimizing transactions between people'
                      : 'Showing direct pairwise debts'}
                  </span>
                </div>
              </div>

              {/* iOS-Style Sliding Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isSimplifyEnabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSimplify(!isSimplifyEnabled);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  isSimplifyEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                title={isSimplifyEnabled ? 'Turn off simplification' : 'Turn on simplification'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isSimplifyEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
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
              {memberBalances.map((b) => (
                <div
                  key={b.memberId}
                  onClick={() => setSelectedMember(b)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/90 active:bg-slate-100 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-11 h-11 rounded-full font-bold flex items-center justify-center text-sm shrink-0 border border-slate-200 ${getAvatarBg(
                        b.name
                      )}`}
                    >
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-base truncate group-hover:text-emerald-700 transition-colors">
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <div className="text-right shrink-0">
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
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button: Add expense (comfortable gap above bottom tab bar) */}
      <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto pointer-events-none px-4 flex justify-end z-30 animate-fab-enter">
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

      {/* Bottom Sticky Tab Navigation (3 tabs: Activity, Who owes who, People) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-2 select-none shadow-lg">
        <div className="grid grid-cols-3 gap-1">
          {/* Tab 1: Activity */}
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
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
            className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'balances'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
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
            className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'text-emerald-700 font-bold'
                : 'text-slate-500 font-medium hover:text-slate-800'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors ${
                activeTab === 'members' ? 'bg-emerald-100 text-emerald-800' : ''
              }`}
            >
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] mt-0.5">People</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <TransactionDetailsModal
        isOpen={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        item={selectedTransaction}
        members={group.members}
        currentUserId={ownerMember?.id}
        isAdmin={isCurrentUserAdmin}
        onEdit={(tx) => {
          if (!isCurrentUserAdmin) {
            alert('Only group admins can edit transactions');
            return;
          }
          setSelectedTransaction(null);
          if (tx.type === 'EXPENSE') {
            setEditingSettlement(null);
            setEditingExpense(tx.raw);
            setIsAddExpenseOpen(true);
          } else {
            setEditingExpense(null);
            setEditingSettlement(tx.raw);
            setSettlePreload({
              payerId: tx.raw.payerId,
              receiverId: tx.raw.receiverId,
              amountPaisa: tx.raw.amountPaisa,
            });
            setIsSettleOpen(true);
          }
        }}
        onDelete={(tx) => {
          if (!isCurrentUserAdmin) {
            alert('Only group admins can delete transactions');
            return;
          }
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
        members={group.members}
        onExpenseAdded={handleExpenseAdded}
        initialExpense={editingExpense}
      />

      <SettleUpModal
        isOpen={isSettleOpen}
        onClose={() => {
          setIsSettleOpen(false);
          setEditingSettlement(null);
        }}
        groupId={group.id}
        members={group.members}
        transfers={displayedTransfers}
        currentUserId={ownerMember?.id}
        onSettled={handleSettled}
        initialPayerId={settlePreload.payerId}
        initialReceiverId={settlePreload.receiverId}
        initialAmountPaisa={settlePreload.amountPaisa}
        initialSettlement={editingSettlement}
      />

      <MemberDetailsModal
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        member={selectedMember ? memberBalances.find((b) => b.memberId === selectedMember.memberId) || selectedMember : null}
        groupName={group.name}
        transfers={displayedTransfers}
        currentMemberId={ownerMember?.id}
        isCurrentUserAdmin={isCurrentUserAdmin}
        isCurrentUserCreator={Boolean(ownerMember?.isOwner)}
        onToggleAdmin={handleToggleAdmin}
        onRemoveMember={handleRemoveMember}
        onSettleUp={(preload) => {
          setSettlePreload(preload);
          setIsSettleOpen(true);
        }}
      />

      {/* Confirmation Modal: Delete Group Entirely */}
      {showDeleteGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
          <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">
                Delete "{group.name}"?
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                This will permanently delete this group along with all its expenses, splits, settlements, and member records. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingGroup}
                onClick={() => setShowDeleteGroupModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingGroup}
                onClick={handleDeleteGroup}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingGroup ? 'Deleting...' : 'Delete Group'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
