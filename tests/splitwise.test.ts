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
});
