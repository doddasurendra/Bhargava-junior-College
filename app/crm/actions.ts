'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PROGRAM_SLUGS } from '@/content/programs';
import { clearSession, devLoginEnabled, loginAsDevStaff, loginWithPassword, requireStaff } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { assignLeads, bulkCategory, checkInVisit, CrmError, logCall, qualifyLead, recordDecision, recordVisitOutcome } from '@/lib/crm/service';
import { CALL_OUTCOMES, LEAD_CATEGORIES, LOST_REASONS } from '@/lib/crm/types';
import { addDays, todayIST } from '@/lib/dates';
import { getStore } from '@/lib/store';

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** `datetime-local` values are campus (IST) wall-clock times. */
function istLocalToIso(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string' || !v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  return new Date(`${v}:00+05:30`).toISOString();
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

async function run(fn: () => Promise<string | void>, paths: string[]): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message: message || 'Saved.' };
  } catch (e) {
    if (e instanceof CrmError || e instanceof z.ZodError) return { error: e instanceof z.ZodError ? e.issues[0]?.message : e.message };
    console.error('[crm] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}

// ---------------------------------------------------------------- auth

export async function loginDevAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const err = await loginAsDevStaff(String(fd.get('staffId') ?? ''));
  if (err) return { error: err };
  redirect('/crm');
}

export async function loginPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email');
  const password = typeof fd.get('password') === 'string' ? String(fd.get('password')) : '';
  if (!email || !password) return { error: 'Enter your email and password.' };
  const err = await loginWithPassword(email, password);
  if (err) return { error: err };
  redirect('/crm');
}

export async function logoutAction() {
  clearSession();
  redirect('/crm/login');
}

// ---------------------------------------------------------------- leads

const category = z.enum(LEAD_CATEGORIES, { errorMap: () => ({ message: 'Choose a category.' }) });

export async function qualifyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const id = String(fd.get('leadId'));
  return run(() => qualifyLead(user, id, category.parse(fd.get('category'))), [`/crm/leads/${id}`, '/crm/leads']);
}

export async function assignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const ids = fd.getAll('ids').map(String).filter(Boolean);
  const owner = str(fd, 'ownerId');
  return run(
    async () => {
      if (!owner) throw new CrmError('Choose an owner or round-robin.');
      const n = await assignLeads(user, ids, owner, str(fd, 'reason'));
      return n === 0 ? 'No changes: those leads already have that owner.' : `Assigned ${n} lead${n === 1 ? '' : 's'}.`;
    },
    ['/crm/leads', '/crm', ...ids.map((i) => `/crm/leads/${i}`)],
  );
}

export async function bulkCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const ids = fd.getAll('ids').map(String).filter(Boolean);
  return run(
    async () => {
      if (ids.length === 0) throw new CrmError('Select at least one lead.');
      const n = await bulkCategory(user, ids, category.parse(fd.get('category')));
      return `Updated ${n} lead${n === 1 ? '' : 's'}.`;
    },
    ['/crm/leads', '/crm'],
  );
}

const callSchema = z.object({
  outcome: z.enum(CALL_OUTCOMES.map((o) => o.value) as [string, ...string[]], { errorMap: () => ({ message: 'Choose the call outcome.' }) }),
  interest: category.exclude(['invalid']).nullable(),
  close: z.enum(['lost']).nullable(),
  lostReason: z.enum(LOST_REASONS.map((r) => r.value) as [string, ...string[]]).nullable(),
});

export async function callAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const id = String(fd.get('leadId'));
  return run(
    async () => {
      const p = callSchema.parse({ outcome: str(fd, 'outcome'), interest: str(fd, 'interest'), close: str(fd, 'close'), lostReason: str(fd, 'lostReason') });
      await logCall(user, id, {
        outcome: p.outcome as never,
        interest: p.interest,
        close: p.close,
        lostReason: p.lostReason as never,
        competitor: str(fd, 'competitor'),
        notes: str(fd, 'notes')?.slice(0, 1000) ?? null,
        nextFollowUpAt: istLocalToIso(fd.get('nextFollowUpAt')),
      });
      return 'Call logged.';
    },
    [`/crm/leads/${id}`, '/crm/leads', '/crm'],
  );
}

export async function decisionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const id = String(fd.get('leadId'));
  return run(
    async () => {
      const decision = z.enum(['confirmed', 'pending', 'lost'], { errorMap: () => ({ message: 'Choose a decision.' }) }).parse(str(fd, 'decision'));
      await recordDecision(user, id, {
        decision,
        lostReason: (str(fd, 'lostReason') as never) ?? null,
        competitor: str(fd, 'competitor'),
        nextFollowUpAt: istLocalToIso(fd.get('nextFollowUpAt')),
      });
      return 'Decision recorded.';
    },
    [`/crm/leads/${id}`, '/crm/leads', '/crm'],
  );
}

// ---------------------------------------------------------------- visits

export async function checkInAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const status = z.enum(['arrived', 'no_show']).parse(fd.get('status'));
  return run(() => checkInVisit(user, String(fd.get('visitId')), status), ['/crm/visits', '/crm', '/crm/leads']);
}

export async function visitOutcomeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  return run(() => recordVisitOutcome(user, String(fd.get('visitId')), str(fd, 'outcome') ?? '', fd.get('counselled') === 'on'), ['/crm/visits', '/crm', '/crm/leads']);
}

// ---------------------------------------------------------------- development

/** Development only: fill the local store with demo leads so every queue has something in it. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function seedDemoAction(_: ActionState, _fd: FormData): Promise<ActionState> {
  if (!devLoginEnabled()) return { error: 'Demo data is only available in local development.' };
  const store = getStore();
  const repo = getCrmRepo();
  const names = ['Lakshmi Prasad', 'Venkatesh Rao', 'Sunitha Reddy', 'Mahesh Goud', 'Kavitha N', 'Srinivas K', 'Padma Devi', 'Ravi Teja', 'Anitha M', 'Prakash V', 'Swapna R', 'Naveen Kumar'];
  const sources = ['callback', 'brochure', 'fee_calculator', 'bsat', 'enquiry', 'exit_popup'] as const;
  const owners = ['staff-priya', 'staff-ramesh', 'staff-divya', null];
  const now = Date.now();
  const H = 3_600_000;
  const dueOffsets = [-60, -30, -5, 2, 6, 30, 72, null, -1, 4, null, 50];
  for (let i = 0; i < names.length; i++) {
    const phone = `+9190000${String(10000 + i).slice(-5)}`;
    const { leadId } = await store.captureLead({
      name: names[i],
      phone,
      source: sources[i % sources.length],
      program: PROGRAM_SLUGS[i % 4],
      studentClass: i % 3 ? 'Class 10' : 'Completed Class 12',
      consent: true,
      attribution: { utm_source: i % 2 ? 'google' : 'facebook', page: '/' },
    });
    const owner = owners[i % owners.length];
    const due = dueOffsets[i];
    await repo.updateLead(
      leadId,
      {
        ownerId: owner,
        category: owner ? (['hot', 'warm', 'cold'] as const)[i % 3] : null,
        nextFollowUpAt: owner && due !== null ? new Date(now + due * H).toISOString() : null,
        lastContactAt: owner && due !== null ? new Date(now - 26 * H).toISOString() : null,
      },
      owner ? [{ action: 'assigned', field: 'owner', newValue: owner, reason: 'demo data' }] : [],
    );
  }
  const today = todayIST();
  await store.createVisit({ name: names[0], phone: '+919000010000', consent: true, date: today, slot: '10:00', familySize: 3, program: 'iit-jee' });
  await store.createVisit({ name: names[1], phone: '+919000010001', consent: true, date: addDays(today, -1), slot: '11:30', familySize: 2, program: 'neet' });
  await store.createVisit({ name: names[4], phone: '+919000010004', consent: true, date: addDays(today, 1), slot: '14:00', familySize: 2 });
  revalidatePath('/crm', 'layout');
  return { ok: true, message: `Loaded ${names.length} demo leads and 3 visits.` };
}
