import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { payerId, receiverId, amountPaisa, paymentMethod = 'UPI', notes } = body;

    if (!payerId || !receiverId) {
      return NextResponse.json({ error: 'Payer and receiver are required' }, { status: 400 });
    }

    if (payerId === receiverId) {
      return NextResponse.json({ error: 'Payer and receiver cannot be the same person' }, { status: 400 });
    }

    const parsedAmount = Math.round(Number(amountPaisa));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Valid settlement amount is required' }, { status: 400 });
    }

    const settlement = await db.groupSettlement.create({
      data: {
        groupId: id,
        payerId,
        receiverId,
        amountPaisa: parsedAmount,
        paymentMethod,
        notes: notes?.trim() || null,
      },
      include: {
        payer: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ settlement });
  } catch (err: any) {
    console.error('Error recording settlement:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
