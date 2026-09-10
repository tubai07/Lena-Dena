import { formatINR } from './ledger';

export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

export function generateReminderMessage(params: {
  customerName: string;
  amountPaisa: number;
  upiId?: string | null;
  customTemplate?: string | null;
}): string {
  const formattedAmount = formatINR(params.amountPaisa, true);

  if (params.customTemplate) {
    let msg = params.customTemplate
      .replace('{customer_name}', params.customerName)
      .replace('{amount}', formattedAmount);
    const cleanUpi = params.upiId && params.upiId.trim() !== '[upi address]' ? params.upiId.trim() : '';
    if (cleanUpi) {
      msg = msg.replace('{upi_id}', cleanUpi);
    } else {
      msg = msg.replace(/\s*UPI(?:\s*ID)?:\s*\{upi_id\}\.?/gi, '').replace(/\{upi_id\}/gi, '');
    }
    return msg;
  }

  const cleanUpi =
    params.upiId && params.upiId.trim() && params.upiId.trim() !== '[upi address]'
      ? ` UPI: ${params.upiId.trim()}.`
      : '';

  return `Hi ${params.customerName}, ${formattedAmount} is pending.${cleanUpi} Pay when convenient. Thank you!`;
}

/**
 * Cross-platform SMS link generator (compatible with iOS & Android)
 */
export function generateSmsLink(phone: string, message: string): string {
  const clean = normalizeIndianPhone(phone);
  // iOS uses '&body=', Android uses '?body='
  // Using standard 'sms:phone?&body=' works reliably across both platforms
  return `sms:${clean}?&body=${encodeURIComponent(message)}`;
}

export function generatePaymentReceiptMessage(params: {
  customerName: string;
  amountPaidPaisa: number;
  newBalancePaisa: number;
  paymentMethod?: string;
  note?: string | null;
}): string {
  const paidStr = formatINR(params.amountPaidPaisa, true);
  const balanceStr = formatINR(params.newBalancePaisa, true);
  const balanceLabel =
    params.newBalancePaisa > 0
      ? `${balanceStr} due`
      : params.newBalancePaisa < 0
      ? `${balanceStr} advance`
      : `${balanceStr} settled`;

  return `Hi ${params.customerName}, received payment of ${paidStr}${params.note ? ` for ${params.note}` : ''}. Updated balance: ${balanceLabel}. Thanks!`;
}
