import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { MAX_FILE_BYTES } from '@/lib/kb/extract';
import { signedUpload } from '@/lib/kb/storage';

export const dynamic = 'force-dynamic';

/** A one-time signed URL to put a big file straight into Supabase Storage (staging key). */
export async function POST(req: Request) {
  const user = await getStaffSession();
  if (!user || !can(user, 'kb.edit') || user.viewedBy) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { size?: number };
  if (!body.size || body.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Files must be 50 MB or smaller.' }, { status: 400 });
  const key = `incoming/${user.id}/${randomUUID()}`;
  const s = await signedUpload(key).catch(() => null);
  if (!s) return NextResponse.json({ direct: false });
  return NextResponse.json({ direct: true, key, url: s.url });
}
