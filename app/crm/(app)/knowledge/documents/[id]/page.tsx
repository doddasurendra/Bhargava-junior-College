import Link from 'next/link';
import { notFound } from 'next/navigation';
import { aiDraftAction, fileMetaAction, replaceFileAction, retryExtractionAction, transitionFileAction } from '@/app/crm/kb-actions';
import { ActionButton, QuickForm } from '@/components/crm/QuickForm';
import { ActionForm, Submit } from '@/components/crm/forms';
import { Panel } from '@/components/crm/ui';
import { AccessPill, fmtBytes, SamplePill, StatusPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDateTime } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { allowedLevels, LEVELS, SENSITIVITY } from '@/lib/kb/access';
import { CENTRES, centreById } from '@/lib/kb/centres';
import { CHANNELS } from '@/lib/kb/collections';
import { ACCEPT } from '@/lib/kb/extract';
import { fileText, getFile, liveFileVersion } from '@/lib/kb/files';
import { kbT, LEVEL_LABEL, pick, SENSITIVITY_LABEL } from '@/lib/kb/i18n';
import { auditLog, audit, canApproveKb, canEditKb, staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Document' };

export default async function DocumentPage({ params, searchParams }: { params: { id: string }; searchParams: { v?: string } }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const rec = await getFile(v, params.id);
  if (!rec) notFound();
  const f = rec.data;
  await audit(v, 'view', 'file', params.id, f.title.en);
  const shownVersion = Number(searchParams.v) || f.version;
  const h = f.history.find((x) => x.version === shownVersion) ?? f.history[f.history.length - 1];
  const text = await fileText(params.id, h.version);
  const log = can(user, 'kb.analytics') || can(user, 'kb.approve') ? await auditLog(user, { targetId: params.id, limit: 40 }) : [];
  const edit = canEditKb(user);
  const approve = canApproveKb(user);
  const src = `/api/kb/files/${params.id}?v=${h.version}&inline=1`;
  const btn = (tr: string, label: string, cls = 'btn-outline py-1.5 text-sm') => <ActionButton action={transitionFileAction} label={label} hidden={{ id: params.id, t: tr }} className={cls} />;
  const levels = allowedLevels(v);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted"><Link href="/crm/knowledge/documents" className="underline">{t.documents}</Link> · {centreById(f.centre)?.name[lang]} · {f.name} · {fmtBytes(f.size)} · v{f.version}{liveFileVersion(f) && liveFileVersion(f) !== f.version ? ` · readers get v${liveFileVersion(f)}` : ''}</p>
        <h1 className="mt-1 font-display text-3xl text-heading">{pick(f.title, lang)}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill status={f.status} lang={lang} />
          <AccessPill access={f.access} sensitivity={f.sensitivity} lang={lang} />
          <SamplePill show={f.sample} label={t.sample} />
          <span className="text-xs text-muted">{t.reviewBy}: {f.reviewBy ?? '—'} · channels: {f.channels.join(', ')}</span>
        </div>
        {f.rejectReason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Returned: {f.rejectReason}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/kb/files/${params.id}?v=${h.version}`} className="btn-primary py-1.5 text-sm">{t.download} v{h.version}</a>
        {edit && f.status === 'draft' && btn('submit', 'Send for review')}
        {approve && f.status === 'review' && btn('approve', 'Approve')}
        {approve && (f.status === 'review' || f.status === 'approved') && btn('approve_publish', f.status === 'approved' ? 'Publish' : 'Approve & publish', 'btn-primary py-1.5 text-sm')}
        {approve && f.status !== 'archived' && btn('archive', 'Archive')}
        {approve && f.status === 'archived' && btn('unarchive', 'Unarchive')}
        {edit && <ActionButton action={retryExtractionAction} label="Extract text / OCR again" hidden={{ id: params.id }} />}
        {edit && f.extract.chars > 0 && <ActionButton action={aiDraftAction} label="AI summary (draft)" hidden={{ kind: 'file', id: params.id, what: 'summary' }} />}
        {edit && f.extract.chars > 0 && <ActionButton action={aiDraftAction} label="AI FAQs (draft)" hidden={{ kind: 'file', id: params.id, what: 'faq' }} />}
      </div>
      {approve && (f.status === 'review' || f.status === 'approved') && (
        <QuickForm action={transitionFileAction} submit="Reject with reason" cols={1} fields={[{ name: 'id', type: 'hidden', value: params.id }, { name: 't', type: 'hidden', value: 'reject' }, { name: 'reason', label: 'Reason', type: 'text', required: true }]} />
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Panel title={`${t.preview} · v${h.version}`}>
            {h.mime === 'application/pdf' ? (
              <iframe src={src} title={f.title.en} className="h-[70vh] w-full rounded-lg border border-line bg-white" />
            ) : h.mime.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={f.title.en} className="max-h-[70vh] rounded-lg border border-line" />
            ) : (
              <p className="text-sm text-muted">Office and CSV files are previewed as their extracted text below. Download to open the original.</p>
            )}
          </Panel>
          <Panel title={`Extracted text · ${f.extract.status === 'ok' ? `${f.extract.pages} ${text?.pageLabel ?? 'page'}(s), ${f.extract.chars.toLocaleString('en-IN')} characters, ${f.extract.method}${f.extract.langs.length ? `, scripts: ${f.extract.langs.join('/')}` : ''}` : f.extract.status}`}>
            {f.extract.error && <p className="mb-3 rounded-lg bg-gold-100 px-3 py-2 text-sm text-navy">{f.extract.error}</p>}
            {text?.pages.some((p) => p.trim()) ? (
              <ol className="max-h-[60vh] space-y-3 overflow-auto">
                {text.pages.map((p, i) => (
                  <li key={i} id={`p${i + 1}`} className="rounded-lg border border-line p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{text.pageLabel} {i + 1}</p>
                    <p className="whitespace-pre-line text-xs leading-5 text-ink">{p.slice(0, 6000) || '—'}{p.length > 6000 ? '…' : ''}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted">No text.</p>}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title={`${t.versions} (${f.history.length})`}>
            <ul className="space-y-1.5 text-xs">
              {[...f.history].reverse().map((x) => (
                <li key={x.version} className="flex flex-wrap justify-between gap-1">
                  <span><span className="font-mono font-semibold">v{x.version}</span> · {x.name} · {fmtBytes(x.size)} · {formatDateTime(x.at)}{x.note ? ` · ${x.note}` : ''}{liveFileVersion(f) === x.version ? ' · live' : ''}</span>
                  <span className="flex gap-2"><Link href={`?v=${x.version}`} className="underline">view</Link><a href={`/api/kb/files/${params.id}?v=${x.version}`} className="underline">download</a></span>
                </li>
              ))}
            </ul>
            {edit && f.status !== 'archived' && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-xs font-semibold text-heading">{t.replace}</p>
                <ActionForm action={replaceFileAction} className="space-y-2">
                  <input type="hidden" name="id" value={params.id} />
                  <input type="file" name="file" accept={ACCEPT} required className="block w-full text-xs" />
                  <input name="note" placeholder="What changed" maxLength={300} className="input py-1.5 text-xs" />
                  <Submit className="btn-outline py-1.5 text-xs">Upload new version</Submit>
                </ActionForm>
              </div>
            )}
          </Panel>
          <Panel title="Safety scan">
            <p className="text-sm">{f.scan.ok ? '✅ Passed' : '⛔ Blocked'}: type checked by file bytes; macros, embedded programs and PDF scripts are blocked.</p>
            {f.scan.notes.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-muted">{f.scan.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            <p className="mt-2 text-[11px] text-muted">SHA-256 {f.sha256.slice(0, 16)}… (duplicate uploads are refused). This is a structural check, not a signature antivirus.</p>
          </Panel>
          {edit && (
            <Panel title="Details & access">
              <QuickForm action={fileMetaAction} submit="Save details" cols={1} reset={false} fields={[
                { name: 'id', type: 'hidden', value: params.id },
                { name: 'titleEn', label: 'Title (English)', type: 'text', defaultValue: f.title.en },
                { name: 'titleTe', label: 'శీర్షిక (తెలుగు)', type: 'text', defaultValue: f.title.te ?? '' },
                { name: 'titleHi', label: 'शीर्षक (हिंदी)', type: 'text', defaultValue: f.title.hi ?? '' },
                { name: 'centre', label: t.centre, type: 'select', defaultValue: f.centre, options: CENTRES.filter((c) => c.kind === 'content' || c.id === 'core').map((c) => ({ value: c.id, label: c.name[lang] })) },
                { name: 'topic', label: t.topic, type: 'select', defaultValue: f.topic ?? '', options: [{ value: '', label: '—' }, ...(centreById(f.centre)?.topics ?? []).map((x) => ({ value: x.key, label: x.t[lang] }))] },
                { name: 'access', label: t.access, type: 'select', defaultValue: f.access, options: LEVELS.filter((l) => levels.includes(l)).map((l) => ({ value: l, label: LEVEL_LABEL[l][lang] })) },
                { name: 'sensitivity', label: t.sensitivity, type: 'select', defaultValue: f.sensitivity, options: SENSITIVITY.map((s) => ({ value: s, label: SENSITIVITY_LABEL[s][lang] })) },
                { name: 'reviewBy', label: t.reviewBy, type: 'date', defaultValue: f.reviewBy ?? '' },
                ...CHANNELS.map((c) => ({ name: `ch_${c}`, label: c, type: 'checkbox' as const, defaultChecked: f.channels.includes(c) })),
              ]} />
            </Panel>
          )}
          {log.length > 0 && (
            <Panel title={t.audit}>
              <ul className="max-h-72 space-y-1 overflow-auto text-[11px]">
                {log.map((l, i) => <li key={i}><span className="font-mono">{formatDateTime(l.at)}</span> · {l.action} · {l.actor}{l.detail ? ` · ${l.detail}` : ''}</li>)}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
