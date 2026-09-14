import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const { id, settlementId } = await params;

    const existing = await db.groupSettlement.findFirst({
      where: {
        id: settlementId,
        groupId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const group = await db.group.findUnique({
      where: { id },
      select: { businessId: true },
    });

    await db.groupSettlement.delete({
      where: {
        id: settlementId,
        groupId: id,
      },
    });

    invalidateAllGroupServerCaches(id, group?.businessId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting settlement:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
