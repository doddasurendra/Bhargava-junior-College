'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { addSpend, generateDailyReport, removeSpend } from '@/lib/crm/reports';
import { CrmError } from '@/lib/crm/service';
import type { ActionState } from './actions';

export async function addSpendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff('marketing.spend');
  try {
    await addSpend(user, { source: String(fd.get('source') ?? ''), month: String(fd.get('month') ?? ''), amount: Number(fd.get('amount') ?? 0), note: String(fd.get('note') ?? '') || null });
    revalidatePath('/crm/marketing');
    return { ok: true, message: 'Spend recorded.' };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    if (e instanceof CrmError) return { error: e.message };
    throw e;
  }
}

export async function removeSpendAction(fd: FormData) {
  const user = await requireStaff('marketing.spend');
  await removeSpend(user, String(fd.get('id') ?? ''));
  revalidatePath('/crm/marketing');
}

/** "Preview today's report": builds and stores today's snapshot without sending WhatsApp messages. */
export async function previewReportAction() {
  await requireStaff('dashboard.view');
  const r = await generateDailyReport(new Date(), { send: false });
  redirect(`/crm/reports/${r.date}`);
}
