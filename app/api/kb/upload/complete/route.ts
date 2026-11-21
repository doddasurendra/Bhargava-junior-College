import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import type { Level, Sensitivity } from '@/lib/kb/access';
import { CHANNELS } from '@/lib/kb/collections';
import { uploadFile } from '@/lib/kb/files';
import { KbError } from '@/lib/kb/service';
import { readKbFile, removeKbFile } from '@/lib/kb/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** After a signed direct upload: read the staged object, run the normal checks/ingest, delete the staging copy. */
export async function POST(req: Request) {
  const user = await getStaffSession();
  if (!user || !can(user, 'kb.edit') || user.viewedBy) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, string | string[] | undefined>;
  const key = typeof b.key === 'string' ? b.key : '';
  // only the uploader's own staging area
  if (!key.startsWith(`incoming/${user.id}/`) || key.includes('..')) return NextResponse.json({ error: 'Bad upload key.' }, { status: 400 });
  const bytes = await readKbFile(key);
  if (!bytes) return NextResponse.json({ error: 'The uploaded file was not found.' }, { status: 404 });
  try {
    const str = (k: string) => (typeof b[k] === 'string' && (b[k] as string).trim() ? (b[k] as string).trim() : null);
    const r = await uploadFile(user, str('name') ?? 'document', bytes, { titleEn: str('titleEn'), centre: str('centre') ?? 'student', topic: str('topic'), access: (str('access') ?? 'faculty') as Level, sensitivity: (str('sensitivity') ?? 'internal') as Sensitivity, channels: CHANNELS.filter((c) => (b.channels as string[] | undefined)?.includes(c)), reviewBy: str('reviewBy') });
    return NextResponse.json({ ok: true, message: `Uploaded “${r.data.title.en}” as a draft (${r.data.extract.status === 'ok' ? `${r.data.extract.pages} pages of text` : r.data.extract.status.replace('_', ' ')}).` });
  } catch (e) {
    if (!(e instanceof KbError)) console.error('[kb upload complete]', e);
    return NextResponse.json({ ok: false, error: e instanceof KbError ? e.message : 'Upload failed.' }, { status: 422 });
  } finally {
    await removeKbFile(key);
  }
}
