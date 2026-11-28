import 'server-only';
import { getContent, type Content } from '../cms';
import { getRecordStore } from '../records';
import { kbArticles } from './collections';
import { liveView, syncStamp } from './service';
import { programsForAssistant } from '../studentLife/activities';
import { allSessions, typeLabel } from '../studentLife/sessions';
import { formatDate, todayIST } from '../dates';

/**
 * The website chatbot and voice agent answer from CMS content (lib/rag, lib/assistant). This adds the
 * Knowledge Hub's PUBLISHED, PUBLIC articles meant for the website or the bot, so they reach both agents
 * without a second knowledge base. The CMS editor keeps using getContent() unchanged, so these articles
 * are never written back into the CMS block.
 */
const CATEGORY: Record<string, Content['knowledgeBase']['items'][number]['category']> = { admission: 'admissions', student: 'academics', exams: 'academics', career: 'academics', parent: 'parents', events: 'campus', library: 'academics', core: 'other' };

let cached: { base: Content; stamp: string; out: Content } | null = null;

export async function botContent(): Promise<Content> {
  const [base, stamp] = await Promise.all([getContent(), syncStamp()]);
  // schedules change without a KB sync, so the cache also expires every 5 minutes
  const key = `:${Math.floor(Date.now() / 300_000)}`;
  if (cached && cached.base === base && cached.stamp === key) return cached.out;
  const extra: Content['knowledgeBase']['items'] = [];
  for (const r of await kbArticles.list(getRecordStore())) {
    const a = await liveView(r);
    if (!a || a.access !== 'public' || a.sensitivity !== 'public' || !(a.channels.includes('website') || a.channels.includes('bot'))) continue;
    extra.push({ title: a.title.en.slice(0, 140), body: a.body.en.slice(0, 4000), category: CATEGORY[a.centre] ?? 'other', audience: 'public', published: true });
  }
  extra.push(...(await scheduleItems().catch((e) => { console.error('[kb] schedule items failed', (e as Error).message); return []; })));
  const out: Content = extra.length ? { ...base, knowledgeBase: { ...base.knowledgeBase, items: [...base.knowledgeBase.items, ...extra] } } : base;
  cached = { base, stamp: key, out };
  return out;
}

/** Live, public schedule facts (no names of students, no attendance): yoga / wellness / practice classes and upcoming talks. */
async function scheduleItems(): Promise<Content['knowledgeBase']['items']> {
  const today = todayIST();
  const [programs, sessions] = await Promise.all([programsForAssistant(today), allSessions()]);
  const upcoming = sessions.filter((s) => s.date >= today && s.audience !== 'parents').slice(0, 8);
  const parents = sessions.filter((s) => s.date >= today && s.audience === 'parents').slice(0, 4);
  const out: Content['knowledgeBase']['items'] = [];
  if (programs.length) out.push({ title: 'Yoga, meditation, wellness and sports practice timetable', body: `Weekly classes students can register for in the BJC app (Yoga, wellness & practice):\n${programs.join('\n')}`, category: 'campus', audience: 'public', published: true });
  if (upcoming.length || parents.length) out.push({ title: 'Upcoming motivational talks, career guidance and parent seminars', body: [...upcoming, ...parents].map((s) => `${typeLabel(s.type)}: ${s.title} on ${formatDate(s.date, { day: 'numeric', month: 'short', year: 'numeric' })} at ${s.time}, ${s.venue ?? (s.onlineUrl ? 'online' : 'campus')}${s.audience === 'parents' ? ' (for parents)' : ''}. Register in the BJC app.`).join('\n'), category: 'campus', audience: 'public', published: true });
  return out;
}