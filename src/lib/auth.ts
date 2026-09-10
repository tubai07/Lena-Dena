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

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  // Verify HMAC-SHA256 signature and extract validated session payload
  const parsed = verifyAndExtractPayload<SessionData>(sessionCookie.value);
  if (!parsed?.userId || !parsed?.businessId) {
    return null;
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
