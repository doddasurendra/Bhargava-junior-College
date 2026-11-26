// Open Book weekly link checker (§2 "Edge Function + pg_cron"). Scheduled by pg_cron (job
// 'openbook-link-check', Sundays 03:00 UTC) through pg_net. It checks every official source in the
// `records` table (collection ob_sources), stores status / HTTP code / final URL / date, and logs a summary
// to ob_audit for admins (Open Book → Official sources). Only the pg_cron job may run it: it sends the Vault
// secret 'ob_cron_secret', which this function reads through public.ob_cron_secret() (service role only).
import { createClient } from 'npm:@supabase/supabase-js@2';

type Result = { status: string; httpStatus: number | null; finalUrl: string | null; note: string | null };

async function check(url: string): Promise<Result> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BJC-OpenBook-LinkChecker/1.0)' } });
    await r.body?.cancel();
    const host = (s: string) => new URL(s).hostname.replace(/^www\./, '');
    if (r.status >= 400) return { status: 'broken', httpStatus: r.status, finalUrl: r.url, note: `HTTP ${r.status}` };
    if (host(r.url) !== host(url)) return { status: 'moved', httpStatus: r.status, finalUrl: r.url, note: `Now redirects to ${host(r.url)}` };
    return { status: 'ok', httpStatus: r.status, finalUrl: r.url, note: null };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    const note = (e as Error)?.name === 'AbortError' ? 'No response within 20 seconds (the site may block cloud servers: open it in a browser to confirm)'
      : /certificate|tls|ssl/i.test(msg) ? `TLS/certificate problem (${msg.slice(0, 80)}); browsers may still open it`
      : /dns|lookup|not known/i.test(msg) ? 'Domain does not resolve: find the new official address'
      : `Could not connect (${msg.slice(0, 80)}); the site may block cloud servers: open it in a browser to confirm`;
    return { status: 'broken', httpStatus: null, finalUrl: null, note };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: secret } = await sb.rpc('ob_cron_secret');
  const given = req.headers.get('x-ob-cron-secret') ?? '';
  if (!secret || given.length !== String(secret).length || given !== secret) return new Response('Unauthorized', { status: 401 });
  const { data: rows, error } = await sb.from('records').select('id, data').eq('collection', 'ob_sources');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const problems: string[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < (rows ?? []).length; i += 6) {
    await Promise.all(rows!.slice(i, i + 6).map(async (r: { id: string; data: Record<string, unknown> }) => {
      let c = await check(String(r.data.url));
      // Deno can't repair an incomplete certificate chain; keep the app checker's verified result for such sites
      if (c.status === 'broken' && /TLS|certificate/i.test(c.note ?? '') && r.data.status === 'ok' && /certificate chain is incomplete/i.test(String(r.data.note ?? ''))) c = { status: 'ok', httpStatus: (r.data.httpStatus as number) ?? null, finalUrl: (r.data.finalUrl as string) ?? null, note: String(r.data.note) };
      await sb.from('records').update({ data: { ...r.data, status: c.status, httpStatus: c.httpStatus, finalUrl: c.finalUrl, lastChecked: now, note: c.note ?? r.data.note ?? null }, updated_at: now }).eq('collection', 'ob_sources').eq('id', r.id);
      if (c.status !== 'ok') problems.push(`${r.data.name} (${c.status})`);
    }));
  }
  await sb.from('records').insert({ collection: 'ob_audit', k1: 'sources.check', k2: 'all', data: { actor: { kind: 'system', id: 'edge-function', name: 'Weekly link check (Edge Function + pg_cron)' }, action: 'sources.check', target: 'all', note: `${rows?.length ?? 0} checked, ${problems.length} problems: ${problems.join('; ')}`.slice(0, 500) } });
  return Response.json({ checked: rows?.length ?? 0, problems: problems.length });
});
