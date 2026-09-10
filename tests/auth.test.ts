import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signPayload,
  verifyAndExtractPayload,
} from '../src/lib/security';
import { checkRateLimit, resetRateLimit } from '../src/lib/rate-limit';

describe('Security & Authentication Engine', () => {
  it('hashes password with bcrypt and verifies correctly', async () => {
    const plain = 'superSecret123!';
    const hash = await hashPassword(plain);

    expect(hash).toMatch(/^\$2[aby]\$12\$/);

    const match = await verifyPassword(plain, hash);
    expect(match.valid).toBe(true);
    expect(match.needsRehash).toBe(false);

    const wrong = await verifyPassword('wrongPassword', hash);
    expect(wrong.valid).toBe(false);
  });

  it('supports legacy plaintext passwords and flags needsRehash=true', async () => {
    const legacyPlain = 'myOldUnHashedPassword';

    const match = await verifyPassword('myOldUnHashedPassword', legacyPlain);
    expect(match.valid).toBe(true);
    expect(match.needsRehash).toBe(true);

    const wrong = await verifyPassword('incorrect', legacyPlain);
    expect(wrong.valid).toBe(false);
  });

  it('signs session payload and verifies untampered token', () => {
    const session = {
      userId: 'user_123',
      businessId: 'biz_456',
      userName: 'Aman',
      businessName: "Aman's Khata",
      phone: '9876543210',
    };

    const token = signPayload(session);
    expect(token).toContain('.');

    const extracted = verifyAndExtractPayload<typeof session>(token);
    expect(extracted).not.toBeNull();
    expect(extracted?.userId).toBe('user_123');
    expect(extracted?.businessId).toBe('biz_456');
  });

  it('rejects tampered or forged session tokens', () => {
    const session = {
      userId: 'user_123',
      businessId: 'biz_456',
    };

    const token = signPayload(session);
    const [payload, sig] = token.split('.');

    // Tamper the payload (e.g. attempting to hijack another user's account)
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: 'victim_999', businessId: 'biz_999' }),
      'utf-8'
    ).toString('base64url');

    const tamperedToken = `${forgedPayload}.${sig}`;

    const result = verifyAndExtractPayload(tamperedToken);
    expect(result).toBeNull();

    // Tamper the signature
    const corruptSigToken = `${payload}.${sig.slice(0, -4)}ffff`;
    expect(verifyAndExtractPayload(corruptSigToken)).toBeNull();

    // Malformed token
    expect(verifyAndExtractPayload('invalid_token_without_dot')).toBeNull();
  });

  it('enforces rate limiting on repeated failed attempts', () => {
    const key = `test_rate_limit_${Date.now()}`;

    // First 3 attempts should be allowed (limit = 3)
    expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);

    // 4th attempt must be rejected
    const blocked = checkRateLimit(key, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Reset clears the limit
    resetRateLimit(key);
    expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);
  });
});
