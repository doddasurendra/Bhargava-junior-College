'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStaffSession } from '@/lib/crm/auth';
import { can, canSeeLead } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import type { CrmLead, LeadPatch, Staff } from '@/lib/crm/types';
import { STAGES, type StageKey } from '@/lib/admission';
import { getContent } from '@/lib/cms';
import { normalizeIndianMobile } from '@/lib/phone';
import { getStore } from '@/lib/store';
import { validateVisit } from '@/lib/visits';
import { isGuideLang, type Answers } from '@/lib/parentCounselling/content';
import { createGuideSession, getGuideSession, updateGuideSession, type GuideSession } from '@/lib/parentCounselling/sessions';

const MAX_ANSWERS_BYTES = 100_000;

async function counsellor(): Promise<Staff> {
  const user = await getStaffSession();
  if (!user || !can(user, 'counselling.record')) throw new Error('Only counsellors can use the counselling guide.');
  if (user.viewedBy) throw new Error('Read-only while viewing as another user.');
  return user;
}

async function ownSession(user: Staff, id: string): Promise<GuideSession> {
  const s = await getGuideSession(id);
  if (!s || (s.counsellorId !== user.id && !can(user, 'lead.viewAll'))) throw new Error('Session not found.');
  return s;
}

/** Only plain JSON values, bounded in size. */
function cleanAnswers(raw: unknown): Answers {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid answers.');
  const json = JSON.stringify(raw);
  if (json.length > MAX_ANSWERS_BYTES) throw new Error('Too much data.');
  const a = JSON.parse(json) as Answers;
  // Step 1: at most two worries.
  const ticked = Object.keys(a).filter((k) => k.startsWith('s1.w.') && a[k] === true);
  ticked.slice(2).forEach((k) => (a[k] = false));
  return a;
}

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null;
};

/** Step 1 fields known from the lead. */
function prefill(lead: CrmLead): Answers {
  const a: Answers = {};
  const set = (k: string, v: string | null) => { if (v) a[k] = v; };
  set('s1.f.0', lead.studentName);
  set('s1.f.1', lead.area);
  set('s1.f.2', lead.parentName ?? lead.contactName);
  set('s1.f.3', lead.school);
  set('s1.f.4', lead.phone);
  const board = ['SSC', 'CBSE', 'ICSE'].findIndex((b) => (lead.board ?? '').toUpperCase().includes(b));
  if (board >= 0) a['s1.ch.0'] = String(board);
  const prog = (lead.program ?? '').toLowerCase();
  if (prog.includes('jee')) a['s1.ch.1'] = '0';
  else if (prog.includes('neet')) a['s1.ch.1'] = '1';
  return a;
}

export async function startGuideSessionAction(fd: FormData) {
  const user = await counsellor();
  const lang = isGuideLang(fd.get('lang')) ? (fd.get('lang') as 'te' | 'en' | 'hi') : 'te';
  const repo = getCrmRepo();
  let leadId = s(fd, 'leadId');
  if (!leadId) {
    const phone = normalizeIndianMobile(s(fd, 'phone') ?? '');
    const parentName = s(fd, 'parentName');
    if (!phone || !parentName) redirect(`/parent-counselling?mode=counsellor&lang=${lang}&error=lead`);
    const res = await getStore().captureLead({ name: parentName!, studentName: s(fd, 'studentName') ?? undefined, phone: phone!, source: 'walk_in', consent: true, note: 'Parent counselling session' });
    leadId = res.leadId;
  }
  let lead = await repo.getLead(leadId);
  if (!lead) redirect(`/parent-counselling?mode=counsellor&lang=${lang}&error=lead`);
  if (!lead!.ownerId) {
    await repo.updateLead(lead!.id, { ownerId: user.id, assignedAt: new Date().toISOString() }, [{ action: 'assigned', actorId: user.id, field: 'owner', newValue: user.fullName, reason: 'Parent counselling session started' }]);
    lead = { ...lead!, ownerId: user.id };
  }
  if (!canSeeLead(user, lead!)) redirect(`/parent-counselling?mode=counsellor&lang=${lang}&error=lead`);
  const session = await createGuideSession({ leadId: lead!.id, counsellorId: user.id, language: lang, answers: prefill(lead!) });
  redirect(`/parent-counselling/step-1?mode=counsellor&session=${session.id}&lang=${lang}`);
}

export async function saveGuideAnswersAction(sessionId: string, answers: unknown, lang?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await counsellor();
    const sess = await ownSession(user, sessionId);
    if (sess.endedAt) return { ok: false, error: 'Session already finished.' };
    await updateGuideSession(sess, { answers: cleanAnswers(answers), ...(isGuideLang(lang) ? { language: lang } : {}) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' };
  }
}

const stageIndex = (k: StageKey) => STAGES.findIndex((x) => x.key === k);

export async function finishGuideSessionAction(sessionId: string, answers: unknown): Promise<{ ok: boolean; error?: string; notes: string[] }> {
  const notes: string[] = [];
  try {
    const user = await counsellor();
    const sess = await ownSession(user, sessionId);
    if (sess.endedAt) return { ok: false, error: 'Session already finished.', notes };
    const done = await updateGuideSession(sess, { answers: cleanAnswers(answers), endedAt: new Date().toISOString() });
    const repo = getCrmRepo();
    let lead = await repo.getLead(done.leadId);
    if (!lead || !canSeeLead(user, lead)) throw new Error('Lead not found.');

    // Next step "Campus visit" with a date and a valid slot creates the booking.
    const a = done.answers;
    if (a['s10.next.0'] === true && done.nextStepDate) {
      const { visitSlots } = await getContent();
      const slot = typeof a['s10.nf.1'] === 'string' ? (a['s10.nf.1'] as string).trim() : '';
      const err = validateVisit(done.nextStepDate, slot, visitSlots);
      if (err) notes.push(`Campus visit not booked: ${err} Book it from Campus visits.`);
      else {
        try {
          await getStore().createVisit({ name: lead.contactName ?? lead.parentName ?? 'Parent', studentName: lead.studentName ?? undefined, phone: lead.phone, consent: true, date: done.nextStepDate, slot, familySize: 2 });
          notes.push(`Campus visit booked for ${done.nextStepDate} ${slot}.`);
          lead = (await repo.getLead(lead.id)) ?? lead;
        } catch (e) {
          notes.push(`Campus visit not booked (${e instanceof Error ? e.message : 'error'}). Book it from Campus visits.`);
        }
      }
    }

    const patch: LeadPatch = {};
    const category = done.interest ? ({ high: 'hot', medium: 'warm', low: 'cold' } as const)[done.interest] : null;
    if (category && lead.category !== 'invalid') patch.category = category;
    if (done.followUpDate) patch.nextFollowUpAt = new Date(`${done.followUpDate}T10:00:00+05:30`).toISOString();
    if (stageIndex('counselling') > stageIndex(lead.stage)) patch.stage = 'counselling';
    if (!['decision_pending', 'confirmed', 'lost', 'admitted', 'invalid'].includes(lead.status)) patch.status = 'counselled';
    if (!lead.ownerId) { patch.ownerId = user.id; patch.assignedAt = new Date().toISOString(); }
    patch.lastContactAt = new Date().toISOString();
    const startedStep10 = typeof a['_s10at'] === 'number' ? (a['_s10at'] as number) : null;
    const late = startedStep10 !== null && Date.now() - startedStep10 > 10 * 60_000;
    await repo.updateLead(lead.id, patch, [{
      action: 'counselled', actorId: user.id, field: 'counselling',
      newValue: `Parent counselling guide (10 steps) completed by ${user.fullName}; interest ${done.interest ?? 'not recorded'}; next step ${done.nextStep ?? 'none'}${done.nextStepDate ? ` on ${done.nextStepDate}` : ''}; follow-up ${done.followUpDate ?? 'none'}`,
      reason: [done.worries.length ? `Worries: ${done.worries.join(', ')}` : null, done.outcome ? `Outcome: ${done.outcome}` : null, late ? 'Session record closed after 10 minutes' : null].filter(Boolean).join(' · ') || null,
    }]);
    if (category) notes.push(`Lead marked ${category.toUpperCase()}.`);
    if (done.followUpDate) notes.push(`Next follow-up ${done.followUpDate}.`);
    notes.push('Counselling stage completed.');
    revalidatePath(`/crm/leads/${lead.id}`);
    return { ok: true, notes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Finish failed', notes };
  }
}
