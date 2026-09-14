import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const { id, settlementId } = await params;
    const session = await getSession();
    const body = await req.json();
    const { payerId, receiverId, amountPaisa, paymentMethod = 'UPI', notes, memberId } = body;

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

    const group = await db.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Verify caller is an admin or group owner
    const isBusinessOwner = session?.businessId && group.businessId === session.businessId;
    const requestingMember = memberId
      ? group.members.find((m) => m.id === memberId && m.isActive !== false)
      : group.members.find((m) => session?.phone && m.phone === session.phone);
    const isMemberAdmin = isBusinessOwner || Boolean(requestingMember?.isAdmin || requestingMember?.isOwner);

    if (!isMemberAdmin) {
      return NextResponse.json({ error: 'Only group admins can edit payments' }, { status: 403 });
    }

    const existing = await db.groupSettlement.findFirst({
      where: { id: settlementId, groupId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const activeMembers = group.members.filter((m) => m.isActive !== false);
    const activeMemberIds = new Set(activeMembers.map((m) => m.id));
    if (!activeMemberIds.has(payerId) || !activeMemberIds.has(receiverId)) {
      return NextResponse.json(
        { error: 'Payer and receiver must be active members of this group' },
        { status: 400 }
      );
    }

    const settlement = await db.groupSettlement.update({
      where: { id: settlementId },
      data: {
        payerId,
        receiverId,
        amountPaisa: parsedAmount,
        paymentMethod,
        notes: notes?.trim() || null,
      },
      include: {
        payer: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true, upiId: true, phone: true } },
      },
    });

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({ settlement });
  } catch (err: any) {
    console.error('Error updating settlement:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const { id, settlementId } = await params;
    const session = await getSession();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // ignore
    }
    const { memberId } = body || {};

    const group = await db.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Verify caller is an admin or group owner
    const isBusinessOwner = session?.businessId && group.businessId === session.businessId;
    const requestingMember = memberId
      ? group.members.find((m) => m.id === memberId && m.isActive !== false)
      : group.members.find((m) => session?.phone && m.phone === session.phone);
    const isMemberAdmin = isBusinessOwner || Boolean(requestingMember?.isAdmin || requestingMember?.isOwner);

    if (!isMemberAdmin) {
      return NextResponse.json({ error: 'Only group admins can delete payments' }, { status: 403 });
    }

    const existing = await db.groupSettlement.findFirst({
      where: {
        id: settlementId,
        groupId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    await db.groupSettlement.delete({
      where: {
        id: settlementId,
        groupId: id,
      },
    });

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting settlement:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
