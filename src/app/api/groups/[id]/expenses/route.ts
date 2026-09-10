import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      description,
      totalAmountPaisa,
      category = 'GENERAL',
      splitType = 'EQUAL',
      notes,
      date,
      payers,
      splits,
    } = body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const parsedTotal = Math.round(Number(totalAmountPaisa));
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json({ error: 'Valid expense amount is required' }, { status: 400 });
    }

    if (!Array.isArray(payers) || payers.length === 0) {
      return NextResponse.json({ error: 'At least one payer is required' }, { status: 400 });
    }

    if (!Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json({ error: 'At least one split member is required' }, { status: 400 });
    }

    // Verify payer sum matches total
    const payersSum = payers.reduce((sum: number, p: any) => sum + Math.round(Number(p.amountPaisa) || 0), 0);
    if (payersSum !== parsedTotal) {
      return NextResponse.json(
        { error: `Payer amounts (₹${payersSum / 100}) must match total expense (₹${parsedTotal / 100})` },
        { status: 400 }
      );
    }

    // Verify split sum matches total
    const splitsSum = splits.reduce((sum: number, s: any) => sum + Math.round(Number(s.amountPaisa) || 0), 0);
    if (splitsSum !== parsedTotal) {
      return NextResponse.json(
        { error: `Split amounts (₹${splitsSum / 100}) must match total expense (₹${parsedTotal / 100})` },
        { status: 400 }
      );
    }

    // Create inside Prisma transaction
    const expense = await db.$transaction(async (tx) => {
      const createdExpense = await tx.groupExpense.create({
        data: {
          groupId: id,
          description: description.trim(),
          totalAmountPaisa: parsedTotal,
          category,
          splitType,
          notes: notes?.trim() || null,
          date: date ? new Date(date) : new Date(),
          payers: {
            create: payers.map((p: any) => ({
              memberId: p.memberId,
              amountPaisa: Math.round(Number(p.amountPaisa)),
            })),
          },
          splits: {
            create: splits.map((s: any) => ({
              memberId: s.memberId,
              amountPaisa: Math.round(Number(s.amountPaisa)),
              shareValue: s.shareValue ? Number(s.shareValue) : null,
            })),
          },
        },
        include: {
          payers: { include: { member: true } },
          splits: { include: { member: true } },
        },
      });

      return createdExpense;
    });

    return NextResponse.json({ expense });
  } catch (err: any) {
    console.error('Error recording expense:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
