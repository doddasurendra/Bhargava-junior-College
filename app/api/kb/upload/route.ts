import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import type { Level, Sensitivity } from '@/lib/kb/access';
import { CHANNELS } from '@/lib/kb/collections';
import { uploadFile } from '@/lib/kb/files';
import { KbError } from '@/lib/kb/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Multipart upload (≤ 4.5 MB per request on Vercel; larger files use /api/kb/upload/sign). Staff with kb.edit only. */
export async function POST(req: Request) {
  const user = await getStaffSession();
  if (!user || !can(user, 'kb.edit') || user.viewedBy) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 });
  }
  const str = (k: string) => (typeof fd.get(k) === 'string' && (fd.get(k) as string).trim() ? (fd.get(k) as string).trim() : null);
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 20);
  if (!files.length) return NextResponse.json({ error: 'Choose at least one file.' }, { status: 400 });
  const meta = { titleEn: files.length === 1 ? str('titleEn') : null, centre: str('centre') ?? 'student', topic: str('topic'), access: (str('access') ?? 'faculty') as Level, sensitivity: (str('sensitivity') ?? 'internal') as Sensitivity, channels: CHANNELS.filter((c) => fd.get(`ch_${c}`) === 'on'), reviewBy: str('reviewBy') };
  const ok: string[] = [];
  const bad: string[] = [];
  for (const f of files) {
    try {
      const r = await uploadFile(user, f.name, new Uint8Array(await f.arrayBuffer()), meta);
      ok.push(`${f.name} (${r.data.extract.status === 'ok' ? `${r.data.extract.pages} ${r.data.extract.pages === 1 ? 'page' : 'pages'} of text` : r.data.extract.status.replace('_', ' ')})`);
    } catch (e) {
      bad.push(e instanceof KbError ? e.message : `${f.name}: upload failed`);
      if (!(e instanceof KbError)) console.error('[kb upload]', e);
    }
  }
  if (!ok.length) return NextResponse.json({ ok: false, error: bad.join(' · ') }, { status: 422 });
  return NextResponse.json({ ok: true, message: `Uploaded as drafts: ${ok.join(', ')}.${bad.length ? ` Not uploaded: ${bad.join(' · ')}` : ''}` });
}
