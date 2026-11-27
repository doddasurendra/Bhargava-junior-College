'use server';
import { cookies, headers } from 'next/headers';
import { rateLimit } from '@/lib/api';
import * as R from '@/lib/app/registration';
import { decodeToken, encodeToken } from '@/lib/crm/session';
import { MessagingNotConfigured } from '@/lib/whatsapp/service';

/**
 * Multi-step registration. Which student / phone a registration is about, and whether its WhatsApp code was
 * verified, live in a signed 15-minute cookie — never in fields the browser could change.
 */
const COOKIE = 'bjc_reg';
const TTL_S = 15 * 60;

type Pending = { k: 'student'; sid: string; phone: string; who: string; v: boolean } | { k: 'parent'; d: R.ParentDraft; v: boolean };

function setPending(p: Pending) {
  cookies().set(COOKIE, encodeToken({ sub: JSON.stringify(p) }, 'reg', TTL_S), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/app', maxAge: TTL_S });
}
function getPending(): Pending | null {
  const c = decodeToken(cookies().get(COOKIE)?.value, 'reg');
  try {
    return c ? (JSON.parse(c.sub) as Pending) : null;
  } catch {
    return null;
  }
}
const clear = () => cookies().delete(COOKIE);

const ip = () => headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? String(fd.get(k)) : '');
const OTP_ERR: Record<string, string> = { invalid: 'That code is not correct.', expired: 'This code has expired. Start again to get a new one.', locked: 'Too many wrong attempts. Start again to get a new code.' };

export interface RegState {
  step: 'details' | 'code' | 'account' | 'done';
  error?: string;
  devCode?: string;
  to?: string;
  message?: string;
  result?: 'already' | 'linked' | 'pending';
}

async function guard(prev: RegState, fn: () => Promise<RegState>): Promise<RegState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof R.RegistrationError) return { ...prev, error: e.message };
    if (e instanceof MessagingNotConfigured) return { ...prev, error: 'Verification codes are not available right now. Please call the college office.' };
    console.error('[register] failed', e);
    return { ...prev, error: 'Something went wrong. Please try again.' };
  }
}

async function verifyStep(prev: RegState, fd: FormData, phone: string, onOk: () => void): Promise<RegState> {
  if (!rateLimit(`reg-verify:${ip()}`, 20, 10 * 60_000)) return { ...prev, error: 'Too many attempts. Please wait a few minutes.' };
  const code = str(fd, 'code').trim();
  if (!/^\d{6}$/.test(code)) return { ...prev, error: 'Enter the 6-digit code.' };
  const r = await R.checkCode(phone, code);
  if (r !== 'ok') return { ...prev, error: OTP_ERR[r] };
  onOk();
  return { step: 'account' };
}

const codeLimit = (phone: string) => rateLimit(`reg-code-ip:${ip()}`, 10, 3600_000) && rateLimit(`reg-code:${phone}`, 3, 10 * 60_000);

export async function parentRegisterAction(prev: RegState, fd: FormData): Promise<RegState> {
  if (str(fd, 'restart')) {
    clear();
    return { step: 'details' };
  }
  return guard(prev, async () => {
    const p = getPending();
    if (prev.step === 'details') {
      const phone = str(fd, 'phone');
      if (!codeLimit(phone)) return { ...prev, error: 'Too many codes requested. Please wait a few minutes.' };
      const r = await R.startParentRegistration({ name: str(fd, 'name'), relation: str(fd, 'relation'), phone, collegeId: str(fd, 'collegeId'), dob: str(fd, 'dob') });
      setPending({ k: 'parent', d: r.draft, v: false });
      return { step: 'code', devCode: r.devCode, to: `your WhatsApp (${r.draft.phone.slice(0, 3)} ******${r.draft.phone.slice(-4)})` };
    }
    if (p?.k !== 'parent') return { step: 'details', error: 'Your registration timed out. Start again.' };
    if (prev.step !== 'code') return { step: 'details' };
    if (!rateLimit(`reg-verify:${ip()}`, 20, 10 * 60_000)) return { ...prev, error: 'Too many attempts. Please wait a few minutes.' };
    const code = str(fd, 'code').trim();
    if (!/^\d{6}$/.test(code)) return { ...prev, error: 'Enter the 6-digit code.' };
    const v = await R.checkCode(p.d.phone, code);
    if (v !== 'ok') return { ...prev, error: OTP_ERR[v] };
    const r = await R.finishParentRegistration(p.d);
    clear();
    const msg = {
      already: `This number already has access to ${r.student}. Sign in with it and a one-time code.`,
      linked: `Done. Your number is on ${r.student}’s admission record, so it is linked now. Sign in with it and a one-time code.`,
      pending: `Request sent. The admin office will check it against ${r.student}’s admission record and approve it, usually within one working day. You’ll get a WhatsApp message when it is approved; then sign in with this number.`,
    }[r.result];
    return { step: 'done', result: r.result, message: msg };
  });
}
