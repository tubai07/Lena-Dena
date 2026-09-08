import { db } from './db';
import { Prisma } from '@prisma/client';

/**
 * Currency and Paisa Conversion Helpers
 * 1 Rupee = 100 Paise. All calculations are performed in integers to eliminate floating point issues.
 */
export function toPaisa(rupees: number): number {
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function toRupees(paisa: number): number {
  return paisa / 100;
}

export function formatINR(amount: number, isPaisa: boolean = false): string {
  const rupees = isPaisa ? toRupees(amount) : amount;
  const absRupees = Math.abs(rupees);
  
  // Format Indian numbering system: ₹1,25,000
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: absRupees % 1 === 0 ? 0 : 2,
  }).format(absRupees);

  return `${rupees < 0 ? '-' : ''}₹${formatted}`;
}

export function formatINRShort(amount: number, isPaisa: boolean = false): string {
  const rupees = isPaisa ? toRupees(amount) : amount;
  const abs = Math.abs(rupees);
  if (abs >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}k`;
  }
  return formatINR(rupees, false);
}

/**
 * Recalculates and safely synchronizes the customer's balance based on opening balance
 * and all transaction records. Runs atomically within a transaction if provided.
 */
export async function recalculateCustomerBalance(
  customerId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<number> {
  const customer = await client.customer.findUnique({
    where: { id: customerId },
    select: { id: true, openingBalancePaisa: true },
  });

  if (!customer) {
    throw new Error(`Customer with ID ${customerId} not found`);
  }

  // Aggregate credits and payments
  const transactions = await client.transaction.findMany({
    where: { customerId },
    select: { type: true, amountPaisa: true },
  });

  let creditsPaisa = 0;
  let paymentsPaisa = 0;

  for (const tx of transactions) {
    if (tx.type === 'CREDIT') {
      creditsPaisa += tx.amountPaisa;
    } else if (tx.type === 'PAYMENT') {
      paymentsPaisa += tx.amountPaisa;
    }
  }

  // Formula: Current Balance = Opening Balance + Total Credit - Total Payment
  // > 0 means customer owes merchant (You will receive)
  // < 0 means merchant owes customer (You will pay / Advance)
  // = 0 means settled
  const newBalancePaisa = customer.openingBalancePaisa + creditsPaisa - paymentsPaisa;
  const status = newBalancePaisa === 0 ? 'SETTLED' : 'ACTIVE';

  await client.customer.update({
    where: { id: customerId },
    data: {
      currentBalancePaisa: newBalancePaisa,
      status,
    },
  });

  return newBalancePaisa;
}

/**
 * Creates a transaction atomically and synchronizes customer balance and creates notifications.
 */
export async function recordLedgerTransaction(data: {
  businessId: string;
  customerId: string;
  type: 'CREDIT' | 'PAYMENT';
  amountPaisa: number;
  paymentMethod?: string;
  date?: Date;
  description?: string;
  billNumber?: string;
}) {
  if (data.amountPaisa <= 0) {
    throw new Error('Transaction amount must be greater than zero');
  }

  return await db.$transaction(async (tx) => {
    // Verify customer belongs to this business
    const customer = await tx.customer.findFirst({
      where: { id: data.customerId, businessId: data.businessId },
    });

    if (!customer) {
      throw new Error('Customer not found in this business');
    }

    const transaction = await tx.transaction.create({
      data: {
        businessId: data.businessId,
        customerId: data.customerId,
        type: data.type,
        amountPaisa: data.amountPaisa,
        paymentMethod: data.paymentMethod || 'CASH',
        date: data.date || new Date(),
        description: data.description?.trim() || null,
        billNumber: data.billNumber?.trim() || null,
      },
    });

    const newBalancePaisa = await recalculateCustomerBalance(data.customerId, tx);

    // Create system notification for large transactions or payments
    if (data.type === 'PAYMENT') {
      await tx.notification.create({
        data: {
          businessId: data.businessId,
          title: 'Payment Received',
          message: `Received ${formatINR(data.amountPaisa, true)} from ${customer.name} via ${data.paymentMethod || 'CASH'}. New balance: ${formatINR(newBalancePaisa, true)}.`,
          type: 'PAYMENT_RECEIVED',
          link: `/customers/${customer.id}`,
        },
      });
    }

    return { transaction, newBalancePaisa };
  });
}

/**
 * Deletes a transaction and recalculates the balance.
 */
export async function deleteLedgerTransaction(transactionId: string, businessId: string) {
  return await db.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: transactionId, businessId },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    await tx.transaction.delete({
      where: { id: transactionId },
    });

    const newBalancePaisa = await recalculateCustomerBalance(transaction.customerId, tx);
    return { customerId: transaction.customerId, newBalancePaisa };
  });
}

/**
 * Updates an existing transaction and synchronizes balance.
 */
export async function updateLedgerTransaction(
  transactionId: string,
  businessId: string,
  data: {
    type?: 'CREDIT' | 'PAYMENT';
    amountPaisa?: number;
    paymentMethod?: string;
    date?: Date;
    description?: string;
    billNumber?: string;
  }
) {
  if (data.amountPaisa !== undefined && data.amountPaisa <= 0) {
    throw new Error('Transaction amount must be greater than zero');
  }

  return await db.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { id: transactionId, businessId },
    });

    if (!existing) {
      throw new Error('Transaction not found');
    }

    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.amountPaisa !== undefined && { amountPaisa: data.amountPaisa }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.date && { date: data.date }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.billNumber !== undefined && { billNumber: data.billNumber }),
      },
    });

    const newBalancePaisa = await recalculateCustomerBalance(existing.customerId, tx);
    return { transaction: updated, newBalancePaisa };
  });
}

/**
 * Computes running balances for a customer's ledger view in chronological order.
 */
export function computeLedgerRunningBalances(
  openingBalancePaisa: number,
  transactions: Array<{
    id: string;
    type: string;
    amountPaisa: number;
    date: Date | string;
    [key: string]: any;
  }>
) {
  // Sort ascending by date
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let currentPaisa = openingBalancePaisa;
  return sorted.map((tx) => {
    if (tx.type === 'CREDIT') {
      currentPaisa += tx.amountPaisa;
    } else if (tx.type === 'PAYMENT') {
      currentPaisa -= tx.amountPaisa;
    }
    return {
      ...tx,
      runningBalancePaisa: currentPaisa,
    };
  });
}

/**
 * Computes business-level financial metrics dynamically from the database.
 */
export async function getBusinessDashboardSummary(businessId: string) {
  const customers = await db.customer.findMany({
    where: { businessId },
    select: { id: true, currentBalancePaisa: true, updatedAt: true },
  });

  let totalReceivablePaisa = 0; // Customer owes merchant (> 0)
  let totalPayablePaisa = 0;    // Merchant owes customer (< 0)
  let pendingCount = 0;

  for (const c of customers) {
    if (c.currentBalancePaisa > 0) {
      totalReceivablePaisa += c.currentBalancePaisa;
      pendingCount++;
    } else if (c.currentBalancePaisa < 0) {
      totalPayablePaisa += Math.abs(c.currentBalancePaisa);
    }
  }

  // Calculate collections this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyPayments = await db.transaction.aggregate({
    where: {
      businessId,
      type: 'PAYMENT',
      date: { gte: startOfMonth },
    },
    _sum: { amountPaisa: true },
  });

  const collectedThisMonthPaisa = monthlyPayments._sum.amountPaisa || 0;

  return {
    totalReceivablePaisa,
    totalPayablePaisa,
    collectedThisMonthPaisa,
    pendingPaymentsPaisa: totalReceivablePaisa,
    totalCustomers: customers.length,
    activePendingCustomersCount: pendingCount,
  };
}
