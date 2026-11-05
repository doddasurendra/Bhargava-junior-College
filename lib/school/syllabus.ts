import 'server-only';
import { can } from '../crm/permissions';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { chaptersOf, curriculumMap, type Subject } from '../practice/bank';
import { syllabusProgress } from '../records/collections';
import { allBatches, batchOf, canTeachBatch, SchoolError, store, type Batch } from './common';

export type ChapterStatus = 'not_started' | 'in_progress' | 'done';

/** Subjects a program studies: JEE → Maths, Physics, Chemistry; NEET → Biology, Physics, Chemistry. */
export function subjectsForProgram(program: string): Subject[] {
  return /neet/i.test(program) ? ['Physics', 'Chemistry', 'Biology'] : ['Mathematics', 'Physics', 'Chemistry'];
}

/** Coverage % where in-progress counts half. */
export function coverage(statuses: ChapterStatus[]) {
  if (!statuses.length) return 0;
  return Math.round((statuses.reduce((t, s) => t + (s === 'done' ? 1 : s === 'in_progress' ? 0.5 : 0), 0) / statuses.length) * 100);
}

export async function syllabusFor(batch: Batch) {
  const rows = await syllabusProgress.list(store(), { k1: batch.id });
  const status = new Map(rows.map((r) => [`${r.data.subject}|${r.data.chapter}`, r.data]));
  const map = curriculumMap();
  const subjects = subjectsForProgram(batch.data.program).map((subject) => {
    const chapters = chaptersOf(subject).map((chapter) => {
      const s = status.get(`${subject}|${chapter}`);
      const tags = map.find((m) => m.subject === subject && m.chapter === chapter)?.byCurriculum;
      return { chapter, status: (s?.status ?? 'not_started') as ChapterStatus, date: s?.date ?? null, curriculum: tags ? (Object.keys(tags) as (keyof typeof tags)[]).filter((k) => tags[k] > 0) : [] };
    });
    return { subject, chapters, coverage: coverage(chapters.map((c) => c.status)) };
  });
  return { batch: { id: batch.id, name: batch.data.name, program: batch.data.program }, subjects, overall: coverage(subjects.flatMap((s) => s.chapters.map((c) => c.status))) };
}

/** Teacher / head view: their batches, or every active batch for academic heads and management. */
export async function syllabusBatches(user: Staff) {
  const all = (await allBatches()).filter((b) => b.data.active);
  if (can(user, 'academics.view') || can(user, 'academics.manage')) return all;
  const out = [];
  for (const b of all) if (await canTeachBatch(user, b.id)) out.push(b);
  return out;
}

export async function setChapterStatus(user: Staff, input: { batchId: string; subject: string; chapter: string; status: ChapterStatus }, today = todayIST()) {
  if (!can(user, 'homework.assign')) throw new SchoolError('You do not have permission to do this.');
  if (!(await canTeachBatch(user, input.batchId))) throw new SchoolError('You don’t teach this batch.');
  const batch = (await allBatches()).find((b) => b.id === input.batchId);
  if (!batch) throw new SchoolError('Batch not found.');
  if (!subjectsForProgram(batch.data.program).includes(input.subject as Subject) || !chaptersOf(input.subject as Subject).includes(input.chapter)) throw new SchoolError('That chapter is not in this batch’s syllabus.');
  if (!['not_started', 'in_progress', 'done'].includes(input.status)) throw new SchoolError('Choose a status.');
  const prev = (await syllabusProgress.list(store(), { k1: input.batchId })).find((r) => r.data.subject === input.subject && r.data.chapter === input.chapter);
  await syllabusProgress.put(store(), { ...input, updatedBy: user.id, date: today }, prev?.id);
  return `${input.chapter}: ${input.status.replace('_', ' ')}.`;
}

/** Student / parent: the child's batch syllabus. */
export async function syllabusForStudent(studentId: string) {
  const b = await batchOf(studentId);
  return b ? syllabusFor(b) : null;
}
