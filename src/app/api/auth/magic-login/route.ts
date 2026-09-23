import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession, getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, token_hash, type = 'email', accessToken, redirect } = body;

    const client = getSupabaseAdmin();
    let verifiedEmail: string | null = null;
    let authError: string | null = null;

    // 1. Verify access token (from client-side hash parsing)
    if (accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) {
        authError = error.message;
      } else if (data?.user?.email) {
        verifiedEmail = data.user.email;
      }
    }

    // 2. PKCE code exchange
    if (!verifiedEmail && code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        authError = error.message;
      } else if (data?.user?.email) {
        verifiedEmail = data.user.email;
      }
    }

    // 3. Token hash verification
    if (!verifiedEmail && token_hash) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash,
        type: type as any,
      });
      if (error) {
        authError = error.message;
      } else if (data?.user?.email) {
        verifiedEmail = data.user.email;
      }
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { error: authError || 'Invalid or expired sign-in link. Please request a new one.' },
        { status: 400 }
      );
    }

    const cleanEmail = verifiedEmail.trim().toLowerCase();

    // Check if an existing logged-in user is just confirming an email change in settings
    const existingSession = await getSession();
    if (existingSession?.userId && existingSession.email !== cleanEmail) {
      await db.user.update({
        where: { id: existingSession.userId },
        data: { email: cleanEmail },
      });
      await setSession({
        ...existingSession,
        email: cleanEmail,
      });
      return NextResponse.json({
        success: true,
        redirectUrl: '/settings?confirmed=true',
      });
    }

    // Lookup user in Lena Dena database
    const user = await db.user.findFirst({
      where: { email: cleanEmail },
      include: {
        businesses: {
          select: { id: true, name: true, phone: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No Lena Dena account found with this email address. Please register first.' },
        { status: 404 }
      );
    }

    const business = user.businesses[0];

    // Mint cryptographic HMAC session cookie
    await setSession({
      userId: user.id,
      businessId: business?.id || '',
      phone: user.phone || '',
      email: user.email || undefined,
      userName: user.name,
      businessName: business?.name || 'My Business',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      redirectUrl: redirect || '/',
    });
  } catch (err: any) {
    console.error('Error handling magic-login:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
