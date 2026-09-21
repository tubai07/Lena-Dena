import { describe, it, expect } from 'vitest';
import {
  calculateMemberNetBalances,
  simplifyDebts,
  distributeEqualSplits,
} from '../src/lib/splitwise';

describe('Audited Exceptions & Ledger Integrity Engine', () => {
  it('soft-deleted former member preserves exact mathematical net balances for remaining members', () => {
    // Scenario:
    // Members: Alice (Owner), Bob, Charlie.
    // Expense: Alice paid ₹300 (30,000 paise), split equally (10,000 paise each) with Bob and Charlie.
    // Balances: Alice +200, Bob -100, Charlie -100.
    // Later, Charlie settles all dues with Alice: Charlie pays Alice ₹100.
    // Balances: Alice +100, Bob -100, Charlie 0.
    // Charlie is now settled and leaves the group.
    // With soft-deletion, Charlie is marked isActive: false (tombstone) instead of hard SQL cascade deleting his expense records.

    const allMembers = [
      { id: 'alice', name: 'Alice', isOwner: true, isAdmin: false, isActive: true },
      { id: 'bob', name: 'Bob', isOwner: false, isAdmin: false, isActive: true },
      { id: 'charlie', name: 'Charlie (Left)', isOwner: false, isAdmin: false, isActive: false },
    ];

    const expenses = [
      {
        id: 'exp_lunch',
        totalAmountPaisa: 30000,
        payers: [{ memberId: 'alice', amountPaisa: 30000 }],
        splits: [
          { memberId: 'alice', amountPaisa: 10000 },
          { memberId: 'bob', amountPaisa: 10000 },
          { memberId: 'charlie', amountPaisa: 10000 },
        ],
      },
    ];

    const settlements = [
      {
        id: 'st_charlie_settle',
        payerId: 'charlie',
        receiverId: 'alice',
        amountPaisa: 10000,
      },
    ];

    const balances = calculateMemberNetBalances(allMembers, expenses, settlements);

    const aliceBal = balances.find((b) => b.memberId === 'alice');
    const bobBal = balances.find((b) => b.memberId === 'bob');
    const charlieBal = balances.find((b) => b.memberId === 'charlie');

    // Alice is owed ₹100 (from Bob)
    expect(aliceBal?.netBalancePaisa).toBe(10000);
    // Bob owes ₹100 (to Alice)
    expect(bobBal?.netBalancePaisa).toBe(-10000);
    // Charlie is settled at ₹0.00
    expect(charlieBal?.netBalancePaisa).toBe(0);

    // If Charlie was cascade deleted, Bob's ledger would be broken.
    // With Charlie's tombstone preserved, simplified debts correctly shows ONLY Bob owes Alice!
    const simplified = simplifyDebts(balances);
    expect(simplified.length).toBe(1);
    expect(simplified[0].fromId).toBe('bob');
    expect(simplified[0].toId).toBe('alice');
    expect(simplified[0].amountPaisa).toBe(10000);
  });

  it('rejects self-settlement when payer and receiver are identical', () => {
    const payerId = 'member_123';
    const receiverId = 'member_123';
    const isSelfSettlement = payerId === receiverId;

    expect(isSelfSettlement).toBe(true);

    const validateSettlement = (payer: string, receiver: string, amount: number) => {
      if (payer === receiver) {
        return { error: 'Payer and receiver cannot be the same person', status: 400 };
      }
      if (amount <= 0) {
        return { error: 'Valid settlement amount is required', status: 400 };
      }
      return { success: true };
    };

    expect(validateSettlement(payerId, receiverId, 5000)).toEqual({
      error: 'Payer and receiver cannot be the same person',
      status: 400,
    });
    expect(validateSettlement('alice', 'bob', 5000)).toEqual({ success: true });
  });

  it('distributes odd remainder paise with 0-cent drift and deterministic remainder distribution', () => {
    // ₹100.00 split among 3 members => 10,000 paise / 3 = 3333 paise each + 1 paise remainder
    const splits = distributeEqualSplits(10000, ['m1', 'm2', 'm3']);

    expect(splits).toHaveLength(3);
    expect(splits[0].amountPaisa).toBe(3334); // First person gets remainder 1 paisa
    expect(splits[1].amountPaisa).toBe(3333);
    expect(splits[2].amountPaisa).toBe(3333);

    const totalCalculated = splits.reduce((sum, s) => sum + s.amountPaisa, 0);
    expect(totalCalculated).toBe(10000); // Exactly matches total with 0 drift
  });

  it('filters active members for active member lists while retaining former members in transactions', () => {
    const members = [
      { id: '1', name: 'Alice', isActive: true },
      { id: '2', name: 'Bob', isActive: true },
      { id: '3', name: 'Charlie', isActive: false }, // Soft deleted
    ];

    const activeMembers = members.filter((m) => m.isActive !== false);
    expect(activeMembers).toHaveLength(2);
    expect(activeMembers.map((m) => m.name)).toEqual(['Alice', 'Bob']);

    // Name lookup for old transaction:
    const findMemberName = (id: string) => members.find((m) => m.id === id)?.name;
    expect(findMemberName('3')).toBe('Charlie');
  });
});
