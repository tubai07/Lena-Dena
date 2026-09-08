import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/lib/db';
import {
  toPaisa,
  toRupees,
  formatINR,
  computeLedgerRunningBalances,
} from '../src/lib/ledger';
import {
  recordLedgerTransaction,
  deleteLedgerTransaction,
  updateLedgerTransaction,
  recalculateCustomerBalance,
  getBusinessDashboardSummary,
} from '../src/lib/ledger-server';
import { generateReminderMessage } from '../src/lib/reminders';

describe('Lena Dena Financial Ledger Accounting Engine', { timeout: 30000 }, () => {
  let testUser: any;
  let testBusinessA: any;
  let testBusinessB: any;

  beforeAll(async () => {
    // Create test user and two isolated businesses
    testUser = await db.user.create({
      data: {
        name: 'Test Merchant',
        email: `merchant_${Date.now()}@test.com`,
        phone: `9198${Date.now().toString().slice(-8)}`,
      },
    });

    testBusinessA = await db.business.create({
      data: {
        name: 'Store Alpha',
        ownerId: testUser.id,
      },
    });

    testBusinessB = await db.business.create({
      data: {
        name: 'Store Beta',
        ownerId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.business.deleteMany({
      where: { id: { in: [testBusinessA.id, testBusinessB.id] } },
    });
    await db.user.delete({ where: { id: testUser.id } });
  });

  it('correctly converts between rupees and paise without floating point issues', () => {
    expect(toPaisa(100)).toBe(10000);
    expect(toPaisa(12.5)).toBe(1250);
    expect(toPaisa(199.99)).toBe(19999);
    expect(toRupees(19999)).toBe(199.99);
    expect(formatINR(1250000, true)).toBe('₹12,500');
  });

  it('verifies exact core ledger scenario: 0 -> +10k -> -3k -> +5k -> -2k = ₹10,000', async () => {
    // 1. Customer starts at ₹0
    const customer = await db.customer.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Ramesh Patel',
        phone: '9876543210',
        openingBalancePaisa: 0,
        currentBalancePaisa: 0,
      },
    });

    expect(customer.currentBalancePaisa).toBe(0);

    // 2. Credit ₹10,000
    const tx1 = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: customer.id,
      type: 'CREDIT',
      amountPaisa: toPaisa(10000),
      description: 'Grain inventory credit',
    });
    expect(tx1.newBalancePaisa).toBe(toPaisa(10000));

    // 3. Payment ₹3,000
    const tx2 = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: customer.id,
      type: 'PAYMENT',
      amountPaisa: toPaisa(3000),
      paymentMethod: 'UPI',
      description: 'Part payment via GPay',
    });
    expect(tx2.newBalancePaisa).toBe(toPaisa(7000));

    // 4. Credit ₹5,000
    const tx3 = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: customer.id,
      type: 'CREDIT',
      amountPaisa: toPaisa(5000),
      description: 'Spices and oil restock',
    });
    expect(tx3.newBalancePaisa).toBe(toPaisa(12000));

    // 5. Payment ₹2,000
    const tx4 = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: customer.id,
      type: 'PAYMENT',
      amountPaisa: toPaisa(2000),
      paymentMethod: 'CASH',
      description: 'Cash payment',
    });

    // Final Expected balance: ₹10,000 exactly!
    expect(tx4.newBalancePaisa).toBe(toPaisa(10000));

    // Verify stored customer record in database
    const freshCustomer = await db.customer.findUnique({ where: { id: customer.id } });
    expect(freshCustomer?.currentBalancePaisa).toBe(toPaisa(10000));
    expect(freshCustomer?.status).toBe('ACTIVE');

    // 6. Test Transaction Deletion & Balance Recalculation
    // Delete the ₹3,000 payment (tx2) -> balance should increase from ₹10,000 to ₹13,000
    const delResult = await deleteLedgerTransaction(tx2.transaction.id, testBusinessA.id);
    expect(delResult.newBalancePaisa).toBe(toPaisa(13000));

    // 7. Test Transaction Edit
    // Change tx4 (Payment of ₹2,000) to Payment of ₹5,000 -> balance becomes ₹13,000 - ₹3,000 = ₹10,000
    const editResult = await updateLedgerTransaction(tx4.transaction.id, testBusinessA.id, {
      amountPaisa: toPaisa(5000),
    });
    expect(editResult.newBalancePaisa).toBe(toPaisa(10000));
  });

  it('enforces multi-tenant business customer and transaction isolation', async () => {
    // Customer in Business A
    const custA = await db.customer.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Customer In Store A',
        phone: '9991112233',
        openingBalancePaisa: 0,
      },
    });

    // Trying to record transaction for CustA from Business B MUST fail
    await expect(
      recordLedgerTransaction({
        businessId: testBusinessB.id,
        customerId: custA.id,
        type: 'CREDIT',
        amountPaisa: toPaisa(1000),
      })
    ).rejects.toThrow('Customer not found in this business');

    // Trying to delete from Business B MUST fail
    const txValid = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: custA.id,
      type: 'CREDIT',
      amountPaisa: toPaisa(500),
    });

    await expect(
      deleteLedgerTransaction(txValid.transaction.id, testBusinessB.id)
    ).rejects.toThrow('Transaction not found');
  });

  it('calculates dashboard financial summaries accurately', async () => {
    const summary = await getBusinessDashboardSummary(testBusinessA.id);
    expect(summary.totalReceivablePaisa).toBeGreaterThan(0);
    expect(summary.totalCustomers).toBeGreaterThanOrEqual(1);
  });

  it('generates short complete reminder message with UPI from profile and without please', () => {
    // 1. With UPI ID present from user profile
    const msgWithUpi = generateReminderMessage({
      customerName: 'Sibu',
      amountPaisa: toPaisa(1),
      upiId: '9681214449@ptsbi',
    });
    expect(msgWithUpi).toBe('Hi Sibu, ₹1 is pending. UPI: 9681214449@ptsbi. Pay when convenient. Thank you!');
    expect(msgWithUpi.toLowerCase()).not.toContain('please');

    // 2. Without UPI ID (no placeholder like [upi address])
    const msgNoUpi = generateReminderMessage({
      customerName: 'Sibu',
      amountPaisa: toPaisa(1),
      upiId: '',
    });
    expect(msgNoUpi).toBe('Hi Sibu, ₹1 is pending. Pay when convenient. Thank you!');
    expect(msgNoUpi).not.toContain('[upi address]');
    expect(msgNoUpi.toLowerCase()).not.toContain('please');

    // 3. When placeholder [upi address] is passed accidentally
    const msgPlaceholder = generateReminderMessage({
      customerName: 'Sibu',
      amountPaisa: toPaisa(1),
      upiId: '[upi address]',
    });
    expect(msgPlaceholder).toBe('Hi Sibu, ₹1 is pending. Pay when convenient. Thank you!');
    expect(msgPlaceholder).not.toContain('[upi address]');
  });

  it('supports high value transactions and balances (e.g. 5 Crores and 100 Crores) without integer overflow', async () => {
    // ₹5 Crores = 50,000,000 INR = 5,000,000,000 paise (exceeds 32-bit int limit of 2,147,483,647)
    const highValCust = await db.customer.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Enterprise Client',
        phone: '9888777666',
        openingBalancePaisa: toPaisa(10000000), // ₹1 Crore
        currentBalancePaisa: toPaisa(10000000),
      },
    });

    const txHigh = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: highValCust.id,
      type: 'CREDIT',
      amountPaisa: toPaisa(50000000), // ₹5 Crores
    });

    expect(txHigh.transaction.amountPaisa).toBe(5000000000);
    expect(txHigh.newBalancePaisa).toBe(6000000000); // ₹6 Crores total
    expect(formatINR(txHigh.newBalancePaisa, true)).toBe('₹6,00,00,000');

    // Partial payment of ₹2 Crores
    const txPayment = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: highValCust.id,
      type: 'PAYMENT',
      amountPaisa: toPaisa(20000000), // ₹2 Crores
    });

    expect(txPayment.newBalancePaisa).toBe(4000000000); // ₹4 Crores remaining
    expect(formatINR(txPayment.newBalancePaisa, true)).toBe('₹4,00,00,000');
  });

  it('soft-deletes (cancels) a transaction instead of purging, striking through and excluding from balance', async () => {
    const cust = await db.customer.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Soft Delete Test',
        phone: '9777666555',
        openingBalancePaisa: 0,
        currentBalancePaisa: 0,
      },
    });

    const tx1 = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: cust.id,
      type: 'CREDIT',
      amountPaisa: toPaisa(1000),
    });

    const tx2 = await recordLedgerTransaction({
      businessId: testBusinessA.id,
      customerId: cust.id,
      type: 'CREDIT',
      amountPaisa: toPaisa(500),
    });

    expect(tx2.newBalancePaisa).toBe(toPaisa(1500));

    // Delete tx2 -> should soft delete and recalculate balance to 1000
    const delResult = await deleteLedgerTransaction(tx2.transaction.id, testBusinessA.id);
    expect(delResult.newBalancePaisa).toBe(toPaisa(1000));
    expect(delResult.transaction.isDeleted).toBe(true);

    // Verify tx2 still exists in DB with isDeleted: true
    const tx2InDb = await db.transaction.findUnique({ where: { id: tx2.transaction.id } });
    expect(tx2InDb).not.toBeNull();
    expect(tx2InDb?.isDeleted).toBe(true);

    // Verify running balances calculation strikes it through and doesn't affect running balance
    const running = computeLedgerRunningBalances(0, [tx1.transaction, delResult.transaction]);
    expect(running[0].runningBalancePaisa).toBe(toPaisa(1000));
    expect(running[1].isDeleted).toBe(true);
    expect(running[1].runningBalancePaisa).toBe(toPaisa(1000)); // Unchanged!
  });
});
