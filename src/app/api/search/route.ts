import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentBusiness } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ customers: [], transactions: [] });
    }

    const customers = await db.customer.findMany({
      where: {
        businessId: business.id,
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { notes: { contains: q } },
          { address: { contains: q } },
        ],
      },
      take: 8,
    });

    const transactions = await db.transaction.findMany({
      where: {
        businessId: business.id,
        OR: [
          { description: { contains: q } },
          { billNumber: { contains: q } },
        ],
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      take: 8,
    });

    return NextResponse.json({ customers, transactions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 });
  }
}
