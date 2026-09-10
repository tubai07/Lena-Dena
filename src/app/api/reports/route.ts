import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBusinessDashboardSummary } from '@/lib/ledger-server';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month'; // today, week, month, year, all

    // 4. Time series breakdown for charts (last 6 months or 7 days)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Run business profile, summary, transactions, customers, and chart history in parallel
    const [business, summary, recentTransactions, outstandingCustomers, allTx] = await Promise.all([
      db.business.findUnique({
        where: { id: session.businessId },
        include: { owner: true, settings: true },
      }),
      getBusinessDashboardSummary(session.businessId),
      db.transaction.findMany({
        where: { businessId: session.businessId, isDeleted: false },
        orderBy: { date: 'desc' },
        take: 6,
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      }),
      db.customer.findMany({
        where: {
          businessId: session.businessId,
          currentBalancePaisa: { gt: 0 },
        },
        orderBy: { currentBalancePaisa: 'desc' },
        take: 6,
        include: {
          transactions: {
            where: { isDeleted: false },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      }),
      db.transaction.findMany({
        where: {
          businessId: session.businessId,
          isDeleted: false,
          date: { gte: sixMonthsAgo },
        },
        select: { type: true, amountPaisa: true, date: true },
      }),
    ]);

    // Calculate days overdue based on oldest unpaid or last transaction
    const now = new Date();
    const formattedOutstanding = outstandingCustomers.map((c) => {
      const lastTxDate = c.transactions[0]?.date ? new Date(c.transactions[0].date) : new Date(c.createdAt);
      const daysOverdue = Math.max(1, Math.floor((now.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        ...c,
        daysOverdue,
      };
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
        id: business?.id || session.businessId,
        name: business?.name || session.businessName,
        category: business?.category || 'Personal',
        currency: business?.currency || 'INR',
        currencySymbol: business?.currencySymbol || '₹',
        upiId: business?.upiId,
        phone: business?.phone || session.phone,
        address: business?.address,
        ownerName: business?.owner?.name || session.userName,
        settings: business?.settings,
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
