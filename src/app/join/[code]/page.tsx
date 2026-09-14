'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JoinGroupDetailPage() {
  const router = useRouter();
  const urlParams = useParams();
  const paramCode = (urlParams?.code as string) || '';
  const [code, setCode] = useState(paramCode);

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
    const clean = (code || '').trim();
    if (!clean) return;

    fetch(`/api/groups/${clean}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.group?.id) {
          router.replace(`/groups/${data.group.id}`);
        } else {
          router.replace('/groups');
        }
      })
      .catch(() => {
        router.replace('/groups');
      });
  }, [code, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="animate-pulse text-sm font-bold text-slate-500">
        Opening group...
      </div>
    </div>
  );
}
