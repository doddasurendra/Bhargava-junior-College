import 'server-only';
import { obCards, obNotes, obQuestions } from './collections';
import { chapters, store } from './core';
import { masteryOf } from './mastery';
import { normalize } from './text';
import { slug } from './taxonomy';

/**
 * Chapter formula sheet & revision notes (§19), printable to PDF. Built only from real records:
 * formulas in the explanations of approved/own questions, general formulas found in worked solutions,
 * the student's formula and definition flashcards, their revision list and their weak concepts.
 */
const GENERAL = /([A-Za-zα-ωΑ-ΩΔ∆′'²³√()\s·×/^+\-−_]{1,40}?)\s=\s([−\-]?[A-Za-zα-ωΑ-ΩΔ∆√(][^,;.\n]{0,60})/g;

/** General formulas (right-hand side starts with a symbol, not a number) found in a solution text. */
export function generalFormulas(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(GENERAL)) {
    const lhs = m[1].trim(), rhs = m[2].split(/\s=\s/)[0].trim();
    if (lhs.length < 1 || /\d{2,}/.test(rhs) || !/[A-Za-zα-ωΔ√]/.test(rhs)) continue;
    out.push(`${lhs} = ${rhs}`.replace(/\s+/g, ' '));
  }
  return out;
}

export async function formulaSheet(studentId: string, subject: string, chapter: string) {
  const prefix = `${slug(subject)}/${slug(chapter)}/`;
  const [qs, cards, notes, mastery, chs] = await Promise.all([obQuestions.list(store()), obCards.list(store(), { k1: studentId }), obNotes.list(store(), { k1: studentId }), masteryOf(studentId), chapters()]);
  const mine = qs.filter((q) => q.data.subject === subject && q.data.chapter === chapter && (q.data.status === 'approved' || q.data.ownerId === studentId));
  const seen = new Set<string>();
  const formulas: { text: string; concept: string }[] = [];
  const add = (t: string, concept: string) => { const k = normalize(t); if (t.length >= 3 && t.length <= 160 && !seen.has(k)) { seen.add(k); formulas.push({ text: t, concept }); } };
  for (const q of mine) {
    for (const f of q.data.explanation?.formulas ?? []) add(f, q.data.concept);
    for (const f of generalFormulas(`${q.data.explanation?.explanation ?? ''}\n${(q.data.explanation?.steps ?? []).join('\n')}`)) add(f, q.data.concept);
  }
  const myCards = cards.filter((c) => (c.data.conceptKey ?? '').startsWith(prefix) || false).concat(cards.filter((c) => !c.data.conceptKey && (c.data.kind === 'formula' || c.data.kind === 'definition') && normalize(`${c.data.front} ${c.data.back}`).includes(normalize(chapter).split(' ')[0])));
  const definitions = myCards.filter((c) => c.data.kind === 'definition' || c.data.kind === 'formula').map((c) => ({ term: c.data.front, meaning: c.data.back }));
  const ch = chs.find((c) => c.subject === subject && c.name === chapter);
  return {
    subject, chapter, concepts: ch?.concepts ?? [], formulas: formulas.sort((a, b) => a.concept.localeCompare(b.concept)), definitions,
    weak: mastery.filter((m) => m.subject === subject && m.chapter === chapter && !m.mastered && m.attempts > 0).map((m) => ({ concept: m.concept, score: Math.round(m.score), attempts: m.attempts })),
    revisionList: notes.filter((n) => n.data.revision || n.data.note).map((n) => ({ text: n.data.text, note: n.data.note, page: n.data.page, bookId: n.data.bookId })).slice(0, 40),
    basis: `${mine.length} questions with worked solutions, ${myCards.length} of your cards`,
  };
}
