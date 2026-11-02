import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssignForm, CallForm, CheckInButtons, DecisionForm, QualifyForm, VisitOutcomeForm } from '@/components/crm/forms';
import { CategoryBadge, Empty, FollowUpBadge, Panel, programShort, sourceLabel, StatusBadge } from '@/components/crm/ui';
import { VerificationPanel } from '@/components/crm/VerificationPanel';
import { VERIFY_STATUSES } from '@/lib/crm/verification';
import { verification } from '@/lib/crm/verifyService';
import { visitSlots } from '@/content/sample';
import { STAGES } from '@/lib/admission';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { visitFlag } from '@/lib/crm/rules';
import { CrmError, leadDetail } from '@/lib/crm/service';
import { CALL_OUTCOMES, LOST_REASONS, ROLE_LABELS } from '@/lib/crm/types';
import { addDays, formatDate, formatDateTime, todayIST } from '@/lib/dates';

export const metadata = { title: 'Lead' };

type Event = { at: string; kind: string; title: string; body?: string | null; who?: string | null };

export default async function LeadPage({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  let d;
  try {
    d = await leadDetail(user, params.id);
  } catch (e) {
    if (e instanceof CrmError) notFound();
    throw e;
  }
  const { lead, history, staff, owner, follow } = d;
  const verify = VERIFY_STATUSES.includes(lead.status) && can(user, 'verify.view') ? await verification(user, lead.id) : null;
  const name = (id: string | null) => (id ? staff.get(id)?.fullName ?? 'Staff' : 'System');
  const defaultFollowUp = `${addDays(todayIST(), 1)}T10:00`;
  const outcomeLabel = (v: string) => CALL_OUTCOMES.find((o) => o.value === v)?.label ?? v;

  const events: Event[] = [
    ...history.touchpoints.map((t) => ({ at: t.createdAt, kind: 'touch', title: `Website: ${sourceLabel(t.source)}`, body: [t.note, t.utmSource && `utm ${t.utmSource}${t.utmCampaign ? ` / ${t.utmCampaign}` : ''}`, t.page, t.device].filter(Boolean).join(' · ') })),
    ...history.calls.map((c) => ({ at: c.createdAt, kind: 'call', title: `Call: ${outcomeLabel(c.outcome)}${c.interest ? ` · ${c.interest}` : ''}`, body: [c.notes, c.nextFollowUpAt && `Next follow-up ${formatDateTime(c.nextFollowUpAt)}`].filter(Boolean).join(' · '), who: name(c.actorId) })),
    ...history.audit
      .filter((a) => !['touchpoint', 'call_logged', 'follow_up_set'].includes(a.action))
      .map((a) => ({
        at: a.at,
        kind: 'audit',
        title: a.action.replace(/_/g, ' '),
        body: [a.field === 'owner' ? `${name(a.oldValue)} → ${name(a.newValue)}` : a.oldValue || a.newValue ? `${a.oldValue ?? '—'} → ${a.newValue ?? '—'}` : null, a.reason && `Reason: ${a.reason}`].filter(Boolean).join(' · '),
        who: name(a.actorId),
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const staffOptions = Array.from(staff.values())
    .filter((s) => s.roles.some((r) => ['telecaller', 'admission_counsellor', 'admission_manager'].includes(r)))
    .map((s) => ({ id: s.id, label: `${s.fullName} · ${s.roles.map((r) => ROLE_LABELS[r]).join(', ')}` }));
  const slotLabel = (s: string) => visitSlots.slots.find((x) => x.slot === s)?.label ?? s;
  const stageIdx = STAGES.findIndex((s) => s.key === lead.stage);
  const closed = follow.state === 'closed';

  return (
    <div className="space-y-5">
      <Link href="/crm/leads" className="text-sm text-muted underline">← Leads</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-heading">{lead.contactName ?? lead.studentName ?? 'Unnamed lead'}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <a href={`tel:${lead.phone}`} className="font-mono font-semibold text-ink">{lead.phone}</a>
            <span>·</span>
            <span>{programShort(lead.program)}</span>
            <span>·</span>
            <CategoryBadge category={lead.category} />
            <StatusBadge status={lead.status} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${lead.phone}`} className="btn-primary py-2">Call</a>
          <a href={`https://wa.me/${lead.phone.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-outline py-2">WhatsApp</a>
        </div>
      </header>

      <ol className="flex flex-wrap gap-1 text-[11px]" aria-label="Admission stage">
        {STAGES.map((s, i) => (
          <li key={s.key} className={`rounded-full px-2.5 py-1 ${i <= stageIdx ? 'bg-gold text-navy-950' : 'bg-surface text-muted ring-1 ring-line'}`}>
            {s.label}
          </li>
        ))}
      </ol>

      {verify && <VerificationPanel user={user} lead={lead} record={verify.record} steps={verify.steps} checklist={verify.checklist} names={name} />}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Owner</p>
              <p className="mt-1 font-semibold text-heading">{owner?.fullName ?? 'Unassigned'}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Follow-up</p>
              <div className="mt-1"><FollowUpBadge f={follow} /></div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Last contact</p>
              <p className="mt-1 text-sm">{lead.lastContactAt ? formatDateTime(lead.lastContactAt) : 'Never contacted'}</p>
              <p className="text-xs text-muted">{follow.ageDays} days since {lead.lastContactAt ? 'contact' : 'enquiry'}</p>
            </div>
          </div>

          <Panel title="Details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ['Student', lead.studentName],
                ['Class', lead.classLevel],
                ['School', lead.school],
                ['Board', lead.board],
                ['Area', lead.area],
                ['First source', sourceLabel(lead.firstSource)],
                ['Latest source', sourceLabel(lead.lastSource)],
                ['Enquired', formatDateTime(lead.createdAt)],
                ...(lead.lostReason ? [['Lost reason', `${LOST_REASONS.find((r) => r.value === lead.lostReason)?.label ?? lead.lostReason}${lead.lostCompetitor ? `: ${lead.lostCompetitor}` : ''}`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-1.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className={`text-right ${k?.includes('source') ? 'capitalize' : ''}`}>{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title={`Campus visits (${history.visits.length})`}>
            {history.visits.length === 0 ? (
              <Empty>No visit booked yet.</Empty>
            ) : (
              <ul className="space-y-3">
                {history.visits.map((v) => {
                  const flag = visitFlag(v);
                  return (
                    <li key={v.id} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">{formatDate(v.date)} · {slotLabel(v.slot)} · {v.familySize} people</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${flag === 'escalated' ? 'bg-red-600 text-white' : flag === 'needs_outcome' ? 'bg-red-100 text-red-800' : 'bg-bg'}`}>
                          {flag === 'ok' ? v.status.replace('_', ' ') : flag === 'escalated' ? 'Outcome overdue · escalated' : 'Outcome needed'}
                        </span>
                      </div>
                      {v.outcome && <p className="mt-2 text-sm text-muted">{v.outcome} <span className="text-xs">— {name(v.outcomeBy)}</span></p>}
                      {v.status === 'scheduled' && v.date <= todayIST() && can(user, 'visit.checkin') && <div className="mt-2"><CheckInButtons visitId={v.id} /></div>}
                      {v.status === 'arrived' && can(user, 'visit.outcome') && <div className="mt-2"><VisitOutcomeForm visitId={v.id} /></div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="History">
            {events.length === 0 ? (
              <Empty>No activity yet.</Empty>
            ) : (
              <ol className="space-y-3">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.kind === 'call' ? 'bg-maroon' : e.kind === 'touch' ? 'bg-gold' : 'bg-navy dark:bg-white/60'}`} />
                    <div className="min-w-0">
                      <p>
                        <span className="font-semibold capitalize text-heading">{e.title}</span>
                        <span className="text-xs text-muted"> · {formatDateTime(e.at)}{e.who ? ` · ${e.who}` : ''}</span>
                      </p>
                      {e.body && <p className="break-words text-muted">{e.body}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          {can(user, 'lead.assign') && (
            <Panel title="Owner">
              <AssignForm leadId={lead.id} currentOwner={lead.ownerId} staff={staffOptions} />
            </Panel>
          )}
          {can(user, 'lead.qualify') && (
            <Panel title="Qualification">
              <QualifyForm leadId={lead.id} current={lead.category} />
            </Panel>
          )}
          {can(user, 'lead.call') && !closed && (
            <Panel title="Log a call">
              {lead.ownerId ? <CallForm leadId={lead.id} defaultFollowUp={defaultFollowUp} /> : <Empty>Assign an owner first.</Empty>}
            </Panel>
          )}
          {can(user, 'lead.decide') && !closed && ['visited', 'counselled', 'decision_pending', 'confirmed'].includes(lead.status) && (
            <Panel title="Admission decision">
              <DecisionForm leadId={lead.id} defaultFollowUp={defaultFollowUp} />
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
