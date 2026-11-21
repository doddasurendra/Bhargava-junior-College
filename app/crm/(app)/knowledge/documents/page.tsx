import Link from 'next/link';
import { Empty, Panel } from '@/components/crm/ui';
import { UploadZone } from '@/components/kb/client';
import { AccessPill, fmtBytes, SamplePill, StatusPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { allowedLevels, LEVELS, SENSITIVITY } from '@/lib/kb/access';
import { CENTRES, centreById } from '@/lib/kb/centres';
import { CHANNELS, STATUSES } from '@/lib/kb/collections';
import { ACCEPT } from '@/lib/kb/extract';
import { listFiles } from '@/lib/kb/files';
import { kbT, LEVEL_LABEL, pick, SENSITIVITY_LABEL, STATUS_LABEL } from '@/lib/kb/i18n';
import { ocrAvailable } from '@/lib/kb/ocr';
import { staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Documents' };

const KIND_ICON: Record<string, string> = { pdf: '📕', word: '📘', excel: '📗', csv: '📗', powerpoint: '📙', image: '🖼️', text: '📄' };

export default async function DocumentsPage({ searchParams }: { searchParams: { centre?: string; status?: string; kind?: string; q?: string } }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const files = await listFiles(v, { centre: searchParams.centre || undefined, status: searchParams.status || 'all', kind: searchParams.kind || undefined, q: searchParams.q?.slice(0, 100) });
  const levels = allowedLevels(v);
  const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">{t.documents}</h1>
      {can(user, 'kb.edit') && (
        <Panel title={t.upload}>
          <UploadZone accept={ACCEPT} maxMb={50} labels={{ drop: 'Drag and drop PDF, Word (.docx), Excel (.xlsx/.csv), PowerPoint (.pptx), images or scans here — up to 20 files, 50 MB each.', choose: 'Choose files', upload: t.upload, tooBig: 'Larger than 50 MB, not added' }}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-3"><span className={lbl}>Title (one file only; otherwise the file name)</span><input name="titleEn" maxLength={200} className="input py-2 text-sm" /></label>
              <label className="block"><span className={lbl}>{t.centre}</span>
                <select name="centre" defaultValue={searchParams.centre ?? 'student'} className="input py-2 text-sm">{CENTRES.filter((c) => c.kind === 'content' || c.id === 'core').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name[lang]}</option>)}</select>
              </label>
              <label className="block"><span className={lbl}>{t.access}</span>
                <select name="access" defaultValue="faculty" className="input py-2 text-sm">{LEVELS.filter((l) => levels.includes(l)).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l][lang]}</option>)}</select>
              </label>
              <label className="block"><span className={lbl}>{t.sensitivity}</span>
                <select name="sensitivity" defaultValue="internal" className="input py-2 text-sm">{SENSITIVITY.map((s) => <option key={s} value={s}>{SENSITIVITY_LABEL[s][lang]}</option>)}</select>
              </label>
              <label className="block"><span className={lbl}>{t.reviewBy}</span><input type="date" name="reviewBy" className="input py-2 text-sm" /></label>
              <fieldset className="flex flex-wrap items-end gap-3 text-sm sm:col-span-2">
                <legend className={lbl}>Channels</legend>
                {CHANNELS.map((c) => <label key={c} className="flex items-center gap-1.5"><input type="checkbox" name={`ch_${c}`} defaultChecked={c === 'staff'} className="h-4 w-4 accent-maroon" />{c}</label>)}
              </fieldset>
            </div>
            <p className="text-xs text-muted">Every file is type-checked by its bytes, scanned (macros, embedded programs, PDF scripts are blocked), stored privately, and its text extracted page by page. Scanned PDFs and images need OCR: {ocrAvailable() ? 'Claude vision OCR is on (English, Telugu, Hindi).' : 'OCR is not configured (ANTHROPIC_API_KEY), so scans are stored but not searchable yet.'} New uploads are drafts until approved.</p>
          </UploadZone>
        </Panel>
      )}
      <form className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
        <input name="q" defaultValue={searchParams.q ?? ''} placeholder={t.search} className="input w-48 py-1.5" />
        <select name="centre" defaultValue={searchParams.centre ?? ''} className="input w-auto py-1.5"><option value="">{t.centre}: {t.all}</option>{CENTRES.filter((c) => c.kind === 'content' || c.id === 'core').map((c) => <option key={c.id} value={c.id}>{c.name[lang]}</option>)}</select>
        <select name="status" defaultValue={searchParams.status ?? ''} className="input w-auto py-1.5"><option value="">{t.status}: {t.all}</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s][lang]}</option>)}</select>
        <select name="kind" defaultValue={searchParams.kind ?? ''} className="input w-auto py-1.5"><option value="">Type: {t.all}</option>{Object.keys(KIND_ICON).map((k) => <option key={k} value={k}>{k}</option>)}</select>
        <button className="btn-outline py-1.5">{t.search}</button>
      </form>
      <Panel title={`${t.files} (${files.length})`}>
        {files.length === 0 ? <Empty>{t.noResults}</Empty> : (
          <ul className="divide-y divide-line">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/crm/knowledge/documents/${f.id}`} className="font-medium text-heading hover:underline">{KIND_ICON[f.data.kind]} {pick(f.data.title, lang)}</Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {f.data.name} · {fmtBytes(f.data.size)} · v{f.data.version} · {centreById(f.data.centre)?.name[lang]} · {formatDate(f.updatedAt.slice(0, 10), { day: 'numeric', month: 'short' })} · text: {f.data.extract.status === 'ok' ? `${f.data.extract.pages} ${f.data.extract.pages === 1 ? 'page' : 'pages'}${f.data.extract.method.includes('ocr') ? ' (OCR)' : ''}` : f.data.extract.status.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SamplePill show={f.data.sample} label={t.sample} />
                  {!f.data.scan.ok || f.data.scan.notes.length ? <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] text-navy" title={f.data.scan.notes.join('; ')}>scan notes</span> : null}
                  <AccessPill access={f.data.access} sensitivity={f.data.sensitivity} lang={lang} />
                  <StatusPill status={f.data.status} lang={lang} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
