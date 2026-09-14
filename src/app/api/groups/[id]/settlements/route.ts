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

    const cleanId = id?.trim() || '';
    const group = await db.group.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { joinCode: cleanId.toUpperCase() },
        ],
      },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const activeMembers = group.members.filter((m) => m.isActive !== false);
    const activeMemberIds = new Set(activeMembers.map((m) => m.id));
    if (!activeMemberIds.has(payerId) || !activeMemberIds.has(receiverId)) {
      return NextResponse.json(
        { error: 'Payer and receiver must be active members of this group' },
        { status: 400 }
      );
    }

    const settlement = await db.groupSettlement.create({
      data: {
        groupId: group.id,
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

    invalidateAllGroupServerCaches(group.id, group.businessId);

    return NextResponse.json({ settlement });
  } catch (err: any) {
    console.error('Error recording settlement:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
