'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function handleAuth() {
      try {
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') || 'magiclink';
        const redirectParam = searchParams.get('redirect') || searchParams.get('next');

        let accessToken: string | null = null;

        // Check if token is in the hash fragment (#access_token=...)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          accessToken = hashParams.get('access_token');
        }

        // If neither hash nor query params contain a token, check supabase client session
        if (!accessToken && !code && !tokenHash) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            accessToken = sessionData.session.access_token;
          }
        }

        if (!accessToken && !code && !tokenHash) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage('No verification token or code found in this link. Please request a new sign-in link.');
          }
          return;
        }

        // Exchange/verify on the server to establish encrypted session cookie
        const res = await fetch('/api/auth/magic-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            token_hash: tokenHash,
            type,
            accessToken,
            redirect: redirectParam,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to authenticate. The link may have expired.');
        }

        if (!isMounted) return;

        setStatus('success');

        // Check for any pending group join code stored in localStorage
        let targetDestination = data.redirectUrl || '/';
        try {
          const pendingJoinCode = localStorage.getItem('lena_dena_pending_join_code');
          if (pendingJoinCode) {
            localStorage.removeItem('lena_dena_pending_join_code');
            targetDestination = `/join/${pendingJoinCode}`;
          }
        } catch {
          // Ignore localStorage errors
        }

        // Redirect immediately to target destination
        setTimeout(() => {
          window.location.href = targetDestination;
        }, 600);
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Verification failed. Please try signing in again.');
        }
      }
    }

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

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
        </div>

        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200 sm:px-8 text-center">
          {status === 'verifying' && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Signing you in...
              </h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Verifying your secure sign-in link. You will be redirected in just a moment.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Successfully Authenticated!
              </h3>
              <p className="text-sm text-slate-500">
                Redirecting you to your account...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-5 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Unable to Sign In
                </h3>
                <p className="text-sm text-rose-600 font-medium">
                  {errorMessage}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2.5">
                <Link
                  href="/forgot-password"
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  Request a New Link
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all text-center"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
