'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/crm/auth';
import { removeCampaign, saveCampaign } from '@/lib/crm/marketingAnalytics';
import { CrmError } from '@/lib/crm/service';
import type { ActionState } from './actions';

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };

export async function saveCampaignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireStaff();
  try {
    await saveCampaign(u, { name: s(fd, 'name'), code: s(fd, 'code'), channel: s(fd, 'channel'), source: s(fd, 'source'), startDate: s(fd, 'startDate'), endDate: s(fd, 'endDate'), budget: s(fd, 'budget') ?? 0, targetLeads: s(fd, 'targetLeads') ?? 0, targetAdmissions: s(fd, 'targetAdmissions') ?? 0 }, s(fd, 'id') ?? undefined);
    revalidatePath('/crm/marketing');
    return { ok: true, message: 'Campaign saved.' };
  } catch (e) {
    if (e instanceof CrmError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[campaign] save failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export async function removeCampaignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireStaff();
  try {
    await removeCampaign(u, s(fd, 'id') ?? '');
    revalidatePath('/crm/marketing');
    return { ok: true, message: 'Removed.' };
  } catch (e) {
    return { error: e instanceof CrmError ? e.message : 'Something went wrong. Please try again.' };
  }
}
