import Link from 'next/link';
import { gapAction } from '@/app/crm/kb-actions';
import { ActionButton } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { AskBox } from '@/components/kb/client';
import { fmtBytes } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getLang } from '@/lib/i18n-server';
import { ASSISTANT_INFO, assistantsFor } from '@/lib/kb/ai';
import { kbT } from '@/lib/kb/i18n';
import { dashboard } from '@/lib/kb/insights';
import { centresFor } from '@/lib/kb/nav';
import { getSettings, staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Knowledge Hub' };

export default async function KnowledgeDashboard() {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const [d, settings] = await Promise.all([dashboard(), getSettings()]);
  const assistants = assistantsFor(v);
  const centres = centresFor(v).filter((c) => c.kind === 'content');
  const ask = assistants[0];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label={t.articles} value={d.articles} href="/crm/knowledge/repository" />
        <Stat label={t.files} value={d.files} href="/crm/knowledge/documents" />
        <Stat label={t.chunks} value={d.chunks} />
        <Stat label={t.newThisWeek} value={d.newThisWeek} tone="good" />
        <Stat label={t.changedThisWeek} value={d.changedThisWeek} />
        <Stat label={t.pending} value={d.pending} tone={d.pending ? 'warn' : 'default'} href={can(user, 'kb.approve') ? '/crm/knowledge/approvals' : undefined} />
        <Stat label={t.outdated} value={d.outdated} tone={d.outdated ? 'alert' : 'good'} href={can(user, 'kb.analytics') ? '/crm/knowledge/audit' : undefined} />
        <Stat label={t.storage} value={fmtBytes(d.storage.bytes)} />
      </div>

      <Panel title={`🤖 ${t.ask}`}>
        <AskBox
          assistants={assistants.map((a) => ({ id: a, name: ASSISTANT_INFO[a].name[lang] }))}
          initial={ask}
          suggestions={(settings.assistants[ask]?.suggestions?.length ? settings.assistants[ask].suggestions : ASSISTANT_INFO[ask].suggestions[lang]).slice(0, 4)}
          labels={{ placeholder: t.askPlaceholder, ask: t.askButton, sources: t.sources, page: t.page, basedOn: t.basedOn, helpful: t.helpful, notHelpful: t.notHelpful, suggested: t.suggested }}
          compact
        />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t.topSearches}>
          {d.topSearches.length === 0 ? <Empty>No searches yet.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {d.topSearches.map((s) => (
                <li key={s.q} className="flex justify-between py-1.5">
                  <Link href={`/crm/knowledge/search?q=${encodeURIComponent(s.q)}`} className="underline">{s.q}</Link>
                  <span className="font-mono text-muted">{s.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t.unanswered}>
          {d.unanswered.length === 0 ? <Empty>No unanswered questions.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {d.unanswered.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>{g.q} <span className="text-xs text-muted">×{g.count} · {g.assistant}</span></span>
                  {can(user, 'kb.edit') && <ActionButton action={gapAction} label="Create article" hidden={{ id: g.id, what: 'create' }} className="btn-outline py-1 text-xs" />}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t.centres}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {centres.map((c) => (
            <li key={c.id}>
              <Link href={`/crm/knowledge/centres/${c.id}`} className="card block h-full p-4 hover:border-gold">
                <p className="font-semibold text-heading">{c.icon} {c.name[lang]}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{c.intro}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="text-xs text-muted">Storage: {fmtBytes(d.storage.bytes)} of {fmtBytes(d.storage.quota)} ({d.storage.backend === 'local' ? 'local folder .data/kb-files' : 'Supabase bucket kb-files'}) · {d.published} of {d.articles} articles published.</p>
    </div>
  );
}
