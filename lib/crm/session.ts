import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signed, expiring staff session token: base64url(json).hmac — no framework imports, unit tested. */
export const SESSION_COOKIE = 'bjc_staff';
export const SESSION_MAX_AGE_S = 10 * 60 * 60; // one working day

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set');
  return s || 'dev-only-session-secret';
}

const sign = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url');

/** `aud` separates staff CRM sessions from Student & Parent app sessions: neither token works for the other. */
export type Audience = 'crm' | 'app';

export function encodeSession(sub: string, now = Date.now(), aud: Audience = 'crm', maxAgeS = SESSION_MAX_AGE_S): string {
  const body = Buffer.from(JSON.stringify({ sub, aud, exp: Math.floor(now / 1000) + maxAgeS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined, now = Date.now(), aud: Audience = 'crm'): string | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sub, exp, aud: tokenAud } = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof sub !== 'string' || typeof exp !== 'number' || exp * 1000 < now) return null;
    if ((tokenAud ?? 'crm') !== aud) return null;
    return sub;
  } catch {
    return null;
  }
}
