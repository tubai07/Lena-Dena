import { NextResponse } from 'next/server';
import { seedDemoData } from '@/lib/seed';
import { setSession } from '@/lib/auth';

export async function POST() {
  try {
    const seeded = await seedDemoData();
    await setSession({
      userId: seeded.user.id,
      businessId: seeded.business.id,
      userName: seeded.user.name,
      businessName: seeded.business.name,
      phone: seeded.user.phone || '9830012345',
    });

    return NextResponse.json({ success: true, message: 'Demo data reset successfully!' });
  } catch (error: any) {
    console.error('Demo reset error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset demo data' }, { status: 500 });
  }
}
