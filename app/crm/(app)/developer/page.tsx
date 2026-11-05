import Link from 'next/link';
import { openPortalAsAction, syncKnowledgeAction } from '@/app/crm/developer-actions';
import { getContent } from '@/lib/cms';
import { formatDateTime } from '@/lib/dates';
import { indexStatus } from '@/lib/rag';
import { Panel } from '@/components/crm/ui';
import { getAppStore } from '@/lib/app/service';
import { devLoginEnabled, requireStaff } from '@/lib/crm/auth';
import { isDeveloper, PERMISSIONS } from '@/lib/crm/permissions';
import { usingSupabase } from '@/lib/crm/repo';
import { ROLE_LABELS, ROLES } from '@/lib/crm/types';
import { BLOCK_KEYS } from '@/lib/cms/blocks';
import { QUESTIONS } from '@/lib/practice/bank';
import { maskPhone } from '@/lib/phone';

export const metadata = { title: 'Developer console' };
export const dynamic = 'force-dynamic';

const WEBSITE = ['/', '/about', '/admission-system', '/admissions', '/apply', '/programs', '/programs/iit-jee', '/programs/neet', '/programs/long-term-jee', '/programs/long-term-neet', '/course-finder', '/results', '/fees', '/scholarship', '/hostel', '/campus', '/visit', '/track', '/resources', '/mock-test', '/predictor', '/faculty', '/blog', '/downloads', '/careers', '/parents', '/contact', '/login', '/sitemap.xml', '/robots.txt'];
const CRM = ['/crm', '/crm/summary', '/crm/dashboard', '/crm/reports', '/crm/leads', '/crm/import', '/crm/visits', '/crm/front-desk', '/crm/verification', '/crm/accounts', '/crm/inbox', '/crm/whatsapp', '/crm/assistant', '/crm/college-assistant', '/crm/students', '/crm/academics', '/crm/academics/overview', '/crm/academics/my-classes', '/crm/mentor', '/crm/practice', '/crm/syllabus', '/crm/homework', '/crm/library', '/crm/events', '/crm/notices', '/crm/hostel', '/crm/transport', '/crm/leave', '/crm/alumni', '/crm/exports', '/crm/cms', '/crm/cms/knowledgeBase', '/crm/marketing', '/crm/staff', '/crm/permissions', '/crm/security', '/crm/account'];
const PORTAL = ['/app', '/app/practice', '/app/syllabus', '/app/timetable', '/app/attendance', '/app/homework', '/app/tests', '/app/results', '/app/report-card', '/app/study', '/app/doubts', '/app/fees', '/app/notices', '/app/events', '/app/leave', '/app/ptm', '/app/messages', '/app/outpass', '/app/hostel', '/app/bus', '/app/id-card', '/app/apply', '/app/documents', '/app/visit', '/app/alumni', '/app/more'];

const set = (v: string | undefined) => (v ? 'set' : 'not set');

export default async function DeveloperPage() {
  const user = await requireStaff();
  if (!isDeveloper(user)) {
    return <Panel title="Developer console"><p className="text-sm text-muted">Only the Developer role can open this page.</p></Panel>;
  }
  const dev = devLoginEnabled();
  const kb = indexStatus(await getContent());
  const students = dev ? await getAppStore().listStudents() : [];
  const families = dev
    ? await Promise.all(students.slice(0, 50).map(async (s) => ({ s, guardians: await getAppStore().guardiansOf(s.id) })))
    : [];

  const LinkList = ({ items }: { items: string[] }) => (
    <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map((h) => <li key={h}><Link href={h} className="font-mono text-xs text-maroon underline dark:text-gold">{h}</Link></li>)}
    </ul>
  );

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Developer console</h1>
        <p className="text-sm text-muted">Signed in as {user.fullName} · Developer. This role has every permission ({PERMISSIONS.length}), always, and edits all {BLOCK_KEYS.length} website content blocks. Every action is still recorded in the audit and login logs.</p>
      </div>

      <Panel title="Environment">
        <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt className="text-muted">Mode</dt><dd className="font-mono">{process.env.NODE_ENV}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Data store</dt><dd className="font-mono">{usingSupabase() ? 'Supabase' : 'local file (.data/dev-db.json)'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">SUPABASE_URL</dt><dd className="font-mono">{process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : 'not set'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">SUPABASE_SERVICE_ROLE_KEY</dt><dd className="font-mono">{set(process.env.SUPABASE_SERVICE_ROLE_KEY)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">ANTHROPIC_API_KEY (AI chat)</dt><dd className="font-mono">{set(process.env.ANTHROPIC_API_KEY)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">WhatsApp</dt><dd className="font-mono">{process.env.MESSAGING_PROVIDER || 'logging only'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">SMTP (7 PM email)</dt><dd className="font-mono">{set(process.env.SMTP_HOST)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Razorpay</dt><dd className="font-mono">{set(process.env.RAZORPAY_KEY_ID)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Roles</dt><dd className="font-mono">{ROLES.length} built-in</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Practice questions</dt><dd className="font-mono">{QUESTIONS.length}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted">Secrets are shown only as set / not set. Change them in <span className="font-mono">.env.local</span> and restart the server.</p>
      </Panel>

      <Panel title="AI knowledge base (shared by the voice and chat assistants)">
        <p className="text-sm">Version <span className="font-mono">{kb.version}</span> · {kb.chunks} chunks from {kb.sections.length} sections · indexed {formatDateTime(kb.builtAt)}{kb.sampleChunks ? ` · ${kb.sampleChunks} still sample data` : ''}</p>
        <p className="mt-1 text-xs text-muted">Built from the verified website content (Website content / CMS + confirmed college facts). It re-indexes automatically after every content save; use Sync now to force it. Retrieval: keyword (BM25) with Telugu/Hindi expansion and typo correction. AI answers: {process.env.ANTHROPIC_API_KEY ? 'Claude' : 'knowledge-base answers (no ANTHROPIC_API_KEY)'} · Voice: {process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION ? 'Azure female neural voices' : 'browser female voice (no AZURE_SPEECH_KEY)'}.</p>
        <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-3">{kb.sections.map((s) => <li key={s.section}><Link href={s.url} className="underline">{s.section}</Link> · {s.chunks}</li>)}</ul>
        <form action={syncKnowledgeAction} className="mt-3"><button className="btn-outline py-1.5 text-sm">Sync now</button></form>
      </Panel>

      <Panel title="Change anything">
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['/crm/cms', 'Website content (all blocks)'],
            ['/crm/permissions', 'Permission matrix & custom roles'],
            ['/crm/staff', 'Staff accounts & roles'],
            ['/crm/security', 'Login audit & 2FA'],
            ['/crm/college-assistant', 'College assistant & query log'],
            ['/crm/exports', 'Excel exports'],
          ].map(([h, l]) => <li key={h}><Link href={h} className="card block p-3 font-medium text-heading hover:border-gold">{l}</Link></li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">To act as another staff role, use “View as” on Staff accounts (read-only, logged), or sign in as that sample user locally. Roles: {ROLES.map((r) => ROLE_LABELS[r]).join(', ')}.</p>
      </Panel>

      <Panel title={`Open the Student & Parent portal as a family${dev ? '' : ' (local development only)'}`}>
        {!dev ? (
          <p className="text-sm text-muted">Turned off here: it only works in local development (no Supabase), so a developer session can never browse families’ data on the live site without their sign-in.</p>
        ) : families.length === 0 ? (
          <p className="text-sm text-muted">No admitted students yet. Sign in as the Admission Manager and press <strong>Load demo leads</strong> to create sample students.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {families.map(({ s, guardians }) => {
              const phones = [...new Map([[s.guardianPhone, `${s.guardianName} (guardian)`], ...guardians.map((g) => [g.phone, `${g.name} (${g.relation})`] as const), ...(s.loginPhone ? [[s.loginPhone, `${s.fullName} (student)`] as const] : [])]).entries()];
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><span className="font-medium text-heading">{s.fullName}</span> <span className="font-mono text-xs text-muted">{s.collegeId}</span></span>
                  <span className="flex flex-wrap gap-2">
                    {phones.map(([phone, label]) => (
                      <form key={phone} action={openPortalAsAction}>
                        <input type="hidden" name="phone" value={phone} />
                        <button className="btn-outline px-3 py-1 text-xs" title={maskPhone(phone)}>Open as {label}</button>
                      </form>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={`Website (${WEBSITE.length})`}><LinkList items={WEBSITE} /></Panel>
      <Panel title={`Staff CRM (${CRM.length})`}><LinkList items={CRM} /></Panel>
      <Panel title={`Student & Parent portal (${PORTAL.length})`}><LinkList items={PORTAL} /></Panel>
    </div>
  );
}
