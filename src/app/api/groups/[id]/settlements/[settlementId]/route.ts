import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const { id, settlementId } = await params;
    const session = await getSession();

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
