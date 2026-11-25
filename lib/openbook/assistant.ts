import 'server-only';
import { z } from 'zod';
import { screenText } from '../studentLife/wellbeing';
import { obBookPages, obBooks, obMockAttempts, obSessions } from './collections';
import { need, OpenBookError, store, useQuota } from './core';
import { aiConfigured, callJson, S } from './llm';
import { tokens } from './text';

/**
 * AI Study Assistant (§10), Smart Reader AI actions (§17) and the Voice Tutor brain (§21).
 * Answers are grounded: passages are retrieved from Open Book's extracted book pages and every answer lists
 * its sources (book + page). If the sources don't cover the question the assistant says so. Without
 * ANTHROPIC_API_KEY it returns the best matching passages verbatim (a grounded extract), clearly labelled.
 * Every message a student types is screened by the existing wellbeing safety protocol.
 */
export type Lang = 'en' | 'te' | 'hi';
const LANG_NAME: Record<Lang, string> = { en: 'English', te: 'Telugu', hi: 'Hindi' };
export interface Source { label: string; bookId: string | null; page: number | null }
export interface Passage { bookId: string; title: string; page: number; text: string; score: number }

/** Lexical retrieval over approved books' pages (optionally one book), best passages first. */
export async function retrieve(question: string, opts: { bookId?: string | null; k?: number } = {}): Promise<Passage[]> {
  const q = [...new Set(tokens(question).filter((t) => t.length > 2))];
  if (!q.length) return [];
  const books = (await obBooks.list(store())).filter((b) => b.data.status === 'approved' && b.data.textStatus === 'extracted' && (!opts.bookId || b.id === opts.bookId));
  const out: Passage[] = [];
  for (const b of books) {
    for (const p of await obBookPages.list(store(), { k1: b.id })) {
      const t = p.data.text.toLowerCase();
      let score = 0;
      for (const w of q) { const n = t.split(w).length - 1; if (n) score += 1 + Math.log(n); }
      if (score > 0) out.push({ bookId: b.id, title: b.data.title, page: p.data.page, text: p.data.text, score: score / q.length });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.k ?? 5);
}

const ansSchema = S.obj({ answer: S.str(), found: S.bool(), sources: S.arr(S.obj({ passage: S.int(), page: S.int() })) });
const ansValidate = z.object({ answer: z.string(), found: z.boolean(), sources: z.array(z.object({ passage: z.number(), page: z.number() })) });

export type Task = 'answer' | 'explain' | 'summarize' | 'notes' | 'revision' | 'mindmap' | 'simplify' | 'translate' | 'formulas' | 'page_questions' | 'tutor_explain' | 'tutor_quiz' | 'tutor_socratic' | 'tutor_page';
const TASK: Record<Task, string> = {
  answer: 'Answer the student\'s question.',
  explain: 'Explain this clearly for an Intermediate / JEE / NEET student, step by step, with an example.',
  summarize: 'Summarise the chapter or pages: key ideas in order, then the must-remember points.',
  notes: 'Write concise study notes with headings, bullet points, definitions and formulas.',
  revision: 'Write last-minute revision notes: only the facts, formulas and traps most likely to be tested.',
  mindmap: 'Make a mind map as an indented outline ("- " bullets, 2 spaces per level): the central topic first, then branches and sub-branches.',
  simplify: 'Rewrite the selected passage in much simpler words for a student who found it hard. Keep every fact.',
  translate: 'Translate the selected passage faithfully. Keep formulas, symbols and technical terms (add the English term in brackets the first time).',
  formulas: 'List the key formulas and important definitions on these pages, each with a one-line meaning of its symbols.',
  page_questions: 'Write 5 practice questions (with short answers) strictly from these pages.',
  tutor_explain: 'You are a friendly voice tutor. Explain the concept conversationally in short spoken sentences (no lists, no symbols that can\'t be read aloud). End by checking understanding with one short question.',
  tutor_quiz: 'You are a voice tutor running an oral quiz. If the student just answered, tell them if they are right, explain briefly, then ask the next short question. Otherwise ask the first question. One question at a time.',
  tutor_socratic: 'You are a Socratic tutor. Do NOT give the answer. Ask one guiding question at a time that leads the student to work it out. Acknowledge what they got right.',
  tutor_page: 'You are a voice tutor reading and discussing a page with the student. Explain what the page says in simple spoken language and invite questions.',
};

export interface AskInput { studentId: string; task: Task; question: string; lang: Lang; bookId?: string | null; pages?: number[]; selection?: string | null; sessionId?: string | null; kind?: 'assistant' | 'tutor' | 'reader' }

async function passagesFor(i: AskInput): Promise<Passage[]> {
  if (i.bookId && i.pages?.length) {
    const b = await obBooks.get(store(), i.bookId);
    need(b && b.data.status === 'approved', 'Book not found.');
    const rows = await obBookPages.list(store(), { k1: i.bookId });
    return rows.filter((r) => i.pages!.includes(r.data.page)).map((r) => ({ bookId: i.bookId!, title: b!.data.title, page: r.data.page, text: r.data.text, score: 1 }));
  }
  return retrieve(i.question + ' ' + (i.selection ?? ''), { bookId: i.bookId, k: 5 });
}

/** Refuses help during a live mock exam (the tutor must not do graded work for the student). */
async function inLiveExam(studentId: string) {
  const now = Date.now();
  return (await obMockAttempts.list(store(), { k1: studentId })).some((a) => a.data.status === 'in_progress' && Date.parse(a.data.endsAt) > now);
}

export async function ask(i: AskInput): Promise<{ answer: string; sources: Source[]; mode: 'ai' | 'extract' | 'safety'; found: boolean; sessionId: string }> {
  need(i.question.trim() || i.selection?.trim(), 'Type a question or select some text.');
  const text = [i.question, i.selection].filter(Boolean).join(' ');
  const safety = await screenText('chat', `openbook:${i.studentId}:${Date.now()}`, i.studentId, text).catch(() => null);
  if (safety) { const msg = [safety.message, ...safety.helplines.map((h) => `: `)].join('\n'); return { answer: msg, sources: [], mode: 'safety', found: true, sessionId: await log(i, msg, []) }; }
  if (i.task.startsWith('tutor') && (await inLiveExam(i.studentId))) throw new OpenBookError('You have a mock test running. The tutor is paused until you submit it.');
  const passages = await passagesFor(i);
  if (!aiConfigured()) {
    if (i.task === 'translate' || i.task === 'simplify' || i.task === 'mindmap' || i.task.startsWith('tutor')) throw new (await import('./llm')).AiNotConfigured();
    const top = passages.slice(0, 3);
    const answer = top.length ? `AI answers are not configured yet, so here are the most relevant passages from Open Book:\n\n${top.map((p) => `“${p.text.replace(/\s+/g, ' ').slice(0, 600)}…” (${p.title}, p. ${p.page})`).join('\n\n')}` : 'This is not in the Open Book sources available to me, and AI answers are not configured yet. Try different words or ask your teacher.';
    const sources = top.map((p) => ({ label: `${p.title}, p. ${p.page}`, bookId: p.bookId, page: p.page }));
    return { answer, sources, mode: 'extract', found: top.length > 0, sessionId: await log(i, answer, sources) };
  }
  await useQuota(i.studentId, i.task.startsWith('tutor') ? 'voice' : 'ai');
  const history = i.sessionId ? (await obSessions.get(store(), i.sessionId))?.data.turns.slice(-8) ?? [] : [];
  const r = await callJson({
    system: `You are Open Book AI for Bhargava Junior College students (ages 15–18). ${TASK[i.task]}
Use ONLY the numbered source passages below for facts. If they do not contain the answer, set "found" to false and say clearly that it is not in the Open Book sources (you may then give a brief general explanation, labelled "General explanation (not from your books):"). Cite every passage you used in "sources" with its number and page.
Reply in ${LANG_NAME[i.lang]} (keep formulas and symbols). Plain text. Age-appropriate. Never write a student's graded homework or exam answers for them; teach instead. If the student mentions self-harm, abuse or feeling unsafe, tell them kindly to speak to the college counsellor or a trusted adult now.`,
    parts: [{ kind: 'text', text: `${passages.length ? passages.map((p, n) => `[${n + 1}] ${p.title}, page ${p.page}:\n${p.text.slice(0, 4000)}`).join('\n\n') : '(no passages found)'}\n\n${history.length ? `Conversation so far:\n${history.map((t) => `${t.role === 'user' ? 'Student' : 'Tutor'}: ${t.text.slice(0, 600)}`).join('\n')}\n\n` : ''}${i.selection ? `Selected passage:\n"""${i.selection.slice(0, 6000)}"""\n\n` : ''}Student: ${i.question || '(see the selected passage)'}` }],
    jsonSchema: ansSchema, validate: ansValidate, effort: i.task.startsWith('tutor') ? 'low' : 'medium', maxTokens: 8000,
  });
  const sources = r.data.sources.map((s) => passages[s.passage - 1]).filter(Boolean).map((p) => ({ label: `${p.title}, p. ${p.page}`, bookId: p.bookId, page: p.page }));
  const uniq = sources.filter((s, n) => sources.findIndex((x) => x.label === s.label) === n);
  return { answer: r.data.answer, sources: uniq, mode: 'ai', found: r.data.found, sessionId: await log(i, r.data.answer, uniq) };
}

async function log(i: AskInput, answer: string, sources: Source[]) {
  const now = new Date().toISOString();
  const prev = i.sessionId ? await obSessions.get(store(), i.sessionId) : null;
  const kind = i.kind ?? (i.task.startsWith('tutor') ? 'tutor' : 'assistant');
  const turns = [...(prev && prev.data.studentId === i.studentId ? prev.data.turns : []), { role: 'user' as const, text: (i.question || `[${i.task}] ${i.selection ?? ''}`).slice(0, 12000), sources: [], at: now }, { role: 'assistant' as const, text: answer.slice(0, 12000), sources, at: now }].slice(-200);
  const r = await obSessions.put(store(), { studentId: i.studentId, kind, title: (prev?.data.title ?? (i.question || i.task)).slice(0, 200), lang: i.lang, mode: i.task, turns }, prev && prev.data.studentId === i.studentId ? prev.id : undefined);
  return r.id;
}

export async function sessionsOf(studentId: string, kind?: 'assistant' | 'tutor' | 'reader' | 'scanner' | 'generator') {
  return (await obSessions.list(store(), kind ? { k1: studentId, k2: kind } : { k1: studentId })).map((s) => ({ id: s.id, updatedAt: s.updatedAt, ...s.data })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getSession(studentId: string, id: string) {
  const s = await obSessions.get(store(), id);
  need(s && s.data.studentId === studentId, 'Conversation not found.');
  return { id: s!.id, ...s!.data };
}
/** The student deletes a transcript (DPDP right to erasure). */
export async function deleteSession(studentId: string, id: string) {
  const s = await obSessions.get(store(), id);
  need(s && s.data.studentId === studentId, 'Conversation not found.');
  await obSessions.remove(store(), id);
}
