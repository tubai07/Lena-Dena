import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toPaisa } from '@/lib/ledger';
import {
  recordLedgerTransaction,
  deleteLedgerTransaction,
  updateLedgerTransaction,
} from '@/lib/ledger-server';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // CREDIT, PAYMENT
    const method = searchParams.get('method');
    const customerId = searchParams.get('customerId');
    const q = searchParams.get('q')?.trim();
    const dateRange = searchParams.get('dateRange'); // today, week, month, all

    const where: any = {
      businessId: session.businessId,
    };

    if (type) where.type = type;
    if (method) where.paymentMethod = method;
    if (customerId) where.customerId = customerId;

    if (q) {
      where.OR = [
        { description: { contains: q } },
        { billNumber: { contains: q } },
        { customer: { name: { contains: q } } },
      ];
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.date = { gte: startOfDay };
      } else if (dateRange === 'week') {
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.date = { gte: startOfWeek };
      } else if (dateRange === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        where.date = { gte: startOfMonth };
      }
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, currentBalancePaisa: true },
        },
      },
      take: 100,
    });

    return NextResponse.json({ transactions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { customerId, type, amount, paymentMethod, date, description, billNumber } = body;

    if (!customerId || !type || !amount) {
      return NextResponse.json({ error: 'Customer, transaction type, and amount are required' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const txDate = date ? new Date(date) : new Date();

    const result = await recordLedgerTransaction({
      businessId: session.businessId,
      customerId,
      type: type as 'CREDIT' | 'PAYMENT',
      amountPaisa: toPaisa(numAmount),
      paymentMethod: paymentMethod || 'CASH',
      date: txDate,
      description,
      billNumber,
    });

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      newBalancePaisa: result.newBalancePaisa,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record transaction' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, type, amount, paymentMethod, date, description, billNumber } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (type) updateData.type = type;
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
      }
      updateData.amountPaisa = toPaisa(numAmount);
    }
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (date) updateData.date = new Date(date);
    if (description !== undefined) updateData.description = description;
    if (billNumber !== undefined) updateData.billNumber = billNumber;

    const result = await updateLedgerTransaction(id, session.businessId, updateData);

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      newBalancePaisa: result.newBalancePaisa,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const result = await deleteLedgerTransaction(id, session.businessId);

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted and balance recalculated',
      newBalancePaisa: result.newBalancePaisa,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete transaction' }, { status: 500 });
  }
}
