import Link from 'next/link';
import { deptDecideAction, transitionArticleAction, transitionFileAction } from '@/app/crm/kb-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { AccessPill, StatusPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { centreById, DEPARTMENTS } from '@/lib/kb/centres';
import { deptRequests } from '@/lib/kb/collections';
import { listFiles } from '@/lib/kb/files';
import { kbT, pick } from '@/lib/kb/i18n';
import { listArticles, staffViewer } from '@/lib/kb/service';
import { getRecordStore } from '@/lib/records';
import { leaveRequests, outpasses, studentLeave } from '@/lib/records/collections';

export const metadata = { title: 'Approvals' };

/** One inbox (§8): KB articles and documents, plus counts of the other approvals with links to where they are decided. */
export default async function ApprovalsPage() {
  const user = await requireStaff('kb.approve');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const st = getRecordStore();
  const [articles, files, staffLeave, kidsLeave, outs, purchases] = await Promise.all([
    listArticles(v, { status: 'all' }),
    listFiles(v, { status: 'all' }),
    can(user, 'leave.approve') ? leaveRequests.list(st, { k2: 'pending' }) : Promise.resolve([]),
    studentLeave.list(st, { k2: 'pending' }),
    can(user, 'outpass.approve') || can(user, 'hostel.view') ? outpasses.list(st) : Promise.resolve([]),
    deptRequests.list(st, { k2: 'requested' }),
  ]);
  const pa = articles.filter((r) => r.a.status === 'review' || r.a.status === 'approved');
  const pf = files.filter((f) => f.data.status === 'review' || f.data.status === 'approved');
  const pendingOut = outs.filter((o) => o.data.status === 'requested' || o.data.status === 'parent_approved');
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">{t.approvals}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="KB articles" value={pa.length} tone={pa.length ? 'warn' : 'good'} />
        <Stat label="KB documents" value={pf.length} tone={pf.length ? 'warn' : 'good'} />
        <Stat label="Staff leave" value={staffLeave.length} href="/crm/leave" />
        <Stat label="Student leave" value={kidsLeave.length} href="/crm/academics" />
        <Stat label="Out-passes" value={pendingOut.length} href="/crm/hostel" />
        <Stat label="Purchases" value={purchases.length} />
      </div>
      <Panel title={`KB articles waiting (${pa.length})`}>
        {pa.length === 0 ? <Empty>Nothing waiting.</Empty> : (
          <ul className="divide-y divide-line">
            {pa.map(({ id, a, updatedAt }) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <Link href={`/crm/knowledge/articles/${id}`} className="font-medium underline">{pick(a.title, lang)}</Link>
                  <span className="block text-xs text-muted">{centreById(a.centre)?.name[lang]} · v{a.version} · {formatDate(updatedAt.slice(0, 10), { day: 'numeric', month: 'short' })}{a.aiGenerated ? ' · AI-generated' : ''}{a.submittedBy === user.id ? ' · you submitted this (someone else approves)' : ''}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <AccessPill access={a.access} sensitivity={a.sensitivity} lang={lang} />
                  <StatusPill status={a.status} lang={lang} />
                  <ActionButton action={transitionArticleAction} label={a.status === 'approved' ? 'Publish' : 'Approve & publish'} hidden={{ id, t: 'approve_publish' }} className="btn-primary py-1 text-xs" />
                  <Link href={`/crm/knowledge/articles/${id}`} className="btn-outline py-1 text-xs">Review / reject</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`KB documents waiting (${pf.length})`}>
        {pf.length === 0 ? <Empty>Nothing waiting.</Empty> : (
          <ul className="divide-y divide-line">
            {pf.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/crm/knowledge/documents/${f.id}`} className="font-medium underline">{pick(f.data.title, lang)}</Link>
                <span className="flex flex-wrap items-center gap-1.5">
                  <AccessPill access={f.data.access} sensitivity={f.data.sensitivity} lang={lang} />
                  <StatusPill status={f.data.status} lang={lang} />
                  <ActionButton action={transitionFileAction} label={f.data.status === 'approved' ? 'Publish' : 'Approve & publish'} hidden={{ id: f.id, t: 'approve_publish' }} className="btn-primary py-1 text-xs" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`Department purchase & expense requests (${purchases.length})`}>
        {purchases.length === 0 ? <Empty>No open requests.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{DEPARTMENTS.find((d) => d.id === p.data.department)?.name[lang]} · {p.data.kind}: <span className="font-medium">{p.data.item}</span> × {p.data.qty}{p.data.amount ? ` · ₹${p.data.amount.toLocaleString('en-IN')}` : ''}{p.data.note ? ` · ${p.data.note}` : ''}</span>
                <span className="flex gap-1.5">
                  <ActionButton action={deptDecideAction} label="Approve" hidden={{ id: p.id, approve: '1' }} className="btn-primary py-1 text-xs" />
                  <ActionButton action={deptDecideAction} label="Reject" hidden={{ id: p.id, approve: '0' }} className="btn-outline py-1 text-xs" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
