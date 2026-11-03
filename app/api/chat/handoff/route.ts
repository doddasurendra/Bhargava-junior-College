import { z } from 'zod';
import { clientIp, deviceFromUA, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { startWebHandoff } from '@/lib/chat/service';
import { attributionSchema, phoneSchema } from '@/lib/validation';

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  phone: phoneSchema,
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree to be contacted so a counsellor can reply' }) }),
  question: z.string().trim().max(1000).optional(),
  transcript: z.array(z.object({ from: z.enum(['user', 'bot']), text: z.string().max(1500) })).max(40).default([]),
  attribution: attributionSchema,
});

/** Website widget "Talk to a counsellor": creates the lead and the conversation, returns a visitor token. */
export async function POST(req: Request) {
  if (!rateLimit(`chat-handoff:${clientIp(req)}`, 5, 10 * 60_000)) return fail('Too many requests. Please call us instead.', 429);
  const parsed = await parseBody(req, schema);
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const d = parsed.data;
  try {
    const r = await startWebHandoff({ ...d, question: d.question || null, attribution: { ...d.attribution, device: d.attribution?.device ?? deviceFromUA(req) } });
    return ok(r);
  } catch (e) {
    console.error('[chat] handoff failed', (e as Error).message);
    return fail('Could not reach a counsellor. Please call us.', 500);
  }
}
