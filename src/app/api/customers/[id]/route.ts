import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { computeLedgerRunningBalances } from '@/lib/ledger';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: { id, businessId: session.businessId },
      include: {
        transactions: {
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        },
        reminders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Compute chronological running balance
    const ledgerWithBalances = computeLedgerRunningBalances(
      customer.openingBalancePaisa,
      customer.transactions
    );

    // Compute customer totals
    let totalGivenPaisa = 0;
    let totalReceivedPaisa = 0;
    for (const tx of customer.transactions) {
      if (!tx.isDeleted) {
        if (tx.type === 'CREDIT') totalGivenPaisa += tx.amountPaisa;
        if (tx.type === 'PAYMENT') totalReceivedPaisa += tx.amountPaisa;
      }
    }

    return NextResponse.json({
      customer: {
        ...customer,
        transactions: ledgerWithBalances.reverse(), // most recent on top for display
      },
      stats: {
        totalGivenPaisa,
        totalReceivedPaisa,
        currentBalancePaisa: customer.currentBalancePaisa,
      },
      business: {
        id: session.businessId,
        name: session.businessName,
        phone: session.phone,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch customer details' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, phone, email, address, notes } = body;

    const existing = await db.customer.findFirst({
      where: { id, businessId: session.businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const updatedCustomer = await db.customer.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
      include: {
        transactions: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    return NextResponse.json({ success: true, customer: updatedCustomer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: { id, businessId: session.businessId },
    });

    if (!customer) {
      return NextResponse.json({ success: true, message: 'Customer already deleted' });
    }

    await db.customer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete customer' }, { status: 500 });
  }
}
