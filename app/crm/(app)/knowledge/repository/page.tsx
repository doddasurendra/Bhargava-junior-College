import Link from 'next/link';
import { categoryAction } from '@/app/crm/kb-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { AccessPill, SamplePill, StatusPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { getLang } from '@/lib/i18n-server';
import { LEVELS } from '@/lib/kb/access';
import { CENTRES, centreById } from '@/lib/kb/centres';
import { STATUSES, TYPES } from '@/lib/kb/collections';
import { LEVEL_LABEL, kbT, pick, STATUS_LABEL } from '@/lib/kb/i18n';
import { listArticles, listCategories, staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Knowledge repository' };

type SP = { centre?: string; status?: string; access?: string; type?: string; q?: string; channel?: string };

export default async function RepositoryPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const v = await staffViewer(user);
  const rows = (await listArticles(v, { centre: searchParams.centre || undefined, status: (searchParams.status as never) || 'all', access: (searchParams.access as never) || undefined, type: searchParams.type || undefined, q: searchParams.q?.slice(0, 100) || undefined })).filter((r) => !searchParams.channel || r.a.channels.includes(searchParams.channel as never));
  const cats = await listCategories();
  const sel = (name: keyof SP, opts: { value: string; label: string }[], label: string) => (
    <label className="text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wider text-muted">{label}</span>
      <select name={name} defaultValue={searchParams[name] ?? ''} className="input py-1.5 text-sm">
        <option value="">{t.all}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">{t.repository}</h1>
          <p className="text-sm text-muted">{rows.length} {t.articles.toLowerCase()} · website, app, chatbot and staff repositories are one store, separated by channel.</p>
        </div>
        {can(user, 'kb.edit') && <Link href={`/crm/knowledge/articles/new${searchParams.centre ? `?centre=${searchParams.centre}` : ''}`} className="btn-primary py-2 text-sm">+ {t.newArticle}</Link>}
      </div>
      <form className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3 lg:grid-cols-7">
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-semibold uppercase tracking-wider text-muted">{t.search}</span>
          <input name="q" defaultValue={searchParams.q ?? ''} className="input py-1.5 text-sm" maxLength={100} />
        </label>
        {sel('centre', CENTRES.filter((c) => c.kind === 'content' || c.id === 'core').map((c) => ({ value: c.id, label: c.name[lang] })), t.centre)}
        {sel('status', STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s][lang] })), t.status)}
        {sel('access', LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l][lang] })), t.access)}
        {sel('channel', [{ value: 'website', label: 'Website' }, { value: 'app', label: 'Mobile app' }, { value: 'bot', label: 'Chatbot/voice' }, { value: 'staff', label: 'Staff' }], 'Repository')}
        <div className="flex items-end gap-2">
          {sel('type', TYPES.map((x) => ({ value: x, label: x })), 'Type')}
          <button className="btn-outline py-1.5 text-sm">{t.search}</button>
        </div>
      </form>

      <Panel title={`${t.articles} (${rows.length})`}>
        {rows.length === 0 ? <Empty>{t.noResults}</Empty> : (
          <ul className="divide-y divide-line">
            {rows.map(({ id, a, live, updatedAt }) => (
              <li key={id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/crm/knowledge/articles/${id}`} className="font-medium text-heading underline-offset-2 hover:underline">{pick(a.title, lang)}</Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {centreById(a.centre)?.icon} {centreById(a.centre)?.name[lang] ?? a.centre}
                    {a.topic ? ` · ${centreById(a.centre)?.topics.find((x) => x.key === a.topic)?.t[lang] ?? a.topic}` : ''} · v{a.version}
                    {live && a.status !== 'published' ? ` (live: v${a.liveVersion})` : ''} · {formatDate(updatedAt.slice(0, 10), { day: 'numeric', month: 'short' })} · {a.channels.join(', ')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SamplePill show={a.sample} label={t.sample} />
                  {a.aiGenerated && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900">AI draft</span>}
                  <AccessPill access={a.access} sensitivity={a.sensitivity} lang={lang} />
                  <StatusPill status={a.status} lang={lang} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Categories (${cats.length})`}>
        {cats.length > 0 && (
          <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
            {cats.map((c) => (
              <li key={c.id}>
                {c.data.parentId ? '↳ ' : ''}{c.data.icon} {pick(c.data.name, lang)} <span className="text-xs text-muted">· {centreById(c.data.centre)?.name[lang]}{c.data.reviewerRoles.length ? ` · reviewers: ${c.data.reviewerRoles.join(', ')}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {can(user, 'kb.approve') ? (
          <QuickForm action={categoryAction} submit="Add category" cols={3} fields={[
            { name: 'nameEn', label: 'Name (English)', type: 'text', required: true },
            { name: 'nameTe', label: 'పేరు (తెలుగు)', type: 'text' },
            { name: 'nameHi', label: 'नाम (हिंदी)', type: 'text' },
            { name: 'centre', label: t.centre, type: 'select', required: true, options: CENTRES.filter((c) => c.kind === 'content').map((c) => ({ value: c.id, label: c.name[lang] })) },
            { name: 'parentId', label: 'Parent category', type: 'select', options: [{ value: '', label: '— top level —' }, ...cats.map((c) => ({ value: c.id, label: c.data.name.en }))] },
            { name: 'icon', label: 'Icon (emoji)', type: 'text', maxLength: 8 },
            { name: 'reviewerRoles', label: 'Reviewer roles (comma separated, e.g. principal, academic_coordinator)', type: 'text', wide: true },
          ]} />
        ) : <p className="text-xs text-muted">Approvers manage categories.</p>}
      </Panel>
    </div>
  );
}
