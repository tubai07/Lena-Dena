import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  generateJoinCode,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '@/lib/splitwise';

// Fast in-memory server cache with 10s TTL
const groupsServerCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10000;

export function invalidateServerGroupsCache(businessId?: string) {
  if (businessId) {
    groupsServerCache.delete(businessId);
  } else {
    groupsServerCache.clear();
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cached = groupsServerCache.get(session.businessId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
      });
    }

    // Highly optimized query selecting only necessary columns
    const groups = await db.group.findMany({
      where: { businessId: session.businessId },
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

    const responsePayload = { groups: formatted };
    groupsServerCache.set(session.businessId, { data: responsePayload, timestamp: Date.now() });

    return NextResponse.json(responsePayload, {
      headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
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
    const membersToCreate: { name: string; phone?: string; upiId?: string; isOwner: boolean }[] = [
      {
        name: ownerName,
        phone: session.phone || undefined,
        isOwner: true,
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
    invalidateServerGroupsCache(session.businessId);

    return NextResponse.json({ group: newGroup }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating group:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
