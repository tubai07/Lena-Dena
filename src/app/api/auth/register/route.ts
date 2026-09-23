import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { normalizePhone, getPhoneLookupVariants } from '@/lib/phone';
import { hashPassword } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const { name, phone, email, password } = await req.json();

    if (!name || !phone || !email || !password) {
      return NextResponse.json(
        { error: 'Name, mobile number, email, and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    const cleanPhone = normalized || phone.trim();
    const cleanName = name.trim();
    const phoneVariants = getPhoneLookupVariants(phone);

    // Fast check if phone or email is already registered
    const existing = await db.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          ...phoneVariants.map((p) => ({ phone: p })),
        ],
      },
      select: { id: true, email: true, phone: true },
    });

    if (existing) {
      if (existing.email && existing.email.toLowerCase() === cleanEmail) {
        return NextResponse.json(
          { error: 'An account with this email address already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'An account with this mobile number already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Atomic single insert creating User, Business, and Settings in 1 fast query!
    const user = await db.user.create({
      data: {
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        passwordHash: hashedPassword,
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
      email: user.email || cleanEmail,
    });

    // Directly go to dashboard, no business onboarding needed
    return NextResponse.json({ success: true, redirect: '/' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 });
  }
}
