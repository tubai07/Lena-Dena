'use client';

import React, { useState } from 'react';
import { X, KeyRound, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface JoinCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinCodeModal({ isOpen, onClose }: JoinCodeModalProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
        throw new Error(data.error || 'Invalid code');
      }

      try {
        const existing = JSON.parse(localStorage.getItem('lena_dena_joined_groups') || '[]');
        if (!existing.includes(clean)) {
          localStorage.setItem('lena_dena_joined_groups', JSON.stringify([...existing, clean]));
        }
      } catch {
        // Ignore
      }

      onClose();
      router.push(`/join/${clean}`);
    } catch (err: any) {
      setError(err.message || 'Group not found with this code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Join a Group</h3>
              <p className="text-xs text-slate-500">Enter friend's 5-character code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
              Group Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="44A3B"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full text-center tracking-widest font-mono text-2xl uppercase font-extrabold px-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900 bg-slate-50/50"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              'Looking up...'
            ) : (
              <>
                Join Group
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
