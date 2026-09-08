'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Phone, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-warm dashboard route immediately on mount so navigation after register is instantaneous
  useEffect(() => {
    try {
      router.prefetch('/');
    } catch {
      // Ignore
    }
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // Fast immediate browser navigation
      window.location.href = data.redirect || '/';
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
          Create Personal Khata
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-600 font-medium">
          Start recording credit and tracking dues
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200 sm:px-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider mb-2">
                Your Full Name *
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-4 top-4" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider mb-2">
                Mobile Number *
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-sm sm:text-base font-bold text-slate-400">+91</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="w-full pl-14 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-4" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-emerald-700/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 tap-effect cursor-pointer"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              <span>Create Account</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="text-center pt-2">
            <span className="text-sm sm:text-base text-slate-600">Already have an account? </span>
            <Link
              href="/login"
              className="text-sm sm:text-base font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
