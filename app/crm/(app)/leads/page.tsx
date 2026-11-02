import Link from 'next/link';
import { BulkForm } from '@/components/crm/forms';
import { CategoryBadge, Empty, FollowUpBadge, programShort, sourceLabel, StatusBadge } from '@/components/crm/ui';
import { programs, PROGRAM_SLUGS } from '@/content/programs';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { getCrmRepo } from '@/lib/crm/repo';
import { listLeads, type Queue } from '@/lib/crm/service';
import { LEAD_CATEGORIES, LEAD_STATUSES, ROLE_LABELS, STATUS_LABELS, type LeadFilter } from '@/lib/crm/types';
import { LEAD_SOURCES } from '@/lib/validation';

export const metadata = { title: 'Leads' };

const QUEUES: { value: Queue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'unassigned', label: 'Unassigned' },
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireStaff();
  const all = can(user, 'lead.viewAll');
  const queue = pick(one(searchParams.queue), QUEUES.map((q) => q.value)) ?? 'all';
  const filter: LeadFilter = {
    category: pick(one(searchParams.category), [...LEAD_CATEGORIES, 'none'] as const),
    status: pick(one(searchParams.status), LEAD_STATUSES),
    program: pick(one(searchParams.program), PROGRAM_SLUGS),
    source: pick(one(searchParams.source), LEAD_SOURCES),
    q: one(searchParams.q)?.slice(0, 60),
  };
  const ownerParam = one(searchParams.owner);
  const staff = await getCrmRepo().listStaff();
  if (all && ownerParam && staff.some((s) => s.id === ownerParam)) filter.ownerId = ownerParam;

  const rows = await listLeads(user, filter, queue);
  const assignable = staff.filter((s) => s.roles.some((r) => ['telecaller', 'admission_counsellor', 'admission_manager'].includes(r)));
  const staffOptions = assignable.map((s) => ({ id: s.id, label: `${s.fullName} · ${s.roles.map((r) => ROLE_LABELS[r]).join(', ')}` }));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, one(v)])), ...patch })) if (v) p.set(k, v);
    return `/crm/leads${p.size ? `?${p}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-heading">{all ? 'All leads' : 'My leads'}</h1>
        <p className="font-mono text-sm text-muted">{rows.length} shown</p>
      </div>

      <nav aria-label="Queues" className="flex flex-wrap gap-1.5">
        {QUEUES.filter((q) => q.value !== 'unassigned' || all).map((q) => (
          <Link key={q.value} href={qs({ queue: q.value === 'all' ? undefined : q.value })} className={`chip px-3.5 py-1.5 text-sm ${queue === q.value ? 'chip-active' : ''}`}>
            {q.label}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap gap-2" method="get">
        {queue !== 'all' && <input type="hidden" name="queue" value={queue} />}
        <input name="q" defaultValue={filter.q} placeholder="Name, phone or school" className="input w-56 py-2 text-sm" />
        <select name="category" defaultValue={filter.category ?? ''} className="input w-auto py-2 text-sm">
          <option value="">Any category</option>
          <option value="none">Unqualified</option>
          {LEAD_CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
        <select name="status" defaultValue={filter.status ?? ''} className="input w-auto py-2 text-sm">
          <option value="">Any status</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select name="program" defaultValue={filter.program ?? ''} className="input w-auto py-2 text-sm">
          <option value="">Any program</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>{p.short}</option>
          ))}
        </select>
        <select name="source" defaultValue={filter.source ?? ''} className="input w-auto py-2 text-sm">
          <option value="">Any source</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>{sourceLabel(s)}</option>
          ))}
        </select>
        {all && (
          <select name="owner" defaultValue={filter.ownerId ?? ''} className="input w-auto py-2 text-sm">
            <option value="">Any owner</option>
            {assignable.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        )}
        <button className="btn-outline py-2">Filter</button>
        <Link href={queue === 'all' ? '/crm/leads' : `/crm/leads?queue=${queue}`} className="self-center text-sm text-muted underline">Clear</Link>
      </form>

      <BulkForm staff={staffOptions} canAssign={can(user, 'lead.assign')}>
        {rows.length === 0 ? (
          <Empty>No leads match.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="table-base min-w-[900px] text-[13px]">
              <thead>
                <tr>
                  {can(user, 'lead.assign') && <th className="w-8" aria-label="Select" />}
                  <th>Lead</th>
                  <th>Program</th>
                  <th>Category</th>
                  <th>Status</th>
                  {all && <th>Owner</th>}
                  <th>Follow-up</th>
                  <th>Age</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ lead, owner, follow }) => (
                  <tr key={lead.id} className="hover:bg-bg">
                    {can(user, 'lead.assign') && (
                      <td>
                        <input type="checkbox" name="ids" value={lead.id} className="h-4 w-4 accent-maroon" aria-label={`Select ${lead.contactName ?? lead.phone}`} />
                      </td>
                    )}
                    <td>
                      <Link href={`/crm/leads/${lead.id}`} className="font-semibold text-heading hover:underline">
                        {lead.contactName ?? lead.studentName ?? 'Unnamed'}
                      </Link>
                      <a href={`tel:${lead.phone}`} className="block font-mono text-xs text-muted hover:text-ink">{lead.phone}</a>
                    </td>
                    <td>{programShort(lead.program)}</td>
                    <td><CategoryBadge category={lead.category} /></td>
                    <td><StatusBadge status={lead.status} /></td>
                    {all && <td>{owner?.fullName ?? <span className="text-maroon dark:text-gold">Unassigned</span>}</td>}
                    <td><FollowUpBadge f={follow} /></td>
                    <td className="font-mono text-muted">{follow.ageDays}d</td>
                    <td className="capitalize text-muted">{sourceLabel(lead.firstSource)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BulkForm>
    </div>
  );
}
