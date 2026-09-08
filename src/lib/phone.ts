/**
 * Phone number normalization utilities for Lena Dena
 * Ensures seamless lookup and registration across all Indian mobile phone formats (+91, 0, spaces, dashes)
 */

export function normalizePhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  // If 12 digits starting with country code 91, extract the 10-digit number
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  // If 11 digits starting with 0, extract the 10-digit number
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function getPhoneLookupVariants(input: string): string[] {
  if (!input) return [];
  const clean = input.trim();
  const digitsOnly = input.replace(/\D/g, '');
  const normalized = normalizePhone(input);

  const variants = new Set<string>([
    clean,
    digitsOnly,
    normalized,
    `+91${normalized}`,
    `91${normalized}`,
    `0${normalized}`,
  ]);

  return Array.from(variants).filter(Boolean);
}
