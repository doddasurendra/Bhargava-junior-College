import 'server-only';
import { chapters, readiness } from './core';
import { aiConfigured } from './llm';
import { CATEGORIES, EXAMS, QTYPES } from './taxonomy';

/** Serializable exam / chapter lists for the client pickers, with "coming soon" readiness. */
export async function pickerOptions() {
  const [ready, chs] = await Promise.all([readiness(), chapters()]);
  return {
    exams: EXAMS.map((e) => ({ id: e.id, name: e.name, category: e.category, subjects: e.subjects, classes: e.classes, ready: !!ready.get(e.id)?.ready, note: e.pattern.note + (e.notice ? ` ${e.notice}` : ''), types: e.pattern.types.map((t) => ({ id: t, label: QTYPES.find((q) => q.id === t)!.label })) })),
    chapters: chs.map((c) => ({ subject: c.subject, cls: c.cls, name: c.name, concepts: c.concepts })),
    categories: CATEGORIES,
    ready,
    aiReady: aiConfigured(),
  };
}
