'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { rateLimit } from '@/lib/api';
import { completeLogin, logout, requestLoginCode, switchProfile } from '@/lib/app/service';
import { normalizeIndianMobile } from '@/lib/phone';
import { MessagingNotConfigured } from '@/lib/whatsapp/service';

export interface LoginState {
  step: 'phone' | 'code';
  phone?: string;
  error?: string;
  devCode?: string;
}

const ip = () => headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

export async function loginAction(prev: LoginState, fd: FormData): Promise<LoginState> {
  const phone = normalizeIndianMobile(String(fd.get('phone') ?? ''));
  if (!phone) return { step: 'phone', error: 'Enter the 10-digit mobile number registered with the college.' };

  if (prev.step === 'code' && fd.get('code') !== null) {
    if (!rateLimit(`app-verify:${ip()}`, 20, 10 * 60_000)) return { ...prev, error: 'Too many attempts. Please wait a few minutes.' };
    const code = String(fd.get('code') ?? '').trim();
    if (!/^\d{6}$/.test(code)) return { ...prev, error: 'Enter the 6-digit code.' };
    const r = await completeLogin(phone, code);
    if (r === 'ok') redirect('/app');
    return { ...prev, error: r === 'invalid' ? 'That code is not correct.' : r === 'locked' ? 'Too many wrong attempts. Request a new code.' : 'This code has expired. Request a new code.' };
  }

  if (!rateLimit(`app-code-ip:${ip()}`, 10, 60 * 60_000) || !rateLimit(`app-code:${phone}`, 3, 10 * 60_000)) {
    return { step: 'phone', phone, error: 'Too many codes requested. Please wait a few minutes.' };
  }
  try {
    const r = await requestLoginCode(phone);
    return { step: 'code', phone, devCode: r.devCode };
  } catch (e) {
    if (e instanceof MessagingNotConfigured) return { step: 'phone', phone, error: 'Sign-in codes are not available right now. Please call the college office.' };
    console.error('[app] code request failed', (e as Error).message);
    return { step: 'phone', phone, error: 'Something went wrong. Please try again.' };
  }
}

export async function logoutAction() {
  await logout();
  redirect('/app/login');
}

export async function switchProfileAction(fd: FormData) {
  await switchProfile(String(fd.get('key') ?? ''));
  redirect(String(fd.get('back') ?? '/app').startsWith('/app') ? String(fd.get('back')) : '/app');
}
