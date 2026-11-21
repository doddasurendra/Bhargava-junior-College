import Link from 'next/link';
import { gapAction } from '@/app/crm/kb-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { getLang } from '@/lib/i18n-server';
import { kbT } from '@/lib/kb/i18n';
import { analytics } from '@/lib/kb/insights';

export const metadata = { title: 'Knowledge analytics' };

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <Empty>No data yet.</Empty>;
  return (
    <ul className="space-y-1 text-xs">
      {rows.map(([k, n]) => (
        <li key={k} className="grid grid-cols-[110px_1fr_40px] items-center gap-2">
          <span className="truncate text-muted" title={k}>{k}</span>
          <span className="h-2.5 rounded-full bg-line"><span className="block h-full rounded-full bg-navy dark:bg-gold" style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="text-right font-mono">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  await requireStaff('kb.analytics');
  const lang = getLang();
  const t = kbT(lang);
  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const a = await analytics(days);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-heading">{t.analytics}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          {[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={`rounded-full border px-3 py-1 ${d === days ? 'border-navy bg-navy text-white dark:bg-gold dark:text-navy-950' : 'border-line'}`}>{d} days</Link>)}
          <a href={`/api/kb/export?what=analytics&days=${days}&format=csv`} className="btn-outline py-1 text-sm">Excel</a>
          <a href={`/api/kb/export?what=analytics&days=${days}&format=pdf`} className="btn-outline py-1 text-sm">PDF</a>
        </div>
      </div>
      {a.alerts.length > 0 && <div role="alert" className="rounded-xl border border-maroon/40 bg-red-50 px-4 py-3 text-sm text-red-900 dark:bg-red-400/10 dark:text-red-100">{a.alerts.map((x) => <p key={x}>⚠ {x}</p>)}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Searches" value={a.search.total} />
        <Stat label="Zero-result" value={a.search.zero} tone={a.search.zero ? 'warn' : 'good'} />
        <Stat label="Click-through" value={a.search.ctr === null ? '–' : `${a.search.ctr}%`} />
        <Stat label="AI questions" value={a.ai.questions} />
        <Stat label="Answer rate" value={a.ai.answerRate === null ? '–' : `${a.ai.answerRate}%`} tone={a.ai.answerRate !== null && a.ai.answerRate < 70 ? 'warn' : 'good'} />
        <Stat label="👍 / 👎" value={`${a.ai.up} / ${a.ai.down}`} />
        <Stat label="With sources" value={a.ai.withSources === null ? '–' : `${a.ai.withSources}%`} />
        <Stat label="Handoffs" value={a.ai.handoffs} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Views by day"><Bars rows={a.usage.viewsByDay.slice(-14)} /></Panel>
        <Panel title="Searches by day"><Bars rows={a.usage.searchesByDay.slice(-14)} /></Panel>
        <Panel title="AI questions by day"><Bars rows={a.usage.aiByDay.slice(-14)} /></Panel>
        <Panel title="By role"><Bars rows={a.usage.byRole.slice(0, 10)} /></Panel>
        <Panel title="By centre (views)"><Bars rows={a.usage.byCentre.slice(0, 10)} /></Panel>
        <Panel title="Search language"><Bars rows={a.usage.byLang} /></Panel>
        <Panel title="Top queries"><Bars rows={a.search.top} /></Panel>
        <Panel title="Zero-result queries"><Bars rows={a.search.zeroQueries} /></Panel>
        <Panel title="AI answer modes"><Bars rows={a.ai.byMode} /></Panel>
      </div>
      <Panel title={`${t.unanswered} (top 20)`}>
        {a.ai.unanswered.length === 0 ? <Empty>None.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {a.ai.unanswered.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>{g.q} <span className="text-xs text-muted">×{g.count} · {g.lang} · {g.assistant}</span></span>
                <span className="flex gap-1.5">
                  <ActionButton action={gapAction} label="Create article" hidden={{ id: g.id, what: 'create' }} className="btn-primary py-1 text-xs" />
                  <ActionButton action={gapAction} label="Ignore" hidden={{ id: g.id, what: 'ignore' }} className="btn-outline py-1 text-xs" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Content health">
          <ul className="space-y-1 text-sm">
            <li>Past review date: <b>{a.health.outdated}</b></li>
            <li>Drafts / in review over 7 days: <b>{a.health.draftsOver7}</b></li>
            <li>Published, no views in 90 days: <b>{a.health.noViews90}</b></li>
          </ul>
          <Link href="/crm/knowledge/audit" className="mt-2 inline-block text-xs underline">Full knowledge audit →</Link>
        </Panel>
        <Panel title="Contributors">
          {a.contributors.length === 0 ? <Empty>No contributions yet.</Empty> : <ul className="space-y-1 text-xs">{a.contributors.map((c, i) => <li key={i}>{c.actor} · {c.what} <b>{c.n}</b></li>)}</ul>}
        </Panel>
        <Panel title="Performance">
          <ul className="space-y-1 text-sm">
            <li>Search latency (avg): <b>{a.performance.searchMs ?? '–'} ms</b></li>
            <li>AI response (avg): <b>{a.performance.aiMs ?? '–'} ms</b></li>
            <li>Ingestion (avg): <b>{a.performance.ingestMs ?? '–'} ms</b></li>
            <li>Queue error rate: <b>{a.performance.errorRate}%</b> ({a.performance.failed} failed)</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
