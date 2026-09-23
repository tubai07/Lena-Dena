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
 * Sends a 6-digit Email OTP via Supabase Auth
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
 * Verifies a 6-digit Email OTP via Supabase Auth
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
    const { data, error } = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'OTP verification failed' };
  }
}

