import 'server-only';
import { randomUUID } from 'node:crypto';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { putKbFile, readKbFile } from '../kb/storage';
import { getRecordStore } from '../records';
import { obAudit, obBooks, obPapers, obQuestions, obSettings, obTaxonomy, obUsage } from './collections';
import { BASE_CHAPTERS, EXAMS, EXAM_BY_ID, type Chapter, type Exam } from './taxonomy';

export const store = () => getRecordStore();
export class OpenBookError extends Error {}
export const need = (ok: unknown, msg = 'You do not have permission to do this.') => {
  if (!ok) throw new OpenBookError(msg);
};

export type Actor = { kind: 'staff' | 'student' | 'system'; id: string; name: string };
export const staffActor = (u: Staff): Actor => ({ kind: 'staff', id: u.id, name: u.fullName });
export const studentActor = (id: string, name: string): Actor => ({ kind: 'student', id, name });

/** Content managers (upload, approve, sources, AI settings) and teachers (banks, papers, assignments). */
export const canManage = (u: Staff) => can(u, 'ob.manage');
export const canTeach = (u: Staff) => can(u, 'ob.teach') || canManage(u);

// ---------------------------------------------------------------- settings & daily limits

export async function settings() {
  const rows = await obSettings.list(store());
  return obSettings.schema.parse(rows[0]?.data ?? {});
}
export async function saveSettings(u: Staff, patch: Record<string, unknown>) {
  need(canManage(u));
  const rows = await obSettings.list(store());
  const next = obSettings.schema.parse({ ...(rows[0]?.data ?? {}), ...patch });
  await obSettings.put(store(), next, rows[0]?.id ?? 'settings');
  await audit(staffActor(u), 'settings.save', 'ai', JSON.stringify(patch).slice(0, 400));
  return next;
}

export type UsageKind = 'questions' | 'ai' | 'voice';
/** Counts one use; throws when today's limit is reached (cost control, §26). */
export async function useQuota(who: string, kind: UsageKind, n = 1) {
  const s = await settings();
  const limit = kind === 'questions' ? s.dailyQuestions : kind === 'voice' ? s.dailyVoiceTurns : s.dailyAiCalls;
  const date = todayIST();
  const row = (await obUsage.list(store(), { k1: who, k2: date }))[0];
  const counts = { ...(row?.data.counts ?? {}) };
  if ((counts[kind] ?? 0) + n > limit) throw new OpenBookError(`Daily limit reached (${limit} ${kind === 'questions' ? 'questions' : kind === 'voice' ? 'voice turns' : 'AI requests'} a day). It resets at midnight.`);
  counts[kind] = (counts[kind] ?? 0) + n;
  await obUsage.put(store(), { who, date, counts }, row?.id);
}
export async function usageToday(who: string) {
  return (await obUsage.list(store(), { k1: who, k2: todayIST() }))[0]?.data.counts ?? {};
}

export async function audit(actor: Actor, action: string, target: string, note: string | null = null) {
  await obAudit.put(store(), { actor, action, target, note });
}

// ---------------------------------------------------------------- files (private storage, kb-files bucket, `openbook/` prefix)

export async function putFile(kind: 'book' | 'paper' | 'scan' | 'post' | 'solution' | 'card', bytes: Uint8Array, contentType: string) {
  const key = `openbook/${kind}/${randomUUID()}`;
  await putKbFile(key, bytes, contentType);
  return key;
}
export const readFile = (key: string) => readKbFile(key);

// ---------------------------------------------------------------- taxonomy (base + admin additions) and readiness

export async function chapters(): Promise<Chapter[]> {
  const extra = (await obTaxonomy.list(store())).map((r) => r.data);
  const out = BASE_CHAPTERS.map((c) => ({ ...c, concepts: [...c.concepts] }));
  for (const e of extra) {
    const hit = out.find((c) => c.subject === e.subject && c.cls === e.cls && c.name === e.chapter);
    if (hit) hit.concepts = [...new Set([...hit.concepts, ...e.concepts])];
    else out.push({ subject: e.subject, cls: e.cls, name: e.chapter, concepts: e.concepts });
  }
  return out;
}

export async function chaptersFor(examId: string, subject: string) {
  const exam = EXAM_BY_ID.get(examId);
  if (!exam) return [];
  return (await chapters()).filter((c) => c.subject === subject && exam.classes.includes(c.cls));
}

/**
 * "Coming soon" rule (§25): an exam is ready when it has chapters for at least one subject, or approved
 * books/papers/questions. Empty categories are never shown as if they were ready.
 */
export async function readiness(): Promise<Map<string, { ready: boolean; books: number; papers: number; questions: number }>> {
  const [chs, books, papers, qs] = await Promise.all([chapters(), obBooks.list(store()), obPapers.list(store()), obQuestions.list(store(), { k1: 'bank' })]);
  const m = new Map<string, { ready: boolean; books: number; papers: number; questions: number }>();
  for (const e of EXAMS) {
    const b = books.filter((x) => x.data.status === 'approved' && x.data.examIds.includes(e.id)).length;
    const p = papers.filter((x) => x.data.status === 'approved' && x.data.examId === e.id).length;
    const q = qs.filter((x) => x.data.status === 'approved' && x.data.examId === e.id).length;
    const hasChapters = e.subjects.some((s) => chs.some((c) => c.subject === s && e.classes.includes(c.cls)));
    m.set(e.id, { ready: hasChapters || b + p + q > 0, books: b, papers: p, questions: q });
  }
  return m;
}

export function examOrThrow(id: string): Exam {
  const e = EXAM_BY_ID.get(id);
  need(e, 'Choose an examination.');
  return e!;
}
