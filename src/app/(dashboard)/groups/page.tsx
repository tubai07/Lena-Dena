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
      const res = await fetch(`/api/groups?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      let combined: GroupSummary[] = res.ok && data.groups ? [...data.groups] : [];

      // Merge joined groups stored in localStorage
      try {
        const joinedCodes: string[] = JSON.parse(localStorage.getItem('lena_dena_joined_groups') || '[]');
        const existingCodes = new Set(combined.map((g) => g.joinCode.toUpperCase()));
        const missingCodes = joinedCodes.filter((c) => !existingCodes.has(c.toUpperCase()));

        if (missingCodes.length > 0) {
          const joinedResults = await Promise.all(
            missingCodes.map(async (c) => {
              try {
                const jRes = await fetch(`/api/join/${c}`);
                if (!jRes.ok) return null;
                const jData = await jRes.json();
                if (!jData?.group) return null;
                const g = jData.group;
                const ownerMember = g.members?.find((m: any) => m.isOwner) || g.members?.[0];
                const mySaved = localStorage.getItem(`lena_dena_member_${c.toUpperCase()}`);
                const myId = mySaved ? JSON.parse(mySaved).id : null;
                const targetMemberId = myId || ownerMember?.id;
                const ownerBalance = targetMemberId
                  ? g.balances?.find((b: any) => b.memberId === targetMemberId)?.netBalancePaisa || 0
                  : 0;

                return {
                  id: g.id,
                  name: g.name,
                  category: g.category || 'Trip',
                  currencySymbol: g.currencySymbol || '₹',
                  joinCode: g.joinCode,
                  simplifyDebts: g.simplifyDebts,
                  createdAt: g.createdAt || new Date().toISOString(),
                  memberCount: g.members?.length || 0,
                  totalSpendPaisa: g.totalSpendPaisa || 0,
                  ownerBalancePaisa: ownerBalance,
                } as GroupSummary;
              } catch {
                return null;
              }
            })
          );
          const validJoined = joinedResults.filter(Boolean) as GroupSummary[];
          combined = [...combined, ...validJoined];
        }
      } catch {
        // Ignore localStorage errors
      }

      setGroups(combined);
      setCachedItem('all_groups', combined);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();

    // Live auto-polling every 4 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchGroups();
      }
    }, 4000);

    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        fetchGroups();
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, []);

  // Proactive background pre-warm for group details so tapping ANY group opens in 0ms!
  const prefetchGroupDetail = (groupId: string) => {
    if (!getCachedItem(`group_${groupId}`)) {
      fetch(`/api/groups/${groupId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.group) {
            setCachedItem(`group_${groupId}`, data.group);
          }
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (groups.length > 0) {
      const timer = setTimeout(() => {
        groups.slice(0, 6).forEach((g) => {
          prefetchGroupDetail(g.id);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [groups]);

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
      {/* Top Header with Larger Typography */}
      <header className="px-4 py-4 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-30 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Groups</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Split group bills & expenses</p>
        </div>

        {/* Action Buttons with larger text */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Join with Code"
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>Join</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Group</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 pt-3.5 space-y-3.5">
        {/* Net Balance Summary Card with larger, legible typography */}
        <div className="p-4 sm:p-5 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                Your Net Balance
              </span>
              <div
                className={`text-3xl font-black tracking-tight mt-1 ${
                  isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-800'
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
              <span className="text-xs font-bold text-slate-500 block mt-1">
                {isPositive
                  ? 'You get back'
                  : isNegative
                  ? 'You owe friends'
                  : 'All groups settled'}
              </span>
            </div>

            <div className="text-right border-l border-slate-200/80 pl-5">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                Groups
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {groups.length}
              </div>
              <span className="text-xs font-semibold text-slate-500 block mt-1">
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
              className="w-full pl-10 pr-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 placeholder:text-slate-400"
            />
          </div>
        )}

        {/* Groups List */}
        {loading && groups.length === 0 ? (
          <div className="space-y-3 pt-1 animate-pulse">
            <div className="h-20 bg-slate-100 rounded-2xl"></div>
            <div className="h-20 bg-slate-100 rounded-2xl"></div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-3 shadow-2xs mt-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <UsersRound className="w-7 h-7 stroke-[1.8]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">No groups yet</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
                Create a group for trips, flatmates, or dining bills.
              </p>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Group</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {filteredGroups.map((group) => {
              const hasPositive = group.ownerBalancePaisa > 0;
              const hasNegative = group.ownerBalancePaisa < 0;

              return (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  prefetch={true}
                  onMouseEnter={() => prefetchGroupDetail(group.id)}
                  onPointerDown={() => prefetchGroupDetail(group.id)}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition-all block group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 text-lg truncate group-hover:text-emerald-700 transition-colors">
                          {group.name}
                        </h3>

                        {/* Join Code Chip */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(e, group.joinCode)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100 transition-colors shrink-0"
                          title="Copy Code"
                        >
                          <span>{group.joinCode}</span>
                          {copiedCode === group.joinCode ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-60" />
                          )}
                        </button>
                      </div>

                      <p className="text-xs font-semibold text-slate-500 mt-1">
                        {group.memberCount} members • ₹{(group.totalSpendPaisa / 100).toFixed(0)} total
                      </p>
                    </div>

                    {/* Standing with larger numbers */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {hasPositive ? (
                          <span className="text-base font-black text-emerald-600 block">
                            +₹{(group.ownerBalancePaisa / 100).toFixed(2)}
                          </span>
                        ) : hasNegative ? (
                          <span className="text-base font-black text-rose-600 block">
                            -₹{(Math.abs(group.ownerBalancePaisa) / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-slate-400 block">
                            Settled
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-bold">
                          {hasPositive ? 'You get' : hasNegative ? 'You owe' : '₹0'}
                        </span>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
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
