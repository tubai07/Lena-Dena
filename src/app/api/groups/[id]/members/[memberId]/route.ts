import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';
import { calculateMemberNetBalances } from '@/lib/splitwise';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await getSession();
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

    // Verify caller is an admin or group owner
    const callerIsOwner = session?.businessId === group.businessId;
    const callerMember = group.members.find(
      (m) => session?.phone && m.phone === session.phone
    );
    const callerIsAdmin = callerIsOwner || Boolean(callerMember?.isAdmin || callerMember?.isOwner);

    if (!callerIsAdmin) {
      return NextResponse.json({ error: 'Only group admins can modify member roles' }, { status: 403 });
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
    const session = await getSession();

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

    // Verify caller is an admin or group owner
    const callerIsOwner = session?.businessId === group.businessId;
    const callerMember = group.members.find(
      (m) => session?.phone && m.phone === session.phone
    );
    const callerIsAdmin = callerIsOwner || Boolean(callerMember?.isAdmin || callerMember?.isOwner);

    if (!callerIsAdmin) {
      return NextResponse.json({ error: 'Only group admins can remove members' }, { status: 403 });
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

    // Check if member participated in any past expenses or settlements
    const history = await db.groupMember.findUnique({
      where: { id: memberId },
      include: {
        expensePayers: { take: 1 },
        splits: { take: 1 },
        settlementsPaid: { take: 1 },
        settlementsReceived: { take: 1 },
      },
    });

    const hasHistory = Boolean(
      history?.expensePayers.length ||
      history?.splits.length ||
      history?.settlementsPaid.length ||
      history?.settlementsReceived.length
    );

    if (hasHistory) {
      // Soft-deactivate: Preserve mathematical ledger integrity for remaining members
      await db.groupMember.update({
        where: { id: memberId },
        data: {
          isActive: false,
          isAdmin: false,
        },
      });
    } else {
      // Safe hard-delete: Member has zero transaction history
      await db.groupMember.delete({
        where: { id: memberId },
      });
    }

    invalidateAllGroupServerCaches(id, group.businessId);

    return NextResponse.json({
      success: true,
      removedMemberId: memberId,
      softDeleted: hasHistory,
      message: `${member.name} removed from the group`,
    });
  } catch (err: any) {
    console.error('Error removing member from group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
