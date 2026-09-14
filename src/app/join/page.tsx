'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/groups');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="animate-pulse text-sm font-bold text-slate-500">
        Redirecting to groups...
      </div>
    </div>
  );
}
