import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentBusiness } from '@/lib/auth';
import { toPaisa } from '@/lib/ledger';
import { recalculateCustomerBalance } from '@/lib/ledger-server';

export async function GET(req: Request) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const filter = searchParams.get('filter') || 'all'; // all, owes_me, i_owe, settled
    const sort = searchParams.get('sort') || 'highest_balance'; // highest_balance, oldest_due, recently_active, name

    // Build Prisma query
    const where: any = {
      businessId: business.id,
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
      orderBy = { currentBalancePaisa: 'desc' };
    } else if (sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (sort === 'recently_active') {
      orderBy = { updatedAt: 'desc' };
    } else if (sort === 'oldest_due') {
      orderBy = { createdAt: 'asc' };
    } else {
      orderBy = { currentBalancePaisa: 'desc' };
    }

    const customers = await db.customer.findMany({
      where,
      orderBy,
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return NextResponse.json({ customers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email, address, notes, openingBalance = 0, balanceType = 'OWES_ME' } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Customer name and phone number are required' }, { status: 400 });
    }

    const numBalance = Number(openingBalance) || 0;
    let openingPaisa = toPaisa(numBalance);
    if (balanceType === 'I_OWE') {
      openingPaisa = -openingPaisa;
    }

    const customer = await db.$transaction(async (tx) => {
      const newCust = await tx.customer.create({
        data: {
          businessId: business.id,
          name: name.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
          openingBalancePaisa: openingPaisa,
          currentBalancePaisa: openingPaisa,
          status: openingPaisa === 0 ? 'SETTLED' : 'ACTIVE',
        },
      });

      // If non-zero opening balance, create initial ledger transaction record
      if (openingPaisa !== 0) {
        await tx.transaction.create({
          data: {
            businessId: business.id,
            customerId: newCust.id,
            type: openingPaisa > 0 ? 'CREDIT' : 'PAYMENT',
            amountPaisa: Math.abs(openingPaisa),
            paymentMethod: 'OTHER',
            description: 'Opening Balance',
          },
        });
        await recalculateCustomerBalance(newCust.id, tx);
      }

      return newCust;
    });

    return NextResponse.json({ customer, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create customer' }, { status: 500 });
  }
}
