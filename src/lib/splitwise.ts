/**
 * Core Financial Engine & Utilities for Lena Dena Group Splitting
 */

export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an unambiguous 5-character alphanumeric join code (e.g. "44A3B")
 * Excludes easily confused characters (0, O, 1, I).
 */
export function generateJoinCode(length: number = 5): string {
  let result = '';
  const charactersLength = JOIN_CODE_ALPHABET.length;
  for (let i = 0; i < length; i++) {
    result += JOIN_CODE_ALPHABET.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export interface SplitResult {
  memberId: string;
  amountPaisa: number;
  shareValue?: number;
}

/**
 * Distributes an integer paise amount equally among members with 0-cent drift.
 * Odd paise remainder is distributed 1 paisa each to the first members.
 */
export function distributeEqualSplits(
  totalAmountPaisa: number,
  memberIds: string[]
): SplitResult[] {
  if (!memberIds.length || totalAmountPaisa <= 0) return [];
  const n = memberIds.length;
  const base = Math.floor(totalAmountPaisa / n);
  const remainder = totalAmountPaisa % n;

  return memberIds.map((memberId, index) => ({
    memberId,
    amountPaisa: base + (index < remainder ? 1 : 0),
    shareValue: 1,
  }));
}

/**
 * Distributes an integer paise amount by shares / weights with 0-cent drift.
 */
export function distributeSharesSplits(
  totalAmountPaisa: number,
  shares: { memberId: string; shareValue: number }[]
): SplitResult[] {
  if (!shares.length || totalAmountPaisa <= 0) return [];
  const totalShares = shares.reduce((sum, s) => sum + s.shareValue, 0);
  if (totalShares <= 0) return [];

  // Initial floor calculation
  let allocated = 0;
  const items = shares.map((s) => {
    const raw = (totalAmountPaisa * s.shareValue) / totalShares;
    const floorAmount = Math.floor(raw);
    allocated += floorAmount;
    return {
      memberId: s.memberId,
      amountPaisa: floorAmount,
      fraction: raw - floorAmount,
      shareValue: s.shareValue,
    };
  });

  // Distribute remaining paise by highest fractional parts
  let remainder = totalAmountPaisa - allocated;
  items.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder && i < items.length; i++) {
    items[i].amountPaisa += 1;
  }

  return items.map(({ memberId, amountPaisa, shareValue }) => ({
    memberId,
    amountPaisa,
    shareValue,
  }));
}

export interface MemberBalance {
  memberId: string;
  name: string;
  phone?: string | null;
  upiId?: string | null;
  isOwner: boolean;
  isAdmin?: boolean;
  totalPaidPaisa: number;
  totalOwedPaisa: number;
  settlementsPaidPaisa: number;
  settlementsReceivedPaisa: number;
  netBalancePaisa: number; // > 0: gets back; < 0: owes
}

export interface ExpenseData {
  id: string;
  totalAmountPaisa: number;
  payers: { memberId: string; amountPaisa: number }[];
  splits: { memberId: string; amountPaisa: number }[];
}

export interface SettlementData {
  id: string;
  payerId: string;
  receiverId: string;
  amountPaisa: number;
}

/**
 * Calculates net balance for every group member based on expenses and settlements.
 */
export function calculateMemberNetBalances(
  members: { id: string; name: string; phone?: string | null; upiId?: string | null; isOwner: boolean; isAdmin?: boolean }[],
  expenses: ExpenseData[],
  settlements: SettlementData[]
): MemberBalance[] {
  const map = new Map<string, MemberBalance>();

  for (const m of members) {
    map.set(m.id, {
      memberId: m.id,
      name: m.name,
      phone: m.phone,
      upiId: m.upiId,
      isOwner: m.isOwner,
      isAdmin: Boolean(m.isAdmin || m.isOwner),
      totalPaidPaisa: 0,
      totalOwedPaisa: 0,
      settlementsPaidPaisa: 0,
      settlementsReceivedPaisa: 0,
      netBalancePaisa: 0,
    });
  }

  // Aggregate expenses
  for (const exp of expenses) {
    for (const p of exp.payers) {
      const rec = map.get(p.memberId);
      if (rec) rec.totalPaidPaisa += p.amountPaisa;
    }
    for (const s of exp.splits) {
      const rec = map.get(s.memberId);
      if (rec) rec.totalOwedPaisa += s.amountPaisa;
    }
  }

  // Aggregate settlements
  for (const st of settlements) {
    const payer = map.get(st.payerId);
    if (payer) payer.settlementsPaidPaisa += st.amountPaisa;

    const receiver = map.get(st.receiverId);
    if (receiver) receiver.settlementsReceivedPaisa += st.amountPaisa;
  }

  // Compute net balance:
  // (Total paid for bills - Total consumed) + (Settlement money paid out - Settlement money received)
  const result: MemberBalance[] = [];
  for (const item of map.values()) {
    item.netBalancePaisa =
      item.totalPaidPaisa -
      item.totalOwedPaisa +
      item.settlementsPaidPaisa -
      item.settlementsReceivedPaisa;
    result.push(item);
  }

  return result;
}

export interface DebtTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  toUpiId?: string | null;
  toPhone?: string | null;
  amountPaisa: number;
}

/**
 * Simplified Debts: Greedy Minimum Cash Flow solver.
 * Minimizes total number of transactions between members.
 */
export function simplifyDebts(memberBalances: MemberBalance[]): DebtTransfer[] {
  const debtors: { id: string; name: string; balance: number }[] = [];
  const creditors: { id: string; name: string; upiId?: string | null; phone?: string | null; balance: number }[] = [];

  for (const m of memberBalances) {
    if (m.netBalancePaisa < 0) {
      debtors.push({ id: m.memberId, name: m.name, balance: -m.netBalancePaisa });
    } else if (m.netBalancePaisa > 0) {
      creditors.push({
        id: m.memberId,
        name: m.name,
        upiId: m.upiId,
        phone: m.phone,
        balance: m.netBalancePaisa,
      });
    }
  }

  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transfers: DebtTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const settle = Math.min(debtor.balance, creditor.balance);

    if (settle > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        toUpiId: creditor.upiId,
        toPhone: creditor.phone,
        amountPaisa: settle,
      });

      debtor.balance -= settle;
      creditor.balance -= settle;
    }

    if (debtor.balance === 0) dIdx++;
    if (creditor.balance === 0) cIdx++;
  }

  return transfers;
}

/**
 * Direct (Pairwise) Debts: Computes bilateral debts between people based on actual shared bills.
 * Used when "Simplify Debts" is toggled OFF.
 */
export function calculateDirectPairwiseDebts(
  members: { id: string; name: string; upiId?: string | null; phone?: string | null }[],
  expenses: ExpenseData[],
  settlements: SettlementData[]
): DebtTransfer[] {
  // matrix[fromId][toId] = amount from owes to
  const matrix = new Map<string, Map<string, number>>();

  const getDebt = (from: string, to: string) => matrix.get(from)?.get(to) || 0;
  const setDebt = (from: string, to: string, amt: number) => {
    if (!matrix.has(from)) matrix.set(from, new Map());
    matrix.get(from)!.set(to, amt);
  };
  const addDebt = (from: string, to: string, amt: number) => {
    setDebt(from, to, getDebt(from, to) + amt);
  };

  // Process each expense:
  // Each payer lent money to each consumer in proportion to their payment share
  for (const exp of expenses) {
    if (exp.totalAmountPaisa <= 0) continue;
    for (const split of exp.splits) {
      for (const payer of exp.payers) {
        if (split.memberId === payer.memberId) continue;
        const payerFraction = payer.amountPaisa / exp.totalAmountPaisa;
        const owedToPayer = Math.round(split.amountPaisa * payerFraction);
        if (owedToPayer > 0) {
          addDebt(split.memberId, payer.memberId, owedToPayer);
        }
      }
    }
  }

  // Deduct settlements
  for (const st of settlements) {
    const current = getDebt(st.payerId, st.receiverId);
    setDebt(st.payerId, st.receiverId, Math.max(0, current - st.amountPaisa));
  }

  // Net pairwise debts between (A, B) and (B, A)
  const transfers: DebtTransfer[] = [];
  const processed = new Set<string>();

  for (const m1 of members) {
    for (const m2 of members) {
      if (m1.id === m2.id) continue;
      const pairKey = [m1.id, m2.id].sort().join(':');
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const d12 = getDebt(m1.id, m2.id); // m1 owes m2
      const d21 = getDebt(m2.id, m1.id); // m2 owes m1

      if (d12 > d21) {
        const net = d12 - d21;
        if (net > 0) {
          transfers.push({
            fromId: m1.id,
            fromName: m1.name,
            toId: m2.id,
            toName: m2.name,
            toUpiId: m2.upiId,
            toPhone: m2.phone,
            amountPaisa: net,
          });
        }
      } else if (d21 > d12) {
        const net = d21 - d12;
        if (net > 0) {
          transfers.push({
            fromId: m2.id,
            fromName: m2.name,
            toId: m1.id,
            toName: m1.name,
            toUpiId: m1.upiId,
            toPhone: m1.phone,
            amountPaisa: net,
          });
        }
      }
    }
  }

  return transfers;
}

/**
 * Generates an instant UPI intent deep-link
 */
export function generateUpiUrl(params: {
  upiId: string;
  name: string;
  amountRupees: number;
  note?: string;
}): string {
  const { upiId, name, amountRupees, note } = params;
  const cleanUpi = upiId.trim();
  const cleanName = name.trim();
  const formattedAmt = amountRupees.toFixed(2);
  const cleanNote = (note || 'Lena Dena Settlement').trim();

  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanName)}&am=${formattedAmt}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
}

/**
 * Formats a clean, ready-to-paste WhatsApp group summary
 */
export function generateWhatsAppSummary(params: {
  groupName: string;
  joinCode: string;
  totalSpendPaisa: number;
  transfers: DebtTransfer[];
  baseUrl?: string;
}): string {
  const { groupName, joinCode, totalSpendPaisa, transfers, baseUrl } = params;
  const totalRupees = (totalSpendPaisa / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });

  const lines: string[] = [
    `🌴 *${groupName}* — Settlement Summary`,
    `💰 *Total Group Spend:* ₹${totalRupees}`,
    `🔑 *Group Code:* ${joinCode}`,
    '',
    '⚖️ *Suggested Settlements:*',
  ];

  if (transfers.length === 0) {
    lines.push('✨ All balances are settled up! Zero pending dues.');
  } else {
    for (const t of transfers) {
      const amt = (t.amountPaisa / 100).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
      });
      const upiText = t.toUpiId ? ` (UPI: ${t.toUpiId})` : '';
      lines.push(`• *${t.fromName}* pays *${t.toName}*: ₹${amt}${upiText}`);
    }
  }

  lines.push('');
  if (baseUrl) {
    lines.push(`📱 View live details & pay: ${baseUrl}/join/${joinCode}`);
  } else {
    lines.push(`📱 View details on Lena Dena with Code: *${joinCode}*`);
  }

  return lines.join('\n');
}
