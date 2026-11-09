'use server';
import { redirect } from 'next/navigation';
import { devOpenPortalAs } from '@/lib/app/service';
import { devLoginEnabled } from '@/lib/crm/auth';

/** Local development only (next dev + local JSON store): open the app as a demo family without an OTP. */
export async function devAppSignIn(formData: FormData) {
  if (!devLoginEnabled()) redirect('/app/login');
  const phone = String(formData.get('phone') ?? '');
  if (!/^\+9190000\d{5}$/.test(phone)) redirect('/app/login');
  await devOpenPortalAs(phone);
  redirect('/app');
}
