import 'server-only';
import type { Staff } from '../crm/types';
import { addDays, todayIST } from '../dates';
import { allBatches, canTeachBatch, studentsById } from '../school/common';
import { obAttempts, obAudit, obMockAttempts, obQuestions, obReading, obRejections, obUsage } from './collections';
import { canManage, canTeach, need, store } from './core';
import { recommendations } from './library';
import { masteryOf } from './mastery';
import { pathSummary } from './path';

/** Student Learning Dashboard (§9). Everything is computed from the student's own records. */
export async function dashboard(studentId: string, examIds: string[]) {
  const [reading, attempts, generated, mocks, mastery, path] = await Promise.all([
    obReading.list(store(), { k1: studentId }), obAttempts.list(store(), { k1: studentId }), obQuestions.list(store(), { k1: `s:${studentId}` }),
    obMockAttempts.list(store(), { k1: studentId }), masteryOf(studentId), pathSummary(studentId),
  ]);
  const marked = attempts.filter((a) => a.data.correct !== null);
  const pct = (xs: typeof marked) => (xs.length ? Math.round((xs.filter((a) => a.data.correct).length / xs.length) * 100) : null);
  const subjects = [...new Set(marked.map((a) => a.data.subject))].map((s) => { const xs = marked.filter((a) => a.data.subject === s); return { subject: s, attempts: xs.length, accuracy: pct(xs) ?? 0 }; }).sort((a, b) => b.attempts - a.attempts);
  const concepts = mastery.filter((m) => m.attempts > 0).sort((a, b) => b.score - a.score);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(todayIST(), i - 13)).map((d) => ({ date: d, questions: attempts.filter((a) => a.data.date === d).length }));
  const recs = await recommendations(studentId, examIds, 5);
  const weak = concepts.filter((c) => c.attempts >= 3 && c.score < 60).slice(-5).reverse();
  return {
    totals: {
      booksRead: reading.filter((r) => r.data.pagesRead.length >= 3).length, pagesRead: reading.reduce((s, r) => s + r.data.pagesRead.length, 0), minutesRead: Math.round(reading.reduce((s, r) => s + r.data.seconds, 0) / 60),
      generated: generated.filter((g) => g.data.origin === 'generated').length, attempted: attempts.length, mocks: mocks.filter((m) => m.data.status === 'submitted').length, accuracy: pct(marked),
    },
    subjects, strong: concepts.filter((c) => c.mastered).slice(0, 8), weak, conceptCount: concepts.length, mastered: concepts.filter((c) => c.mastered).length,
    trend: last14, path, recommendedBooks: recs,
    practice: weak.map((w) => ({ subject: w.subject, chapter: w.chapter, concept: w.concept, reason: `${Math.round(w.score)}% over ${w.attempts} questions` })),
  };
}

/** Teacher: performance of a batch they teach (or all, for academic heads). */
export async function batchPerformance(u: Staff, batchId: string) {
  need(canTeach(u));
  need(canManage(u) || (await canTeachBatch(u, batchId)), 'You do not teach this batch.');
  const b = (await allBatches()).find((x) => x.id === batchId);
  need(b, 'Batch not found.');
  const byId = await studentsById();
  const rows = await Promise.all(b!.data.studentIds.map(async (sid) => {
    const [att, m, p] = await Promise.all([obAttempts.list(store(), { k1: sid }), masteryOf(sid), pathSummary(sid)]);
    const marked = att.filter((a) => a.data.correct !== null);
    return { studentId: sid, name: byId.get(sid)?.fullName ?? 'Student', attempts: att.length, accuracy: marked.length ? Math.round((marked.filter((a) => a.data.correct).length / marked.length) * 100) : null, mastered: m.filter((x) => x.mastered).length, weak: m.filter((x) => x.attempts >= 3 && x.score < 60).map((x) => x.concept).slice(0, 3), path: p?.progress ?? null };
  }));
  const conceptAgg = new Map<string, { label: string; n: number; sum: number }>();
  for (const sid of b!.data.studentIds) for (const m of await masteryOf(sid)) { const c = conceptAgg.get(m.conceptKey) ?? { label: `${m.chapter} › ${m.concept}`, n: 0, sum: 0 }; c.n++; c.sum += m.score; conceptAgg.set(m.conceptKey, c); }
  return { batch: b!.data.name, students: rows, weakConcepts: [...conceptAgg.values()].filter((c) => c.n >= 2).map((c) => ({ label: c.label, students: c.n, avg: Math.round(c.sum / c.n) })).sort((a, b) => a.avg - b.avg).slice(0, 10) };
}

/** Admin monitoring: AI generation, duplicate detection, usage, uploads. */
export async function monitoring(u: Staff) {
  need(canTeach(u));
  const since = addDays(todayIST(), -6);
  const [qs, rej, usage, audit] = await Promise.all([obQuestions.list(store()), obRejections.list(store()), obUsage.list(store()), obAudit.list(store(), { limit: 300 })]);
  const recent = qs.filter((q) => q.createdAt.slice(0, 10) >= since);
  return {
    questions: { total: qs.length, generated: qs.filter((q) => q.data.origin === 'generated').length, extracted: qs.filter((q) => q.data.origin === 'extracted').length, bank: qs.filter((q) => !q.data.ownerId && !q.data.paperId).length, last7: recent.length, pendingBank: qs.filter((q) => q.data.status === 'pending').length },
    rejections: { total: rej.length, exact: rej.filter((r) => r.data.reason === 'exact').length, semantic: rej.filter((r) => r.data.reason === 'semantic').length, recent: rej.slice(0, 30).map((r) => ({ id: r.id, ...r.data, at: r.createdAt })) },
    usage: usage.filter((x) => x.data.date >= since).reduce((m, x) => { for (const [k, v] of Object.entries(x.data.counts)) m[k] = (m[k] ?? 0) + v; return m; }, {} as Record<string, number>),
    activeUsers: new Set(usage.filter((x) => x.data.date >= since).map((x) => x.data.who)).size,
    audit: audit.slice(0, 60).map((a) => ({ at: a.createdAt, ...a.data })),
  };
}
