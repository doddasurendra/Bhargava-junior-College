import { NextResponse } from 'next/server';
import { deleteHistory } from '@/lib/kb/ai';
import { currentViewer } from '@/lib/kb/viewer';

export const dynamic = 'force-dynamic';

/** The signed-in person deletes their own AI history. */
export async function DELETE(req: Request) {
  const surface = new URL(req.url).searchParams.get('surface') === 'app' ? 'app' : 'auto';
  const v = await currentViewer(surface);
  if (v.kind === 'public') return NextResponse.json({ ok: false }, { status: 401 });
  await deleteHistory(v);
  return NextResponse.json({ ok: true });
}
