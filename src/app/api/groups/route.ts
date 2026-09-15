import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  generateJoinCode,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';

import {
  getCachedServerSummary,
  setCachedServerSummary,
  invalidateAllGroupServerCaches,
} from '@/lib/serverGroupCache';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const forceFresh = url.searchParams.get('fresh') === '1' || url.searchParams.get('fresh') === 'true';

    if (!forceFresh) {
      const cached = getCachedServerSummary(session.businessId);
      if (cached) {
        return NextResponse.json(cached, {
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
      }
    }

    const cleanPhone = session.phone ? session.phone.replace(/\D/g, '') : '';
    const cleanName = session.userName?.trim() || '';

    const memberMatchConditions: any[] = [];
    if (cleanPhone && cleanPhone.length >= 10) {
      memberMatchConditions.push({ phone: { contains: cleanPhone.slice(-10) } });
    }
    if (cleanName && cleanName.length >= 2) {
      memberMatchConditions.push({ name: { equals: cleanName, mode: 'insensitive' } });
    }

    const whereClause: any = {
      OR: [
        { businessId: session.businessId },
        ...(memberMatchConditions.length > 0
          ? [{ members: { some: { OR: memberMatchConditions } } }]
          : []),
      ],
    };

    // Highly optimized query selecting only necessary columns
    const groups = await db.group.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        category: true,
        currencySymbol: true,
        joinCode: true,
        simplifyDebts: true,
        createdAt: true,
        members: {
          select: {
            id: true,
            name: true,
            isOwner: true,
            isAdmin: true,
            isActive: true,
            status: true,
            phone: true,
          },
        },
        expenses: {
          select: {
            id: true,
            totalAmountPaisa: true,
            payers: {
              select: {
                memberId: true,
                amountPaisa: true,
              },
            },
            splits: {
              select: {
                memberId: true,
                amountPaisa: true,
              },
            },
          },
        },
        settlements: {
          select: {
            id: true,
            payerId: true,
            receiverId: true,
            amountPaisa: true,
          },
        },
      },
    });

    const formatted = groups.map((g) => {
      const activeMembers = g.members.filter((m: any) => m.isActive !== false);
      const totalSpendPaisa = g.expenses.reduce((acc, e) => acc + e.totalAmountPaisa, 0);
      const balances = calculateMemberNetBalances(activeMembers, g.expenses, g.settlements);
      const ownerMember =
        activeMembers.find((m: any) =>
          (cleanPhone && m.phone && m.phone.replace(/\D/g, '').includes(cleanPhone.slice(-10))) ||
          (cleanName && m.name.toLowerCase() === cleanName.toLowerCase())
        ) ||
        activeMembers.find((m) => m.isOwner) ||
        activeMembers[0];
      const ownerBalance = ownerMember
        ? balances.find((b) => b.memberId === ownerMember.id)?.netBalancePaisa || 0
        : 0;

      const transfers = g.simplifyDebts
        ? simplifyDebts(balances)
        : calculateDirectPairwiseDebts(activeMembers, g.expenses, g.settlements);

      return {
        id: g.id,
        name: g.name,
        category: g.category,
        currencySymbol: g.currencySymbol,
        joinCode: g.joinCode,
        simplifyDebts: g.simplifyDebts,
        memberCount: activeMembers.length,
        totalSpendPaisa,
        ownerBalancePaisa: ownerBalance,
        pendingTransfersCount: transfers.length,
        createdAt: g.createdAt,
      };
    });

    const responsePayload = { groups: formatted };
    setCachedServerSummary(session.businessId, responsePayload);

    return NextResponse.json(responsePayload, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
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
    const membersToCreate: any[] = [
      {
        name: ownerName,
        phone: session.phone || undefined,
        isOwner: true,
        isAdmin: true,
        isActive: true,
        status: 'APPROVED',
      },
    ];

    if (Array.isArray(initialMembers)) {
      for (const m of initialMembers) {
        const cleanName = (typeof m === 'string' ? m : m?.name || '').trim();
        if (cleanName && cleanName.toLowerCase() !== ownerName.toLowerCase()) {
          membersToCreate.push({
            name: cleanName,
            phone: typeof m === 'object' && m.phone ? m.phone.trim() : undefined,
            upiId: typeof m === 'object' && m.upiId ? m.upiId.trim() : undefined,
            isOwner: false,
            isAdmin: false,
            isActive: true,
            status: 'APPROVED',
          });
        }
      }
    }

    const newGroup = await db.group.create({
      data: {
        name: name.trim(),
        category: category?.trim() || 'Trip',
        joinCode,
        businessId: session.businessId,
        members: {
          create: membersToCreate,
        },
      },
      include: {
        members: true,
      },
    });

    // Invalidate server cache
    invalidateAllGroupServerCaches(newGroup.id, session.businessId);

    return NextResponse.json({ group: newGroup }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
