'use server';
import { redirect } from 'next/navigation';
import { devOpenPortalAs } from '@/lib/app/service';
import { devLoginEnabled, requireStaff } from '@/lib/crm/auth';
import { can, isDeveloper } from '@/lib/crm/permissions';
import { revalidatePath } from 'next/cache';
import { getContent } from '@/lib/cms';
import { indexStatus, resetIndex } from '@/lib/rag';

/** Rebuild the shared AI knowledge base now (it also rebuilds automatically after every content save). */
export async function syncKnowledgeAction() {
  const user = await requireStaff();
  if (!isDeveloper(user) && !can(user, 'whatsapp.setup')) redirect('/crm');
  resetIndex();
  indexStatus(await getContent()); // rebuild immediately so the status shows the new version
  revalidatePath('/crm/developer');
}

/** Developer console: open the Student & Parent portal as one family (local development only). */
export async function openPortalAsAction(fd: FormData) {
  const user = await requireStaff();
  if (!isDeveloper(user) || !devLoginEnabled()) redirect('/crm/developer');
  const phone = String(fd.get('phone') ?? '');
  await devOpenPortalAs(phone);
  redirect('/app');
}
