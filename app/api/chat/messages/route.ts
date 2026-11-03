import { z } from 'zod';
import { clientIp, fail, ok, parseBody, rateLimit } from '@/lib/api';
import { visitorPoll, visitorSend } from '@/lib/chat/service';

export const dynamic = 'force-dynamic';

const auth = { c: z.string().uuid(), t: z.string().min(20).max(64) };

/** Visitor polls for new messages: GET ?c=<conversation>&t=<token>&after=<iso> */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const parsed = z.object({ ...auth, after: z.string().datetime().nullable() }).safeParse({ c: p.get('c'), t: p.get('t'), after: p.get('after') });
  if (!parsed.success) return fail('Invalid request');
  if (!rateLimit(`chat-poll:${clientIp(req)}`, 120, 60_000)) return fail('Slow down', 429);
  const r = await visitorPoll(parsed.data.c, parsed.data.t, parsed.data.after);
  return r ? ok(r) : fail('Chat not found.', 404);
}

/** Visitor sends a message after the handoff. */
export async function POST(req: Request) {
  if (!rateLimit(`chat-send:${clientIp(req)}`, 30, 60_000)) return fail('Too many messages. Please wait a moment.', 429);
  const parsed = await parseBody(req, z.object({ ...auth, text: z.string().trim().min(1).max(1000) }));
  if ('spam' in parsed) return ok();
  if ('error' in parsed) return fail(parsed.error);
  const r = await visitorSend(parsed.data.c, parsed.data.t, parsed.data.text);
  return r.ok ? ok() : fail(r.error, 404);
}
