import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/security';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, otp, newPassword } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // 1. Send OTP Flow
    if (action === 'send-otp') {
      const rateLimitKey = `forgot-pwd-send:${cleanEmail}`;
      const rateLimit = checkRateLimit(rateLimitKey, 3, 10 * 60 * 1000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many OTP requests. Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another code.`,
          },
          { status: 429 }
        );
      }

      // Check if user with this email exists in Lena Dena
      const user = await db.user.findFirst({
        where: { email: cleanEmail },
        select: { id: true, name: true },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this email address' },
          { status: 404 }
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

    // 2. Verify OTP & Reset Password Flow
    if (action === 'verify-otp') {
      if (!otp || typeof otp !== 'string' || !otp.trim()) {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
      }

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters long' },
          { status: 400 }
        );
      }

      const rateLimitKey = `forgot-pwd-verify:${cleanEmail}`;
      const rateLimit = checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many verification attempts. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
          },
          { status: 429 }
        );
      }

      const user = await db.user.findFirst({
        where: { email: cleanEmail },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Verify OTP token with Supabase Auth
      const verifyRes = await verifyEmailOtp(cleanEmail, otp.trim());
      if (!verifyRes.success) {
        return NextResponse.json(
          { error: verifyRes.error || 'Invalid or expired verification code' },
          { status: 400 }
        );
      }

      // Reset password in database
      const hashedPassword = await hashPassword(newPassword);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      });

      // Clear rate limit counters
      resetRateLimit(rateLimitKey);
      resetRateLimit(`login:${cleanEmail}`);

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully. You can now log in with your new password.',
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in forgot-password API:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
