import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  generateJoinCode,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groups = await db.group.findMany({
      where: { businessId: session.businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        members: true,
        expenses: {
          include: {
            payers: true,
            splits: true,
          },
        },
        settlements: true,
      },
    });

    const formatted = groups.map((g) => {
      const totalSpendPaisa = g.expenses.reduce((acc, e) => acc + e.totalAmountPaisa, 0);
      const balances = calculateMemberNetBalances(g.members, g.expenses, g.settlements);
      const ownerMember = g.members.find((m) => m.isOwner) || g.members[0];
      const ownerBalance = ownerMember
        ? balances.find((b) => b.memberId === ownerMember.id)?.netBalancePaisa || 0
        : 0;

      const transfers = g.simplifyDebts
        ? simplifyDebts(balances)
        : calculateDirectPairwiseDebts(g.members, g.expenses, g.settlements);

      return {
        id: g.id,
        name: g.name,
        category: g.category,
        currencySymbol: g.currencySymbol,
        joinCode: g.joinCode,
        simplifyDebts: g.simplifyDebts,
        memberCount: g.members.length,
        totalSpendPaisa,
        ownerBalancePaisa: ownerBalance,
        pendingTransfersCount: transfers.length,
        createdAt: g.createdAt,
      };
    });

    return NextResponse.json({ groups: formatted });
  } catch (err: any) {
    console.error('Error fetching groups:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, category, initialMembers } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Generate unique 5-char code
    let joinCode = generateJoinCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await db.group.findUnique({ where: { joinCode } });
      if (!existing) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
        attempts++;
      }
    }

    // Prepare members list: Owner is always first member
    const ownerName = session.userName?.trim() || session.businessName || 'You';
    const membersToCreate: { name: string; phone?: string; upiId?: string; isOwner: boolean }[] = [
      {
        name: ownerName,
        phone: session.phone || undefined,
        isOwner: true,
      },
    ];

    if (Array.isArray(initialMembers)) {
      for (const m of initialMembers) {
        if (m && typeof m.name === 'string' && m.name.trim()) {
          const trimmed = m.name.trim();
          if (trimmed.toLowerCase() !== ownerName.toLowerCase()) {
            membersToCreate.push({
              name: trimmed,
              phone: m.phone?.trim() || undefined,
              upiId: m.upiId?.trim() || undefined,
              isOwner: false,
            });
          }
        }
      }
    }

    const group = await db.group.create({
      data: {
        businessId: session.businessId,
        name: name.trim(),
        category: category?.trim() || 'Trip',
        joinCode,
        members: {
          create: membersToCreate,
        },
      },
      include: {
        members: true,
      },
    });

    return NextResponse.json({ group });
  } catch (err: any) {
    console.error('Error creating group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
