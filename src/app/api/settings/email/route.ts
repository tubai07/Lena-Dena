import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, setSession } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { sendEmailOtp, verifyEmailOtp, getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, newEmail, otp, accessToken } = body;

    // 0. Confirm via access token from URL hash (when clicking confirmation link in email)
    if (action === 'confirm-token') {
      if (!accessToken || typeof accessToken !== 'string') {
        return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
      }

      const client = getSupabaseAdmin();
      const { data: userData, error: userError } = await client.auth.getUser(accessToken);
      if (userError || !userData?.user?.email) {
        return NextResponse.json({ error: 'Invalid or expired confirmation link' }, { status: 400 });
      }

      const verifiedEmail = userData.user.email.toLowerCase();

      // Check uniqueness
      const existing = await db.user.findFirst({
        where: {
          email: verifiedEmail,
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

      const updatedUser = await db.user.update({
        where: { id: session.userId },
        data: { email: verifiedEmail },
        select: { id: true, email: true },
      });

      await setSession({
        ...session,
        email: verifiedEmail,
      });

      return NextResponse.json({
        success: true,
        email: updatedUser.email,
        message: 'Email confirmed and updated successfully!',
      });
    }

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // 1. Send OTP / Confirmation link to new email
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

      // Send 6-digit OTP / Confirmation link using Supabase Auth
      const otpRes = await sendEmailOtp(cleanEmail);
      if (!otpRes.success) {
        return NextResponse.json(
          { error: otpRes.error || 'Failed to send verification code. Please check your email configuration.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Verification code or link sent to ${cleanEmail}`,
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

    // 3. Check if user already clicked the confirmation link in their email
    if (action === 'check-confirmed') {
      const client = getSupabaseAdmin();
      const { data: usersData, error: listError } = await client.auth.admin.listUsers();
      if (listError) {
        return NextResponse.json({ error: 'Failed to verify confirmation status' }, { status: 500 });
      }

      const authUser = usersData?.users?.find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );

      if (!authUser || !authUser.email_confirmed_at) {
        return NextResponse.json(
          {
            confirmed: false,
            error: 'Email has not been confirmed yet. Please click the confirmation link in your email or enter the 6-digit OTP.',
          },
          { status: 400 }
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

      return NextResponse.json({
        success: true,
        confirmed: true,
        email: updatedUser.email,
        message: 'Email address confirmed and updated successfully!',
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in settings email API:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
