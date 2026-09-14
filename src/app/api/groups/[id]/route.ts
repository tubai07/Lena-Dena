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
  invalidateAllGroupServerCaches,
} from '@/lib/serverGroupCache';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = id?.trim() || '';
    if (!cleanId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
    }
    const session = await getSession();

    const group = await db.group.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { joinCode: cleanId.toUpperCase() },
        ],
      },
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
      const isMember = group.members.some(
        (m) =>
          (session.phone && m.phone === session.phone) ||
          (session.userName && m.name.toLowerCase() === session.userName.toLowerCase())
      );
      if (!isMember && !group.joinCode) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const approvedMembers = group.members.filter((m) => (m.status === 'APPROVED' || !m.status) && m.isActive !== false);
    const pendingMembers = group.members.filter((m) => m.status === 'PENDING');

    const balances = calculateMemberNetBalances(approvedMembers, group.expenses, group.settlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(
      approvedMembers,
      group.expenses,
      group.settlements
    );

    const totalSpendPaisa = group.expenses.reduce((acc, e) => acc + e.totalAmountPaisa, 0);

    const payload = {
      group: {
        ...group,
        members: approvedMembers,
        pendingMembers,
        allMembers: group.members,
        totalSpendPaisa,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      },
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
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
    const cleanId = id?.trim() || '';
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await db.group.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { joinCode: cleanId.toUpperCase() },
        ],
        businessId: session.businessId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Group not found or unauthorized' }, { status: 404 });
    }

    const body = await req.json();
    const { name, category, simplifyDebts } = body;

    const data: any = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof category === 'string' && category.trim()) data.category = category.trim();
    if (typeof simplifyDebts === 'boolean') data.simplifyDebts = simplifyDebts;

    const updated = await db.group.update({
      where: { id: existing.id },
      data,
    });

    invalidateAllGroupServerCaches(existing.id, session.businessId);

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
    const cleanId = id?.trim() || '';
    const session = await getSession();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // ignore empty body
    }
    const { memberId } = body || {};

    const group = await db.group.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { joinCode: cleanId.toUpperCase() },
        ],
      },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check admin authorization:
    // 1. Business creator/owner of the group
    // 2. OR group member with isAdmin === true or isOwner === true
    const isBusinessOwner = session?.businessId && group.businessId === session.businessId;
    const requestingMember = memberId
      ? group.members.find((m) => m.id === memberId && m.isActive !== false)
      : null;
    const isMemberAdmin = Boolean(requestingMember?.isAdmin || requestingMember?.isOwner);

    if (!isBusinessOwner && !isMemberAdmin) {
      return NextResponse.json(
        { error: 'Only group admins can delete the group' },
        { status: 403 }
      );
    }

    await db.group.delete({
      where: { id: group.id },
    });

    invalidateAllGroupServerCaches(group.id, group.businessId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
