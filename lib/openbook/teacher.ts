import 'server-only';
import type { Staff } from '../crm/types';
import { allBatches, canTeachBatch } from '../school/common';
import { obAssignments, obTaxonomy } from './collections';
import { audit, canManage, canTeach, need, staffActor, store } from './core';

/** Teacher assignments (§11): concept exercises, book recommendations and shared tests for a batch. */
export async function createAssignment(u: Staff, a: { batchId: string; kind: 'concept' | 'book' | 'mock'; examId: string | null; subject: string | null; chapter: string | null; concept: string | null; count: number; difficulty: string | null; bookId: string | null; mockId: string | null; due: string | null; note: string | null }) {
  need(canTeach(u));
  need(canManage(u) || (await canTeachBatch(u, a.batchId)), 'You do not teach this batch.');
  const r = await obAssignments.put(store(), { ...a, teacherId: u.id, teacherName: u.fullName });
  await audit(staffActor(u), `assignment.${a.kind}`, r.id, a.batchId);
  return r.id;
}

export async function assignmentsFor(batchId: string) {
  return (await obAssignments.list(store(), { k1: batchId })).map((r) => ({ id: r.id, createdAt: r.createdAt, ...r.data })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function myBatches(u: Staff) {
  const all = await allBatches();
  if (canManage(u)) return all;
  const out = [];
  for (const b of all) if (await canTeachBatch(u, b.id)) out.push(b);
  return out;
}

/** Admins/teachers add subjects, chapters and concepts at runtime (merged with the NCERT base taxonomy). */
export async function addTaxonomy(u: Staff, input: { subject: string; cls: '11' | '12'; chapter: string; concepts: string[]; examIds: string[] }) {
  need(canTeach(u));
  const have = (await obTaxonomy.list(store(), { k1: input.subject, k2: input.chapter }))[0];
  const concepts = [...new Set([...(have?.data.concepts ?? []), ...input.concepts.map((c) => c.trim()).filter(Boolean)])].slice(0, 60);
  await obTaxonomy.put(store(), { ...input, concepts, addedBy: u.id }, have?.id);
  await audit(staffActor(u), 'taxonomy.add', `${input.subject}/${input.chapter}`, concepts.join('; ').slice(0, 400));
}
