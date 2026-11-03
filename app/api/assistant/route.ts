import { z } from 'zod';
import { clientIp, deviceFromUA, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { assistantTurn, giveConsent } from '@/lib/assistant/session';
import { attributionSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  c: z.string().uuid().optional(),
  t: z.string().min(20).max(64).optional(),
  text: z.string().trim().min(1).max(1000).optional(),
  /** the visitor tapped "I agree" */
  consent: z.literal(true).optional(),
  attribution: attributionSchema,
});

/** Website chat turn with the AI admission assistant. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`assistant:${ip}`, 20, 60_000) || !rateLimit(`assistant-hour:${ip}`, 120, 60 * 60_000)) return fail('Too many messages. Please wait a moment, or call us.', 429);
  const parsed = await parseBody(req, schema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const d = parsed.data;

  if (d.consent) {
    if (!d.c || !d.t || !(await giveConsent(d.c, d.t))) return fail('Chat not found.', 404);
    if (!d.text) return ok({ consent: true });
  }
  if (!d.text) return fail('Type a message.');

  const r = await assistantTurn({ c: d.c, t: d.t, text: d.text, attribution: { ...d.attribution, device: d.attribution?.device ?? deviceFromUA(req) } });
  if ('error' in r) return fail(r.error, r.status);
  return ok({ ...r });
}
