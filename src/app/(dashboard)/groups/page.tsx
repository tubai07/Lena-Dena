'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UsersRound,
  Plus,
  KeyRound,
  Search,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { JoinCodeModal } from '@/components/groups/JoinCodeModal';
import { getCachedItem, setCachedItem } from '@/lib/groupCache';

interface GroupSummary {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  totalSpendPaisa: number;
  ownerBalancePaisa: number;
  createdAt: string;
}

export default function GroupsPage() {
  // Instant render from cache (0ms)
  const [groups, setGroups] = useState<GroupSummary[]>(() => {
    return getCachedItem<GroupSummary[]>('all_groups') || [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCachedItem<GroupSummary[]>('all_groups');
    return !cached || cached.length === 0;
  });
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (res.ok && data.groups) {
        setGroups(data.groups);
        setCachedItem('all_groups', data.groups);
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

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.joinCode.toLowerCase().includes(search.toLowerCase())
  );

  const netBalancePaisa = groups.reduce((sum, g) => sum + g.ownerBalancePaisa, 0);
  const isPositive = netBalancePaisa > 0;
  const isNegative = netBalancePaisa < 0;

  return (
    <div className="w-full pb-28">
      {/* Top Header */}
      <header className="px-4 py-3.5 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-slate-100">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Groups</h1>
          <p className="text-[11px] font-medium text-slate-400">Split group expenses</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Join with Code"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            <span>Join</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Group</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 pt-3 space-y-3">
        {/* Net Balance Summary Card (Unified Single Card matching Lena Dena style) */}
        <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Your Net Balance
              </span>
              <div
                className={`text-2xl font-black tracking-tight mt-0.5 ${
                  isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-700'
                }`}
              >
                {isPositive
                  ? `+₹${(netBalancePaisa / 100).toLocaleString('en-IN', {
                      maximumFractionDigits: 2,
                    })}`
                  : isNegative
                  ? `-₹${(Math.abs(netBalancePaisa) / 100).toLocaleString('en-IN', {
                      maximumFractionDigits: 2,
                    })}`
                  : '₹0.00'}
              </div>
              <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                {isPositive
                  ? 'You get back'
                  : isNegative
                  ? 'You owe friends'
                  : 'All groups settled'}
              </span>
            </div>

            <div className="text-right border-l border-slate-200/80 pl-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Groups
              </span>
              <div className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {groups.length}
              </div>
              <span className="text-[11px] font-medium text-slate-400 block mt-0.5">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        {groups.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search group or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Groups List */}
        {loading && groups.length === 0 ? (
          <div className="space-y-2.5 pt-1 animate-pulse">
            <div className="h-16 bg-slate-100 rounded-2xl"></div>
            <div className="h-16 bg-slate-100 rounded-2xl"></div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-3 shadow-2xs mt-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <UsersRound className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">No groups yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                Create a group for trips, flatmates, or dining bills.
              </p>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {filteredGroups.map((group) => {
              const hasPositive = group.ownerBalancePaisa > 0;
              const hasNegative = group.ownerBalancePaisa < 0;

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all block group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base truncate group-hover:text-indigo-600 transition-colors">
                          {group.name}
                        </h3>

                        {/* Join Code Chip */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(e, group.joinCode)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 transition-colors shrink-0"
                          title="Copy Code"
                        >
                          <span>{group.joinCode}</span>
                          {copiedCode === group.joinCode ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 mt-0.5">
                        {group.memberCount} members • ₹{(group.totalSpendPaisa / 100).toFixed(0)} total
                      </p>
                    </div>

                    {/* Standing */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {hasPositive ? (
                          <span className="text-xs font-black text-emerald-600 block">
                            +₹{(group.ownerBalancePaisa / 100).toFixed(2)}
                          </span>
                        ) : hasNegative ? (
                          <span className="text-xs font-black text-rose-600 block">
                            -₹{(Math.abs(group.ownerBalancePaisa) / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 block">
                            Settled
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {hasPositive ? 'You get' : hasNegative ? 'You owe' : '₹0'}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

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
