import { reindexAction, retryQueueAction } from '@/app/crm/kb-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { fmtBytes } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { isDeveloper } from '@/lib/crm/permissions';
import { formatDateTime } from '@/lib/dates';
import { healthReport } from '@/lib/kb/health';

export const metadata = { title: 'Supabase integration' };

const ok = (b: boolean | null | undefined) => (b === null || b === undefined ? '–' : b ? '✅' : '⛔');

/** §21: Super Admin / Developer only. */
export default async function SupabasePage() {
  const user = await requireStaff('kb.view');
  if (!(isDeveloper(user) || user.roles[0] === 'super_admin')) return <Panel title="Supabase integration"><p className="text-sm text-muted">Super Admin / Developer only.</p></Panel>;
  const h = await healthReport();
  const rlsOff = h.database.db?.tables.filter((t) => !t.rls) ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">Supabase integration centre</h1>
          <p className="text-sm text-muted">Project <b>{h.project.ref ?? 'none'}</b> · environment <b>{h.project.env}</b> · {h.project.kind} · {h.project.connected ? 'connected (service role)' : 'NOT connected'}</p>
        </div>
        <ActionButton action={reindexAction} label="Re-index now" className="btn-primary py-1.5 text-sm" />
      </div>
      {h.warnings.length > 0 && (
        <div role="alert" className="space-y-1 rounded-xl border border-maroon/40 bg-red-50 px-4 py-3 text-sm text-red-900 dark:bg-red-400/10 dark:text-red-100">
          {h.warnings.map((w) => <p key={w}>⚠ {w}</p>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Tables" value={h.database.db?.tables.length ?? '–'} />
        <Stat label="RLS off" value={h.database.db ? rlsOff.length : '–'} tone={rlsOff.length ? 'alert' : 'good'} />
        <Stat label="Chunks" value={h.vector.chunks} />
        <Stat label="Embedded" value={h.vector.configured ? `${h.vector.embedded}/${h.vector.chunks}` : 'off'} />
        <Stat label="Storage" value={fmtBytes(h.storage.usage.bytes)} tone={h.storage.usage.bytes > h.storage.quota * 0.8 ? 'alert' : 'default'} />
        <Stat label="Failed jobs" value={h.queue.failed.length} tone={h.queue.failed.length ? 'alert' : 'good'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Database">
          {h.database.dbError && <p className="mb-2 rounded-lg bg-gold-100 px-3 py-2 text-xs text-navy">{h.database.dbError}</p>}
          {h.database.db ? (
            <>
              <p className="mb-2 text-xs text-muted">Migrations applied: {h.database.db.migrations.length} (latest {h.database.db.migrations[h.database.db.migrations.length - 1] ?? '–'}) · in repo: {h.database.localMigrations.length} (latest {h.database.localMigrations[h.database.localMigrations.length - 1]?.slice(0, 14)})</p>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted"><th className="py-1">Table</th><th>RLS</th><th className="text-right">Rows (est.)</th></tr></thead>
                  <tbody>{h.database.db.tables.map((t) => <tr key={t.name} className={`border-t border-line ${t.rls ? '' : 'bg-red-50 text-red-900'}`}><td className="py-1 font-mono">{t.name}</td><td>{ok(t.rls)}</td><td className="text-right font-mono">{t.rows}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          ) : <p className="text-sm text-muted">{h.project.connected ? '' : 'Local JSON store (.data/dev-db.json). Set SUPABASE_SERVICE_ROLE_KEY to connect.'} Migrations in repo: {h.database.localMigrations.length}.</p>}
          <p className="mt-3 mb-1 text-xs font-semibold text-heading">Knowledge Hub collections (in public.records)</p>
          <ul className="grid grid-cols-2 gap-x-4 text-xs">{h.database.collections.map((c) => <li key={c.name} className="flex justify-between"><span className="font-mono">{c.name}</span><span className="font-mono">{c.rows}</span></li>)}</ul>
        </Panel>
        <div className="space-y-5">
          <Panel title="Storage">
            {h.storage.error && <p className="text-xs text-maroon">{h.storage.error}</p>}
            <p className="text-sm">{fmtBytes(h.storage.usage.bytes)} of {fmtBytes(h.storage.quota)} in {h.storage.usage.objects} object(s) · {h.storage.usage.backend === 'local' ? 'local folder' : `bucket ${h.storage.bucket}`}</p>
            {h.storage.buckets.length > 0 && <ul className="mt-2 text-xs">{h.storage.buckets.map((b) => <li key={b.name}>{b.public ? '⚠ public' : '🔒 private'} · <span className="font-mono">{b.name}</span></li>)}</ul>}
          </Panel>
          <Panel title="pgvector & index">
            <ul className="space-y-1 text-sm">
              <li>pgvector extension: {ok(h.vector.pgvector)}</li>
              <li>Embeddings: {h.vector.configured ? `${h.vector.model}, ${h.vector.dim} dims · ${h.vector.embedded} embedded, ${h.vector.missing} missing (embedded on first use)` : 'not configured (VOYAGE_API_KEY): keyword search only'}</li>
              <li>Stored vectors in kb_embeddings: {h.vector.stored ?? '–'}</li>
              <li>Index: {h.vector.chunks} chunks, built {formatDateTime(h.vector.indexBuiltAt)} in {h.vector.indexMs} ms</li>
            </ul>
          </Panel>
          <Panel title="Realtime / sync">
            <p className="text-sm">Last sync: {h.realtime.lastSync ? `${formatDateTime(h.realtime.lastSync)} (${h.realtime.reason})` : 'never'}</p>
            <p className="mt-1 text-xs text-muted">{h.realtime.note}</p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Functions">
          <ul className="space-y-1.5 text-sm">{h.functions.map((f) => <li key={f.name}><span className="font-mono font-semibold">{f.name}</span> · {f.runtime}<span className="block text-xs text-muted">{f.note}</span></li>)}</ul>
          <p className="mt-2 text-[11px] text-muted">This project runs these as Next.js server code on Vercel, not as Supabase Edge Functions; there is nothing to deploy with `supabase functions deploy`.</p>
        </Panel>
        <Panel title="Scheduled jobs">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted"><th className="py-1">Job</th><th>Schedule (UTC)</th><th>Last run</th></tr></thead>
            <tbody>{h.jobs.crons.map((j) => { const r = h.jobs.lastRuns[j.path]; return <tr key={j.path} className="border-t border-line"><td className="py-1 font-mono">{j.path}</td><td className="font-mono">{j.schedule}</td><td>{r ? `${ok(r.ok)} ${formatDateTime(r.at)}` : '–'}{r?.detail ? <span className="block text-muted">{r.detail}</span> : null}</td></tr>; })}</tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">Vercel Cron (Hobby plan: once a day each). pg_cron: {h.jobs.pgCron === null ? 'not installed' : `${h.jobs.pgCron.length} job(s)`}.</p>
        </Panel>
        <Panel title="Auth">
          <ul className="grid grid-cols-2 gap-x-4 text-xs">{h.auth.perRole.map((r) => <li key={r.role} className="flex justify-between"><span>{r.role}</span><span className="font-mono">{r.n}</span></li>)}</ul>
          <p className="mt-3 mb-1 text-xs font-semibold text-heading">2FA on admin roles</p>
          <ul className="text-xs">{h.auth.adminMfa.map((a, i) => <li key={i}>{ok(a.mfa)} {a.name} · {a.role}</li>)}</ul>
          <p className="mt-2 text-xs">Test OTP on screen: {h.auth.testOtp ? '⚠ ON (local only)' : '✅ off'} · Developer sign-in picker: {h.auth.devLogin ? '⚠ ON' : '✅ off'}</p>
        </Panel>
        <Panel title="Queues">
          <p className="text-sm">Pending {h.queue.pending} · processing {h.queue.processing} · done {h.queue.done} · failed {h.queue.failed.length}</p>
          {h.queue.failed.length === 0 ? <Empty>No failed jobs.</Empty> : (
            <ul className="mt-2 space-y-1 text-xs">{h.queue.failed.slice(0, 20).map((q) => <li key={q.id} className="flex flex-wrap items-center justify-between gap-2"><span>{q.kind} · <span className="font-mono">{q.targetId.slice(0, 8)}</span> · {q.error}</span><ActionButton action={retryQueueAction} label="Retry" hidden={{ id: q.id }} className="btn-outline py-0.5 text-xs" /></li>)}</ul>
          )}
        </Panel>
        <Panel title="Integrations & environment">
          <ul className="space-y-1 text-sm">{h.integrations.map((i) => <li key={i.name}>{ok(i.ok)} {i.name}<span className="block text-xs text-muted">{i.note}</span></li>)}</ul>
          <p className="mt-2 text-xs">Demo rows (id demo-…): {h.demo.demoRows} · sample KB articles: {h.demo.sampleArticles}</p>
        </Panel>
      </div>
    </div>
  );
}
