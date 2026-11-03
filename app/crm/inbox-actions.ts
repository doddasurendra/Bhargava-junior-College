'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/crm/auth';
import { CrmError } from '@/lib/crm/service';
import { claim, closeConversation, reply, transfer } from '@/lib/chat/inbox';
import type { ActionState } from './actions';

async function run(fn: () => Promise<void>, message: string): Promise<ActionState> {
  try {
    await fn();
    revalidatePath('/crm/inbox');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    console.error('[crm] inbox action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function claimAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  return run(() => claim(user, String(fd.get('id'))), 'You are now handling this conversation.');
}

export async function replyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  return run(() => reply(user, String(fd.get('id')), String(fd.get('text') ?? '')), 'Sent.');
}

export async function transferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const note = String(fd.get('note') ?? '').trim();
  return run(() => transfer(user, String(fd.get('id')), String(fd.get('to') ?? ''), note ? note.slice(0, 200) : null), 'Transferred.');
}

export async function closeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  return run(() => closeConversation(user, String(fd.get('id')), String(fd.get('note') ?? '')), 'Conversation closed.');
}
