import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';

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

    const balances = calculateMemberNetBalances(group.members, group.expenses, group.settlements);
    const simplifiedTransfers = simplifyDebts(balances);
    const directTransfers = calculateDirectPairwiseDebts(
      group.members,
      group.expenses,
      group.settlements
    );
    const totalSpendPaisa = group.expenses.reduce((acc, e) => acc + e.totalAmountPaisa, 0);

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        category: group.category,
        currencySymbol: group.currencySymbol,
        joinCode: group.joinCode,
        simplifyDebts: group.simplifyDebts,
        totalSpendPaisa,
        members: group.members,
        balances,
        activeTransfers: group.simplifyDebts ? simplifiedTransfers : directTransfers,
        expenses: group.expenses,
        settlements: group.settlements,
      },
    });
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
        groupId: group.id,
        groupName: group.name,
      });
    }

    // 2. If adding a new member to the group
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
        },
      });

      return NextResponse.json({
        success: true,
        member: createdMember,
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
