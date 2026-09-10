import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;

    await db.groupExpense.delete({
      where: {
        id: expenseId,
        groupId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting expense:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
