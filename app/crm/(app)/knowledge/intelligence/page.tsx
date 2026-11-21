import Link from 'next/link';
import { briefingAction } from '@/app/crm/kb-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDateTime } from '@/lib/dates';
import { llmAvailable } from '@/lib/kb/ai';
import { listFiles } from '@/lib/kb/files';
import { compareDocs, earlyWarnings, lastBriefing, REPORTS } from '@/lib/kb/intel';
import { listArticles, staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Advanced AI' };

export default async function IntelligencePage({ searchParams }: { searchParams: { a?: string; b?: string } }) {
  const user = await requireStaff('kb.view');
  const v = await staffViewer(user);
  const briefingOk = can(user, 'dashboard.view') || can(user, 'kb.analytics');
  const [brief, warnings, articles, files] = await Promise.all([
    briefingOk ? lastBriefing() : Promise.resolve(null),
    can(user, 'students.view') ? earlyWarnings(user) : Promise.resolve([]),
    listArticles(v, { status: 'all' }),
    listFiles(v, { status: 'all' }),
  ]);
  const items = [...articles.map((x) => ({ key: `article:${x.id}`, label: `📝 ${x.a.title.en}` })), ...files.filter((f) => f.data.extract.chars > 0).map((f) => ({ key: `file:${f.id}`, label: `📄 ${f.data.title.en}` }))];
  const parse = (s?: string) => (s && /^(article|file):/.test(s) ? { kind: s.split(':')[0] as 'article' | 'file', id: s.slice(s.indexOf(':') + 1) } : null);
  const A = parse(searchParams.a);
  const B = parse(searchParams.b);
  const cmp = A && B ? await compareDocs(user, A, B).catch((e: Error) => ({ error: e.message })) : null;
  const reports = REPORTS.filter((r) => can(user, r.perm));
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">Advanced AI intelligence</h1>
      <p className="text-sm text-muted">Every output says what it was based on. AI-written summaries and FAQs are saved as drafts and need a staff approver before publishing. {llmAvailable() ? 'Claude is configured.' : 'No AI model key is configured: these tools use rules and quoted text (no generated wording).'}</p>
      {briefingOk && (
        <Panel title="🌆 Management Daily Briefing (7 PM)" actions={<ActionButton action={briefingAction} label="Generate now" />}>
          {brief ? (
            <>
              <p className="whitespace-pre-line text-sm leading-6">{brief.text}</p>
              <p className="mt-2 text-[11px] text-muted">Based on: {brief.basedOn} · generated {formatDateTime(brief.at)}</p>
            </>
          ) : <Empty>Not generated today yet. The daily job runs at 7 PM IST.</Empty>}
        </Panel>
      )}
      {can(user, 'students.view') && (
        <Panel title={`🚨 Student Early Warning (${warnings.length})`}>
          {warnings.length === 0 ? <Empty>No students with warnings among those you can see.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {warnings.slice(0, 40).map((w) => (
                <li key={w.id} className="py-2">
                  <Link href={`/crm/knowledge/centres/student360?student=${w.id}`} className="font-medium underline">{w.name}</Link> <span className="text-xs text-muted">{w.collegeId} · {w.batch ?? 'no batch'} · attendance {w.attendance ?? '–'}%</span>
                  <ul className="mt-0.5 list-disc pl-5 text-xs">{w.warnings.map((x) => <li key={x}>{x}</li>)}</ul>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted">Based on: attendance (30 days), test scores, the counsellor’s flag (never notes), sports participation. Mentors see these on their Mentoring page.</p>
        </Panel>
      )}
      <Panel title="📑 One-click Report Generator">
        {reports.length === 0 ? <Empty>Your role has no reports.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{r.label}</span>
                <span className="flex gap-2"><a href={`/api/kb/export?what=report&id=${r.id}&format=excel`} className="btn-outline py-1 text-xs">Excel</a><a href={`/api/kb/export?what=report&id=${r.id}&format=pdf`} className="btn-outline py-1 text-xs">PDF</a></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="⚖️ Document comparison">
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select name="a" defaultValue={searchParams.a ?? ''} className="input py-2 text-sm"><option value="">First item…</option>{items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>
          <select name="b" defaultValue={searchParams.b ?? ''} className="input py-2 text-sm"><option value="">Second item…</option>{items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>
          <button className="btn-primary py-2 text-sm">Compare</button>
        </form>
        {cmp && 'error' in cmp && <p className="mt-3 text-sm text-maroon">{cmp.error}</p>}
        {cmp && !('error' in cmp) && (
          <div className="mt-4 space-y-2 text-sm">
            <p><b>{cmp.similarity}%</b> similar · {cmp.added} lines only in “{cmp.b}”, {cmp.removed} only in “{cmp.a}”.</p>
            {cmp.ai && <p className="whitespace-pre-line rounded-lg bg-bg p-3">{cmp.ai}</p>}
            <pre className="max-h-96 overflow-auto rounded-lg bg-bg p-3 font-mono text-xs leading-5">{cmp.diff.map((d, i) => <div key={i} className={d.op === '+' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{d.op} {d.line}</div>)}</pre>
            <p className="text-[11px] text-muted">Based on: {cmp.basedOn}</p>
          </div>
        )}
      </Panel>
      <Panel title="Other AI tools">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>AI summary and AI FAQs: open any article or document → “AI summary (draft)” / “AI FAQs (draft)”.</li>
          <li>Duplicate and outdated detection, knowledge gaps: <Link href="/crm/knowledge/audit" className="underline">Knowledge audit</Link> and <Link href="/crm/knowledge/analytics" className="underline">Analytics → unanswered questions</Link>.</li>
          <li>Smart recommendations: “Related articles” on every article; weak-chapter practice in <Link href="/crm/knowledge/centres/student360" className="underline">Student 360°</Link>.</li>
        </ul>
      </Panel>
    </div>
  );
}
