import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { deptRequestAction, licenceAction } from '@/app/crm/kb-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { AskBox } from '@/components/kb/client';
import { AccessPill, SamplePill, StatusPill } from '@/components/kb/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getLang } from '@/lib/i18n-server';
import { ASSISTANT_INFO, assistantsFor, type AssistantId } from '@/lib/kb/ai';
import { centreById, DEPARTMENTS, type DepartmentId } from '@/lib/kb/centres';
import { listFiles } from '@/lib/kb/files';
import { kbT, pick } from '@/lib/kb/i18n';
import { liveFor } from '@/lib/kb/live';
import { canOpenCentre } from '@/lib/kb/nav';
import { audit, getSettings, listArticles, staffViewer } from '@/lib/kb/service';

export const metadata = { title: 'Knowledge centre' };

const SYSTEM: Record<string, string> = { core: '/crm/knowledge', documents: '/crm/knowledge/documents', ai: '/crm/knowledge/search', advanced_ai: '/crm/knowledge/intelligence', notifications: '/crm/knowledge/notifications', security: '/crm/knowledge/security', supabase: '/crm/knowledge/supabase', analytics: '/crm/knowledge/analytics' };
const ASSISTANT_OF: Record<string, AssistantId> = { student: 'student', student360: 'faculty', parent: 'parent', faculty: 'faculty', departments: 'subject_head', principal: 'principal', management: 'management', admission: 'admission', career: 'career', library: 'library', exams: 'exam', events: 'student', admin_ops: 'principal', compliance: 'principal' };

export default async function CentrePage({ params, searchParams }: { params: { id: string }; searchParams: { dept?: string; student?: string } }) {
  const user = await requireStaff('kb.view');
  const lang = getLang();
  const t = kbT(lang);
  const c = centreById(params.id);
  if (!c) notFound();
  if (SYSTEM[c.id]) redirect(SYSTEM[c.id]);
  const v = await staffViewer(user);
  if (!canOpenCentre(v, c)) return <Panel title={`${c.icon} ${c.name[lang]}`}><p className="text-sm text-muted">{t.noAccess}</p></Panel>;
  await audit(v, 'view', 'centre', c.id, c.name.en);
  const dept = (DEPARTMENTS.find((d) => d.id === searchParams.dept)?.id ?? (v.kind === 'staff' && v.subjectHeadOf?.[0]) ?? 'physics') as DepartmentId;
  const [articles, files, live, settings] = await Promise.all([
    listArticles(v, { centre: c.id, status: 'all', department: c.id === 'departments' ? dept : undefined }),
    listFiles(v, { centre: c.id, status: 'all' }),
    liveFor(user, c.id, { dept: c.id === 'departments' ? dept : null, student: searchParams.student ?? null }),
    getSettings(),
  ]);
  const editor = can(user, 'kb.edit');
  const shownFiles = c.id === 'departments' ? files.filter((f) => !f.data.department || f.data.department === dept) : files;
  const byTopic = (key: string | null) => ({ a: articles.filter((x) => (x.a.topic ?? null) === key), f: shownFiles.filter((x) => (x.data.topic ?? null) === key) });
  const assistants = assistantsFor(v);
  const initial = assistants.includes(ASSISTANT_OF[c.id]) ? ASSISTANT_OF[c.id] : assistants[0];
  const other = byTopic(null);
  const isHead = (v.kind === 'staff' && v.subjectHeadOf?.includes(dept)) || can(user, 'kb.approve');
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">§{c.section} · {t.centres}</p>
        <h1 className="mt-1 font-display text-3xl text-heading">{c.icon} {c.name[lang]}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{c.intro}</p>
      </div>

      {c.id === 'departments' && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Departments">
          {DEPARTMENTS.map((d) => (
            <Link key={d.id} href={`?dept=${d.id}`} aria-current={d.id === dept ? 'page' : undefined} className={`rounded-full border px-3 py-1 text-xs font-medium ${d.id === dept ? 'border-navy bg-navy text-white dark:border-gold dark:bg-gold dark:text-navy-950' : 'border-line'}`}>
              {d.name[lang]}{settings.subjectHeads[d.id] ? '' : ' (no head set)'}
            </Link>
          ))}
        </nav>
      )}

      {(live.tiles.length > 0 || live.tables.length > 0) && (
        <Panel title={`⚡ ${t.liveData}`} actions={<span className="text-[11px] text-muted">{t.liveNote}</span>}>
          {live.tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {live.tiles.map((x, i) => <Stat key={i} label={x.label} value={x.value} href={x.href} tone={x.tone === 'warn' ? 'warn' : x.tone === 'good' ? 'good' : 'default'} />)}
            </div>
          )}
          {live.tables.map((tb, i) => (
            <div key={i} className="mt-4 overflow-x-auto">
              <p className="mb-1 text-sm font-semibold text-heading">{tb.title}</p>
              {tb.rows.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted">{tb.headers.map((h) => <th key={h} className="py-1 pr-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {tb.rows.map((r, j) => (
                      <tr key={j} className="border-t border-line">
                        {r.cells.map((cell, k) => <td key={k} className="py-1.5 pr-3">{k === 0 && r.href ? <Link href={r.href} className="underline">{cell}</Link> : cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tb.note && <p className="mt-1 text-[11px] text-muted">{tb.note}</p>}
            </div>
          ))}
        </Panel>
      )}

      <Panel title={`🤖 ${ASSISTANT_INFO[initial].name[lang]}`}>
        <AskBox assistants={assistants.map((a) => ({ id: a, name: ASSISTANT_INFO[a].name[lang] }))} initial={initial} suggestions={(settings.assistants[initial]?.suggestions?.length ? settings.assistants[initial].suggestions : ASSISTANT_INFO[initial].suggestions[lang]).slice(0, 3)} labels={{ placeholder: t.askPlaceholder, ask: t.askButton, sources: t.sources, page: t.page, basedOn: t.basedOn, helpful: t.helpful, notHelpful: t.notHelpful, suggested: t.suggested }} compact />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {[...c.topics.map((tp) => ({ key: tp.key as string | null, tp })), ...(other.a.length || other.f.length ? [{ key: null, tp: null }] : [])].map(({ key, tp }) => {
          const { a, f } = byTopic(key);
          const link = tp?.crm ?? tp?.site ?? null;
          return (
            <section key={key ?? 'other'} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-heading">{tp ? tp.t[lang] : 'Other'}</h2>
                <span className="flex gap-2 text-xs">
                  {link && <Link href={link} className="underline">{t.open} ↗</Link>}
                  {editor && <Link href={`/crm/knowledge/articles/new?centre=${c.id}${key ? `&topic=${key}` : ''}`} className="underline">+ {t.newArticle}</Link>}
                </span>
              </div>
              {tp?.note && editor && <p className="mt-0.5 text-[11px] text-muted">BJC version: {tp.note}</p>}
              {a.length + f.length === 0 ? <p className="mt-2 text-xs text-muted">{link ? 'Shown live from its module (link above).' : 'No articles yet.'}</p> : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {a.map(({ id, a: x }) => (
                    <li key={id} className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/crm/knowledge/articles/${id}`} className="underline">{pick(x.title, lang)}</Link>
                      <SamplePill show={x.sample} label={t.sample} />
                      {x.status !== 'published' && <StatusPill status={x.status} lang={lang} />}
                      {x.sensitivity !== 'public' && x.sensitivity !== 'internal' && <AccessPill access={x.access} sensitivity={x.sensitivity} lang={lang} />}
                    </li>
                  ))}
                  {f.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-1.5">
                      📄 <Link href={`/crm/knowledge/documents/${x.id}`} className="underline">{pick(x.data.title, lang)}</Link>
                      <SamplePill show={x.data.sample} label={t.sample} />
                      {x.data.status !== 'published' && <StatusPill status={x.data.status} lang={lang} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {c.id === 'departments' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Add lab equipment">
            <QuickForm action={deptRequestAction} submit="Add to inventory" fields={[{ name: 'department', type: 'hidden', value: dept }, { name: 'kind', type: 'hidden', value: 'equipment' }, { name: 'item', label: 'Item', type: 'text', required: true }, { name: 'qty', label: 'Quantity', type: 'number', min: 0, max: 10000, defaultValue: '1' }, { name: 'condition', label: 'Condition', type: 'select', options: [{ value: 'good', label: 'Good' }, { value: 'needs_repair', label: 'Needs repair' }, { value: 'broken', label: 'Broken' }] }, { name: 'note', label: 'Note', type: 'text' }]} />
          </Panel>
          <Panel title="Purchase / expense request">
            {isHead || can(user, 'kb.edit') ? (
              <QuickForm action={deptRequestAction} submit="Send request" fields={[{ name: 'department', type: 'hidden', value: dept }, { name: 'kind', label: 'Kind', type: 'select', options: [{ value: 'purchase', label: 'Purchase' }, { value: 'expense', label: 'Expense' }] }, { name: 'item', label: 'Item / purpose', type: 'text', required: true }, { name: 'qty', label: 'Quantity', type: 'number', min: 1, max: 10000, defaultValue: '1' }, { name: 'amount', label: 'Amount (₹)', type: 'number', min: 0, max: 100000000, defaultValue: '0' }, { name: 'note', label: 'Why', type: 'text' }]} />
            ) : <p className="text-sm text-muted">The subject head sends requests.</p>}
            <p className="mt-2 text-xs text-muted">Requests go to the approvals inbox.</p>
          </Panel>
        </div>
      )}
      {(c.id === 'compliance' || c.id === 'admin_ops') && (can(user, 'kb.approve') || user.roles[0] === 'admin_office') && (
        <Panel title="Add a licence / NOC">
          <QuickForm action={licenceAction} submit="Save licence" cols={3} fields={[{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'campus', label: 'Campus', type: 'select', options: [{ value: 'girls_bairamalguda', label: 'Girls · Bairamalguda' }, { value: 'boys_kuntloor', label: 'Boys · Kuntloor' }, { value: 'day_lb_nagar', label: 'Day scholar · LB Nagar' }, { value: 'all', label: 'All / central office' }] }, { name: 'kind', label: 'Kind', type: 'select', options: ['building', 'fire', 'health', 'hostel', 'tsbie', 'other'].map((k) => ({ value: k, label: k })) }, { name: 'number', label: 'Number', type: 'text' }, { name: 'validTo', label: 'Valid to', type: 'date', required: true }, { name: 'fileId', label: 'Document id (optional)', type: 'text' }]} />
        </Panel>
      )}
    </div>
  );
}
