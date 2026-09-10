import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'lena_dena_secure_session_secret_change_in_production_key_1234567890';

/**
 * Hashes a plaintext password using bcrypt with 12 rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

/**
 * Verifies a password against a stored hash.
 * If the stored value is an unhashed legacy password, verifies directly and flags needsRehash=true.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!password || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  // Check if stored string is a bcrypt hash ($2a$, $2b$, or $2y$)
  const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(storedHash);

  if (isBcrypt) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: false };
  }

  // Legacy fallback for plain text password match
  const valid = password === storedHash;
  return { valid, needsRehash: valid };
}

/**
 * Serializes and cryptographically signs a payload using HMAC-SHA256.
 * Format: `<base64Payload>.<hexSignature>`
 */
export function signPayload(payload: any): string {
  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr, 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('hex');

  return `${base64Payload}.${signature}`;
}

/**
 * Verifies the HMAC-SHA256 signature and extracts the typed payload.
 * Returns null if the signature is missing, invalid, or tampered.
 */
export function verifyAndExtractPayload<T>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [base64Payload, signature] = parts;
  if (!base64Payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}
