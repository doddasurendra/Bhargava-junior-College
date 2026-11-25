import { randomUUID } from 'node:crypto';
import { signedUpload } from '@/lib/kb/storage';
import { whoIsAsking } from '@/lib/openbook/session';

export const dynamic = 'force-dynamic';

/**
 * Large uploads (books, papers over ~4 MB): Vercel caps a request at 4.5 MB, so the browser uploads straight to
 * private Supabase Storage with a one-time signed URL. The key is tied to the uploader; the server action that
 * finishes the upload only accepts keys under the uploader's own staging prefix.
 */
export async function POST() {
  const { studentId, staff } = await whoIsAsking();
  const who = staff?.id ?? studentId;
  if (!who) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const key = `openbook/staging/${who}/${randomUUID()}`;
  const s = await signedUpload(key).catch(() => null);
  if (!s) return Response.json({ direct: false }); // local development: send the file with the form
  return Response.json({ direct: true, key, url: s.url });
}
