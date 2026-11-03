import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signed, expiring session tokens: base64url(json).hmac — no framework imports, unit tested. */
export const SESSION_COOKIE = 'bjc_staff';
export const SESSION_MAX_AGE_S = 10 * 60 * 60; // one working day
/** Between the password and the 2FA code. */
export const MFA_COOKIE = 'bjc_staff_mfa';
export const MFA_MAX_AGE_S = 10 * 60;
/** New recovery codes on their way to the page that shows them once. */
export const RC_COOKIE = 'bjc_rc';
/** Which of their roles a multi-role user is working in. */
export const ROLE_COOKIE = 'bjc_role';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set');
  return s || 'dev-only-session-secret';
}

const sign = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url');

/**
 * `aud` separates token kinds — a staff CRM session, a half-finished staff sign-in waiting for its 2FA code,
 * and a Student & Parent app session. None works as another.
 */
export type Audience = 'crm' | 'app' | 'mfa';

export interface Claims {
  sub: string;
  /** staff: session version — bumped to sign out everywhere */
  sv?: number;
  /** staff: second factor completed */
  mfa?: boolean;
}

export function encodeToken(claims: Claims, aud: Audience, maxAgeS: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...claims, aud, exp: Math.floor(now / 1000) + maxAgeS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeToken(token: string | undefined, aud: Audience, now = Date.now()): Claims | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sub, exp, aud: tokenAud, sv, mfa } = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof sub !== 'string' || typeof exp !== 'number' || exp * 1000 < now) return null;
    if ((tokenAud ?? 'crm') !== aud) return null;
    return { sub, sv: typeof sv === 'number' ? sv : 0, mfa: mfa === true };
  } catch {
    return null;
  }
}

export function encodeSession(sub: string, now = Date.now(), aud: Audience = 'crm', maxAgeS = SESSION_MAX_AGE_S): string {
  return encodeToken({ sub }, aud, maxAgeS, now);
}

export function decodeSession(token: string | undefined, now = Date.now(), aud: Audience = 'crm'): string | null {
  return decodeToken(token, aud, now)?.sub ?? null;
}
