import Link from 'next/link';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDateTime } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { kbT } from '@/lib/kb/i18n';
import { knowledgeAudit } from '@/lib/kb/insights';
import { auditLog } from '@/lib/kb/service';

export const metadata = { title: 'Knowledge audit' };

const KIND: Record<string, string> = { past_review: 'Past review date', old_year: 'Old academic year / fee year', outdated: 'Outdated', duplicate: 'Duplicate', unapproved: 'Waiting > 7 days', orphan: 'No active owner', no_views: 'No views in 90 days', ocr_needed: 'Scanned, needs OCR' };

export default async function AuditPage({ searchParams }: { searchParams: { action?: string } }) {
  const user = await requireStaff('kb.analytics');
  const t = kbT(getLang());
  const [findings, log] = await Promise.all([knowledgeAudit(), auditLog(user, { limit: 300, action: searchParams.action || undefined })]);
  const counts = Object.entries(KIND).map(([k, label]) => ({ k, label, n: findings.filter((f) => f.kind === k).length }));
  const actions = ['view', 'create', 'edit', 'submit', 'approve', 'approve_publish', 'publish', 'reject', 'archive', 'restore', 'delete', 'upload', 'replace', 'download', 'ai_query', 'export', 'import'];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-heading">Knowledge audit & {t.audit.toLowerCase()}</h1>
        <div className="flex gap-2"><a href="/api/kb/export?what=knowledge-audit" className="btn-outline py-1 text-sm">Findings (Excel)</a><a href="/api/kb/export?what=audit-log" className="btn-outline py-1 text-sm">Audit log (Excel)</a></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{counts.map((c) => <Stat key={c.k} label={c.label} value={c.n} tone={c.n ? 'warn' : 'good'} />)}</div>
      <Panel title={`Findings (${findings.length})`}>
        {findings.length === 0 ? <Empty>Nothing outdated, duplicated, stuck or orphaned.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {findings.map((f, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                <Link href={f.targetKind === 'article' ? `/crm/knowledge/articles/${f.id}` : `/crm/knowledge/documents/${f.id}`} className="underline">{f.title}</Link>
                <span className="text-xs text-muted">{KIND[f.kind]} · {f.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`${t.audit} (latest ${log.length})`} actions={<form className="flex gap-1"><select name="action" defaultValue={searchParams.action ?? ''} className="input w-auto py-1 text-xs"><option value="">All actions</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select><button className="btn-outline py-1 text-xs">Filter</button></form>}>
        {log.length === 0 ? <Empty>No entries.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted"><th className="py-1">When</th><th>Who</th><th>Role</th><th>Action</th><th>What</th><th>Detail</th></tr></thead>
              <tbody>{log.map((l, i) => <tr key={i} className="border-t border-line"><td className="py-1 pr-2 font-mono">{formatDateTime(l.at)}</td><td className="pr-2">{l.actor}</td><td className="pr-2">{l.role}</td><td className="pr-2 font-semibold">{l.action}</td><td className="pr-2">{l.targetKind}{l.title ? `: ${l.title}` : ''}</td><td className="text-muted">{l.detail}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
