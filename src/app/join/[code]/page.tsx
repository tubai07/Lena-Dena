'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCachedItem, setCachedItem } from '@/lib/groupCache';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function JoinGroupDetailPage() {
  const router = useRouter();
  const urlParams = useParams();
  const paramCode = (urlParams?.code as string) || '';
  const [code, setCode] = useState(paramCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paramCode) {
      setCode(paramCode);
    } else if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/join/');
      if (parts[1]) {
        setCode(decodeURIComponent(parts[1].split('/')[0].split('?')[0]));
      }
    }
  }, [paramCode]);

  useEffect(() => {
    const clean = (code || '').trim().toUpperCase();
    if (!clean) return;

    let isMounted = true;

    async function processJoin() {
      try {
        const res = await fetch(`/api/join/${clean}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoJoin: true }),
        });

        // 1. Unauthenticated user: redirect to login with return link
        if (res.status === 401) {
          const redirectUrl = `/login?redirect=${encodeURIComponent(`/join/${clean}`)}`;
          router.replace(redirectUrl);
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          if (isMounted) {
            setError(data.error || 'Failed to join group');
          }
          return;
        }

        if (data?.groupId) {
          // Invalidate cached group so the new membership reflects immediately
          try {
            sessionStorage.removeItem(`group_${data.groupId}`);
            sessionStorage.removeItem('all_groups');
          } catch {
            // ignore
          }

          // Broadcast member join to all active peers
          try {
            const channel = supabase.channel(`group-rt-${data.groupId}`);
            channel.send({
              type: 'broadcast',
              event: 'GROUP_UPDATED',
              payload: { id: data.groupId, timestamp: Date.now() },
            });
          } catch {
            // ignore
          }

          router.replace(`/groups/${data.groupId}?joined=true`);
        } else {
          router.replace('/groups');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Something went wrong while joining the group');
        }
      }
    }

    processJoin();

    return () => {
      isMounted = false;
    };
  }, [code, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-xl border border-slate-100 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Couldn't Join Group</h2>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
          <Link
            href="/groups"
            className="w-full py-3 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all tap-effect"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to My Groups</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-xl border border-slate-100 space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
        <h2 className="text-sm font-bold text-slate-800">Joining Group...</h2>
        <p className="text-xs text-slate-400">Connecting you with group expenses</p>
      </div>
    </div>
  );
}
