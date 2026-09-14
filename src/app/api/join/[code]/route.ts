import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';
import { invalidateAllGroupServerCaches } from '@/lib/serverGroupCache';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase().trim();

    const group = await db.group.findUnique({
      where: { joinCode: cleanCode },
      include: {
        members: {
          orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            phone: true,
            upiId: true,
            isOwner: true,
            isAdmin: true,
            isActive: true,
            status: true,
          },
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
            receiver: { select: { id: true, name: true, upiId: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found with this code' }, { status: 404 });
    }

    const members = group.members || [];
    const expenses = group.expenses || [];
    const settlements = group.settlements || [];

    const approvedMembers = members.filter((m) => (m.status === 'APPROVED' || !m.status) && m.isActive !== false);
    const pendingMembers = members.filter((m) => m.status === 'PENDING');

    const balances = calculateMemberNetBalances(approvedMembers, expenses, settlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(
      approvedMembers,
      expenses,
      settlements
    );
    const totalSpendPaisa = expenses.reduce((acc, e) => acc + (Number(e.totalAmountPaisa) || 0), 0);
    const isSimplify = typeof group.simplifyDebts === 'boolean' ? group.simplifyDebts : true;

    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          category: group.category || 'Trip',
          currencySymbol: group.currencySymbol || '₹',
          joinCode: group.joinCode,
          simplifyDebts: isSimplify,
          totalSpendPaisa,
          members: approvedMembers,
          pendingMembers,
          allMembers: members,
          balances: balances || [],
          simplifiedTransfers: simplifiedTransfers || [],
          directTransfers: directTransfers || [],
          activeTransfers: (isSimplify ? simplifiedTransfers : directTransfers) || [],
          expenses,
          settlements,
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err: any) {
    console.error('Error looking up group by code:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase().trim();

    const group = await db.group.findUnique({
      where: { joinCode: cleanCode },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found with this code' }, { status: 404 });
    }

    const body = await req.json();
    const { memberId, newMemberName, phone, upiId } = body;

    // 1. If choosing an existing member
    if (memberId) {
      const existing = group.members.find((m) => m.id === memberId);
      if (!existing) {
        return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        member: existing,
        status: existing.status,
        groupId: group.id,
        groupName: group.name,
      });
    }

    // 2. If adding a new member to the group (Created with PENDING status for admin approval)
    if (newMemberName && typeof newMemberName === 'string' && newMemberName.trim()) {
      const trimmedName = newMemberName.trim();
      const duplicate = group.members.some(
        (m) => m.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json(
          { error: 'A member with this name already exists in this group. Select your name from the list instead!' },
          { status: 400 }
        );
      }

      const createdMember = await db.groupMember.create({
        data: {
          groupId: group.id,
          name: trimmedName,
          phone: phone?.trim() || null,
          upiId: upiId?.trim() || null,
          isOwner: false,
          isAdmin: false,
          status: 'PENDING',
        },
      });

      invalidateAllGroupServerCaches(group.id, group.businessId);

      return NextResponse.json({
        success: true,
        member: createdMember,
        status: 'PENDING',
        requiresApproval: true,
        groupId: group.id,
        groupName: group.name,
      });
    }

    return NextResponse.json({ error: 'Either select an existing member or provide a new name' }, { status: 400 });
  } catch (err: any) {
    console.error('Error joining group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
