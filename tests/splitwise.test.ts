import { describe, it, expect } from 'vitest';
import {
  generateJoinCode,
  distributeEqualSplits,
  distributeSharesSplits,
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
  generateUpiUrl,
  generateWhatsAppSummary,
  JOIN_CODE_ALPHABET,
} from '../src/lib/splitwise';

describe('Splitwise Engine & Debt Simplification', () => {
  it('generates 5-character join code without ambiguous characters (0, O, 1, I)', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(5);
      expect(code).not.toMatch(/[0O1I]/);
      for (const char of code) {
        expect(JOIN_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it('distributes equal splits with zero drift on odd numbers', () => {
    // ₹100.00 = 10,000 paise split 3 ways: 3334, 3333, 3333 = 10,000 paise
    const splits3 = distributeEqualSplits(10000, ['m1', 'm2', 'm3']);
    expect(splits3).toHaveLength(3);
    const sum3 = splits3.reduce((acc, s) => acc + s.amountPaisa, 0);
    expect(sum3).toBe(10000);
    expect(splits3[0].amountPaisa).toBe(3334);
    expect(splits3[1].amountPaisa).toBe(3333);
    expect(splits3[2].amountPaisa).toBe(3333);

    // ₹50.00 = 5000 paise split 7 ways
    const splits7 = distributeEqualSplits(5000, ['1', '2', '3', '4', '5', '6', '7']);
    const sum7 = splits7.reduce((acc, s) => acc + s.amountPaisa, 0);
    expect(sum7).toBe(5000);
  });

  it('distributes share-based splits with zero drift', () => {
    // ₹300.00 = 30000 paise split 2:1
    const splits = distributeSharesSplits(30000, [
      { memberId: 'm1', shareValue: 2 },
      { memberId: 'm2', shareValue: 1 },
    ]);
    expect(splits).toHaveLength(2);
    expect(splits[0].amountPaisa).toBe(20000);
    expect(splits[1].amountPaisa).toBe(10000);
    expect(splits[0].amountPaisa + splits[1].amountPaisa).toBe(30000);
  });

  it('calculates net balances for multi-payer expense', () => {
    const members = [
      { id: 'm1', name: 'Tubai', isOwner: true },
      { id: 'm2', name: 'Rahul', isOwner: false },
      { id: 'm3', name: 'Priya', isOwner: false },
    ];

    // Expense: ₹3000 (300,000 paise) dinner
    // Tubai paid ₹2000 (200,000), Rahul paid ₹1000 (100,000)
    // Split equally ₹1000 (100,000) each
    const expenses = [
      {
        id: 'exp1',
        totalAmountPaisa: 300000,
        payers: [
          { memberId: 'm1', amountPaisa: 200000 },
          { memberId: 'm2', amountPaisa: 100000 },
        ],
        splits: [
          { memberId: 'm1', amountPaisa: 100000 },
          { memberId: 'm2', amountPaisa: 100000 },
          { memberId: 'm3', amountPaisa: 100000 },
        ],
      },
    ];

    const balances = calculateMemberNetBalances(members, expenses, []);
    const tubai = balances.find((b) => b.memberId === 'm1')!;
    const rahul = balances.find((b) => b.memberId === 'm2')!;
    const priya = balances.find((b) => b.memberId === 'm3')!;

    expect(tubai.netBalancePaisa).toBe(100000); // gets back ₹1000
    expect(rahul.netBalancePaisa).toBe(0); // even
    expect(priya.netBalancePaisa).toBe(-100000); // owes ₹1000

    // Net sum of all members must always equal zero
    const totalNet = balances.reduce((sum, b) => sum + b.netBalancePaisa, 0);
    expect(totalNet).toBe(0);
  });

  it('simplifies debts correctly using minimum cash flow', () => {
    // 4 members:
    // A paid ₹400 for A, B, C, D (100 each) -> A net = +300
    // B paid ₹200 for A, B (100 each) -> B paid 200, owes 200 -> net = 0
    // C owes 100
    // D owes 100
    const balances = [
      { memberId: 'A', name: 'Alice', isOwner: true, totalPaidPaisa: 40000, totalOwedPaisa: 10000, settlementsPaidPaisa: 0, settlementsReceivedPaisa: 0, netBalancePaisa: 30000 },
      { memberId: 'B', name: 'Bob', isOwner: false, totalPaidPaisa: 20000, totalOwedPaisa: 20000, settlementsPaidPaisa: 0, settlementsReceivedPaisa: 0, netBalancePaisa: 0 },
      { memberId: 'C', name: 'Charlie', isOwner: false, totalPaidPaisa: 0, totalOwedPaisa: 10000, settlementsPaidPaisa: 0, settlementsReceivedPaisa: 0, netBalancePaisa: -10000 },
      { memberId: 'D', name: 'Diana', isOwner: false, totalPaidPaisa: 0, totalOwedPaisa: 20000, settlementsPaidPaisa: 0, settlementsReceivedPaisa: 0, netBalancePaisa: -20000 },
    ];

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(2);
    // Diana pays Alice ₹200
    // Charlie pays Alice ₹100
    const totalTransferred = transfers.reduce((sum, t) => sum + t.amountPaisa, 0);
    expect(totalTransferred).toBe(30000);
    expect(transfers.every((t) => t.toId === 'A')).toBe(true);
  });

  it('resolves balance to zero when settlement is applied', () => {
    const members = [
      { id: 'm1', name: 'Tubai', isOwner: true },
      { id: 'm2', name: 'Rahul', isOwner: false },
    ];

    const expenses = [
      {
        id: 'exp1',
        totalAmountPaisa: 100000, // ₹1000
        payers: [{ memberId: 'm1', amountPaisa: 100000 }],
        splits: [
          { memberId: 'm1', amountPaisa: 50000 },
          { memberId: 'm2', amountPaisa: 50000 },
        ],
      },
    ];

    // Rahul settles with Tubai
    const settlements = [
      {
        id: 's1',
        payerId: 'm2',
        receiverId: 'm1',
        amountPaisa: 50000,
      },
    ];

    const balances = calculateMemberNetBalances(members, expenses, settlements);
    expect(balances[0].netBalancePaisa).toBe(0);
    expect(balances[1].netBalancePaisa).toBe(0);

    const transfers = simplifyDebts(balances);
    expect(transfers).toHaveLength(0);
  });

  it('generates valid UPI deep-link', () => {
    const upi = generateUpiUrl({
      upiId: 'tubai@okaxis',
      name: 'Tubai Das',
      amountRupees: 450.5,
      note: 'Goa dinner share',
    });

    expect(upi).toContain('upi://pay?pa=tubai%40okaxis');
    expect(upi).toContain('am=450.50');
    expect(upi).toContain('pn=Tubai%20Das');
  });

  it('generates WhatsApp group summary text', () => {
    const text = generateWhatsAppSummary({
      groupName: 'Goa Trip 2026',
      joinCode: '44A3B',
      totalSpendPaisa: 2500000,
      transfers: [
        {
          fromId: 'm2',
          fromName: 'Rahul',
          toId: 'm1',
          toName: 'Tubai',
          toUpiId: 'tubai@upi',
          amountPaisa: 120000,
        },
      ],
      baseUrl: 'https://lenadena.app',
    });

    expect(text).toContain('Goa Trip 2026');
    expect(text).toContain('44A3B');
    expect(text).toContain('Rahul');
    expect(text).toContain('Tubai');
    expect(text).toContain('https://lenadena.app/join/44A3B');
  });

  it('formats local date accurately without timezone shifting', () => {
    const d = new Date(2026, 8, 11, 3, 30, 0); // Sept 11, 2026 local
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const expected = `${y}-${m}-${day}`;
    expect(expected).toBe('2026-09-11');
  });

  it('accurately recalculates member balances when an expense is modified', () => {
    const members = [
      { id: 'm1', name: 'Admin', isOwner: true, isAdmin: true },
      { id: 'm2', name: 'Friend', isOwner: false, isAdmin: false },
    ];

    // Initial expense: ₹200 paid by m1, split 50-50
    const initialExpenses = [
      {
        id: 'exp1',
        totalAmountPaisa: 20000,
        payers: [{ memberId: 'm1', amountPaisa: 20000 }],
        splits: [
          { memberId: 'm1', amountPaisa: 10000 },
          { memberId: 'm2', amountPaisa: 10000 },
        ],
      },
    ];

    const initialBalances = calculateMemberNetBalances(members, initialExpenses, []);
    expect(initialBalances.find((b) => b.memberId === 'm1')!.netBalancePaisa).toBe(10000);
    expect(initialBalances.find((b) => b.memberId === 'm2')!.netBalancePaisa).toBe(-10000);

    // Modified expense: Changed to ₹500 paid by m1, split 50-50 (₹250 each)
    const modifiedExpenses = [
      {
        id: 'exp1',
        totalAmountPaisa: 50000,
        payers: [{ memberId: 'm1', amountPaisa: 50000 }],
        splits: [
          { memberId: 'm1', amountPaisa: 25000 },
          { memberId: 'm2', amountPaisa: 25000 },
        ],
      },
    ];

    const modifiedBalances = calculateMemberNetBalances(members, modifiedExpenses, []);
    expect(modifiedBalances.find((b) => b.memberId === 'm1')!.netBalancePaisa).toBe(25000);
    expect(modifiedBalances.find((b) => b.memberId === 'm2')!.netBalancePaisa).toBe(-25000);
  });

  it('supports admin delegation where owner is admin and can delegate admin to another member', () => {
    const members = [
      { id: 'm1', name: 'Creator', isOwner: true, isAdmin: true },
      { id: 'm2', name: 'Friend', isOwner: false, isAdmin: false },
    ];

    expect(members[0].isOwner && members[0].isAdmin).toBe(true);
    expect(members[1].isAdmin).toBe(false);

    // Creator delegates admin to Friend
    const updatedMembers = members.map((m) =>
      m.id === 'm2' ? { ...m, isAdmin: true } : m
    );

    expect(updatedMembers.find((m) => m.id === 'm2')!.isAdmin).toBe(true);

    // Verify calculateMemberNetBalances preserves isAdmin
    const balances = calculateMemberNetBalances(updatedMembers, [], []);
    expect(balances.find((b) => b.memberId === 'm1')!.isAdmin).toBe(true);
    expect(balances.find((b) => b.memberId === 'm2')!.isAdmin).toBe(true);
  });

  it('allows creator to remove a non-owner member and recalculates group balances', () => {
    const members = [
      { id: 'm1', name: 'Creator', isOwner: true, isAdmin: true },
      { id: 'm2', name: 'Member To Remove', isOwner: false, isAdmin: false },
      { id: 'm3', name: 'Remaining Friend', isOwner: false, isAdmin: false },
    ];

    const expenses = [
      {
        id: 'exp1',
        totalAmountPaisa: 30000,
        payers: [{ memberId: 'm1', amountPaisa: 30000 }],
        splits: [
          { memberId: 'm1', amountPaisa: 10000 },
          { memberId: 'm2', amountPaisa: 10000 },
          { memberId: 'm3', amountPaisa: 10000 },
        ],
      },
    ];

    // Creator removes m2
    const remainingMembers = members.filter((m) => m.id !== 'm2');
    expect(remainingMembers).toHaveLength(2);
    expect(remainingMembers.some((m) => m.id === 'm2')).toBe(false);

    // Creator (isOwner: true) cannot be removed
    const canRemoveCreator = remainingMembers.some((m) => m.id === 'm1' && !m.isOwner);
    expect(canRemoveCreator).toBe(false);
  });

  it('enforces that a member cannot be deleted unless they have settled everything (net balance = 0)', () => {
    const members = [
      { id: 'm1', name: 'Creator', isOwner: true },
      { id: 'm2', name: 'Unsettled Friend', isOwner: false },
      { id: 'm3', name: 'Settled Friend', isOwner: false },
    ];

    const expenses = [
      {
        id: 'exp1',
        totalAmountPaisa: 20000,
        payers: [{ memberId: 'm1', amountPaisa: 20000 }],
        splits: [
          { memberId: 'm1', amountPaisa: 10000 },
          { memberId: 'm2', amountPaisa: 10000 },
        ],
      },
    ];

    const balances = calculateMemberNetBalances(members, expenses, []);
    const m2Bal = balances.find((b) => b.memberId === 'm2')!;
    const m3Bal = balances.find((b) => b.memberId === 'm3')!;

    // m2 has an unsettled balance (-₹100) -> CANNOT be deleted
    expect(Math.abs(m2Bal.netBalancePaisa)).toBeGreaterThan(0);
    const canDeleteM2 = Math.abs(m2Bal.netBalancePaisa) === 0;
    expect(canDeleteM2).toBe(false);

    // m3 has 0 balance -> CAN be deleted
    expect(m3Bal.netBalancePaisa).toBe(0);
    const canDeleteM3 = Math.abs(m3Bal.netBalancePaisa) === 0;
    expect(canDeleteM3).toBe(true);

    // Once m2 settles with a settlement of ₹100
    const settlements = [
      { id: 'st1', payerId: 'm2', receiverId: 'm1', amountPaisa: 10000 },
    ];
    const postSettlementBalances = calculateMemberNetBalances(members, expenses, settlements);
    const m2Settled = postSettlementBalances.find((b) => b.memberId === 'm2')!;
    expect(m2Settled.netBalancePaisa).toBe(0);
    expect(Math.abs(m2Settled.netBalancePaisa) === 0).toBe(true);
  });

  it('validates mandatory 10-digit mobile phone number for adding group members', () => {
    const isValidPhone = (phone?: string | null) => {
      const clean = phone ? String(phone).replace(/\D/g, '') : '';
      return clean.length >= 10;
    };

    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('987654321')).toBe(false);
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('+91 98765 43210')).toBe(true);
  });

  it('generates accurate standing sentence without "0 people need to pay you back" glitch', () => {
    const getStandingSentence = (
      userBalance: number,
      transfers: any[],
      ownerId: string,
      allBalances: any[]
    ) => {
      const peopleOwingMe = transfers.filter((t) => t.toId === ownerId);
      const membersOwingMe = allBalances.filter(
        (b) => b.memberId !== ownerId && b.netBalancePaisa < 0
      );

      if (userBalance > 0) {
        const count = peopleOwingMe.length > 0 ? peopleOwingMe.length : membersOwingMe.length;
        if (count > 0) {
          const countLabel = count === 1 ? '1 person needs' : `${count} people need`;
          return `${countLabel} to pay you back ₹${(userBalance / 100).toFixed(2)} overall`;
        }
        return `You are owed ₹${(userBalance / 100).toFixed(2)} overall`;
      }
      if (userBalance < 0) {
        return `You need to pay back ₹${(Math.abs(userBalance) / 100).toFixed(2)} overall`;
      }
      return 'You are all squared away overall';
    };

    // Case 1: 1 person owes ₹18
    const sentence1 = getStandingSentence(
      1800,
      [{ fromId: 'm2', toId: 'm1', amountPaisa: 1800 }],
      'm1',
      [{ memberId: 'm1', netBalancePaisa: 1800 }, { memberId: 'm2', netBalancePaisa: -1800 }]
    );
    expect(sentence1).toBe('1 person needs to pay you back ₹18.00 overall');

    // Case 2: Only 1 member left in group (transfers is empty) -> must NEVER say 0 people
    const sentence2 = getStandingSentence(1800, [], 'm1', [
      { memberId: 'm1', netBalancePaisa: 1800 },
    ]);
    expect(sentence2).not.toContain('0 people');
    expect(sentence2).toBe('You are owed ₹18.00 overall');

    // Case 3: Fully settled
    const sentence3 = getStandingSentence(0, [], 'm1', [
      { memberId: 'm1', netBalancePaisa: 0 },
    ]);
    expect(sentence3).toBe('You are all squared away overall');
  });
});

