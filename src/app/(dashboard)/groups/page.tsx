'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UsersRound,
  Plus,
  KeyRound,
  Search,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { JoinCodeModal } from '@/components/groups/JoinCodeModal';
import { useTranslation } from '@/components/common/LanguageContext';

interface GroupSummary {
  id: string;
  name: string;
  category: string;
  currencySymbol: string;
  joinCode: string;
  simplifyDebts: boolean;
  memberCount: number;
  totalSpendPaisa: number;
  ownerBalancePaisa: number;
  pendingTransfersCount: number;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  Trip: '🏖️',
  Home: '🏠',
  Dining: '🍕',
  Event: '🎂',
  Other: '⚡',
};

export default function GroupsPage() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (res.ok && data.groups) {
        setGroups(data.groups);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.joinCode.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || g.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalOwedToUserPaisa = groups
    .filter((g) => g.ownerBalancePaisa > 0)
    .reduce((sum, g) => sum + g.ownerBalancePaisa, 0);

  const totalUserOwesPaisa = groups
    .filter((g) => g.ownerBalancePaisa < 0)
    .reduce((sum, g) => sum + Math.abs(g.ownerBalancePaisa), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {t.groups}
            </h1>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Splitwise Mode
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Split shared trips, flat rent, and group bills with friends using 5-character Join Codes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-slate-200/80"
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>{t.joinWithCode}</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createGroup}</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total You Get Back */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t.youAreOwed}
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
              ₹{(totalOwedToUserPaisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Across all your groups</span>
          </div>
        </div>

        {/* Total You Owe */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t.youOwe}
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
              ₹{(totalUserOwesPaisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">To other group members</span>
          </div>
        </div>

        {/* Total Active Groups */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <UsersRound className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Groups
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {groups.length}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Separated from 1-on-1 Khata
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {['All', 'Trip', 'Home', 'Dining', 'Event', 'Other'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {cat === 'All' ? 'All Groups' : `${CATEGORY_ICONS[cat] || ''} ${cat}`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search group or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-2xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm font-semibold">
          Loading your groups...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200/80 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <UsersRound className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">No groups found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create a group for your next trip, dinner, or room expenses. Your friends can join
              instantly with a 5-character code!
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map((group) => {
            const hasPositiveBalance = group.ownerBalancePaisa > 0;
            const hasNegativeBalance = group.ownerBalancePaisa < 0;

            return (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="bg-white p-5 rounded-3xl border border-slate-200/80 hover:border-indigo-200 shadow-xs hover:shadow-md transition-all group relative flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Category & Join Code */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-700">
                      <span>{CATEGORY_ICONS[group.category] || '⚡'}</span>
                      <span>{group.category}</span>
                    </span>

                    {/* Join Code Chip */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyCode(e, group.joinCode)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-extrabold bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100 transition-colors"
                      title="Click to copy join code"
                    >
                      <span>Code: {group.joinCode}</span>
                      {copiedCode === group.joinCode ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-60" />
                      )}
                    </button>
                  </div>

                  {/* Group Name & Members */}
                  <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {group.memberCount} members • Total spend: ₹
                    {(group.totalSpendPaisa / 100).toLocaleString('en-IN', {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>

                {/* Bottom Row: Standing */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Your Standing
                    </span>
                    {hasPositiveBalance ? (
                      <span className="text-sm font-extrabold text-emerald-600">
                        +₹
                        {(group.ownerBalancePaisa / 100).toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        <span className="text-[11px] font-bold">(You get back)</span>
                      </span>
                    ) : hasNegativeBalance ? (
                      <span className="text-sm font-extrabold text-rose-600">
                        -₹
                        {(Math.abs(group.ownerBalancePaisa) / 100).toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        <span className="text-[11px] font-bold">(You owe)</span>
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-500">
                        ₹0.00 <span className="text-[11px]">(All settled up)</span>
                      </span>
                    )}
                  </div>

                  <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onGroupCreated={() => {
          fetchGroups();
          setIsCreateOpen(false);
        }}
      />

      <JoinCodeModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </div>
  );
}
