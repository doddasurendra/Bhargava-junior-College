import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateRecoveryCodes, generateSecret, hashRecovery, looksLikeRecovery, otpauthUri, seal, totpAt, unseal, verifyTotp } from './totp';

// RFC 6238 appendix B, SHA-1 key "12345678901234567890" (last 6 of the 8-digit vectors).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 test vectors', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('round-trips base32', () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(base32Decode('gezd gnbv-gy3tqojq')).toEqual(base32Decode('GEZDGNBVGY3TQOJQ'));
  });

  it('accepts ±1 step for clock drift, nothing further, and refuses used steps', () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step).replace(/^(\d{3})/, '$1 '), now)).toBe(step);
  });

  it('builds an otpauth URI authenticator apps accept', () => {
    const uri = otpauthUri('ABC', 'priya@college.in', 'Bhargava CRM');
    expect(uri).toBe('otpauth://totp/Bhargava%20CRM%3Apriya%40college.in?secret=ABC&issuer=Bhargava%20CRM&algorithm=SHA1&digits=6&period=30');
  });

  it('makes distinct single-use recovery codes, hashed independent of formatting', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(hashRecovery(codes[0])).toBe(hashRecovery(codes[0].toUpperCase().replace('-', ' ')));
    expect(looksLikeRecovery(codes[0])).toBe(true);
    expect(looksLikeRecovery('123456')).toBe(false);
  });

  it('seals secrets so they are unreadable and tamper-evident', () => {
    const sealed = seal('JBSWY3DPEHPK3PXP');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(unseal(sealed)).toBe('JBSWY3DPEHPK3PXP');
    expect(seal('x')).not.toBe(seal('x'));
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(unseal(parts.join('.'))).toBeNull();
    expect(unseal('garbage')).toBeNull();
  });
});
