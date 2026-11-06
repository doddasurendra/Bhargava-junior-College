import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { usingSupabase } from '../crm/repo';
import { getRecordStore } from '../records';
import { collection } from '../records/collection';
import { deriveColumns, type Answers, type GuideLang } from './content';

/**
 * Parent Counselling guide sessions. Supabase table `counselling_guide_sessions` (RLS on, service role only)
 * in production; the local record store in development.
 */
export interface GuideSession {
  id: string;
  leadId: string;
  counsellorId: string;
  language: GuideLang;
  answers: Answers;
  worries: string[];
  nextStep: string | null;
  nextStepDate: string | null;
  interest: 'high' | 'medium' | 'low' | null;
  followUpDate: string | null;
  outcome: string | null;
  selfCheck: boolean[];
  startedAt: string;
  endedAt: string | null;
}

const local = collection({
  name: 'counselling_guide_sessions',
  schema: z.object({
    leadId: z.string(), counsellorId: z.string(), language: z.enum(['te', 'en', 'hi']), answers: z.record(z.unknown()),
    worries: z.array(z.string()), nextStep: z.string().nullable(), nextStepDate: z.string().nullable(), interest: z.enum(['high', 'medium', 'low']).nullable(),
    followUpDate: z.string().nullable(), outcome: z.string().nullable(), selfCheck: z.array(z.boolean()), startedAt: z.string(), endedAt: z.string().nullable(),
  }),
  k1: (d) => d.leadId,
  k2: (d) => d.counsellorId,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABLE = 'counselling_guide_sessions';
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const fromRow = (r: Record<string, any>): GuideSession => ({
  id: r.id, leadId: r.lead_id, counsellorId: r.counsellor_id, language: r.language, answers: r.answers ?? {}, worries: r.worries ?? [],
  nextStep: r.next_step, nextStepDate: r.next_step_date, interest: r.interest, followUpDate: r.follow_up_date, outcome: r.outcome,
  selfCheck: r.self_check ?? [], startedAt: r.started_at, endedAt: r.ended_at,
});
const toRow = (s: Omit<GuideSession, 'id'>) => ({
  lead_id: s.leadId, counsellor_id: s.counsellorId, language: s.language, answers: s.answers, worries: s.worries, next_step: s.nextStep,
  next_step_date: s.nextStepDate, interest: s.interest, follow_up_date: s.followUpDate, outcome: s.outcome, self_check: s.selfCheck,
  started_at: s.startedAt, ended_at: s.endedAt,
});

export async function createGuideSession(input: { leadId: string; counsellorId: string; language: GuideLang; answers: Answers }): Promise<GuideSession> {
  const s: Omit<GuideSession, 'id'> = { ...input, ...deriveColumns(input.answers), startedAt: new Date().toISOString(), endedAt: null };
  if (usingSupabase()) {
    const { data, error } = await sb().from(TABLE).insert(toRow(s)).select('*').single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }
  const rec = await local.put(getRecordStore(), s);
  return { id: rec.id, ...rec.data } as GuideSession;
}

export async function getGuideSession(id: string): Promise<GuideSession | null> {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) return null;
  if (usingSupabase()) {
    const { data, error } = await sb().from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) return null;
    return data ? fromRow(data) : null;
  }
  const rec = await local.get(getRecordStore(), id);
  return rec ? ({ id: rec.id, ...rec.data } as GuideSession) : null;
}

export async function updateGuideSession(s: GuideSession, patch: Partial<Pick<GuideSession, 'answers' | 'language' | 'endedAt'>>): Promise<GuideSession> {
  const answers = patch.answers ?? s.answers;
  const next: GuideSession = { ...s, ...patch, answers, ...deriveColumns(answers) };
  const { id, ...rest } = next;
  if (usingSupabase()) {
    const { error } = await sb().from(TABLE).update({ ...toRow(rest), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    return next;
  }
  await local.put(getRecordStore(), rest, id);
  return next;
}
