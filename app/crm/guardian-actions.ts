'use server';
import { revalidatePath } from 'next/cache';
import { addGuardian, removeGuardian } from '@/lib/app/admin';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import type { ActionState } from './actions';

async function run(leadId: string, fn: () => Promise<void>, message: string): Promise<ActionState> {
  try {
    await fn();
    revalidatePath(`/crm/leads/${leadId}`);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    console.error('[crm] guardian action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function addGuardianAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, () => addGuardian(user, leadId, { name: String(fd.get('name') ?? ''), phone: String(fd.get('phone') ?? ''), relation: String(fd.get('relation') ?? '') }), 'Guardian added; a welcome message was sent on WhatsApp.');
}

export async function removeGuardianAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const leadId = String(fd.get('leadId'));
  return run(leadId, () => removeGuardian(user, leadId, String(fd.get('phone') ?? '')), 'App access removed.');
}
