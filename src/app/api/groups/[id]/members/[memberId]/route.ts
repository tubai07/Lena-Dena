import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

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

    return NextResponse.json({ member: updatedMember });
  } catch (err: any) {
    console.error('Error updating member admin status:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
