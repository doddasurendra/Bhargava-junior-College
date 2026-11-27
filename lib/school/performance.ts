import 'server-only';
import { z } from 'zod';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { callJson } from '../openbook/llm';
import { EXAM_TYPE_LABEL, testResults, tests, type Question } from '../records/collections';
import { analysableBatches } from './attendanceTools';
import { batchOf, readableStudentIds, SchoolError, store, studentsById } from './common';

/**
 * Chapter-wise marks and performance analysis, computed only from saved, published examination results.
 *
 * - Subject %: from online tests (question marks per subject) and single-subject offline tests. Offline tests with
 *   several subjects count in the overall % but not in subject %, because their per-subject maximum is unknown.
 * - Chapter / topic accuracy: from online answers (right ÷ attempted); skipped questions are reported separately.
 * - Strong chapter: ≥ 75 % over ≥ 3 attempted questions. Weak chapter: < 50 % over ≥ 3 (or more skipped than tried).
 * - Trend: average of the last three exams minus the three before; "declining" at ≤ −10 points.
 * - Needs attention: average < 40 %, declining, or 3+ weak chapters.
 * The optional AI summary reads only these computed figures (ANTHROPIC_API_KEY); it never sees or invents marks.
 */
export const RULES = { strong: 75, weak: 50, minAttempts: 3, declining: -10, lowAvg: 40 } as const;

type Acc = { right: number; wrong: number; skipped: number };
const add = (m: Map<string, Acc>, k: string, d: Partial<Acc>) => { const v = m.get(k) ?? { right: 0, wrong: 0, skipped: 0 }; m.set(k, { right: v.right + (d.right ?? 0), wrong: v.wrong + (d.wrong ?? 0), skipped: v.skipped + (d.skipped ?? 0) }); };
const accPct = (a: Acc) => (a.right + a.wrong ? Math.round((a.right / (a.right + a.wrong)) * 1000) / 10 : null);
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

interface ExamRow { testId: string; title: string; date: string; examType: string; score: number; max: number; pct: number; rank: number | null; of: number }

/** Everything about one student's published results. */
export async function studentPerformance(studentId: string) {
  const b = await batchOf(studentId);
  if (!b) return null;
  const ts = (await tests.list(store(), { k1: b.id })).filter((t) => t.data.published).sort((a, c) => a.data.date.localeCompare(c.data.date));
  const exams: ExamRow[] = [];
  const subj = new Map<string, { score: number; max: number }>();
  const chapters = new Map<string, Acc & { subject: string }>();
  const topics = new Map<string, Acc>();
  const examTypes = new Map<string, number[]>();
  for (const t of ts) {
    const all = (await testResults.list(store(), { k1: t.id })).filter((r) => r.data.submittedAt);
    const mine = all.find((r) => r.data.studentId === studentId)?.data;
    if (!mine) continue;
    const sorted = [...all].sort((a, c) => c.data.score - a.data.score);
    const rank = sorted.findIndex((r) => r.data.studentId === studentId) + 1;
    const pct = mine.max ? (mine.score / mine.max) * 100 : 0;
    exams.push({ testId: t.id, title: t.data.title, date: t.data.date, examType: t.data.examType ?? 'other', score: mine.score, max: mine.max, pct: r1(pct), rank: rank || null, of: all.length });
    examTypes.set(t.data.examType ?? 'other', [...(examTypes.get(t.data.examType ?? 'other') ?? []), r1(pct)]);
    // subject %
    const qs = t.data.questions as Question[];
    if (t.data.mode === 'online' && qs.length) {
      const maxBy = new Map<string, number>();
      for (const q of qs) maxBy.set(q.subject, (maxBy.get(q.subject) ?? 0) + q.marks);
      for (const [s, mx] of maxBy) { const v = subj.get(s) ?? { score: 0, max: 0 }; subj.set(s, { score: v.score + (mine.bySubject[s] ?? 0), max: v.max + mx }); }
      // chapters (from the stored breakdown) and topics (answers × question topic)
      for (const [key, a] of Object.entries(mine.byChapter ?? {})) {
        // scoreAttempt keys chapters as "Subject · Chapter"
        const i = key.indexOf(' · ');
        const ch = i > 0 ? key.slice(i + 3) : key;
        const subject = i > 0 ? key.slice(0, i) : qs.find((q) => q.chapter === ch)?.subject ?? '';
        const v = chapters.get(ch) ?? { right: 0, wrong: 0, skipped: 0, subject };
        chapters.set(ch, { subject: v.subject || subject, right: v.right + a.right, wrong: v.wrong + a.wrong, skipped: v.skipped + a.skipped });
      }
      for (const q of qs) {
        if (!q.topic) continue;
        const ans = mine.answers?.[q.id];
        add(topics, `${q.chapter} › ${q.topic}`, ans === undefined || ans < 0 ? { skipped: 1 } : ans === q.answer ? { right: 1 } : { wrong: 1 });
      }
    } else if (t.data.subjects.length === 1) {
      const s = t.data.subjects[0];
      const v = subj.get(s) ?? { score: 0, max: 0 };
      subj.set(s, { score: v.score + (mine.bySubject[s] ?? mine.score), max: v.max + mine.max });
    }
  }
  const chapterRows = [...chapters].map(([chapter, a]) => ({ chapter, attempted: a.right + a.wrong, ...a, accuracy: accPct(a) })).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  const strong = chapterRows.filter((c) => c.attempted >= RULES.minAttempts && (c.accuracy ?? 0) >= RULES.strong).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
  const weak = chapterRows.filter((c) => (c.attempted >= RULES.minAttempts && (c.accuracy ?? 100) < RULES.weak) || (c.skipped >= RULES.minAttempts && c.skipped > c.attempted));
  const topicRows = [...topics].map(([topic, a]) => ({ topic, attempted: a.right + a.wrong, ...a, accuracy: accPct(a) }));
  const weakTopics = topicRows.filter((t) => t.attempted >= 2 && (t.accuracy ?? 100) < RULES.weak).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
  const pcts = exams.map((e) => e.pct);
  const last3 = avg(pcts.slice(-3)), prev3 = pcts.length > 3 ? avg(pcts.slice(-6, -3)) : null;
  const trend = last3 !== null && prev3 !== null ? r1(last3 - prev3) : null;
  const latest = exams[exams.length - 1] ?? null;
  const prevSame = latest ? [...exams].reverse().find((e) => e.testId !== latest.testId && e.examType === latest.examType) ?? exams[exams.length - 2] ?? null : null;
  const average = avg(pcts);
  const reasons: string[] = [];
  if (average !== null && average < RULES.lowAvg) reasons.push(`average ${average}% (below ${RULES.lowAvg}%)`);
  if (trend !== null && trend <= RULES.declining) reasons.push(`declining by ${Math.abs(trend)} points`);
  if (weak.length >= 3) reasons.push(`${weak.length} weak chapters`);
  const revision = weak.map((c) => ({ chapter: c.chapter, subject: c.subject, why: c.attempted >= RULES.minAttempts ? `${c.accuracy}% over ${c.attempted} questions` : `${c.skipped} questions skipped` })).slice(0, 6);
  const recommendations: string[] = [
    ...revision.slice(0, 3).map((r) => `Revise ${r.chapter}${r.subject ? ` (${r.subject})` : ''}: ${r.why}. Re-read the chapter notes, then 20 practice questions on it.`),
    ...weakTopics.slice(0, 2).map((t) => `Practise ${t.topic}: ${t.accuracy}% over ${t.attempted} questions.`),
    ...(trend !== null && trend <= RULES.declining ? [`Recent exams are ${Math.abs(trend)} points lower than before: talk to the mentor this week.`] : []),
    ...(strong.length ? [`Keep ${strong.slice(0, 2).map((c) => c.chapter).join(' and ')} fresh with a short weekly revision (already strong).`] : []),
  ];
  return {
    batchId: b.id, batchName: b.data.name,
    exams, average, trend, latest, previous: prevSame,
    change: latest && prevSame ? r1(latest.pct - prevSame.pct) : null,
    bySubject: [...subj].map(([subject, v]) => ({ subject, pct: v.max ? r1((v.score / v.max) * 100) : null, score: v.score, max: v.max })).sort((a, b) => a.subject.localeCompare(b.subject)),
    byExamType: [...examTypes].map(([k, xs]) => ({ examType: k, label: EXAM_TYPE_LABEL[k as keyof typeof EXAM_TYPE_LABEL] ?? k, exams: xs.length, avg: avg(xs) })),
    chapters: chapterRows, strong, weak, topics: topicRows, weakTopics,
    needsAttention: reasons, revision, recommendations,
  };
}

/** Class-wise report: averages, subject and chapter accuracy across the batch, top performers and students needing support. */
export async function classPerformance(user: Staff, batchId: string) {
  if (!(can(user, 'academics.view') || can(user, 'tests.manage'))) throw new SchoolError('You do not have permission to do this.');
  const b = (await analysableBatches(user)).find((x) => x.id === batchId);
  if (!b) throw new SchoolError('You can’t see this batch.');
  const byId = await studentsById();
  const rows = [];
  for (const sid of b.data.studentIds) {
    const p = await studentPerformance(sid);
    if (!p) continue;
    rows.push({ id: sid, name: byId.get(sid)?.fullName ?? 'Student', collegeId: byId.get(sid)?.collegeId ?? '', average: p.average, trend: p.trend, exams: p.exams.length, weak: p.weak.length, needs: p.needsAttention, bySubject: p.bySubject, chapters: p.chapters });
  }
  const ts = (await tests.list(store(), { k1: b.id })).filter((t) => t.data.published).sort((a, c) => a.data.date.localeCompare(c.data.date));
  const examTrend = [];
  for (const t of ts) {
    const res = (await testResults.list(store(), { k1: t.id })).filter((r) => r.data.submittedAt);
    if (!res.length) continue;
    examTrend.push({ date: t.data.date, title: t.data.title, examType: t.data.examType ?? 'other', avg: avg(res.map((r) => (r.data.max ? (r.data.score / r.data.max) * 100 : 0)))!, takers: res.length });
  }
  const subj = new Map<string, number[]>();
  for (const r of rows) for (const s of r.bySubject) if (s.pct !== null) subj.set(s.subject, [...(subj.get(s.subject) ?? []), s.pct]);
  const ch = new Map<string, Acc & { subject: string }>();
  for (const r of rows) for (const c of r.chapters) { const v = ch.get(c.chapter) ?? { right: 0, wrong: 0, skipped: 0, subject: c.subject }; ch.set(c.chapter, { subject: v.subject || c.subject, right: v.right + c.right, wrong: v.wrong + c.wrong, skipped: v.skipped + c.skipped }); }
  const ranked = rows.filter((r) => r.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  return {
    batch: { id: b.id, name: b.data.name, year: b.data.year, section: b.data.section, students: b.data.studentIds.length },
    examTrend,
    average: avg(ranked.map((r) => r.average!)),
    bySubject: [...subj].map(([subject, xs]) => ({ subject, avg: avg(xs), students: xs.length })).sort((a, b) => a.subject.localeCompare(b.subject)),
    chapters: [...ch].map(([chapter, a]) => ({ chapter, subject: a.subject, attempted: a.right + a.wrong, skipped: a.skipped, accuracy: accPct(a) })).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)),
    top: ranked.slice(0, 5),
    support: rows.filter((r) => r.needs.length).sort((a, b) => (a.average ?? 0) - (b.average ?? 0)),
    students: rows,
  };
}

/** Subject comparison across the batches the user can see. */
export async function subjectComparison(user: Staff) {
  const out: { batch: string; subject: string; avg: number | null }[] = [];
  for (const b of await analysableBatches(user)) {
    try {
      const c = await classPerformance(user, b.id);
      for (const s of c.bySubject) out.push({ batch: b.data.name, subject: s.subject, avg: s.avg });
    } catch { /* not visible */ }
  }
  return out;
}

/** Staff may read a student's analysis only if they can read that student (same rule as Student 360). */
export async function canReadStudent(user: Staff, studentId: string) {
  const ids = await readableStudentIds(user);
  return ids === 'all' || ids.has(studentId);
}

const aiOut = z.object({ summary: z.string().max(1200), focus: z.array(z.string().max(200)).max(5) });
/** Optional AI wording over the computed figures only (needs ANTHROPIC_API_KEY); the figures stay the source of truth. */
export async function aiStudentSummary(p: NonNullable<Awaited<ReturnType<typeof studentPerformance>>>) {
  const facts = {
    average: p.average, trend: p.trend, change_vs_previous: p.change,
    exams: p.exams.slice(-8).map((e) => ({ title: e.title, type: e.examType, pct: e.pct })),
    subjects: p.bySubject, strong: p.strong.slice(0, 5).map((c) => ({ chapter: c.chapter, accuracy: c.accuracy, attempted: c.attempted })),
    weak: p.weak.slice(0, 6).map((c) => ({ chapter: c.chapter, accuracy: c.accuracy, attempted: c.attempted, skipped: c.skipped })),
    weak_topics: p.weakTopics.slice(0, 5), needs_attention: p.needsAttention,
  };
  const r = await callJson({
    system: 'You write a short, encouraging academic progress note for a junior-college student (Intermediate / JEE / NEET). Use ONLY the figures given. Never invent marks, ranks, chapters or exams. If data is thin, say so. Plain English, no headings.',
    parts: [{ kind: 'text', text: JSON.stringify(facts) }],
    jsonSchema: { type: 'object', additionalProperties: false, required: ['summary', 'focus'], properties: { summary: { type: 'string' }, focus: { type: 'array', items: { type: 'string' } } } },
    validate: aiOut, effort: 'low', maxTokens: 800,
  });
  return r.data;
}
