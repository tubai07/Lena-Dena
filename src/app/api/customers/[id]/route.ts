import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentBusiness } from '@/lib/auth';
import { computeLedgerRunningBalances } from '@/lib/ledger';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: { id, businessId: business.id },
      include: {
        transactions: {
          orderBy: { date: 'asc' },
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
      if (tx.type === 'CREDIT') totalGivenPaisa += tx.amountPaisa;
      if (tx.type === 'PAYMENT') totalReceivedPaisa += tx.amountPaisa;
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
        id: business.id,
        name: business.name,
        upiId: business.upiId,
        phone: business.phone,
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
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, phone, email, address, notes } = body;

    const customer = await db.customer.updateMany({
      where: { id, businessId: business.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: { id, businessId: business.id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await db.customer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete customer' }, { status: 500 });
  }
}
