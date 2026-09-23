import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
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

    const session = await getSession();
    let currentUserId: string | null = null;
    if (session) {
      const match = members.find(
        (m) =>
          (session.phone && m.phone === session.phone) ||
          (session.businessId && group.businessId === session.businessId && m.isOwner) ||
          (session.userName && m.name.toLowerCase() === session.userName.toLowerCase())
      );
      if (match) currentUserId = match.id;
    }

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
          currentUserMemberId: currentUserId,
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

    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Please log in to join this group', requiresAuth: true },
        { status: 401 }
      );
    }

    // Check if the authenticated user is already in this group
    const cleanSessionPhone = (session.phone || '').replace(/\D/g, '');
    const cleanSessionName = (session.userName || '').trim().toLowerCase();

    const existingMember = group.members.find((m) => {
      const memberCleanPhone = (m.phone || '').replace(/\D/g, '');
      if (cleanSessionPhone && memberCleanPhone && cleanSessionPhone === memberCleanPhone) {
        return true;
      }
      if (m.name.trim().toLowerCase() === cleanSessionName) {
        return true;
      }
      return false;
    });

    if (existingMember) {
      // Ensure member is APPROVED if they joined via link
      if (existingMember.status !== 'APPROVED') {
        await db.groupMember.update({
          where: { id: existingMember.id },
          data: { status: 'APPROVED', isActive: true },
        });
        invalidateAllGroupServerCaches(group.id, group.businessId);
      }

      return NextResponse.json({
        success: true,
        member: existingMember,
        status: 'APPROVED',
        groupId: group.id,
        groupName: group.name,
        alreadyMember: true,
      });
    }

    // Instantly add the authenticated user as an APPROVED member via the invite link
    const newMember = await db.groupMember.create({
      data: {
        groupId: group.id,
        name: session.userName || 'Member',
        phone: session.phone || null,
        status: 'APPROVED',
        isOwner: false,
        isAdmin: false,
        isActive: true,
      },
    });

    invalidateAllGroupServerCaches(group.id, group.businessId);

    return NextResponse.json({
      success: true,
      member: newMember,
      status: 'APPROVED',
      groupId: group.id,
      groupName: group.name,
      newlyJoined: true,
    });
  } catch (err: any) {
    console.error('Error joining group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
