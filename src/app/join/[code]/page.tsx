'use client';

import React, { useState, useEffect, use } from 'react';
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
} from 'lucide-react';
import { AddExpenseModal } from '@/components/groups/AddExpenseModal';
import { SettleUpModal } from '@/components/groups/SettleUpModal';
import { generateUpiUrl } from '@/lib/splitwise';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner?: boolean;
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

  const storageKey = `lena_dena_member_${upperCode}`;

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/join/${upperCode}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Group not found');
      setGroup(data.group);
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
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              {group.category} • Code: {group.joinCode}
            </span>
            <h1 className="text-2xl font-black text-slate-900">{group.name}</h1>
            <p className="text-xs text-slate-500">Who are you in this group?</p>
          </div>

          {/* Existing Member List */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
              Select Your Name
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto">
              {group.members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleClaimExisting(m)}
                  className="w-full p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left flex items-center justify-between transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600">
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

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Mobile Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-slate-900">{group.name}</span>
            <span className="text-[10px] font-mono font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">
              {group.joinCode}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
            <span>You are: <strong>{claimedMember.name}</strong></span>
            <button
              onClick={handleSwitchIdentity}
              className="text-[10px] text-indigo-600 font-bold hover:underline"
            >
              (Switch)
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsAddExpenseOpen(true)}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Bill
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Personal Standing Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Your Balance in this group
          </span>
          <div className="text-3xl font-black tracking-tight">
            {myBalance > 0 ? (
              <span className="text-emerald-600">+₹{(myBalance / 100).toFixed(2)}</span>
            ) : myBalance < 0 ? (
              <span className="text-rose-600">-₹{(Math.abs(myBalance) / 100).toFixed(2)}</span>
            ) : (
              <span className="text-slate-700">₹0.00</span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-500">
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
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
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
                  className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500">You pay</span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{t.toName}</h4>
                    </div>
                    <div className="text-lg font-black text-rose-600">
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
                className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between"
              >
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{t.fromName}</h4>
                  <span className="text-xs text-emerald-700 font-semibold">owes you</span>
                </div>
                <div className="text-lg font-black text-emerald-600">
                  ₹{(t.amountPaisa / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group Expenses Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Recent Group Bills ({group.expenses.length})
            </h3>
            <button
              onClick={() => setIsAddExpenseOpen(true)}
              className="text-xs font-bold text-indigo-600"
            >
              + Add Bill
            </button>
          </div>

          <div className="space-y-2">
            {group.expenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{exp.description}</div>
                  <div className="text-[11px] text-slate-400">
                    {exp.payers.map((p: any) => p.member.name).join(', ')} paid •{' '}
                    {new Date(exp.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
                <div className="text-right font-black text-slate-900 text-sm">
                  ₹{(exp.totalAmountPaisa / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals for Friend */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        groupId={group.id}
        members={group.members}
        onExpenseAdded={fetchGroup}
        defaultPayerId={claimedMember.id}
      />

      <SettleUpModal
        isOpen={isSettleOpen}
        onClose={() => setIsSettleOpen(false)}
        groupId={group.id}
        members={group.members}
        onSettled={fetchGroup}
        initialPayerId={settlePreload.payerId}
        initialReceiverId={settlePreload.receiverId}
        initialAmountPaisa={settlePreload.amountPaisa}
      />
    </div>
  );
}
