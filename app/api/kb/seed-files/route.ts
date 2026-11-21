import { NextResponse } from 'next/server';
import { cronAuthorised } from '@/lib/cron';
import { kbFiles, kbFileText } from '@/lib/kb/collections';
import { putKbFile, readKbFile } from '@/lib/kb/storage';
import { getRecordStore } from '@/lib/records';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * One-off helper (CRON_SECRET only): puts the files of the seeded demo documents (ids demo-kb-*) into the
 * kb-files bucket when they are missing. The brochure comes from the site's own /docs folder; the small sample
 * text/CSV documents are rebuilt from their stored text. Never touches real (non-demo) documents.
 */
export async function POST(req: Request) {
  if (!cronAuthorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const st = getRecordStore();
  const origin = new URL(req.url).origin;
  const done: string[] = [];
  const skipped: string[] = [];
  for (const f of await kbFiles.list(st)) {
    if (!f.id.startsWith('demo-kb-')) continue;
    if (await readKbFile(f.data.storageKey)) {
      skipped.push(`${f.data.name} (already stored)`);
      continue;
    }
    let bytes: Uint8Array | null = null;
    if (f.data.kind === 'pdf') {
      const r = await fetch(`${origin}/docs/${encodeURIComponent(f.data.name)}`);
      if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
    } else {
      const t = (await kbFileText.get(st, `${f.id}:${f.data.version}`))?.data;
      if (t) bytes = new TextEncoder().encode(t.pages.join('\n').replace(/\t/g, f.data.kind === 'csv' ? ',' : '\t'));
    }
    if (!bytes) {
      skipped.push(`${f.data.name} (no source)`);
      continue;
    }
    await putKbFile(f.data.storageKey, bytes, f.data.mime);
    done.push(`${f.data.name} (${bytes.length} bytes)`);
  }
  return NextResponse.json({ ok: true, uploaded: done, skipped });
}
