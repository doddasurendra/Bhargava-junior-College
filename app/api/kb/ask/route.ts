import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { answer, ASSISTANTS, type AssistantId } from '@/lib/kb/ai';
import { viewerKey } from '@/lib/kb/access';
import { allow, LIMITS } from '@/lib/kb/rate';
import { currentViewer } from '@/lib/kb/viewer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** "Ask your college AI" for every surface. The viewer comes from the session, never from the request body. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { q?: string; assistant?: string; surface?: 'staff' | 'app' };
  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 1000) : '';
  if (!q) return NextResponse.json({ error: 'Type a question.' }, { status: 400 });
  const v = await currentViewer(body.surface === 'app' ? 'app' : 'auto');
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const key = v.kind === 'public' ? `ai:ip:${ip}` : `ai:${viewerKey(v)}`;
  if (!allow(key, LIMITS[v.kind].ai)) return NextResponse.json({ error: 'Too many questions in a minute. Please wait a moment.' }, { status: 429 });
  const assistant = (ASSISTANTS as readonly string[]).includes(body.assistant ?? '') ? (body.assistant as AssistantId) : 'public';
  try {
    return NextResponse.json(await answer(v, assistant, q));
  } catch (e) {
    console.error('[kb ask]', e);
    return NextResponse.json({ error: 'The assistant could not answer right now.' }, { status: 500 });
  }
}
