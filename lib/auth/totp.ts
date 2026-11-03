import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30 s, 6 digits) — what Google Authenticator,
 * Microsoft Authenticator, Authy and 1Password all speak. No framework imports; unit tested.
 */
export const STEP_S = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Invalid base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, as RFC 4226 recommends. */
export const generateSecret = () => base32Encode(randomBytes(20));

export const stepAt = (now: number) => Math.floor(now / 1000 / STEP_S);

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Accepts the current step ±1 (phone clocks drift). Returns the matched step so the caller can refuse a
 * replay (any step ≤ the last one used), or null.
 */
export function verifyTotp(secret: string, code: string, now: number, lastStep = 0): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const cur = stepAt(now);
  for (const step of [cur - 1, cur, cur + 1]) {
    if (step <= lastStep) continue;
    const a = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(a, Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_S}`;
}

// ---------------------------------------------------------------- recovery codes

const RC_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i

/** 10 random characters each (~49 bits) — single use, stored only as hashes. */
export function generateRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const s = Array.from({ length: 10 }, () => RC_ALPHABET[randomInt(RC_ALPHABET.length)]).join('');
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export const normaliseRecovery = (code: string) => code.toLowerCase().replace(/[\s-]/g, '');
export const looksLikeRecovery = (code: string) => /^[a-z0-9]{10}$/.test(normaliseRecovery(code)) && !/^\d+$/.test(normaliseRecovery(code));
export const hashRecovery = (code: string) => createHash('sha256').update(`bjc-rc:${normaliseRecovery(code)}`).digest('hex');

// ---------------------------------------------------------------- secret encryption at rest

function key(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!raw && process.env.NODE_ENV === 'production') throw new Error('MFA_ENCRYPTION_KEY (or SESSION_SECRET) is not set');
  return Buffer.from(hkdfSync('sha256', raw || 'dev-only-mfa-key', 'bjc', 'totp-secret-v1', 32));
}

/** AES-256-GCM: v1.iv.tag.ciphertext (base64url). A database leak alone does not reveal 2FA secrets. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function unseal(sealed: string): string | null {
  const [v, iv, tag, enc] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !enc) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
