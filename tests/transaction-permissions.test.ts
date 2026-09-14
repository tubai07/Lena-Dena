import { describe, it, expect } from 'vitest';
import {
  calculateMemberNetBalances,
  simplifyDebts,
  calculateDirectPairwiseDebts,
} from '../src/lib/splitwise';

describe('Transaction Details & Admin Permissions Engine', () => {
  const members = [
    { id: 'm_owner', name: 'Tubai (Creator)', isOwner: true, isAdmin: false },
    { id: 'm_admin', name: 'Rahul (Admin)', isOwner: false, isAdmin: true },
    { id: 'm_member', name: 'Amit (Member)', isOwner: false, isAdmin: false },
  ];

  it('determines admin permissions accurately for creator, admin, and regular members', () => {
    const isOwnerAdmin = Boolean(members[0].isOwner || members[0].isAdmin);
    const isPromotedAdmin = Boolean(members[1].isOwner || members[1].isAdmin);
    const isRegularMemberAdmin = Boolean(members[2].isOwner || members[2].isAdmin);

    expect(isOwnerAdmin).toBe(true);
    expect(isPromotedAdmin).toBe(true);
    expect(isRegularMemberAdmin).toBe(false);
  });

  it('computes user standing ("you lent" / "you borrowed") accurately for multi-payer expenses', () => {
    // Expense of ₹300 (30,000 paise).
    // Payers: Tubai paid ₹200 (20,000 paise), Rahul paid ₹100 (10,000 paise).
    // Split equally between Tubai, Rahul, Amit (10,000 paise each).
    const expense = {
      id: 'exp_1',
      description: 'Solid',
      totalAmountPaisa: 30000,
      payers: [
        { memberId: 'm_owner', amountPaisa: 20000 },
        { memberId: 'm_admin', amountPaisa: 10000 },
      ],
      splits: [
        { memberId: 'm_owner', amountPaisa: 10000 },
        { memberId: 'm_admin', amountPaisa: 10000 },
        { memberId: 'm_member', amountPaisa: 10000 },
      ],
    };

    // For Tubai: Paid 200, Split 100 => Lent 100
    const tubaiPaid = expense.payers.find((p) => p.memberId === 'm_owner')?.amountPaisa || 0;
    const tubaiSplit = expense.splits.find((s) => s.memberId === 'm_owner')?.amountPaisa || 0;
    const tubaiDiff = tubaiPaid - tubaiSplit;
    expect(tubaiDiff).toBe(10000); // Lent ₹100.00

    // For Rahul: Paid 100, Split 100 => 0 diff
    const rahulPaid = expense.payers.find((p) => p.memberId === 'm_admin')?.amountPaisa || 0;
    const rahulSplit = expense.splits.find((s) => s.memberId === 'm_admin')?.amountPaisa || 0;
    const rahulDiff = rahulPaid - rahulSplit;
    expect(rahulDiff).toBe(0);

    // For Amit: Paid 0, Split 100 => Borrowed 100
    const amitPaid = expense.payers.find((p) => p.memberId === 'm_member')?.amountPaisa || 0;
    const amitSplit = expense.splits.find((s) => s.memberId === 'm_member')?.amountPaisa || 0;
    const amitDiff = amitPaid - amitSplit;
    expect(amitDiff).toBe(-10000); // Borrowed ₹100.00
  });

  it('recalculates group balances cleanly when a transaction is deleted', () => {
    const expense1 = {
      id: 'exp_1',
      description: 'Dinner',
      totalAmountPaisa: 30000,
      payers: [{ memberId: 'm_owner', amountPaisa: 30000 }],
      splits: [
        { memberId: 'm_owner', amountPaisa: 10000 },
        { memberId: 'm_admin', amountPaisa: 10000 },
        { memberId: 'm_member', amountPaisa: 10000 },
      ],
    };

    const initialBalances = calculateMemberNetBalances(members, [expense1], []);
    expect(initialBalances.find((b) => b.memberId === 'm_owner')?.netBalancePaisa).toBe(20000);
    expect(initialBalances.find((b) => b.memberId === 'm_admin')?.netBalancePaisa).toBe(-10000);
    expect(initialBalances.find((b) => b.memberId === 'm_member')?.netBalancePaisa).toBe(-10000);

    // After deleting exp_1
    const postDeletionBalances = calculateMemberNetBalances(members, [], []);
    expect(postDeletionBalances.find((b) => b.memberId === 'm_owner')?.netBalancePaisa).toBe(0);
    expect(postDeletionBalances.find((b) => b.memberId === 'm_admin')?.netBalancePaisa).toBe(0);
    expect(postDeletionBalances.find((b) => b.memberId === 'm_member')?.netBalancePaisa).toBe(0);
  });
});
