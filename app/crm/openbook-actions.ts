'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/app/crm/actions';
import { requireStaff } from '@/lib/crm/auth';
import * as Co from '@/lib/openbook/community';
import { canManage, canTeach, OpenBookError, readFile, saveSettings, staffActor } from '@/lib/openbook/core';
import * as F from '@/lib/openbook/flashcards';
import * as L from '@/lib/openbook/library';
import * as M from '@/lib/openbook/mocks';
import * as P from '@/lib/openbook/papers';
import * as Pa from '@/lib/openbook/path';
import * as Q from '@/lib/openbook/questions';
import { importPracticeBank } from '@/lib/openbook/seed';
import * as So from '@/lib/openbook/sources';
import * as T from '@/lib/openbook/teacher';
import type { Difficulty, QType } from '@/lib/openbook/taxonomy';

async function run(fn: () => Promise<unknown>, msg: string, paths: string[] = ['/crm/openbook']): Promise<ActionState> {
  try {
    const r = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message: typeof r === 'string' && r.length < 300 ? r : msg };
  } catch (e) {
    if (e instanceof OpenBookError || (e instanceof Error && e.constructor.name === 'SchoolError')) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Check the form.' };
    console.error('[openbook/crm] action failed', e);
    return { error: 'Something went wrong. Please try again.' };
  }
}
const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };
const list = (fd: FormData, k: string) => (s(fd, k) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const file = async (fd: FormData, k: string, who: string) => {
  const staged = s(fd, `${k}__key`);
  if (staged) {
    if (!staged.startsWith(`openbook/staging/${who}/`)) throw new OpenBookError('Upload not found. Please choose the file again.');
    const bytes = await readFile(staged);
    if (!bytes) throw new OpenBookError('Upload not found. Please choose the file again.');
    return { name: s(fd, `${k}__name`) ?? 'file', bytes };
  }
  const f = fd.get(k);
  return f instanceof File && f.size > 0 ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
};

// ---------------------------------------------------------------- books & sources
export async function uploadBookAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(async () => {
    if (!canTeach(u)) throw new OpenBookError('You do not have permission to do this.');
    const f = await file(fd, 'file', u.id);
    if (!f) throw new OpenBookError('Choose the book file.');
    await L.uploadBook(staffActor(u), canManage(u), f, {
      title: s(fd, 'title') ?? f.name, authors: list(fd, 'authors'), publisher: s(fd, 'publisher'), edition: s(fd, 'edition'), year: s(fd, 'year'), isbn: s(fd, 'isbn'), description: s(fd, 'description'),
      category: s(fd, 'category') ?? 'intermediate', examIds: fd.getAll('examIds').map(String), subjects: list(fd, 'subjects'), cls: (s(fd, 'cls') ?? 'na') as 'na', chapters: list(fd, 'chapters'),
      kind: (s(fd, 'kind') ?? 'institution') as 'institution', licence: s(fd, 'licence') ?? 'institution_owned', officialUrl: s(fd, 'officialUrl'), downloadAllowed: fd.get('downloadAllowed') === 'on',
    });
  }, canManage(u) ? 'Book added and its text extracted.' : 'Book uploaded; an administrator approves it.');
}
export async function googleImportAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(async () => { const r = await L.importFromGoogle(u, { query: s(fd, 'query') ?? '', category: s(fd, 'category') ?? 'intermediate', examIds: fd.getAll('examIds').map(String), subjects: list(fd, 'subjects'), cls: (s(fd, 'cls') ?? 'na') as 'na' }); return `Google Books: ${r.found} found, ${r.added} new books added (metadata, cover, preview and purchase links).`; }, 'Imported.');
}
export async function reviewBookAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => L.reviewBook(u, s(fd, 'id')!, s(fd, 'decision') === 'approve', s(fd, 'note')), 'Saved.');
}
export async function removeBookAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => L.removeBook(u, s(fd, 'id')!, s(fd, 'reason') ?? 'Removed by an administrator'), 'Removed from the library.');
}
export async function seedCatalogueAction() {
  const u = await requireStaff();
  return run(async () => `Catalogue: ${await L.seedCatalogue(u)} books added (NCERT and OpenStax, link-only).`, 'Done.');
}
export async function seedSourcesAction() {
  const u = await requireStaff();
  return run(async () => `${await So.seedSources(u)} official sources added.`, 'Done.');
}
export async function checkSourcesAction() {
  const u = await requireStaff();
  return run(async () => { const r = await So.checkSources(u); return `Checked ${r.checked} links: ${r.problems.length} need attention.`; }, 'Checked.');
}
export async function saveSourceAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => So.saveSource(u, { category: s(fd, 'category'), examId: s(fd, 'examId'), name: s(fd, 'name'), url: s(fd, 'url'), resourceType: s(fd, 'resourceType'), licence: s(fd, 'licence'), note: s(fd, 'note') }, s(fd, 'id') ?? undefined), 'Saved. Run the link check to verify it.');
}
export async function removeSourceAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => So.removeSource(u, s(fd, 'id')!), 'Removed.');
}

// ---------------------------------------------------------------- papers & bank
export async function staffUploadPaperAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(async () => {
    if (!canTeach(u)) throw new OpenBookError('You do not have permission to do this.');
    const f = await file(fd, 'file', u.id);
    if (!f) throw new OpenBookError('Choose the paper file.');
    await P.uploadPaper(staffActor(u), true, f, { title: s(fd, 'title') ?? f.name, examId: s(fd, 'examId') ?? 'jee-main', board: s(fd, 'board'), subject: s(fd, 'subject') ?? 'Physics', topics: list(fd, 'topics'), year: Number(s(fd, 'year')), session: s(fd, 'session'), paperType: (s(fd, 'paperType') ?? 'official') as 'official', difficulty: (s(fd, 'difficulty') as Difficulty) ?? null, cls: (s(fd, 'cls') ?? 'na') as 'na', licence: (s(fd, 'licence') ?? 'official_public') as 'official_public', answerKey: s(fd, 'answerKey') }, await file(fd, 'solution', u.id));
  }, 'Paper uploaded and questions extracted.');
}
export async function reviewPaperAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => P.reviewPaper(u, s(fd, 'id')!, s(fd, 'decision') === 'approve', s(fd, 'note')), 'Saved.');
}
export async function reextractAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(async () => { if (!canTeach(u)) throw new OpenBookError('You do not have permission to do this.'); const r = await P.extractPaper(s(fd, 'id')!); return `Extraction: ${r.status}, ${r.count} questions${r.error ? ` (${r.error})` : ''}.`; }, 'Done.');
}
export async function editExtractedAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => P.editExtractedQuestion(u, s(fd, 'id')!, { stem: s(fd, 'stem') ?? undefined, options: s(fd, 'options') ? s(fd, 'options')!.split('\n').map((x) => x.trim()).filter(Boolean) : undefined, answer: s(fd, 'answer') ? [s(fd, 'answer')!] : undefined, chapter: s(fd, 'chapter') ?? undefined, concept: s(fd, 'concept') ?? undefined }), 'Question updated.');
}
export async function reviewQuestionAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Q.reviewQuestion(u, s(fd, 'id')!, s(fd, 'decision') === 'approve'), 'Saved.');
}
export async function teacherQuestionAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Q.addTeacherQuestion(u, { target: { examId: s(fd, 'examId') ?? 'jee-main', subject: s(fd, 'subject') ?? 'Physics', chapter: s(fd, 'chapter') ?? '', concept: s(fd, 'concept') ?? '' }, type: (s(fd, 'type') ?? 'mcq_single') as QType, difficulty: (s(fd, 'difficulty') ?? 'medium') as Difficulty, stem: s(fd, 'stem') ?? '', options: (s(fd, 'options') ?? '').split('\n').map((x) => x.trim()).filter(Boolean), answer: [s(fd, 'answer') ?? ''], explanation: s(fd, 'explanation') ? { answer: s(fd, 'answer') ?? '', explanation: s(fd, 'explanation')!, steps: [], formulas: [], concepts: [], outcome: '', mistakes: [], related: [], whyOptions: [] } : null }), 'Added to the bank.');
}
export async function bankGenerateAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(async () => {
    if (!canTeach(u)) throw new OpenBookError('You do not have permission to do this.');
    const r = await Q.generate(staffActor(u), null, { examId: s(fd, 'examId') ?? 'jee-main', subject: s(fd, 'subject') ?? 'Physics', chapter: s(fd, 'chapter') ?? '', concept: s(fd, 'concept') ?? '', types: [(s(fd, 'type') ?? 'mcq_single') as QType], difficulty: (s(fd, 'difficulty') ?? 'medium') as Difficulty, count: Number(s(fd, 'count') ?? 10) });
    return `${r.questions.length} AI questions added for review (${r.rejected} duplicates rejected). Approve them below before students see them.`;
  }, 'Done.');
}
export async function importBankAction() {
  const u = await requireStaff();
  return run(async () => { if (!canManage(u)) throw new OpenBookError('You do not have permission to do this.'); return `${await importPracticeBank()} practice-bank questions imported.`; }, 'Done.');
}

// ---------------------------------------------------------------- teaching
export async function assignAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => T.createAssignment(u, { batchId: s(fd, 'batchId') ?? '', kind: (s(fd, 'kind') ?? 'concept') as 'concept', examId: s(fd, 'examId'), subject: s(fd, 'subject'), chapter: s(fd, 'chapter'), concept: s(fd, 'concept'), count: Number(s(fd, 'count') ?? 10), difficulty: s(fd, 'difficulty'), bookId: s(fd, 'bookId'), mockId: null, due: s(fd, 'due'), note: s(fd, 'note') }), 'Assigned to the batch.');
}
export async function shareMockAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(async () => {
    const batchId = s(fd, 'batchId') ?? '';
    const id = await M.shareMockWithBatch(u, batchId, { title: s(fd, 'title') ?? undefined, examId: s(fd, 'examId') ?? 'jee-main', subjects: list(fd, 'subjects'), chapters: list(fd, 'chapters'), concepts: [], count: Number(s(fd, 'count') ?? 20), difficulty: (s(fd, 'difficulty') as Difficulty) ?? null, minutes: s(fd, 'minutes') ? Number(s(fd, 'minutes')) : null, marks: null, negative: null, source: (s(fd, 'source') ?? 'pool') as 'pool' });
    await T.createAssignment(u, { batchId, kind: 'mock', examId: s(fd, 'examId'), subject: null, chapter: null, concept: null, count: 0, difficulty: null, bookId: null, mockId: id, due: s(fd, 'due'), note: s(fd, 'title') });
  }, 'Practice test shared with the batch.');
}
export async function taxonomyAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => T.addTaxonomy(u, { subject: s(fd, 'subject') ?? '', cls: (s(fd, 'cls') ?? '11') as '11', chapter: s(fd, 'chapter') ?? '', concepts: (s(fd, 'concepts') ?? '').split(/[;\n]/), examIds: fd.getAll('examIds').map(String) }), 'Saved.');
}
export async function adjustPathAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Pa.adjustPath(u, s(fd, 'studentId')!, s(fd, 'conceptKey')!, { target: s(fd, 'target') ?? undefined, status: (s(fd, 'status') as 'locked') ?? undefined, reason: s(fd, 'reason') ?? undefined }), 'Path updated.');
}
export async function approveDeckAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => F.approveDeck(u, s(fd, 'id')!, s(fd, 'decision') === 'approve'), 'Saved.');
}

export async function announceWinnersAction() {
  const u = await requireStaff();
  return run(async () => { if (!canManage(u)) throw new OpenBookError('You do not have permission to do this.'); const { announceWeeklyWinners } = await import('@/lib/openbook/challenge'); const r = await announceWeeklyWinners(); return `Weekly winners posted to Notices for ${r.posted} batch(es)${'skipped' in r ? ` (${r.skipped})` : ''}.`; }, 'Done.');
}

// ---------------------------------------------------------------- community moderation
export async function moderateAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Co.moderate(u, s(fd, 'id')!, s(fd, 'action') === 'restore' ? 'restore' : 'hide', s(fd, 'note')), 'Saved.', ['/crm/openbook/community']);
}
export async function verifyAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Co.verify(u, s(fd, 'id')!, s(fd, 'on') !== 'off'), 'Saved.', ['/crm/openbook/community']);
}
export async function suspendAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Co.suspend(u, s(fd, 'studentId')!, Number(s(fd, 'days') ?? 0), s(fd, 'note')), 'Saved.', ['/crm/openbook/community']);
}
export async function staffAnswerAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => Co.answer(staffActor(u), s(fd, 'threadId')!, s(fd, 'body') ?? ''), 'Answer posted.', ['/crm/openbook/community']);
}

// ---------------------------------------------------------------- settings
export async function settingsAction(_: ActionState, fd: FormData) {
  const u = await requireStaff();
  return run(() => saveSettings(u, { model: s(fd, 'model'), dailyQuestions: Number(s(fd, 'dailyQuestions')), dailyAiCalls: Number(s(fd, 'dailyAiCalls')), dailyVoiceTurns: Number(s(fd, 'dailyVoiceTurns')), duplicateThreshold: Number(s(fd, 'duplicateThreshold')), aiEnabled: fd.get('aiEnabled') === 'on', communityEnabled: fd.get('communityEnabled') === 'on', announceWinners: fd.get('announceWinners') === 'on', weeklyReward: s(fd, 'weeklyReward'), weeklyBonusXp: Number(s(fd, 'weeklyBonusXp') ?? 0) }), 'Settings saved.');
}
