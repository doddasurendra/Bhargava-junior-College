import { z } from 'zod';
import { rate } from '@/lib/openbook/flashcards';
import { whoIsAsking } from '@/lib/openbook/session';

export const dynamic = 'force-dynamic';

const body = z.object({ ratings: z.array(z.object({ cardId: z.string().max(80), rating: z.enum(['again', 'hard', 'good', 'easy']), at: z.string().max(40) })).max(500) });

/** Applies ratings made offline, in the order they were made. Only the signed-in student's own cards. */
export async function POST(req: Request) {
  const { studentId } = await whoIsAsking();
  if (!studentId) return Response.json({ error: 'Sign in as a student.' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 });
  let applied = 0;
  for (const r of [...parsed.data.ratings].sort((a, b) => a.at.localeCompare(b.at))) {
    try { await rate(studentId, r.cardId, r.rating); applied++; } catch { /* a card deleted meanwhile is skipped */ }
  }
  return Response.json({ applied });
}
