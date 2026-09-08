'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Lock, Loader2, CheckSquare, Square } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill remembered phone number and pre-warm dashboard
  useEffect(() => {
    try {
      router.prefetch('/');
      const savedPhone = localStorage.getItem('lena_dena_saved_phone');
      if (savedPhone) {
        setIdentifier(savedPhone);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage restrictions
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid mobile number or password');

      // Persist or clear remembered phone number
      try {
        if (rememberMe && identifier) {
          localStorage.setItem('lena_dena_saved_phone', identifier.trim());
        } else {
          localStorage.removeItem('lena_dena_saved_phone');
        }
      } catch {
        // Ignore localStorage restrictions
      }

      // Fast immediate browser navigation
      window.location.href = data.redirect || '/';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img
          src="/app-icon.png"
          alt="Lena Dena"
          className="w-16 h-16 rounded-2xl mx-auto shadow-lg shadow-amber-500/20 object-cover"
        />
        <h2 className="mt-3 text-2xl font-black text-slate-900 tracking-tight">
          Lena Dena
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 font-medium">
          Personal Digital Khata & Credit Ledger
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-5 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200 sm:px-8 space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="9830012345"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                />
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between py-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 cursor-pointer accent-emerald-700"
                />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                  Keep me logged in
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 tap-effect"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Sign In</span>
            </button>
          </form>

          <div className="text-center pt-1">
            <span className="text-xs text-slate-500">Need a new account? </span>
            <Link
              href="/register"
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
