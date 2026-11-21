import 'server-only';
import { getContent, type Content } from '../cms';
import { getRecordStore } from '../records';
import { kbArticles } from './collections';
import { liveView, syncStamp } from './service';

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
  const key = stamp.stamp ?? '0';
  if (cached && cached.base === base && cached.stamp === key) return cached.out;
  const extra: Content['knowledgeBase']['items'] = [];
  for (const r of await kbArticles.list(getRecordStore())) {
    const a = await liveView(r);
    if (!a || a.access !== 'public' || a.sensitivity !== 'public' || !(a.channels.includes('website') || a.channels.includes('bot'))) continue;
    extra.push({ title: a.title.en.slice(0, 140), body: a.body.en.slice(0, 4000), category: CATEGORY[a.centre] ?? 'other', audience: 'public', published: true });
  }
  const out: Content = extra.length ? { ...base, knowledgeBase: { ...base.knowledgeBase, items: [...base.knowledgeBase.items, ...extra] } } : base;
  cached = { base, stamp: key, out };
  return out;
}
