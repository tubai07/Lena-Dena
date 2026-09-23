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
    const cached = getCachedServerDetail(cleanId);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Direct indexed query lookup
    const groupInclude = {
      members: {
        orderBy: [{ isOwner: 'desc' as const }, { createdAt: 'asc' as const }],
      },
      expenses: {
        orderBy: [{ date: 'desc' as const }, { createdAt: 'desc' as const }],
        include: {
          payers: {
            select: { id: true, expenseId: true, memberId: true, amountPaisa: true },
          },
          splits: {
            select: { id: true, expenseId: true, memberId: true, amountPaisa: true, shareValue: true },
          },
        },
      },
      settlements: {
        orderBy: [{ date: 'desc' as const }, { createdAt: 'desc' as const }],
        select: {
          id: true,
          groupId: true,
          payerId: true,
          receiverId: true,
          amountPaisa: true,
          paymentMethod: true,
          notes: true,
          date: true,
          createdAt: true,
        },
      },
    };

    let group = null;
    if (cleanId.length === 5) {
      group = await db.group.findUnique({
        where: { joinCode: cleanId.toUpperCase() },
        include: groupInclude,
      });
    }

    if (!group) {
      group = await db.group.findUnique({
        where: { id: cleanId },
        include: groupInclude,
      }).catch(() => null);
    }

    if (!group) {
      group = await db.group.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { joinCode: cleanId.toUpperCase() },
          ],
        },
        include: groupInclude,
      });
    }

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Fast in-memory member lookup to avoid 6+ redundant SQL sub-queries
    const memberMap = new Map<string, any>();
    for (const m of group.members) {
      memberMap.set(m.id, {
        id: m.id,
        name: m.name,
        upiId: m.upiId,
        phone: m.phone,
        isOwner: m.isOwner,
        isAdmin: m.isAdmin,
      });
    }

    const mappedExpenses = group.expenses.map((e) => ({
      ...e,
      payers: e.payers.map((p) => ({
        ...p,
        member: memberMap.get(p.memberId) || { id: p.memberId, name: 'Unknown' },
      })),
      splits: e.splits.map((s) => ({
        ...s,
        member: memberMap.get(s.memberId) || { id: s.memberId, name: 'Unknown' },
      })),
    }));

    const mappedSettlements = group.settlements.map((s) => {
      const payer = memberMap.get(s.payerId) || { id: s.payerId, name: 'Unknown' };
      const receiver = memberMap.get(s.receiverId) || { id: s.receiverId, name: 'Unknown' };
      return {
        ...s,
        payer: { id: payer.id, name: payer.name },
        receiver: { id: receiver.id, name: receiver.name, upiId: receiver.upiId, phone: receiver.phone },
      };
    });

    const activeMembers = group.members.filter((m) => m.isActive !== false);

    const balances = calculateMemberNetBalances(activeMembers, mappedExpenses, mappedSettlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(
      activeMembers,
      mappedExpenses,
      mappedSettlements
    );

    const totalSpendPaisa = mappedExpenses.reduce((acc, e) => acc + e.totalAmountPaisa, 0);

    const payload = {
      group: {
        ...group,
        expenses: mappedExpenses,
        settlements: mappedSettlements,
        members: activeMembers,
        allMembers: group.members,
        totalSpendPaisa,
        balances,
        simplifiedTransfers,
        directTransfers,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
      },
    };

    setCachedServerDetail(group.id, payload);
    if (group.joinCode) {
      setCachedServerDetail(group.joinCode.toUpperCase(), payload);
    }

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

    const existing = await db.group.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { joinCode: cleanId.toUpperCase() },
        ],
      },
      include: { members: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, category, simplifyDebts, memberId } = body;

    const isBusinessOwner = Boolean(session?.businessId && existing.businessId === session.businessId);
    const requestingMember = memberId
      ? existing.members.find((m) => m.id === memberId && m.isActive !== false)
      : null;
    const isMemberAdmin = Boolean(requestingMember?.isAdmin || requestingMember?.isOwner);

    if (!isBusinessOwner && !isMemberAdmin) {
      return NextResponse.json(
        { error: 'Only group admins can update the group' },
        { status: 403 }
      );
    }

    const data: any = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof category === 'string' && category.trim()) data.category = category.trim();
    if (typeof simplifyDebts === 'boolean') data.simplifyDebts = simplifyDebts;

    const updated = await db.group.update({
      where: { id: existing.id },
      data,
    });

    invalidateAllGroupServerCaches(existing.id, existing.businessId);

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
