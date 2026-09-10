import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function parseSessionPayload(cookieValue: string | undefined): any | null {
  if (!cookieValue) return null;
  try {
    if (cookieValue.includes('.')) {
      const [payloadB64] = cookieValue.split('.');
      const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      if (json?.userId && json?.businessId) return json;
    } else {
      const json = JSON.parse(Buffer.from(cookieValue, 'base64').toString('utf-8'));
      if (json?.userId && json?.businessId) return json;
    }
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
    pathname.startsWith('/onboarding');
  const isApiAuth = pathname.startsWith('/api/auth');

  // Public auth API routes
  if (isApiAuth) {
    return NextResponse.next();
  }

  const sessionPayload = parseSessionPayload(sessionCookie?.value);

  // Not authenticated or invalid cookie:
  if (!sessionPayload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAuthPage) {
      const loginUrl = new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      if (sessionCookie) {
        res.cookies.delete('lena_dena_session');
      }
      return res;
    }
    return NextResponse.next();
  }

  // Authenticated user trying to visit /login or /register: redirect to /
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
