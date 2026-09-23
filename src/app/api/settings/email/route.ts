import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, setSession } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, newEmail, otp } = body;

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // 1. Send OTP to new email
    if (action === 'send-otp') {
      const rateLimitKey = `email-change-send:${session.userId}`;
      const rateLimit = checkRateLimit(rateLimitKey, 3, 10 * 60 * 1000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many OTP requests. Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another code.`,
          },
          { status: 429 }
        );
      }

      // Check if new email is already taken by someone else
      const existing = await db.user.findFirst({
        where: {
          email: cleanEmail,
          id: { not: session.userId },
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'This email address is already in use by another account' },
          { status: 400 }
        );
      }

      // Send 6-digit OTP using Supabase Auth Email OTP
      const otpRes = await sendEmailOtp(cleanEmail);
      if (!otpRes.success) {
        return NextResponse.json(
          { error: otpRes.error || 'Failed to send verification code. Please check your email configuration.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `6-digit verification code sent to ${cleanEmail}`,
      });
    }

    // 2. Verify OTP & Update Email
    if (action === 'verify-otp') {
      if (!otp || typeof otp !== 'string' || !otp.trim()) {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
      }

      const rateLimitKey = `email-change-verify:${session.userId}`;
      const rateLimit = checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many verification attempts. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
          },
          { status: 429 }
        );
      }

      // Verify OTP token with Supabase Auth
      const verifyRes = await verifyEmailOtp(cleanEmail, otp.trim());
      if (!verifyRes.success) {
        return NextResponse.json(
          { error: verifyRes.error || 'Invalid or expired verification code' },
          { status: 400 }
        );
      }

      // Update user in database
      const updatedUser = await db.user.update({
        where: { id: session.userId },
        data: { email: cleanEmail },
        select: { id: true, email: true },
      });

      // Update active session with the new email
      await setSession({
        ...session,
        email: cleanEmail,
      });

      resetRateLimit(rateLimitKey);

      return NextResponse.json({
        success: true,
        email: updatedUser.email,
        message: 'Email address updated successfully!',
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in settings email API:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
