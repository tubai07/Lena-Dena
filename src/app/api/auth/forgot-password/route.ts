import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendMagicLink, sendEmailOtp, verifyEmailOtp } from '@/lib/supabase';
import { hashPassword } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action = 'send-link', email, otp, newPassword, redirect } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // 1. Passwordless 1-Click Magic Sign-In Link Flow (Default)
    if (action === 'send-link' || action === 'send-magic-link' || action === 'send-otp') {
      const rateLimitKey = `magic-link-send:${cleanEmail}`;
      const rateLimit = checkRateLimit(rateLimitKey, 4, 10 * 60 * 1000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many sign-in link requests. Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another link.`,
          },
          { status: 429 }
        );
      }

      // Check if user exists in Lena Dena
      const user = await db.user.findFirst({
        where: { email: cleanEmail },
        select: { id: true, name: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this email address. Please check your spelling or register.' },
          { status: 404 }
        );
      }

      // Determine dynamic callback redirect URL
      const origin =
        req.headers.get('origin') ||
        (req.headers.get('host') ? `https://${req.headers.get('host')}` : '') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://lenadena.vercel.app';
      const callbackBase = `${origin.replace(/\/$/, '')}/auth/callback`;
      const redirectTo = redirect ? `${callbackBase}?redirect=${encodeURIComponent(redirect)}` : callbackBase;

      // Dispatch 1-click magic link via Supabase Auth
      const linkRes = await sendMagicLink(cleanEmail, redirectTo);
      if (!linkRes.success) {
        return NextResponse.json(
          { error: linkRes.error || 'Failed to send sign-in link. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Sign-in link sent to ${cleanEmail}`,
      });
    }

    // 2. Legacy / Optional OTP verification fallback
    if (action === 'verify-otp') {
      if (!otp || typeof otp !== 'string') {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
      }
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      const verifyRes = await verifyEmailOtp(cleanEmail, otp.trim());
      if (!verifyRes.success) {
        return NextResponse.json({ error: verifyRes.error || 'Invalid or expired code' }, { status: 400 });
      }

      const passwordHash = await hashPassword(newPassword);
      await db.user.updateMany({
        where: { email: cleanEmail },
        data: { passwordHash },
      });

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action requested' }, { status: 400 });
  } catch (err: any) {
    console.error('Error handling forgot-password request:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
