import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, upiId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Member name is required' }, { status: 400 });
    }

    const group = await db.group.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check duplicate name in group
    const trimmed = name.trim();
    const exists = group.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return NextResponse.json({ error: 'A member with this name already exists in the group' }, { status: 400 });
    }

    const member = await db.groupMember.create({
      data: {
        groupId: id,
        name: trimmed,
        phone: phone?.trim() || null,
        upiId: upiId?.trim() || null,
        isOwner: false,
      },
    });

    return NextResponse.json({ member });
  } catch (err: any) {
    console.error('Error adding member:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
