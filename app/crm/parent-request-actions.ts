'use server';
import { revalidatePath } from 'next/cache';
import { decideParentRequest } from '@/lib/app/registration';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import type { ActionState } from './actions';

export async function decideParentRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('guardians.manage');
  const approve = fd.get('decision') === 'approve';
  try {
    await decideParentRequest(user, String(fd.get('id') ?? ''), approve, String(fd.get('note') ?? ''));
    revalidatePath('/crm/parent-requests');
    return { ok: true, message: approve ? 'Approved. The parent can sign in now (WhatsApp welcome queued).' : 'Declined.' };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    throw e;
  }
}
