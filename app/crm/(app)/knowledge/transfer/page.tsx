import { importAction } from '@/app/crm/kb-actions';
import { ActionForm, Submit } from '@/components/crm/forms';
import { Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getLang } from '@/lib/i18n-server';
import { allowedLevels, LEVELS, SENSITIVITY } from '@/lib/kb/access';
import { CENTRES } from '@/lib/kb/centres';
import { kbT, LEVEL_LABEL, SENSITIVITY_LABEL } from '@/lib/kb/i18n';
import { staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Import & export' };

export default async function TransferPage() {
  const user = await requireStaff('kb.edit');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const lv = allowedLevels(v);
  const centres = CENTRES.filter((c) => c.kind === 'content' || c.id === 'core');
  const lbl = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">{t.import} & {t.export}</h1>
      <Panel title={t.import}>
        <ActionForm action={importAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className={lbl}>{t.centre}</span><select name="centre" className="input py-2 text-sm">{centres.map((c) => <option key={c.id} value={c.id}>{c.name[lang]}</option>)}</select></label>
            <label className="block"><span className={lbl}>{t.access}</span><select name="access" defaultValue="faculty" className="input py-2 text-sm">{LEVELS.filter((l) => lv.includes(l)).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l][lang]}</option>)}</select></label>
            <label className="block"><span className={lbl}>{t.sensitivity}</span><select name="sensitivity" defaultValue="internal" className="input py-2 text-sm">{SENSITIVITY.map((s) => <option key={s} value={s}>{SENSITIVITY_LABEL[s][lang]}</option>)}</select></label>
          </div>
          <label className="block"><span className={lbl}>File: PDF, Word, Excel/CSV, PowerPoint, image, Markdown, our JSON export, or a ZIP of these</span><input type="file" name="file" className="block w-full text-sm" /></label>
          <label className="block"><span className={lbl}>…or a page of the college website</span><input name="url" placeholder="https://bhargava-junior-college.vercel.app/hostel" className="input py-2 text-sm" /></label>
          <p className="text-xs text-muted">Markdown files become articles (front matter: title, centre, access, sensitivity, topic). A CSV named articles*.csv with columns title, body, centre, access, sensitivity, topic becomes articles. Everything else becomes a document. Everything imports as a draft.</p>
          <Submit className="btn-primary py-2">{t.import}</Submit>
        </ActionForm>
      </Panel>
      {(can(user, 'kb.approve') || can(user, 'kb.analytics')) && (
        <Panel title={t.export}>
          <form action="/api/kb/export" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="what" value="kb" />
            <label className="text-xs"><span className={lbl}>{t.centre}</span><select name="centre" className="input py-2 text-sm"><option value="">Whole knowledge base</option>{centres.map((c) => <option key={c.id} value={c.id}>{c.name[lang]}</option>)}</select></label>
            <label className="text-xs"><span className={lbl}>Format</span><select name="format" className="input py-2 text-sm"><option value="zip">ZIP (Markdown + files)</option><option value="json">JSON</option></select></label>
            <button className="btn-primary py-2 text-sm">{t.export}</button>
          </form>
          <p className="mt-2 text-xs text-muted">Contains only what you are allowed to see. Every export is in the audit log.</p>
        </Panel>
      )}
    </div>
  );
}
