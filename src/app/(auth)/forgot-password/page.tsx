'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect') || searchParams.get('next') || '';

  const [step, setStep] = useState<'input' | 'sent'>('input');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const startCooldown = () => {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-link',
          email: email.trim(),
          redirect: redirectParam || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send sign-in link');

      setStep('sent');
      startCooldown();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-link',
          email: email.trim(),
          redirect: redirectParam || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend sign-in link');
      startCooldown();
    } catch (err: any) {
      setError(err.message || 'Failed to resend link');
    } finally {
      setLoading(false);
    }
  };

  const loginHref = redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-500/20 mb-4">
            <span className="text-white font-black text-2xl tracking-tighter">LD</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Lena Dena
          </h2>
          <p className="mt-2 text-sm sm:text-base font-medium text-slate-600">
            {step === 'input'
              ? 'Passwordless Sign-In & Recovery'
              : 'Sign-in Link Dispatched'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200 sm:px-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {step === 'input' && (
            <form onSubmit={handleSendLink} className="space-y-5">
              <p className="text-sm font-medium text-slate-600">
                Forgot your password or want to log in without one? Enter your registered email and we&apos;ll send you a 1-click sign-in link.
              </p>

              <div>
                <label className="block text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending Link...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Send Sign-In Link
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href={loginHref}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Remember your password? Sign In
                </Link>
              </div>
            </form>
          )}

          {step === 'sent' && (
            <div className="space-y-6 text-center py-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-md shadow-emerald-100">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  Check your inbox!
                </h3>
                <p className="text-sm sm:text-base font-medium text-slate-600">
                  We sent a 1-click sign-in link to:
                </p>
                <div className="p-3 bg-slate-100 rounded-xl font-mono text-sm sm:text-base font-bold text-slate-800 break-all border border-slate-200">
                  {email}
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-left space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No Password Needed</span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-900/80 leading-relaxed font-medium">
                  Just tap the link in your email and you will be signed in instantly to Lena Dena.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {resendCooldown > 0
                    ? `Resend Link in ${resendCooldown}s`
                    : 'Resend Sign-In Link'}
                </button>

                <div className="flex items-center justify-center gap-4 text-sm font-bold text-slate-600 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('input');
                      setError('');
                    }}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Change Email
                  </button>
                  <span>•</span>
                  <Link
                    href={loginHref}
                    className="hover:text-emerald-700 transition-colors"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
