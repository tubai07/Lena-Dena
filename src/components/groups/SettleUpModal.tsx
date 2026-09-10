'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Info,
  Check,
  Mail,
  User,
  AlertCircle,
} from 'lucide-react';

interface Member {
  id: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner?: boolean;
}

interface TransferDebt {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountPaisa: number;
}

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: Member[];
  transfers?: TransferDebt[];
  currentUserId?: string;
  onSettled: (settlement?: any) => void;
  initialPayerId?: string;
  initialReceiverId?: string;
  initialAmountPaisa?: number;
}

const getAvatarBg = (name: string) => {
  if (name.includes('🐰')) return 'bg-pink-100 text-pink-700 border-pink-200';
  const firstChar = name.charAt(0).toUpperCase();
  if (['R', 'S', 'P'].includes(firstChar)) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (['T', 'B', 'A'].includes(firstChar)) return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

export function SettleUpModal({
  isOpen,
  onClose,
  groupId,
  members,
  transfers = [],
  currentUserId,
  onSettled,
  initialPayerId,
  initialReceiverId,
  initialAmountPaisa,
}: SettleUpModalProps) {
  // Step 1: Balance Selection ("Which balance do you want to settle?")
  // Step 2: Member Selection ("Who is paying?")
  // Step 3: Recipient Selection ("Who are they paying?")
  // Step 4: Record Payment ("Record a payment")
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [payerId, setPayerId] = useState<string>('');
  const [receiverId, setReceiverId] = useState<string>('');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentUser = useMemo(() => {
    return (
      members.find((m) => m.id === currentUserId) ||
      members.find((m) => m.isOwner) ||
      members[0]
    );
  }, [members, currentUserId]);

  // Balances involving the current user
  const relevantTransfers = useMemo(() => {
    if (!currentUser) return transfers;
    return transfers.filter(
      (t) => t.fromId === currentUser.id || t.toId === currentUser.id
    );
  }, [transfers, currentUser]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setLoading(false);
      setNotes('');
      setIsEditingAmount(false);

      if (initialPayerId && initialReceiverId && initialAmountPaisa) {
        setPayerId(initialPayerId);
        setReceiverId(initialReceiverId);
        setAmountRupees((initialAmountPaisa / 100).toFixed(2));
        setStep(4); // Jump directly to Record Payment screen
      } else {
        setStep(1); // Start on balance pick screen
        setPayerId('');
        setReceiverId('');
        setAmountRupees('');
      }
    }
  }, [isOpen, initialPayerId, initialReceiverId, initialAmountPaisa]);

  if (!isOpen) return null;

  const payer = members.find((m) => m.id === payerId);
  const receiver = members.find((m) => m.id === receiverId);

  // When tapping a direct balance in Step 1
  const handleSelectBalance = (transfer: TransferDebt) => {
    setPayerId(transfer.fromId);
    setReceiverId(transfer.toId);
    setAmountRupees((transfer.amountPaisa / 100).toFixed(2));
    setStep(4);
  };

  // When selecting payer in Step 2
  const handleSelectPayer = (selectedPayerId: string) => {
    setPayerId(selectedPayerId);
    // Find if there is an existing debt from this payer to anyone
    const existingDebt = transfers.find((t) => t.fromId === selectedPayerId);
    if (existingDebt) {
      setReceiverId(existingDebt.toId);
      setAmountRupees((existingDebt.amountPaisa / 100).toFixed(2));
      setStep(4);
    } else {
      setStep(3); // Choose receiver
    }
  };

  // When selecting receiver in Step 3
  const handleSelectReceiver = (selectedReceiverId: string) => {
    setReceiverId(selectedReceiverId);
    // Check if there is an existing amount
    const debt = transfers.find(
      (t) => t.fromId === payerId && t.toId === selectedReceiverId
    );
    if (debt) {
      setAmountRupees((debt.amountPaisa / 100).toFixed(2));
    } else if (!amountRupees) {
      setAmountRupees('0.00');
    }
    setStep(4);
  };

  // Submit payment
  const handleSubmit = async () => {
    setError('');
    if (!payerId || !receiverId || payerId === receiverId) {
      setError('Please select both a payer and a receiver');
      return;
    }

    const numAmount = Number(amountRupees || 0);
    const amountPaisa = Math.round(numAmount * 100);
    if (amountPaisa <= 0 || isNaN(amountPaisa)) {
      setError('Please enter a valid amount');
      return;
    }

    // ⚡ INSTANT OPTIMISTIC SUBMIT (0ms latency!)
    const optimisticSettlement = {
      id: `temp_st_${Date.now()}`,
      payerId,
      receiverId,
      amountPaisa,
      paymentMethod,
      notes: notes.trim() || undefined,
      date: new Date().toISOString(),
      payer: { id: payer?.id || payerId, name: payer?.name || 'Payer' },
      receiver: {
        id: receiver?.id || receiverId,
        name: receiver?.name || 'Receiver',
        upiId: receiver?.upiId,
        phone: receiver?.phone,
      },
    };

    onSettled(optimisticSettlement);
    onClose();

    // Background server save
    try {
      setLoading(true);
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          receiverId,
          amountPaisa,
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.settlement) {
        onSettled(data.settlement);
      }
    } catch (err: any) {
      console.error('Error saving settlement:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute text for Step 4
  const isPayerMe = currentUser && payerId === currentUser.id;
  const isReceiverMe = currentUser && receiverId === currentUser.id;

  const paymentTitle = isPayerMe
    ? `You paid ${receiver?.name || 'Friend'}`
    : isReceiverMe
    ? `${payer?.name || 'Friend'} paid you`
    : `${payer?.name || 'Payer'} paid ${receiver?.name || 'Receiver'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ================= STEP 1: SELECT BALANCE (Screenshot 2) ================= */}
        {step === 1 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-slate-900 text-base">Mark this as paid</h3>
              <div className="w-8" />
            </header>

            {/* Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Which balance do you want to settle?
              </h2>

              {/* Balances List */}
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-slate-50/60 overflow-hidden">
                {relevantTransfers.length > 0 ? (
                  relevantTransfers.map((t, idx) => {
                    const isOwedToMe = currentUser && t.toId === currentUser.id;
                    const otherMember = members.find(
                      (m) => m.id === (isOwedToMe ? t.fromId : t.toId)
                    );
                    const otherName = otherMember?.name || (isOwedToMe ? t.fromName : t.toName);
                    const otherContact = otherMember?.phone || otherMember?.upiId || 'In group';

                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectBalance(t)}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-white transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Circular avatar with Mail icon */}
                          <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-700 shrink-0 shadow-xs">
                            <Mail className="w-5 h-5 stroke-[2]" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block truncate group-hover:text-emerald-700">
                              {otherName}
                            </span>
                            <span className="text-xs text-slate-400 block truncate">
                              {otherContact}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-[11px] font-bold block ${
                              isOwedToMe ? 'text-emerald-700' : 'text-orange-600'
                            }`}
                          >
                            {isOwedToMe ? 'owes you' : 'you owe'}
                          </span>
                          <span
                            className={`text-base font-black block tracking-tight ${
                              isOwedToMe ? 'text-emerald-700' : 'text-orange-600'
                            }`}
                          >
                            ₹{(t.amountPaisa / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                    No pending dues found. Tap &ldquo;More options&rdquo; below to record any payment.
                  </div>
                )}
              </div>

              {/* More Options Button */}
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-bold text-sm transition-colors text-left flex items-center justify-between cursor-pointer"
              >
                <span>More options</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: WHO IS PAYING? ================= */}
        {step === 2 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-slate-900 text-base">Who is paying?</h3>
              <div className="w-8" />
            </header>

            {/* Members List */}
            <div className="p-5 space-y-2 overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {members.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectPayer(m.id)}
                    className="p-3.5 flex items-center gap-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 shadow-xs">
                      <Mail className="w-5 h-5 stroke-[2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 text-sm block truncate group-hover:text-emerald-700">
                        {m.name}
                        {currentUser && m.id === currentUser.id ? ' (You)' : ''}
                      </span>
                      <span className="text-xs text-slate-400 block truncate">
                        {m.phone || m.upiId || 'Group member'}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: WHO ARE THEY PAYING? ================= */}
        {step === 3 && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-slate-900 text-base">Who received the money?</h3>
              <div className="w-8" />
            </header>

            {/* Receivers List */}
            <div className="p-5 space-y-2 overflow-y-auto flex-1">
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {members
                  .filter((m) => m.id !== payerId)
                  .map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectReceiver(m.id)}
                      className="p-3.5 flex items-center gap-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 shadow-xs">
                        <Mail className="w-5 h-5 stroke-[2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 text-sm block truncate group-hover:text-emerald-700">
                          {m.name}
                          {currentUser && m.id === currentUser.id ? ' (You)' : ''}
                        </span>
                        <span className="text-xs text-slate-400 block truncate">
                          {m.phone || m.upiId || 'Group member'}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600" />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: RECORD A PAYMENT ================= */}
        {step === 4 && payer && receiver && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-slate-900 text-base">Record a payment</h3>
              <div className="w-8" />
            </header>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 flex flex-col items-center justify-center text-center">
              {error && (
                <div className="w-full p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Avatar Pair with Arrow */}
              <div className="flex items-center gap-4 pt-2">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200 shadow-sm">
                  <Mail className="w-8 h-8 stroke-[2]" />
                </div>

                <ArrowRight className="w-6 h-6 text-slate-400 stroke-[2.5]" />

                <div
                  className={`w-16 h-16 rounded-full font-bold text-xl flex items-center justify-center border shadow-sm ${getAvatarBg(
                    receiver.name
                  )}`}
                >
                  {receiver.name.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Text: "[Payer] paid [Receiver]" */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">{paymentTitle}</h2>
              </div>

              {/* Big Editable Amount with Pencil Icon */}
              <div className="w-full flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-slate-400">₹</span>
                {isEditingAmount ? (
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    onBlur={() => setIsEditingAmount(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingAmount(false)}
                    className="w-44 text-4xl sm:text-5xl font-black text-slate-900 text-center border-b-2 border-emerald-600 focus:outline-hidden bg-transparent tracking-tight"
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingAmount(true)}
                    className="flex items-center gap-2.5 cursor-pointer group"
                    title="Tap to edit amount"
                  >
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                      {Number(amountRupees || 0).toFixed(2)}
                    </span>
                    <Pencil className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
                  </div>
                )}
              </div>

              {/* Disclaimer Card */}
              <div className="w-full p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-left flex items-start gap-3 shadow-2xs">
                <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                  You are recording a payment that happened outside Lena Dena. No money will be moved.
                </p>
              </div>
            </div>

            {/* Bottom Primary Button */}
            <footer className="p-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 rounded-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-base shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Recording...' : 'Record payment'}</span>
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
