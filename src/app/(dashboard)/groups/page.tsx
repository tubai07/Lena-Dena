'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UsersRound,
  Plus,
  Search,
  ChevronRight,
} from 'lucide-react';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { getCachedItem, setCachedItem } from '@/lib/groupCache';
import { getGroupCategoryInfo } from '@/lib/groupIcons';

interface GroupSummary {
  id: string;
  name: string;
  category?: string;
  joinCode: string;
  memberCount: number;
  totalSpendPaisa: number;
  ownerBalancePaisa: number;
  createdAt: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`/api/groups?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      const list: GroupSummary[] = res.ok && data.groups ? data.groups : [];

      setGroups(list);
      setCachedItem('all_groups', list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const cached = getCachedItem<GroupSummary[]>('all_groups');
    if (cached && cached.length > 0) {
      setGroups(cached);
      setLoading(false);
    }
    fetchGroups();

    // Idle-aware smart polling (6s active, pauses after 30s idle)
    let lastActivityTime = Date.now();
    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    window.addEventListener('pointerdown', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const isIdle = Date.now() - lastActivityTime > 30000;
      if (isIdle) return; // Skip polling when user is idle
      fetchGroups();
    }, 6000);

    // Debounced tab focus sync (300ms) to prevent burst storms on resume
    let focusTimeout: any = null;
    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(focusTimeout);
        focusTimeout = setTimeout(() => {
          fetchGroups();
        }, 300);
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      clearInterval(interval);
      clearTimeout(focusTimeout);
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('pointerdown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
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

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
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

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 sm:px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
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
        {!isMounted || (loading && groups.length === 0) ? (
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
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
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
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition-all block group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Group Category Icon Tile */}
                      {(() => {
                        const catInfo = getGroupCategoryInfo(group.category);
                        const CatIcon = catInfo.icon;
                        return (
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border ${catInfo.bg} ${catInfo.color} ${catInfo.border}`}>
                            <CatIcon className="w-5 h-5" />
                          </div>
                        );
                      })()}

                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-slate-900 text-base sm:text-lg truncate group-hover:text-emerald-700 transition-colors">
                          {group.name}
                        </h3>

                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          {group.memberCount} members • ₹{(group.totalSpendPaisa / 100).toFixed(0)} total
                        </p>
                      </div>
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
        onGroupCreated={(newGroup) => {
          fetchGroups();
          setIsCreateOpen(false);
          if (newGroup?.id) {
            router.push(`/groups/${newGroup.id}`);
          }
        }}
      />
    </div>
  );
}
