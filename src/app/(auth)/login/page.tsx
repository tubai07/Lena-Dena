'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Lock, Loader2, CheckSquare, Square } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [registerHref, setRegisterHref] = useState('/register');
  const [forgotHref, setForgotHref] = useState('/forgot-password');

  // Pre-fill remembered phone/email, pre-warm dashboard, and resolve register link
  useEffect(() => {
    try {
      router.prefetch('/');
      const savedIdentifier = localStorage.getItem('lena_dena_saved_identifier') || localStorage.getItem('lena_dena_saved_phone');
      if (savedIdentifier) {
        setIdentifier(savedIdentifier);
        setRememberMe(true);
      }

      const search = window.location.search;
      const pending = localStorage.getItem('lena_dena_pending_join_code');
      if (search.includes('redirect=')) {
        setRegisterHref(`/register${search}`);
        setForgotHref(`/forgot-password${search}`);
      } else if (pending) {
        setRegisterHref(`/register?redirect=${encodeURIComponent(`/join/${pending}`)}`);
        setForgotHref(`/forgot-password?redirect=${encodeURIComponent(`/join/${pending}`)}`);
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
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');

      // Persist or clear remembered identifier
      try {
        if (rememberMe && identifier) {
          localStorage.setItem('lena_dena_saved_identifier', identifier.trim());
        } else {
          localStorage.removeItem('lena_dena_saved_identifier');
          localStorage.removeItem('lena_dena_saved_phone');
        }
      } catch {
        // Ignore localStorage restrictions
      }

      // Fast immediate navigation honoring ?redirect= parameter or pending join code
      let pendingJoinCode: string | null = null;
      try {
        pendingJoinCode = localStorage.getItem('lena_dena_pending_join_code');
      } catch {}

      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      let targetUrl = searchParams?.get('redirect') || data.redirect;
      if (!targetUrl && pendingJoinCode) {
        targetUrl = `/join/${pendingJoinCode}`;
      }
      if (!targetUrl) {
        targetUrl = '/';
      }

      router.replace(targetUrl);
      router.refresh();
      setTimeout(() => {
        if (window.location.pathname.startsWith('/login')) {
          window.location.replace(targetUrl);
        }
      }, 250);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img
          src="/app-icon.png"
          alt="Lena Dena"
          className="w-20 h-20 rounded-3xl mx-auto shadow-xl shadow-amber-500/20 object-cover"
        />
        <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Lena Dena
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-600 font-medium">
          Personal Digital Khata & Credit Ledger
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200 sm:px-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider mb-2">
                Mobile Number or Email
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="9830012345 or you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password Options */}
            <div className="flex items-center justify-between py-1 gap-2 flex-wrap">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 text-emerald-700 rounded-md border-slate-300 focus:ring-emerald-600 cursor-pointer accent-emerald-700"
                />
                <span className="text-sm sm:text-base font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                  Keep me logged in
                </span>
              </label>
              <Link
                href={forgotHref}
                className="text-sm sm:text-base font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-emerald-700/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 tap-effect cursor-pointer"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>Sign In</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <span className="text-sm sm:text-base text-slate-600">Need a new account? </span>
            <Link
              href={registerHref}
              className="text-sm sm:text-base font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
