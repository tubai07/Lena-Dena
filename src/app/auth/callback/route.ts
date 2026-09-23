import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, setSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') || 'email';
  const session = await getSession();

  try {
    const client = getSupabaseAdmin();

    // 1. PKCE Code Exchange
    if (code && session?.userId) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data?.user?.email) {
        const verifiedEmail = data.user.email.toLowerCase();
        await db.user.update({
          where: { id: session.userId },
          data: { email: verifiedEmail },
        });
        await setSession({
          ...session,
          email: verifiedEmail,
        });
        return NextResponse.redirect(new URL('/settings?confirmed=true', req.url));
      }
    }

    // 2. Token Hash Verification
    if (tokenHash && session?.userId) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });
      if (!error && data?.user?.email) {
        const verifiedEmail = data.user.email.toLowerCase();
        await db.user.update({
          where: { id: session.userId },
          data: { email: verifiedEmail },
        });
        await setSession({
          ...session,
          email: verifiedEmail,
        });
        return NextResponse.redirect(new URL('/settings?confirmed=true', req.url));
      }
    }
  } catch (err) {
    console.error('Error handling auth callback:', err);
  }

  return NextResponse.redirect(new URL('/settings', req.url));
}
