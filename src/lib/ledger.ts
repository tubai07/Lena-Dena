/**
 * Currency and Paisa Conversion Helpers
 * 1 Rupee = 100 Paise. All calculations are performed in integers to eliminate floating point issues.
 * Pure helpers safe to use across both client and server components.
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
 * Computes running balances for a customer's ledger view in chronological order.
 */
export function computeLedgerRunningBalances<
  T extends {
    id: string;
    type: string;
    amountPaisa: number;
    date: Date | string;
    isDeleted?: boolean;
    [key: string]: any;
  }
>(
  openingBalancePaisa: number,
  transactions: T[]
): (T & { runningBalancePaisa: number })[] {
  // Sort ascending by date with deterministic secondary tiebreakers
  const sorted = [...transactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const createA = new Date(a.createdAt || a.date).getTime();
    const createB = new Date(b.createdAt || b.date).getTime();
    if (createA !== createB) return createA - createB;
    return (a.id || '').localeCompare(b.id || '');
  });

  let currentPaisa = openingBalancePaisa;
  return sorted.map((tx) => {
    // If a transaction was deleted / cancelled, it is struck through and does NOT affect balance
    if (!tx.isDeleted) {
      if (tx.type === 'CREDIT') {
        currentPaisa += tx.amountPaisa;
      } else if (tx.type === 'PAYMENT') {
        currentPaisa -= tx.amountPaisa;
      }
    }
    return {
      ...tx,
      runningBalancePaisa: currentPaisa,
    };
  });
}
