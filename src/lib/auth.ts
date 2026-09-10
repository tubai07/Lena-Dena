import { cookies } from 'next/headers';
import { db } from './db';
import { signPayload, verifyAndExtractPayload } from './security';

export interface SessionData {
  userId: string;
  businessId: string;
  userName: string;
  businessName: string;
  phone: string;
}

const COOKIE_NAME = 'lena_dena_session';

export function parseSessionCookie(cookieValue: string): SessionData | null {
  if (!cookieValue) return null;

  // 1. Check modern cryptographically signed format (payload.signature)
  const verified = verifyAndExtractPayload<SessionData>(cookieValue);
  if (verified?.userId && verified?.businessId) {
    return verified;
  }

  // 2. Backward compatibility for older/existing user sessions (legacy base64 format)
  try {
    const raw = Buffer.from(cookieValue, 'base64').toString('utf-8');
    const legacy = JSON.parse(raw);
    if (legacy?.userId && legacy?.businessId) {
      return legacy as SessionData;
    }
  } catch {
    // Ignore invalid base64
  }

  return null;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const parsed = parseSessionCookie(sessionCookie.value);
  if (!parsed?.userId || !parsed?.businessId) {
    try {
      cookieStore.delete(COOKIE_NAME);
    } catch {
      // Ignore if called in read-only render context
    }
    return null;
  }

  // Auto-upgrade legacy cookie to HMAC-signed format seamlessly
  if (!sessionCookie.value.includes('.')) {
    try {
      await setSession(parsed, true);
    } catch {
      // Ignore if called in read-only render context
    }
  }

  return parsed;
}

export async function setSession(data: SessionData, rememberMe: boolean = true) {
  const cookieStore = await cookies();
  const encoded = signPayload(data);
  
  const cookieOptions: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // If rememberMe is checked, keep login active for 365 days (1 year); otherwise 1 day
    maxAge: rememberMe ? 60 * 60 * 24 * 365 : 60 * 60 * 24,
  };

  cookieStore.set(COOKIE_NAME, encoded, cookieOptions);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Gets currently authenticated business with settings.
 * Guaranteed to scope queries strictly to the authenticated business.
 */
export async function getCurrentBusiness() {
  const session = await getSession();
  if (!session?.businessId) {
    return null;
  }

  const business = await db.business.findUnique({
    where: { id: session.businessId },
    include: {
      owner: true,
      settings: true,
    },
  });

  return business;
}
