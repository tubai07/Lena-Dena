import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;
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
      return NextResponse.json({ error: 'At least one split person is required' }, { status: 400 });
    }

    const group = await db.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const existingExpense = await db.groupExpense.findFirst({
      where: { id: expenseId, groupId: id },
    });

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
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
        {
          error: `Payer amounts (₹${(payersSum / 100).toFixed(2)}) must match total (₹${(
            parsedTotal / 100
          ).toFixed(2)})`,
        },
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
        {
          error: `Split amounts (₹${(splitsSum / 100).toFixed(2)}) must match total (₹${(
            parsedTotal / 100
          ).toFixed(2)})`,
        },
        { status: 400 }
      );
    }

    // Atomically replace payers and splits, then update expense
    const updated = await db.$transaction(async (tx) => {
      await tx.expensePayer.deleteMany({ where: { expenseId } });
      await tx.expenseSplit.deleteMany({ where: { expenseId } });

      const expense = await tx.groupExpense.update({
        where: { id: expenseId },
        data: {
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
          payers: { include: { member: { select: { id: true, name: true } } } },
          splits: { include: { member: { select: { id: true, name: true } } } },
        },
      });

      return expense;
    });

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({ expense: updated });
  } catch (err: any) {
    console.error('Error modifying expense:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;

    const group = await db.group.findUnique({
      where: { id },
      select: { businessId: true },
    });

    await db.groupExpense.delete({
      where: {
        id: expenseId,
        groupId: id,
      },
    });

    invalidateAllGroupServerCaches(id, group?.businessId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting expense:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
