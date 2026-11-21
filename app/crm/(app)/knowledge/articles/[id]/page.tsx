import Link from 'next/link';
import { notFound } from 'next/navigation';
import { aiDraftAction, commentAction, deleteArticleAction, restoreVersionAction, saveArticleAction, transitionArticleAction } from '@/app/crm/kb-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { AccessPill, articleFields, Body, SamplePill, StatusPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDateTime } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { centreById } from '@/lib/kb/centres';
import { kbT, pick } from '@/lib/kb/i18n';
import { related } from '@/lib/kb/index';
import { auditLog, canApproveKb, canEditKb, commentsFor, diffVersions, getArticle, listCategories, staffViewer, versionsOf } from '@/lib/kb/service';

export const metadata = { title: 'Article' };

export default async function ArticlePage({ params, searchParams }: { params: { id: string }; searchParams: { diff?: string; saved?: string } }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const got = await getArticle(v, params.id);
  if (!got) notFound();
  const { shown: a, live } = got;
  const [versions, comments, rel, cats] = await Promise.all([versionsOf(params.id), commentsFor(params.id), related(v, params.id, a.title.en), listCategories(a.centre)]);
  const log = can(user, 'kb.analytics') || can(user, 'kb.approve') ? await auditLog(user, { targetId: params.id, limit: 50 }) : [];
  const [da, db] = (searchParams.diff ?? '').split(',').map(Number);
  const diff = da && db ? await diffVersions(params.id, da, db).catch(() => null) : null;
  const edit = canEditKb(user);
  const approve = canApproveKb(user);
  const centre = centreById(a.centre);
  const btn = (tr: string, label: string, cls = 'btn-outline py-1.5 text-sm') => <ActionButton action={transitionArticleAction} label={label} hidden={{ id: params.id, t: tr }} className={cls} />;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted">
          <Link href={`/crm/knowledge/centres/${a.centre}`} className="underline">{centre?.icon} {centre?.name[lang]}</Link>
          {a.topic ? ` · ${centre?.topics.find((x) => x.key === a.topic)?.t[lang] ?? a.topic}` : ''} · v{a.version}{live && a.status !== 'published' ? ` · readers see v${a.liveVersion}` : ''}
        </p>
        <h1 className="mt-1 font-display text-3xl text-heading">{pick(a.title, lang)}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill status={a.status} lang={lang} />
          <AccessPill access={a.access} sensitivity={a.sensitivity} lang={lang} />
          <SamplePill show={a.sample} label={t.sample} />
          {a.aiGenerated && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-900">AI-generated: needs staff approval</span>}
          <span className="text-xs text-muted">{t.reviewBy}: {a.reviewBy ?? '—'} · channels: {a.channels.join(', ')}</span>
        </div>
        {searchParams.saved && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">Saved as a draft.</p>}
        {a.rejectReason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">Returned: {a.rejectReason}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {edit && a.status === 'draft' && btn('submit', 'Send for review', 'btn-primary py-1.5 text-sm')}
        {approve && a.status === 'review' && btn('approve', 'Approve')}
        {approve && (a.status === 'review' || a.status === 'approved') && btn('approve_publish', a.status === 'approved' ? 'Publish' : 'Approve & publish', 'btn-primary py-1.5 text-sm')}
        {approve && a.status !== 'archived' && btn('archive', 'Archive')}
        {approve && a.status === 'archived' && btn('unarchive', 'Unarchive')}
        {approve && a.status !== 'published' && <ActionButton action={deleteArticleAction} label="Delete" hidden={{ id: params.id }} className="btn-outline py-1.5 text-sm text-maroon" />}
        {edit && <ActionButton action={aiDraftAction} label="AI summary (draft)" hidden={{ kind: 'article', id: params.id, what: 'summary' }} />}
        {edit && <ActionButton action={aiDraftAction} label="AI FAQs (draft)" hidden={{ kind: 'article', id: params.id, what: 'faq' }} />}
      </div>
      {approve && (a.status === 'review' || a.status === 'approved') && (
        <QuickForm action={transitionArticleAction} submit="Reject with reason" cols={1} fields={[{ name: 'id', type: 'hidden', value: params.id }, { name: 't', type: 'hidden', value: 'reject' }, { name: 'reason', label: 'Reason (sent back to the author)', type: 'text', required: true, maxLength: 500 }]} />
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Panel title={pick(a.title, lang)}>
            <Body text={pick(a.body, lang) || a.body.en} />
            {lang !== 'en' && !a.body[lang] && <p className="mt-3 text-xs text-muted">No {lang === 'te' ? 'Telugu' : 'Hindi'} text yet: showing English.</p>}
            {a.basedOn.length > 0 && <p className="mt-3 text-xs text-muted">{t.basedOn}: {a.basedOn.join(', ')}</p>}
          </Panel>
          {edit && a.status !== 'archived' && (
            <details className="rounded-2xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-heading">Edit (creates version {a.version + 1})</summary>
              <div className="mt-4">
                <QuickForm action={saveArticleAction} submit="Save new version" reset={false} fields={[{ name: 'id', type: 'hidden', value: params.id }, ...articleFields(v, lang, got.rec.data, a.centre, { categories: cats.map((c) => ({ id: c.id, name: c.data.name.en })), staff: [] }), { name: 'note', label: 'What changed (version note)', type: 'text', maxLength: 300, wide: true }]} />
              </div>
            </details>
          )}
          {diff && (
            <Panel title={`Compare v${da} → v${db}`} actions={<Link href={`/crm/knowledge/articles/${params.id}`} className="text-xs underline">Close</Link>}>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 font-mono text-xs leading-5">
                {diff.map((d, i) => (
                  <div key={i} className={d.op === '+' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100' : d.op === '-' ? 'bg-red-100 text-red-900 line-through dark:bg-red-400/20 dark:text-red-100' : 'text-muted'}>
                    {d.op === '=' ? '  ' : `${d.op} `}{d.line || ' '}
                  </div>
                ))}
              </pre>
            </Panel>
          )}
          <Panel title={t.comments}>
            {comments.length === 0 ? <Empty>No comments yet.</Empty> : (
              <ul className="mb-3 space-y-2 text-sm">
                {comments.map((c, i) => (
                  <li key={i} className={`rounded-lg border px-3 py-2 ${c.kind === 'reject' ? 'border-maroon/40' : c.kind === 'approve' ? 'border-emerald-600/40' : 'border-line'}`}>
                    <span className="font-semibold">{c.byName}</span> <span className="text-xs text-muted">{formatDateTime(c.at)}</span>
                    <p className="mt-0.5 whitespace-pre-line">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <QuickForm action={commentAction} submit="Comment" cols={1} fields={[{ name: 'id', type: 'hidden', value: params.id }, { name: 'text', label: 'Comment', type: 'textarea', required: true, rows: 2 }]} />
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title={`${t.versions} (${versions.length})`}>
            <ul className="space-y-1.5 text-xs">
              {versions.map((ver, i) => (
                <li key={ver.version} className="flex flex-wrap items-center justify-between gap-1">
                  <span><span className="font-mono font-semibold">v{ver.version}</span> · {formatDateTime(ver.at)}{ver.note ? ` · ${ver.note}` : ''}{a.liveVersion === ver.version ? ' · live' : ''}</span>
                  <span className="flex gap-2">
                    {versions[i + 1] && <Link href={`?diff=${versions[i + 1].version},${ver.version}`} className="underline">diff</Link>}
                    {edit && ver.version !== a.version && <ActionButton action={restoreVersionAction} label="restore" hidden={{ id: params.id, version: String(ver.version) }} className="text-xs underline" />}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t.related}>
            {rel.length === 0 ? <Empty>Nothing related yet.</Empty> : (
              <ul className="space-y-1.5 text-sm">
                {rel.map((r) => (
                  <li key={r.id}><Link href={r.href} className="underline">{r.title}</Link>{r.page ? <span className="text-xs text-muted"> · {t.page} {r.page}</span> : null}</li>
                ))}
              </ul>
            )}
          </Panel>
          {log.length > 0 && (
            <Panel title={t.audit}>
              <ul className="max-h-72 space-y-1 overflow-auto text-[11px]">
                {log.map((l, i) => (
                  <li key={i}><span className="font-mono">{formatDateTime(l.at)}</span> · {l.action} · {l.actor} ({l.role}){l.detail ? ` · ${l.detail}` : ''}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
