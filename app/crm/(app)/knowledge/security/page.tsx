import { assistantSettingsAction, governanceAction, subjectHeadsAction } from '@/app/crm/kb-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { getCrmRepo } from '@/lib/crm/repo';
import { can } from '@/lib/crm/permissions';
import { ROLE_LABELS, ROLES } from '@/lib/crm/types';
import { getLang } from '@/lib/i18n-server';
import { LEVELS, levelsForRole, SENSITIVITY } from '@/lib/kb/access';
import { ASSISTANT_INFO, ASSISTANTS } from '@/lib/kb/ai';
import { DEPARTMENTS } from '@/lib/kb/centres';
import { kbArticles, kbFiles } from '@/lib/kb/collections';
import { LEVEL_LABEL, SENSITIVITY_LABEL } from '@/lib/kb/i18n';
import { getSettings } from '@/lib/kb/service';
import { getRecordStore } from '@/lib/records';

export const metadata = { title: 'Security & governance' };

export default async function SecurityPage() {
  const user = await requireStaff('kb.view');
  if (!can(user, 'kb.approve') && !can(user, 'kb.admin')) return <Panel title="Security & governance"><p className="text-sm text-muted">Approvers and admins only.</p></Panel>;
  const lang = getLang();
  const [settings, staff, articles, files] = await Promise.all([getSettings(), getCrmRepo().listStaff(), kbArticles.list(getRecordStore()), kbFiles.list(getRecordStore())]);
  const teachers = staff.filter((s) => s.roles.some((r) => ['faculty', 'class_teacher', 'academic_coordinator'].includes(r)));
  const count = (k: string) => [...articles, ...files].filter((r) => r.data.sensitivity === k).length;
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-heading">Security & knowledge governance</h1>
      <Panel title="How access works">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Every article, file and centre has one <b>access level</b> and one <b>sensitivity label</b>; a person reads an item only when both allow it. Confidential items never reach students or parents; Restricted items reach only Principal, Management, Super Admin and the owner.</li>
          <li>The data sits in Supabase tables with <b>RLS on and no policies</b> (service role only), so the browser can’t read it; the server checks every page, download and AI question.</li>
          <li><b>AI permission filter</b>: retrieval drops every chunk the asker can’t read <i>before</i> scoring, so restricted text never reaches the model or the answer.</li>
          <li><b>PII</b>: phone numbers are masked for roles without phone access and are stripped from public chatbot answers. Documents are treated as data, never instructions (prompt-injection guard).</li>
          <li>Views, downloads, edits and AI questions go to the audit log; confidential/restricted PDFs are watermarked with the downloader’s name and time. Search and AI are rate-limited per person.</li>
          <li>Backups: Supabase point-in-time recovery (paid plans) plus the Super Admin backup download on Security; run a restore test each term.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Labels in use: {SENSITIVITY.map((s) => `${SENSITIVITY_LABEL[s][lang]} ${count(s)}`).join(' · ')}</p>
      </Panel>
      <Panel title="Who reads which level (active role)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Role</th>{LEVELS.map((l) => <th key={l} className="px-1">{LEVEL_LABEL[l][lang]}</th>)}</tr></thead>
            <tbody>
              {[...ROLES].map((r) => {
                const lv = levelsForRole(r);
                return <tr key={r} className="border-t border-line"><td className="py-1 pr-2">{ROLE_LABELS[r]}</td>{LEVELS.map((l) => <td key={l} className="px-1 text-center">{lv.includes(l) ? '●' : ''}</td>)}</tr>;
              })}
              <tr className="border-t border-line"><td className="py-1 pr-2">Student (app)</td>{LEVELS.map((l) => <td key={l} className="px-1 text-center">{l === 'public' || l === 'student' ? '●' : ''}</td>)}</tr>
              <tr className="border-t border-line"><td className="py-1 pr-2">Parent (app, own child only)</td>{LEVELS.map((l) => <td key={l} className="px-1 text-center">{l === 'public' || l === 'parent' ? '●' : ''}</td>)}</tr>
              <tr className="border-t border-line"><td className="py-1 pr-2">Website visitor</td>{LEVELS.map((l) => <td key={l} className="px-1 text-center">{l === 'public' ? '●' : ''}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">A faculty member named Subject Head below also reads “Subject heads” items.</p>
      </Panel>
      <Panel title="Subject heads (§7)">
        <QuickForm action={subjectHeadsAction} submit="Save subject heads" cols={4} reset={false} fields={DEPARTMENTS.map((d) => ({ name: d.id, label: d.name[lang], type: 'select' as const, defaultValue: settings.subjectHeads[d.id] ?? '', options: [{ value: '', label: '— none —' }, ...teachers.map((s) => ({ value: s.id, label: s.fullName }))] }))} />
      </Panel>
      {can(user, 'kb.admin') && (
        <Panel title="Retention & review">
          <QuickForm action={governanceAction} submit="Save" cols={2} reset={false} fields={[{ name: 'retentionYears', label: 'Archive after (years)', type: 'number', min: 1, max: 25, defaultValue: String(settings.retentionYears) }, { name: 'reviewMonths', label: 'Default review interval (months)', type: 'number', min: 1, max: 36, defaultValue: String(settings.reviewMonths) }]} />
          <p className="mt-2 text-xs text-muted">Every article/file gets an owner and a “review by” date; owners are reminded 14 days before it passes. DPDP Act 2023 data-deletion requests: delete the person’s AI history (they can do it themselves), and remove personal documents from the Documents screen; record the request in the Recognition & Compliance centre.</p>
        </Panel>
      )}
      <Panel title="Assistants: prompts and suggested questions (§17)">
        <div className="space-y-3">
          {ASSISTANTS.map((a) => (
            <details key={a} className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">{ASSISTANT_INFO[a].name[lang]}</summary>
              <div className="mt-2">
                <QuickForm action={assistantSettingsAction} submit="Save assistant" cols={1} reset={false} fields={[{ name: 'assistant', type: 'hidden', value: a }, { name: 'prompt', label: 'Instructions (added to the fixed safety rules)', type: 'textarea', rows: 3, defaultValue: settings.assistants[a]?.prompt ?? ASSISTANT_INFO[a].prompt }, { name: 'suggestions', label: 'Suggested questions (one per line)', type: 'textarea', rows: 3, defaultValue: (settings.assistants[a]?.suggestions ?? ASSISTANT_INFO[a].suggestions.en).join('\n') }]} />
              </div>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}
