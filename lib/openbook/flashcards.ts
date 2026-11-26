import 'server-only';
import { z } from 'zod';
import type { Staff } from '../crm/types';
import { todayIST } from '../dates';
import { obAttempts, obCards, obDecks } from './collections';
import { audit, canTeach, need, staffActor, store, useQuota } from './core';
import { AiNotConfigured, aiConfigured, callJson, S } from './llm';
import { getQuestions } from './questions';

/** Flashcards & revision (§19): SM-2 scheduling, decks, sharing with teacher approval. */
import { sm2, type Rating } from './sm2';
export { sm2, type Rating };

export async function decksOf(studentId: string, batchId: string | null) {
  const own = await obDecks.list(store(), { k1: studentId });
  const shared = batchId ? (await obDecks.list(store(), { k2: batchId })).filter((d) => d.data.shared && d.data.approved && d.data.ownerId !== studentId) : [];
  const cards = await obCards.list(store(), { k1: studentId });
  const today = todayIST();
  return [...own, ...shared].map((d) => {
    const cs = cards.filter((c) => c.data.deckId === d.id);
    return { id: d.id, ...d.data, mine: d.data.ownerId === studentId, cards: cs.length, due: cs.filter((c) => c.data.due <= today).length };
  });
}

export async function createDeck(ownerId: string, ownerKind: 'student' | 'staff', name: string, subject: string | null, chapter: string | null, batchId: string | null = null) {
  return (await obDecks.put(store(), { ownerId, ownerKind, name, subject, chapter, batchId, shared: false, approved: false })).id;
}

async function ensureDeck(studentId: string, name: string, subject: string | null, chapter: string | null) {
  const have = (await obDecks.list(store(), { k1: studentId })).find((d) => d.data.name === name);
  return have?.id ?? createDeck(studentId, 'student', name, subject, chapter);
}

export async function addCard(studentId: string, deckId: string, c: { kind: 'qa' | 'formula' | 'definition' | 'cloze' | 'diagram'; front: string; back: string; source: 'concept' | 'chapter' | 'passage' | 'note' | 'wrong_answer' | 'manual' | 'shared'; conceptKey?: string | null }) {
  const d = await obDecks.get(store(), deckId);
  need(d && d.data.ownerId === studentId, 'Deck not found.');
  return (await obCards.put(store(), { studentId, deckId, ...c, conceptKey: c.conceptKey ?? null, due: todayIST() })).id;
}

export async function dueCards(studentId: string, opts: { deckId?: string; mode?: 'quick' | 'exam' | 'weak'; limit?: number } = {}) {
  const today = todayIST();
  let cards = (await obCards.list(store(), opts.deckId ? { k1: studentId, k2: opts.deckId } : { k1: studentId })).map((c) => ({ id: c.id, ...c.data }));
  if (opts.mode === 'exam') cards = cards.sort((a, b) => a.ef - b.ef); // rapid revision: everything, hardest first
  else if (opts.mode === 'weak') cards = cards.filter((c) => c.lapses > 0 || c.ef < 2.2).sort((a, b) => a.ef - b.ef);
  else cards = cards.filter((c) => c.due <= today).sort((a, b) => a.due.localeCompare(b.due));
  return cards.slice(0, opts.limit ?? (opts.mode === 'quick' ? 10 : 50));
}
export async function dueCount(studentId: string) {
  const today = todayIST();
  return (await obCards.list(store(), { k1: studentId })).filter((c) => c.data.due <= today).length;
}

export async function rate(studentId: string, cardId: string, rating: Rating) {
  const c = await obCards.get(store(), cardId);
  need(c && c.data.studentId === studentId, 'Card not found.');
  const next = sm2(c!.data, rating, todayIST());
  await obCards.put(store(), { ...c!.data, ...next }, cardId);
  return next;
}

export async function removeCard(studentId: string, cardId: string) {
  const c = await obCards.get(store(), cardId);
  need(c && c.data.studentId === studentId, 'Card not found.');
  await obCards.remove(store(), cardId);
}

/** Cards from the student's wrong answers (no AI needed): question → correct answer and explanation. */
export async function cardsFromWrongAnswers(studentId: string) {
  const wrong = (await obAttempts.list(store(), { k1: studentId })).filter((a) => a.data.correct === false);
  const qs = await getQuestions([...new Set(wrong.map((w) => w.data.questionId))]);
  const deckId = await ensureDeck(studentId, 'My mistakes', null, null);
  const have = new Set((await obCards.list(store(), { k1: studentId, k2: deckId })).map((c) => c.data.front));
  let added = 0;
  for (const q of qs) {
    const front = (q.stem + (q.options.length ? '\n' + q.options.map((o, i) => `(${'abcd'[i] ?? i + 1}) ${o}`).join('\n') : '')).slice(0, 2000);
    if (have.has(front)) continue;
    const ans = q.answer.map((a) => (q.options.length && /^\d$/.test(a) ? `(${'abcd'[Number(a)]}) ${q.options[Number(a)]}` : a)).join(', ');
    await obCards.put(store(), { studentId, deckId, kind: 'qa', front, back: `${ans}${q.explanation ? `\n\n${q.explanation.explanation.slice(0, 3500)}` : ''}`.slice(0, 4000), source: 'wrong_answer', conceptKey: q.conceptKey, due: todayIST() });
    added++;
  }
  return { deckId, added };
}

const cardsSchema = S.obj({ cards: S.arr(S.obj({ kind: S.enum(['qa', 'formula', 'definition', 'cloze']), front: S.str(), back: S.str() })) });
const cardsValidate = z.object({ cards: z.array(z.object({ kind: z.enum(['qa', 'formula', 'definition', 'cloze']), front: z.string().min(1), back: z.string().min(1) })) });

/** AI flashcards from a concept, a chapter, a highlighted passage or a note. */
export async function aiCards(studentId: string, input: { source: 'concept' | 'chapter' | 'passage' | 'note'; subject: string; chapter: string; concept?: string; text?: string; count: number; deckName?: string; conceptKey?: string | null }) {
  if (!aiConfigured()) throw new AiNotConfigured();
  await useQuota(studentId, 'ai');
  const r = await callJson({
    system: 'You make exam revision flashcards for Bhargava Junior College students (TS Intermediate, JEE, NEET). Each card tests one fact, formula, definition or step. Fronts are short questions or cloze sentences with ____; backs are short, exact answers. Use plain text with Unicode symbols. Stay strictly within the given material.',
    parts: [{ kind: 'text', text: `Subject: ${input.subject}\nChapter: ${input.chapter}\n${input.concept ? `Concept: ${input.concept}\n` : ''}${input.text ? `Material (use only this):\n${input.text.slice(0, 12000)}\n` : ''}Make ${Math.min(30, input.count)} cards: a mix of question/answer, formula, definition and fill-in-the-blank.` }],
    jsonSchema: cardsSchema, validate: cardsValidate, effort: 'low', maxTokens: 8000,
  });
  const deckId = await ensureDeck(studentId, input.deckName ?? `${input.subject} · ${input.chapter}`, input.subject, input.chapter);
  for (const c of r.data.cards) await obCards.put(store(), { studentId, deckId, kind: c.kind, front: c.front.slice(0, 2000), back: c.back.slice(0, 4000), source: input.source, conceptKey: input.conceptKey ?? null, due: todayIST() });
  return { deckId, added: r.data.cards.length };
}

/** Share a deck with the batch; it becomes visible after teacher approval. */
export async function shareDeck(studentId: string, deckId: string, batchId: string) {
  const d = await obDecks.get(store(), deckId);
  need(d && d.data.ownerId === studentId, 'Deck not found.');
  await obDecks.put(store(), { ...d!.data, batchId, shared: true, approved: false }, deckId);
}
export async function pendingDecks() {
  return (await obDecks.list(store())).filter((d) => d.data.shared && !d.data.approved).map((d) => ({ id: d.id, ...d.data }));
}
export async function approveDeck(u: Staff, deckId: string, approve: boolean) {
  need(canTeach(u));
  const d = await obDecks.get(store(), deckId);
  need(d, 'Deck not found.');
  await obDecks.put(store(), { ...d!.data, approved: approve, shared: approve }, deckId);
  await audit(staffActor(u), approve ? 'deck.approve' : 'deck.reject', deckId);
}

/** A student copies an approved shared deck into their own schedule. */
export async function copySharedDeck(studentId: string, deckId: string) {
  const d = await obDecks.get(store(), deckId);
  need(d && d.data.shared && d.data.approved, 'Deck not found.');
  const src = await obCards.list(store(), { k2: deckId });
  const mine = await createDeck(studentId, 'student', `${d!.data.name} (shared)`, d!.data.subject, d!.data.chapter);
  for (const c of src) await obCards.put(store(), { ...c.data, studentId, deckId: mine, source: 'shared', ef: 2.5, interval: 0, reps: 0, lapses: 0, due: todayIST() });
  return { deckId: mine, added: src.length };
}

/** Cards due in the next `days` days, for offline review on the phone (text cards only). */
export async function cardsForOffline(studentId: string, days = 14) {
  const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  return (await obCards.list(store(), { k1: studentId })).filter((c) => c.data.due <= until && !c.data.imageKey).slice(0, 300).map((c) => ({ id: c.id, front: c.data.front, back: c.data.back, kind: c.data.kind, ef: c.data.ef, interval: c.data.interval, reps: c.data.reps, lapses: c.data.lapses, due: c.data.due }));
}

/**
 * Image-occlusion (diagram label) cards: one card per labelled box. The front shows the diagram with every
 * label hidden and the asked one highlighted; the back reveals it with the label text.
 */
export async function occlusionCards(studentId: string, input: { deckName: string; subject: string | null; image: { bytes: Uint8Array; mime: string }; boxes: { x: number; y: number; w: number; h: number; label: string }[] }) {
  need(/^image\/(png|jpe?g|webp)$/.test(input.image.mime), 'Upload the diagram as a PNG or JPG image.');
  need(input.image.bytes.length <= 5 * 1024 * 1024, 'Diagrams can be up to 5 MB.');
  const boxes = input.boxes.filter((b) => b.label.trim() && b.w > 0.005 && b.h > 0.005).slice(0, 40);
  need(boxes.length > 0, 'Draw at least one box over a label and type its answer.');
  const { putFile } = await import('./core');
  const imageKey = await putFile('card', input.image.bytes, input.image.mime);
  const decks = await obDecks.list(store(), { k1: studentId });
  const deckId = decks.find((d) => d.data.name === input.deckName)?.id ?? (await createDeck(studentId, 'student', input.deckName, input.subject, null));
  const masks = boxes.map(({ x, y, w, h }) => ({ x: clamp(x), y: clamp(y), w: clamp(w), h: clamp(h) }));
  for (let i = 0; i < boxes.length; i++) {
    await obCards.put(store(), { studentId, deckId, kind: 'diagram', front: `Label ${i + 1} on the diagram: what is it?`, back: boxes[i].label.trim().slice(0, 4000), imageKey, source: 'manual', masks, target: i, due: todayIST() });
  }
  return { deckId, added: boxes.length };
}
const clamp = (n: number) => Math.max(0, Math.min(1, Math.round(n * 10000) / 10000));
