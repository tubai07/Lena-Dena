import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { normalizePhone, getPhoneLookupVariants } from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const { name, phone, password } = await req.json();

    if (!name || !phone || !password) {
      return NextResponse.json({ error: 'Name, mobile number, and password are required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const cleanPhone = normalized || phone.trim();
    const cleanName = name.trim();
    const phoneVariants = getPhoneLookupVariants(phone);

    // Fast check if phone already registered under any format
    const existing = await db.user.findFirst({
      where: {
        OR: phoneVariants.map((p) => ({ phone: p })),
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'An account with this mobile number already exists' }, { status: 400 });
    }

    // Atomic single insert creating User, Business, and Settings in 1 fast query!
    const user = await db.user.create({
      data: {
        name: cleanName,
        phone: cleanPhone,
        passwordHash: password,
        businesses: {
          create: {
            name: `${cleanName}'s Khata`,
            phone: cleanPhone,
            category: 'Personal',
            settings: {
              create: {
                autoRemindersEnabled: true,
                reminderFrequencyDays: 7,
              },
            },
          },
        },
      },
      include: {
        businesses: {
          take: 1,
        },
      },
    });

    const business = user.businesses[0];

    await setSession({
      userId: user.id,
      businessId: business.id,
      userName: user.name,
      businessName: business.name,
      phone: user.phone || '',
    });

    // Directly go to dashboard, no business onboarding needed
    return NextResponse.json({ success: true, redirect: '/' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
