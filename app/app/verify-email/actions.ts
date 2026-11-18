'use server';
import { rateLimit } from '@/lib/api';
import { verifyStudentEmail } from '@/lib/app/registration';
import { headers } from 'next/headers';

export async function verifyEmailAction(_: { ok?: boolean; error?: string }, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!rateLimit(`verify-email:${ip}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' };
  const r = await verifyStudentEmail(String(fd.get('token') ?? ''));
  return r === 'ok' ? { ok: true } : { error: 'This link has expired or was already used. Register again to get a new one.' };
}
