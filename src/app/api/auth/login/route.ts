import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: 'Phone or email is required' }, { status: 400 });
    }

    const cleanIdentifier = identifier.trim();

    // Look for user by email or phone
    const user = await db.user.findFirst({
      where: {
        OR: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
      },
      include: {
        businesses: {
          include: { settings: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Please register or use Demo Login.' }, { status: 404 });
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

    await setSession({
      userId: user.id,
      businessId: business.id,
      userName: user.name,
      businessName: business.name,
      phone: user.phone || '',
    });

    return NextResponse.json({ success: true, redirect: '/' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
