'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import { bulkSend, recordOptIn, sendFromCrm } from '@/lib/whatsapp/crm';
import type { ActionState } from './actions';

async function run(paths: string[], fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    console.error('[crm] whatsapp action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function waSendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run([`/crm/leads/${leadId}`], () => sendFromCrm(user, leadId, String(fd.get('template') ?? '')));
}

export async function waOptInAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  if (fd.get('attest') !== 'on') return { error: 'Confirm that the family agreed to receive WhatsApp messages.' };
  return run([`/crm/leads/${leadId}`], async () => {
    await recordOptIn(user, leadId, String(fd.get('note') ?? ''));
    return 'Consent recorded.';
  });
}

export async function waBulkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const ids = fd.getAll('ids').map(String).filter(Boolean);
  return run(['/crm/leads'], async () => {
    const c = await bulkSend(user, ids, String(fd.get('waTemplate') ?? ''));
    return `WhatsApp: ${c.sent} sent, ${c.skipped} skipped (no consent, opted out or not applicable), ${c.failed} failed.`;
  });
}
