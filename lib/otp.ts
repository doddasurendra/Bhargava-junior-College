import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { getStore } from './store';

const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.OTP_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('OTP_SECRET is not set');
  return s || 'dev-only-otp-secret';
}

function hash(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}:${secret()}`).digest('hex');
}

export async function issueOtp(phone: string): Promise<string> {
  const code = String(randomInt(100000, 1000000));
  await getStore().putOtp({ phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + TTL_MS).toISOString(), attempts: 0, consumed: false });
  return code;
}

export type OtpResult = 'ok' | 'invalid' | 'expired' | 'locked';

export async function verifyOtp(phone: string, code: string): Promise<OtpResult> {
  const store = getStore();
  const rec = await store.getOtp(phone);
  if (!rec || rec.consumed) return 'expired';
  if (new Date(rec.expiresAt).getTime() < Date.now()) return 'expired';
  if (rec.attempts >= MAX_ATTEMPTS) return 'locked';
  const a = Buffer.from(rec.codeHash, 'hex');
  const b = Buffer.from(hash(phone, code), 'hex');
  const match = a.length === b.length && timingSafeEqual(a, b);
  await store.patchOtp(phone, match ? { consumed: true } : { attempts: rec.attempts + 1 });
  return match ? 'ok' : 'invalid';
}
