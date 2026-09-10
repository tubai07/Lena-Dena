import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { getPhoneLookupVariants } from '@/lib/phone';
import { verifyPassword, hashPassword } from '@/lib/security';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const { identifier, password, rememberMe = true } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Phone or email and password are required' }, { status: 400 });
    }

    const cleanIdentifier = identifier.trim();

    // 1. Rate limiting: max 5 failed attempts per 15 minutes per phone/email
    const rateLimitKey = `login:${cleanIdentifier}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const phoneVariants = getPhoneLookupVariants(cleanIdentifier);

    // Fast, lightweight lookup by email or any phone format variant
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          ...phoneVariants.map((p) => ({ phone: p })),
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        passwordHash: true,
        businesses: {
          select: { id: true, name: true, phone: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this mobile number. Please register first.' },
        { status: 404 }
      );
    }

    // 2. Cryptographic password verification (with legacy fallback)
    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Incorrect password. Please check and try again.' },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful authentication
    resetRateLimit(rateLimitKey);

    // 3. Auto-upgrade legacy plaintext password to bcrypt hash on successful login
    if (needsRehash) {
      hashPassword(password)
        .then((newHash) => {
          db.user.update({
            where: { id: user.id },
            data: { passwordHash: newHash },
          }).catch((err) => console.error('Failed to auto-upgrade password hash:', err));
        })
        .catch(() => {});
    }

    // Default to first business or create one
    let business = user.businesses[0];
    if (!business) {
      business = await db.business.create({
        data: {
          name: `${user.name}'s Khata`,
          ownerId: user.id,
          phone: user.phone,
        },
        include: { settings: true },
      });
    }

    await setSession(
      {
        userId: user.id,
        businessId: business.id,
        userName: user.name,
        businessName: business.name,
        phone: user.phone || '',
      },
      Boolean(rememberMe)
    );

    return NextResponse.json({ success: true, redirect: '/' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
