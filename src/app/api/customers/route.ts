import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toPaisa } from '@/lib/ledger';
import { recalculateCustomerBalance } from '@/lib/ledger-server';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const filter = searchParams.get('filter') || 'all'; // all, owes_me, i_owe, settled
    const sort = searchParams.get('sort') || 'highest_balance'; // highest_balance, oldest_due, recently_active, name

    // Build Prisma query
    const where: any = {
      businessId: session.businessId,
    };

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { notes: { contains: q } },
      ];
    }

    if (filter === 'owes_me') {
      where.currentBalancePaisa = { gt: 0 };
    } else if (filter === 'i_owe') {
      where.currentBalancePaisa = { lt: 0 };
    } else if (filter === 'settled') {
      where.currentBalancePaisa = 0;
    }

    // Build orderBy
    let orderBy: any = {};
    if (sort === 'highest_balance') {
      orderBy = [{ currentBalancePaisa: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'name') {
      orderBy = [{ name: 'asc' }, { createdAt: 'desc' }];
    } else if (sort === 'recently_active') {
      orderBy = [{ updatedAt: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'oldest_due') {
      orderBy = [{ createdAt: 'asc' }];
    } else {
      orderBy = [{ currentBalancePaisa: 'desc' }, { createdAt: 'desc' }];
    }

    const customers = await db.customer.findMany({
      where,
      orderBy,
      include: {
        transactions: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    return NextResponse.json(
      { customers },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const businessId = session.businessId;

    const body = await req.json();
    const { id, name, phone, email, address, notes, openingBalance = 0, balanceType = 'OWES_ME' } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Customer name and phone number are required' }, { status: 400 });
    }

    const numBalance = Number(openingBalance) || 0;
    let openingPaisa = toPaisa(numBalance);
    if (balanceType === 'I_OWE') {
      openingPaisa = -openingPaisa;
    }

    if (openingPaisa === 0) {
      // Direct single insert - 0 transaction overhead!
      const customer = await db.customer.create({
        data: {
          ...(id ? { id } : {}),
          businessId,
          name: name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
          openingBalancePaisa: 0,
          currentBalancePaisa: 0,
          status: 'SETTLED',
        },
        include: {
          transactions: { take: 1 },
        },
      });
      return NextResponse.json({ customer, success: true });
    }

    // Atomic insert with initial transaction in single query!
    const customer = await db.customer.create({
      data: {
        ...(id ? { id } : {}),
        businessId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        openingBalancePaisa: 0,
        currentBalancePaisa: openingPaisa,
        status: 'ACTIVE',
        transactions: {
          create: {
            businessId,
            type: openingPaisa > 0 ? 'CREDIT' : 'PAYMENT',
            amountPaisa: Math.abs(openingPaisa),
            paymentMethod: 'OTHER',
            description: 'Opening Balance',
          },
        },
      },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    return NextResponse.json({ customer, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create customer' }, { status: 500 });
  }
}
