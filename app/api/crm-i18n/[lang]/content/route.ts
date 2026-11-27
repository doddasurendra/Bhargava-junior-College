import { getStaffSession } from '@/lib/crm/auth';
import { kbCategories } from '@/lib/kb/collections';
import { getRecordStore } from '@/lib/records';
import { listArticles, staffViewer } from '@/lib/kb/service';

/**
 * Translations that come from the college's own trilingual content (Knowledge Hub article and category titles
 * entered in English / Telugu / Hindi). Staff only, and only the articles this person may read, so restricted
 * titles never leave the server for anyone else. Not cached publicly.
 */
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: { lang: string } }) {
  if (params.lang !== 'te' && params.lang !== 'hi') return new Response('Unknown language', { status: 404 });
  const user = await getStaffSession();
  if (!user) return new Response('Sign in first.', { status: 401 });
  const lang = params.lang;
  const exact: Record<string, string> = {};
  const add = (t: { en: string; te?: string | null; hi?: string | null } | undefined) => { const v = t?.[lang]; if (t?.en && v) exact[t.en.replace(/\s+/g, ' ').trim()] = v; };
  try {
    const items = await listArticles(await staffViewer(user), { status: 'all' });
    for (const x of items) { add(x.a.title); if (x.live) add(x.live.title); }
    for (const c of await kbCategories.list(getRecordStore())) add((c.data as { name?: { en: string; te?: string | null; hi?: string | null } }).name);
  } catch { /* content translations are optional; the static dictionary still applies */ }
  return Response.json({ exact, patterns: [] }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
