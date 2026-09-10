import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';
import { calculateMemberNetBalances } from '@/lib/splitwise';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const body = await req.json();
    const { isAdmin } = body;

    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'isAdmin must be a boolean' }, { status: 400 });
    }

    const group = await db.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const member = group.members.find((m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
    }

    // Owner is always an admin
    if (member.isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Group creator/owner must remain an admin' },
        { status: 400 }
      );
    }

    const updatedMember = await db.groupMember.update({
      where: { id: memberId },
      data: { isAdmin },
    });

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({ success: true, member: updatedMember });
  } catch (err: any) {
    console.error('Error updating member admin status:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;

    const group = await db.group.findUnique({
      where: { id },
      include: {
        members: true,
        expenses: {
          include: {
            payers: true,
            splits: true,
          },
        },
        settlements: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const member = group.members.find((m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
    }

    // Creator / Owner cannot be removed
    if (member.isOwner) {
      return NextResponse.json(
        { error: 'The creator cannot be removed from the group' },
        { status: 400 }
      );
    }

    // Rule: User cannot delete anyone unless they have settled everything
    const balances = calculateMemberNetBalances(group.members, group.expenses, group.settlements);
    const memberBalance = balances.find((b) => b.memberId === memberId);

    if (memberBalance && Math.abs(memberBalance.netBalancePaisa) > 0) {
      const amountRupees = (Math.abs(memberBalance.netBalancePaisa) / 100).toFixed(2);
      const direction = memberBalance.netBalancePaisa > 0 ? 'is owed' : 'owes';
      return NextResponse.json(
        {
          error: `Cannot remove ${member.name} because they have an unsettled balance (${direction} ₹${amountRupees}). Settle all dues first.`,
        },
        { status: 400 }
      );
    }

    // Delete the member (cascades splits, payers, settlements)
    await db.groupMember.delete({
      where: { id: memberId },
    });

    // Clean up any orphaned expenses without payers or splits
    await db.groupExpense.deleteMany({
      where: {
        groupId: id,
        OR: [{ payers: { none: {} } }, { splits: { none: {} } }],
      },
    });

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({
      success: true,
      removedMemberId: memberId,
      message: `${member.name} removed from the group`,
    });
  } catch (err: any) {
    console.error('Error removing member from group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
