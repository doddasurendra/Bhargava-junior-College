import Link from 'next/link';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { getProgram } from '@/content/programs';
import { getContent } from '@/lib/cms';
import { profileData, requireAppUser } from '@/lib/app/service';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatINR } from '@/lib/fees';

export const metadata = { title: 'Home' };

function Timeline({ steps }: { steps: Awaited<ReturnType<typeof profileData>>['timeline'] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className={`absolute left-[11px] top-6 h-[calc(100%-1rem)] w-0.5 ${s.status === 'done' ? 'bg-gold' : 'bg-line'}`} />}
          <span aria-hidden className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${s.status === 'done' ? 'bg-gold text-navy-950' : s.status === 'current' ? 'bg-maroon text-white' : 'border-2 border-line bg-surface text-muted'}`}>
            {s.status === 'done' ? '✓' : i + 1}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-medium ${s.status === 'pending' ? 'text-muted' : 'text-heading'}`}>
              {s.label}
              {s.status === 'current' && <span className="ml-1.5 rounded-full bg-maroon/10 px-1.5 py-0.5 text-[10px] font-semibold text-maroon dark:text-gold">In progress</span>}
            </p>
            <p className="text-[11px] text-muted">
              {s.owner}
              {s.at && ` · ${formatDateTime(s.at)}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function AppHome() {
  const { visitSlots } = await getContent();
  const u = await requireAppUser();
  const p = u.active;

  if (!p) {
    return (
      <div className="card p-5 text-sm">
        <p className="font-semibold text-heading">Nothing linked to this number yet</p>
        <p className="mt-1 text-muted">
          Once your enquiry or admission is registered with this mobile number, it will appear here. Call {college.phones[0].display} if you think this is a mistake.
        </p>
      </div>
    );
  }

  const d = await profileData(p);

  if (p.kind === 'applicant') {
    const slot = d.upcomingVisit ? visitSlots.slots.find((s) => s.slot === d.upcomingVisit!.slot)?.label ?? d.upcomingVisit.slot : null;
    return (
      <div className="space-y-4">
        <section className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Admission status</p>
          <p className="mt-1 font-display text-2xl text-heading">{p.name}</p>
          {d.lead?.program && <p className="text-sm text-muted">{getProgram(d.lead.program)?.name}</p>}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] text-muted">Your counsellor</dt>
              <dd className="font-medium">{d.counsellor ?? 'Admissions team'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted">Campus visit</dt>
              <dd className="font-medium">{d.upcomingVisit ? `${formatDate(d.upcomingVisit.date, { day: 'numeric', month: 'short' })}, ${slot}` : '—'}</dd>
            </div>
          </dl>
        </section>
        <section className="card p-4">
          <Timeline steps={d.timeline} />
        </section>
        {d.payments.length > 0 && <PaymentsSummary payments={d.payments} />}
        {!d.upcomingVisit && (
          <Link href="/visit" className="btn-gold w-full">
            Book a campus visit
          </Link>
        )}
        <p className="text-center text-xs text-muted">When the College ID is issued, this becomes your child’s student page automatically.</p>
      </div>
    );
  }

  const s = d.student!;
  return (
    <div className="space-y-4">
      {/* Digital College ID */}
      <section className="overflow-hidden rounded-2xl bg-navy text-white shadow-lg">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Crest size={40} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg">{college.name}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-gold-300">{college.motto}</p>
          </div>
        </div>
        <div className="flex gap-4 px-4 py-4">
          <div aria-hidden className="grid h-20 w-16 shrink-0 place-items-center rounded-lg bg-white/10 text-[10px] text-white/60">
            Photo
          </div>
          <dl className="min-w-0 space-y-1 text-sm">
            <div>
              <dt className="sr-only">Name</dt>
              <dd className="font-semibold">{s.fullName}</dd>
            </div>
            <div>
              <dt className="sr-only">College ID</dt>
              <dd className="font-mono text-lg font-semibold text-gold-300">{s.collegeId}</dd>
            </div>
            <div>
              <dt className="sr-only">Program</dt>
              <dd className="text-white/80">
                {getProgram(s.program)?.name} · {s.stay === 'hostel' ? 'Hostel' : 'Day scholar'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {d.hostel && d.hostel[0] && (
        <Link href="/app/hostel" className="card flex items-center justify-between p-4 text-sm">
          <span>
            <span className="block text-[11px] uppercase tracking-wider text-muted">Last hostel movement</span>
            <span className="font-medium text-heading">
              {d.hostel[0].direction === 'in' ? 'Checked in' : 'Checked out'} · {formatDateTime(d.hostel[0].at)}
            </span>
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <PaymentsSummary payments={d.payments} />

      <section className="card p-4 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Guardians with app access</p>
        <ul className="mt-2 space-y-1">
          {d.guardians.map((g) => (
            <li key={g.phone} className="flex justify-between">
              <span>{g.name}</span>
              <span className="text-xs capitalize text-muted">{g.relation}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">To add another parent or guardian, ask the admin office.</p>
      </section>

      <section className="rounded-2xl border border-dashed border-line p-4 text-xs text-muted">
        Attendance, test results, the mentor’s weekly note and PTM booking will appear here when the academic module goes live.
      </section>
    </div>
  );
}

function PaymentsSummary({ payments }: { payments: Awaited<ReturnType<typeof profileData>>['payments'] }) {
  const paid = payments.filter((x) => x.status === 'approved').reduce((n, x) => n + x.amount, 0);
  return (
    <Link href="/app/fees" className="card flex items-center justify-between p-4 text-sm">
      <span>
        <span className="block text-[11px] uppercase tracking-wider text-muted">Fees paid</span>
        <span className="font-mono text-lg font-semibold text-heading">{formatINR(paid)}</span>
        {payments.some((x) => x.status === 'pending_approval') && <span className="block text-[11px] text-muted">A payment is being confirmed by Accounts</span>}
      </span>
      <span className="text-xs font-semibold text-maroon dark:text-gold">Receipts →</span>
    </Link>
  );
}
