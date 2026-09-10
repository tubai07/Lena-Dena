import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';
import {
  getCachedServerDetail,
  setCachedServerDetail,
  invalidateServerDetail,
  invalidateServerSummary,
} from '@/lib/serverGroupCache';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    // Check high-speed in-memory server cache
    const cached = getCachedServerDetail(id);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
      });
    }

    const group = await db.group.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
        },
        expenses: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
            payers: {
              include: { member: { select: { id: true, name: true } } },
            },
            splits: {
              include: { member: { select: { id: true, name: true } } },
            },
          },
        },
        settlements: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true, upiId: true, phone: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (session?.businessId && group.businessId !== session.businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const balances = calculateMemberNetBalances(group.members, group.expenses, group.settlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(
      group.members,
      group.expenses,
      group.settlements
    );

    const totalSpendPaisa = group.expenses.reduce((acc, e) => acc + e.totalAmountPaisa, 0);

    const payload = {
      group: {
        ...group,
        totalSpendPaisa,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      },
    };

    // Cache in server memory
    setCachedServerDetail(id, payload);

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
    });
  } catch (err: any) {
    console.error('Error fetching group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, category, simplifyDebts } = body;

    const data: any = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof category === 'string' && category.trim()) data.category = category.trim();
    if (typeof simplifyDebts === 'boolean') data.simplifyDebts = simplifyDebts;

    const updated = await db.group.update({
      where: { id },
      data,
    });

    invalidateServerDetail(id);
    invalidateServerSummary(session.businessId);

    return NextResponse.json({ group: updated });
  } catch (err: any) {
    console.error('Error updating group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.group.delete({
      where: { id },
    });

    invalidateServerDetail(id);
    invalidateServerSummary(session.businessId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
