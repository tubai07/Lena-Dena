import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

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
      category = 'General',
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

    // Verify group exists and get members
    const group = await db.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const groupMemberIds = new Set(group.members.map((m) => m.id));

    // Verify all payers are valid group members
    for (const p of payers) {
      if (!p.memberId || !groupMemberIds.has(p.memberId)) {
        return NextResponse.json(
          { error: 'Payer must be a valid member of this group' },
          { status: 400 }
        );
      }
    }

    // Verify all split members are valid group members
    for (const s of splits) {
      if (!s.memberId || !groupMemberIds.has(s.memberId)) {
        return NextResponse.json(
          { error: 'Split person must be a valid member of this group' },
          { status: 400 }
        );
      }
    }

    // Auto-balance minor 1-2 paise floating point rounding differences
    let adjustedPayers = payers.map((p: any) => ({
      memberId: p.memberId,
      amountPaisa: Math.round(Number(p.amountPaisa) || 0),
    }));
    const payersSum = adjustedPayers.reduce((sum: number, p: any) => sum + p.amountPaisa, 0);
    const payerDiff = parsedTotal - payersSum;
    if (Math.abs(payerDiff) <= 2 && adjustedPayers.length > 0) {
      adjustedPayers[0].amountPaisa += payerDiff;
    } else if (payersSum !== parsedTotal) {
      return NextResponse.json(
        { error: `Payer amounts (₹${(payersSum / 100).toFixed(2)}) must match total (₹${(parsedTotal / 100).toFixed(2)})` },
        { status: 400 }
      );
    }

    let adjustedSplits = splits.map((s: any) => ({
      memberId: s.memberId,
      amountPaisa: Math.round(Number(s.amountPaisa) || 0),
      shareValue: s.shareValue ? Number(s.shareValue) : null,
    }));
    const splitsSum = adjustedSplits.reduce((sum: number, s: any) => sum + s.amountPaisa, 0);
    const splitDiff = parsedTotal - splitsSum;
    if (Math.abs(splitDiff) <= 2 && adjustedSplits.length > 0) {
      adjustedSplits[0].amountPaisa += splitDiff;
    } else if (splitsSum !== parsedTotal) {
      return NextResponse.json(
        { error: `Split amounts (₹${(splitsSum / 100).toFixed(2)}) must match total (₹${(parsedTotal / 100).toFixed(2)})` },
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
            create: adjustedPayers.map((p: any) => ({
              memberId: p.memberId,
              amountPaisa: p.amountPaisa,
            })),
          },
          splits: {
            create: adjustedSplits.map((s: any) => ({
              memberId: s.memberId,
              amountPaisa: s.amountPaisa,
              shareValue: s.shareValue,
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

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({ expense });
  } catch (err: any) {
    console.error('Error recording expense:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
