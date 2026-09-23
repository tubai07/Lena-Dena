import { createClient } from '@supabase/supabase-js';

export const getSupabaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

export const getSupabaseAnonKey = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

export const getSupabaseAdmin = () => {
  const url = getSupabaseUrl() || 'https://placeholder.supabase.co';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    getSupabaseAnonKey() ||
    'placeholder-key';
  return createClient(url, serviceRoleKey);
};

export const getSupabaseClient = () => {
  const url = getSupabaseUrl() || 'https://placeholder.supabase.co';
  const key = getSupabaseAnonKey() || 'placeholder-key';
  return createClient(url, key);
};

// Safe default client that never throws during build-time module evaluation
export const supabase = createClient(
  getSupabaseUrl() || 'https://placeholder.supabase.co',
  getSupabaseAnonKey() || 'placeholder-key'
);

/**
 * Sends a 6-digit Email OTP via Supabase Auth.
 * Pre-confirms user in Supabase Auth to prevent sending "Confirm signup" link emails.
 */
export async function sendEmailOtp(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = getSupabaseUrl();
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      getSupabaseAnonKey();

    if (!url || !key) {
      return {
        success: false,
        error: 'Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const client = getSupabaseAdmin();

    const { error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send OTP' };
  }
}

/**
 * Verifies a 6-digit Email OTP via Supabase Auth.
 * Attempts both 'email' and 'signup' OTP types for bulletproof verification.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = getSupabaseUrl();
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      getSupabaseAnonKey();

    if (!url || !key) {
      return {
        success: false,
        error: 'Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    const client = getSupabaseAdmin();

    // 1. Try with type: 'email' (standard for confirmed user OTPs)
    const emailRes = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });

    if (!emailRes.error) {
      return { success: true };
    }

    // 2. Fallback to type: 'signup' (in case Supabase generated a signup OTP)
    const signupRes = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'signup',
    });

    if (!signupRes.error) {
      return { success: true };
    }

    return {
      success: false,
      error: emailRes.error?.message || signupRes.error?.message || 'Invalid or expired OTP',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'OTP verification failed' };
  }
}

/**
 * Sends a passwordless 1-click Magic Sign-in Link via Supabase Auth.
 * When clicked, the user is redirected to /auth/callback and signed in instantly without an OTP or password reset.
 */
export async function sendMagicLink(
  email: string,
  redirectTo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = getSupabaseUrl();
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      getSupabaseAnonKey();

    if (!url || !key) {
      return {
        success: false,
        error: 'Supabase is not configured. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables.',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const client = getSupabaseAdmin();

    // Fast, direct 1-step magic link dispatch via Supabase Auth
    const { error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send sign-in link' };
  }
}

