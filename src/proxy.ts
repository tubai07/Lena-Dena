import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import crypto from 'node:crypto';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'lena_dena_secure_session_secret_change_in_production_key_1234567890';

function parseSessionPayload(cookieValue: string | undefined): any | null {
  if (!cookieValue || typeof cookieValue !== 'string') return null;
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    if (!base64Payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Payload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const json = JSON.parse(jsonStr);
    if (json?.userId && json?.businessId) return json;
  } catch {
    return null;
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('lena_dena_session');

  // Static assets and internal next paths are always allowed
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/app-icon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/manifest') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg')
  ) {
    return NextResponse.next();
  }

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/onboarding');

  const isPublicPage =
    pathname.startsWith('/join') ||
    pathname.startsWith('/groups') ||
    pathname.startsWith('/auth/callback');

  const isPublicApi =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/join') ||
    pathname.startsWith('/api/groups/');

  // Public API routes
  if (isPublicApi) {
    return NextResponse.next();
  }

  const sessionPayload = parseSessionPayload(sessionCookie?.value);

  // Not authenticated or invalid cookie:
  if (!sessionPayload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAuthPage && !isPublicPage) {
      const loginUrl = new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      if (sessionCookie) {
        res.cookies.delete('lena_dena_session');
      }
      return res;
    }
    return NextResponse.next();
  }

  // Authenticated user trying to visit /login, /register, or /onboarding: redirect to /
  if (isAuthPage) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
};
