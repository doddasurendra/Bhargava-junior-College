import { z } from 'zod';
import { clientIp, deviceFromUA, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { assistantTurn } from '@/lib/assistant/session';
import { detectLang } from '@/lib/rag';
import { toSpeech } from '@/lib/voice/speech';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  c: z.string().uuid().optional(),
  t: z.string().min(20).max(64).optional(),
  text: z.string().trim().min(1).max(600),
  /** language the visitor chose / was recognised in */
  lang: z.enum(['en', 'te', 'hi']).optional(),
});

/**
 * Voice agent turn (separate endpoint and session from the chat agent). The visitor's recognised speech goes
 * through the same assistant + shared BJC knowledge base; the answer comes back as speakable text.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`voice:${ip}`, 20, 60_000) || !rateLimit(`voice-hour:${ip}`, 150, 60 * 60_000)) return fail('Too many questions. Please wait a moment, or call the college.', 429);
  const parsed = await parseBody(req, schema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const d = parsed.data;
  const started = Date.now();
  const r = await assistantTurn({ c: d.c, t: d.t, text: d.text, attribution: { device: deviceFromUA(req), page: '/voice-assistant' } as never });
  if ('error' in r) return fail(r.error, r.status);
  const lang = d.lang ?? detectLang(d.text);
  return ok({ c: r.c, t: r.t, speech: toSpeech(r.reply), caption: r.reply, lang, sources: r.links, fallback: r.fallback, ms: Date.now() - started });
}
