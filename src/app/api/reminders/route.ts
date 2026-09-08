import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentBusiness } from '@/lib/auth';

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reminders = await db.reminder.findMany({
      where: { businessId: business.id },
      orderBy: { sentAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, currentBalancePaisa: true },
        },
      },
      take: 50,
    });

    return NextResponse.json({
      reminders,
      settings: business.settings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch reminders' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, channel = 'WHATSAPP', message } = body;

    if (!customerId || !message) {
      return NextResponse.json({ error: 'Customer and message are required' }, { status: 400 });
    }

    const reminder = await db.reminder.create({
      data: {
        businessId: business.id,
        customerId,
        channel,
        message,
        status: 'SENT',
      },
    });

    return NextResponse.json({ success: true, reminder });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to log reminder' }, { status: 500 });
  }
}
