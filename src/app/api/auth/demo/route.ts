import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { seedDemoData } from '@/lib/seed';

export async function POST() {
  try {
    let business = await db.business.findFirst({
      where: { name: 'Tubai General Store' },
      include: { owner: true },
    });

    if (!business) {
      const seeded = await seedDemoData();
      business = await db.business.findUnique({
        where: { id: seeded.business.id },
        include: { owner: true },
      });
    }

    if (!business) {
      return NextResponse.json({ error: 'Failed to initialize demo merchant' }, { status: 500 });
    }

    await setSession({
      userId: business.ownerId,
      businessId: business.id,
      userName: business.owner.name,
      businessName: business.name,
      phone: business.phone || '9830012345',
    });

    return NextResponse.json({ success: true, redirect: '/' });
  } catch (error: any) {
    console.error('Demo login error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
