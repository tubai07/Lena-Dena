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
  const remainder = totalAmountPaisa - allocated;
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
 * All math is strictly in integer paise with zero drift.
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
      isOwner: Boolean(m.isOwner),
      isAdmin: Boolean(m.isAdmin || m.isOwner),
      totalPaidPaisa: 0,
      totalOwedPaisa: 0,
      settlementsPaidPaisa: 0,
      settlementsReceivedPaisa: 0,
      netBalancePaisa: 0,
    });
  }

  // Aggregate expenses
  for (const exp of expenses || []) {
    if (!exp) continue;
    for (const p of exp.payers || []) {
      const rec = map.get(p.memberId);
      if (rec) rec.totalPaidPaisa += Math.round(Number(p.amountPaisa) || 0);
    }
    for (const s of exp.splits || []) {
      const rec = map.get(s.memberId);
      if (rec) rec.totalOwedPaisa += Math.round(Number(s.amountPaisa) || 0);
    }
  }

  // Aggregate settlements
  for (const st of settlements || []) {
    if (!st) continue;
    const payer = map.get(st.payerId);
    if (payer) payer.settlementsPaidPaisa += Math.round(Number(st.amountPaisa) || 0);

    const receiver = map.get(st.receiverId);
    if (receiver) receiver.settlementsReceivedPaisa += Math.round(Number(st.amountPaisa) || 0);
  }

  // Compute net balance:
  // (Total paid for bills - Total consumed) + (Settlement money paid out - Settlement money received)
  const result: MemberBalance[] = [];
  for (const item of map.values()) {
    item.netBalancePaisa = Math.round(
      item.totalPaidPaisa -
      item.totalOwedPaisa +
      item.settlementsPaidPaisa -
      item.settlementsReceivedPaisa
    );
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
 * Minimizes total number of transactions between members with exact-match pre-pass and zero floating drift.
 */
export function simplifyDebts(memberBalances: MemberBalance[]): DebtTransfer[] {
  const debtors: { id: string; name: string; upiId?: string | null; phone?: string | null; balance: number }[] = [];
  const creditors: { id: string; name: string; upiId?: string | null; phone?: string | null; balance: number }[] = [];

  for (const m of memberBalances) {
    const net = Math.round(m.netBalancePaisa || 0);
    if (net < 0) {
      debtors.push({
        id: m.memberId,
        name: m.name,
        upiId: m.upiId,
        phone: m.phone,
        balance: -net,
      });
    } else if (net > 0) {
      creditors.push({
        id: m.memberId,
        name: m.name,
        upiId: m.upiId,
        phone: m.phone,
        balance: net,
      });
    }
  }

  if (debtors.length === 0 || creditors.length === 0) {
    return [];
  }

  // Reconcile minor 1-3 paise rounding drift so total debt strictly equals total credit
  const totalDebt = debtors.reduce((s, d) => s + d.balance, 0);
  const totalCredit = creditors.reduce((s, c) => s + c.balance, 0);
  const drift = totalDebt - totalCredit;
  if (drift !== 0 && Math.abs(drift) <= 5) {
    if (drift > 0 && creditors.length > 0) {
      creditors[0].balance += drift;
    } else if (drift < 0 && debtors.length > 0) {
      debtors[0].balance += Math.abs(drift);
    }
  }

  const transfers: DebtTransfer[] = [];

  // Pass 1: Match exact direct pairs (e.g. Debtor owes ₹50, Creditor is owed ₹50)
  for (let d = 0; d < debtors.length; d++) {
    const debtor = debtors[d];
    if (debtor.balance <= 0) continue;

    for (let c = 0; c < creditors.length; c++) {
      const creditor = creditors[c];
      if (creditor.balance <= 0) continue;

      if (debtor.balance === creditor.balance && debtor.balance > 0) {
        transfers.push({
          fromId: debtor.id,
          fromName: debtor.name,
          toId: creditor.id,
          toName: creditor.name,
          toUpiId: creditor.upiId,
          toPhone: creditor.phone,
          amountPaisa: debtor.balance,
        });
        debtor.balance = 0;
        creditor.balance = 0;
        break;
      }
    }
  }

  // Filter remaining active debtors and creditors
  const remainingDebtors = debtors.filter((d) => d.balance > 0).sort((a, b) => b.balance - a.balance);
  const remainingCreditors = creditors.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance);

  // Pass 2: Greedy solver for remaining net balances
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < remainingDebtors.length && cIdx < remainingCreditors.length) {
    const debtor = remainingDebtors[dIdx];
    const creditor = remainingCreditors[cIdx];

    const settle = Math.round(Math.min(debtor.balance, creditor.balance));

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

    if (debtor.balance <= 0) dIdx++;
    if (creditor.balance <= 0) cIdx++;
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
  const memberMap = new Map<string, { id: string; name: string; upiId?: string | null; phone?: string | null }>();
  for (const m of members || []) {
    memberMap.set(m.id, m);
  }

  // matrix[fromId][toId] = total paise from owes to
  const matrix = new Map<string, Map<string, number>>();

  const getDebt = (from: string, to: string) => matrix.get(from)?.get(to) || 0;
  const setDebt = (from: string, to: string, amt: number) => {
    if (!matrix.has(from)) matrix.set(from, new Map());
    matrix.get(from)!.set(to, amt);
  };
  const addDebt = (from: string, to: string, amt: number) => {
    if (amt <= 0) return;
    setDebt(from, to, getDebt(from, to) + amt);
  };

  // 1. Process each expense:
  // Each payer lent money to each consumer in proportion to their payment share
  for (const exp of expenses || []) {
    if (!exp || exp.totalAmountPaisa <= 0) continue;
    const totalExp = exp.totalAmountPaisa;

    for (const split of exp.splits || []) {
      const splitAmount = Math.round(Number(split.amountPaisa) || 0);
      if (splitAmount <= 0) continue;

      for (const payer of exp.payers || []) {
        if (split.memberId === payer.memberId) continue;
        const payerPaid = Math.round(Number(payer.amountPaisa) || 0);
        if (payerPaid <= 0) continue;

        const owedToPayer = Math.round((splitAmount * payerPaid) / totalExp);
        if (owedToPayer > 0) {
          addDebt(split.memberId, payer.memberId, owedToPayer);
        }
      }
    }
  }

  // 2. Process settlements:
  // When payerId pays receiverId, payerId lent money to receiverId, reducing receiverId's claim on payerId
  for (const st of settlements || []) {
    if (!st || st.amountPaisa <= 0) continue;
    addDebt(st.receiverId, st.payerId, Math.round(Number(st.amountPaisa) || 0));
  }

  // 3. Symmetrical Bilateral Netting between all unique pairs (A, B)
  const transfers: DebtTransfer[] = [];
  const processed = new Set<string>();

  const memberList = Array.from(memberMap.values());
  for (let i = 0; i < memberList.length; i++) {
    for (let j = i + 1; j < memberList.length; j++) {
      const m1 = memberList[i];
      const m2 = memberList[j];
      const pairKey = [m1.id, m2.id].sort().join(':');
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const d12 = getDebt(m1.id, m2.id); // m1 owes m2
      const d21 = getDebt(m2.id, m1.id); // m2 owes m1

      if (d12 > d21) {
        const net = Math.round(d12 - d21);
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
        const net = Math.round(d21 - d12);
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
