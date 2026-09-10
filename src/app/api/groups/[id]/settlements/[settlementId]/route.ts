import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const { id, settlementId } = await params;

    await db.groupSettlement.delete({
      where: {
        id: settlementId,
        groupId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting settlement:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
