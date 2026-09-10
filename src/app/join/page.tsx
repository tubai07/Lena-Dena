'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight, Sparkles } from 'lucide-react';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError('Please enter a valid 5-character group code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/join/${clean}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Group not found');
      }

      router.push(`/join/${clean}`);
    } catch (err: any) {
      setError(err.message || 'Invalid group code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-indigo-50/30 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl space-y-6 text-center">
        <div className="w-14 h-14 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
          <KeyRound className="w-7 h-7 stroke-[2.5]" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Join a Group</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enter the 5-character code shared by your friend to view balances and settle bills.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          <div>
            <input
              type="text"
              maxLength={6}
              required
              placeholder="44A3B"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full text-center tracking-widest font-mono text-3xl uppercase font-black py-4 px-4 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900 bg-slate-50/50"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              'Looking up group...'
            ) : (
              <>
                Continue to Group
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-slate-400">
          Powered by <strong>Lena Dena</strong> — Simple shared expense splitting.
        </p>
      </div>
    </div>
  );
}
