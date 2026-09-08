import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { getPhoneLookupVariants } from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const { identifier, password, rememberMe = true } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: 'Phone or email is required' }, { status: 400 });
    }

    const cleanIdentifier = identifier.trim();
    const phoneVariants = getPhoneLookupVariants(cleanIdentifier);

    // Look for user by email or any phone format variant
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          ...phoneVariants.map((p) => ({ phone: p })),
        ],
      },
      include: {
        businesses: {
          include: { settings: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this mobile number. Please register first.' },
        { status: 404 }
      );
    }

    if (user.passwordHash && password && user.passwordHash !== password) {
      return NextResponse.json(
        { error: 'Incorrect password. Please check and try again.' },
        { status: 401 }
      );
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
