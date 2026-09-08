import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentBusiness } from '@/lib/auth';
import { getBusinessDashboardSummary } from '@/lib/ledger-server';

export async function GET(req: Request) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month'; // today, week, month, year, all

    // 1. Dashboard summary numbers
    const summary = await getBusinessDashboardSummary(business.id);

    // 2. Recent activity
    const recentTransactions = await db.transaction.findMany({
      where: { businessId: business.id },
      orderBy: { date: 'desc' },
      take: 6,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    // 3. Outstanding customers (You will receive)
    const outstandingCustomers = await db.customer.findMany({
      where: {
        businessId: business.id,
        currentBalancePaisa: { gt: 0 },
      },
      orderBy: { currentBalancePaisa: 'desc' },
      take: 6,
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    // Calculate days overdue based on oldest unpaid or last transaction
    const now = new Date();
    const formattedOutstanding = outstandingCustomers.map((c) => {
      const lastTxDate = c.transactions[0]?.date ? new Date(c.transactions[0].date) : new Date(c.createdAt);
      const diffDays = Math.max(1, Math.floor((now.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        ...c,
        daysOverdue: diffDays,
      };
    });

    // 4. Time series breakdown for charts (last 6 months or 7 days)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const allTx = await db.transaction.findMany({
      where: {
        businessId: business.id,
        date: { gte: sixMonthsAgo },
      },
      select: { type: true, amountPaisa: true, date: true },
    });

    // Group by month
    const monthsMap: { [key: string]: { month: string; credit: number; payment: number } } = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en-IN', { month: 'short' });
      monthsMap[key] = { month: key, credit: 0, payment: 0 };
    }

    for (const tx of allTx) {
      const key = new Date(tx.date).toLocaleDateString('en-IN', { month: 'short' });
      if (monthsMap[key]) {
        if (tx.type === 'CREDIT') {
          monthsMap[key].credit += tx.amountPaisa / 100;
        } else if (tx.type === 'PAYMENT') {
          monthsMap[key].payment += tx.amountPaisa / 100;
        }
      }
    }

    const chartData = Object.values(monthsMap);

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        category: business.category,
        currency: business.currency,
        currencySymbol: business.currencySymbol,
        upiId: business.upiId,
        phone: business.phone,
        address: business.address,
        ownerName: business.owner?.name,
        settings: business.settings,
      },
      summary,
      recentTransactions,
      outstandingCustomers: formattedOutstanding,
      chartData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate report' }, { status: 500 });
  }
}
