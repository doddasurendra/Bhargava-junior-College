'use server';
import { redirect } from 'next/navigation';
import { devOpenPortalAs } from '@/lib/app/service';
import { devLoginEnabled, requireStaff } from '@/lib/crm/auth';
import { isDeveloper } from '@/lib/crm/permissions';

/** Developer console: open the Student & Parent portal as one family (local development only). */
export async function openPortalAsAction(fd: FormData) {
  const user = await requireStaff();
  if (!isDeveloper(user) || !devLoginEnabled()) redirect('/crm/developer');
  const phone = String(fd.get('phone') ?? '');
  await devOpenPortalAs(phone);
  redirect('/app');
}
