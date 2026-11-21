import { NextResponse } from 'next/server';
import { feedback } from '@/lib/kb/ai';
import { currentViewer } from '@/lib/kb/viewer';

export const dynamic = 'force-dynamic';

/** 👍/👎 on an answer: only the person who asked can rate it. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { convId?: string; index?: number; up?: boolean; comment?: string };
  if (typeof b.convId !== 'string' || typeof b.index !== 'number') return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await feedback(await currentViewer(), b.convId, b.index, !!b.up, typeof b.comment === 'string' ? b.comment : null);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
