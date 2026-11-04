import Link from 'next/link';
import { Empty, Panel, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { ask, canSeeAudit, canUseAssistant, recentQueries, type Answer, type Profile } from '@/lib/staffAssistant/service';

export const metadata = { title: 'College assistant' };
export const dynamic = 'force-dynamic';

const EXAMPLES = ['BJC-2027-JEE-0001', 'students below 75% attendance', 'fee defaulters this month', 'list all Hot leads not called today', 'compare Rahul’s last 3 tests'];

export default async function CollegeAssistantPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireStaff();
  if (!canUseAssistant(user)) {
    return (
      <Panel title="College assistant">
        <p className="text-sm text-muted">Your role can’t use the college assistant.</p>
      </Panel>
    );
  }
  const q = (searchParams.q ?? '').slice(0, 500);
  const [result, audit] = await Promise.all([q.trim() ? ask(user, q) : Promise.resolve(null), canSeeAudit(user) ? recentQueries(user) : Promise.resolve([])]);

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">College assistant</h1>
        <p className="text-sm text-muted">Type a College ID (roll number), a student’s name or a question. Answers come only from the college’s records; if nothing matches it says “not found”. Every question is logged.</p>
      </div>

      <form method="get" className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Question</label>
        <input id="q" name="q" defaultValue={q} maxLength={500} placeholder="e.g. BJC-2027-JEE-0001" className="input min-w-0 flex-1" autoComplete="off" />
        <button className="btn-primary">Ask</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <Link key={e} href={`/crm/college-assistant?q=${encodeURIComponent(e)}`} className="chip px-3 py-1 text-xs">{e}</Link>
        ))}
      </div>

      {result && <Result r={result} />}

      {canSeeAudit(user) && (
        <Panel title="Query log (ai_query_audit)">
          {audit.length === 0 ? <Empty>No questions yet.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {audit.map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate">“{a.query}”</span>
                  <span className="shrink-0 text-xs text-muted">{a.role.replace(/_/g, ' ')} · {a.intent} · {a.resultCount} result{a.resultCount === 1 ? '' : 's'} · {formatDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function Result({ r }: { r: Answer }) {
  if (r.kind === 'none') return <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">{r.text}</p>;
  if (r.kind === 'profile') return <ProfileCard p={r.profile} />;
  return (
    <Panel title={r.text}>
      {r.kind === 'students' && (
        <ul className="divide-y divide-line text-sm">
          {r.rows.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
              <Link href={`/crm/college-assistant?q=${encodeURIComponent(s.collegeId ?? s.name)}`} className="font-medium text-heading underline">{s.name}</Link>
              <span className="text-muted"><span className="font-mono">{s.collegeId}</span> · {s.batch ?? 'no batch'} · {s.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {r.kind === 'compare' && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1">Test</th><th>Date</th><th>Score</th><th>%</th><th>Rank</th></tr></thead>
          <tbody>{r.tests.map((t) => <tr key={t.title + t.date} className="border-t border-line"><td className="py-1.5">{t.title}</td><td>{formatDate(t.date, { day: 'numeric', month: 'short' })}</td><td className="font-mono">{t.score}/{t.max}</td><td className="font-mono">{t.pct}%</td><td className="font-mono">{t.rank}/{t.of}</td></tr>)}</tbody>
        </table>
      )}
      {r.kind === 'leads' && (
        <ul className="divide-y divide-line text-sm">
          {r.rows.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
              <Link href={`/crm/leads/${l.id}`} className="font-medium text-heading underline">{l.name}</Link>
              <span className="text-muted"><span className="font-mono">{l.phone}</span> · {l.owner ?? 'unassigned'} · last contact {l.lastContact ? formatDateTime(l.lastContact) : 'never'}</span>
            </li>
          ))}
        </ul>
      )}
      {r.kind === 'dues' && (
        <ul className="divide-y divide-line text-sm">
          {r.rows.map((d) => (
            <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
              <Link href={`/crm/college-assistant?q=${encodeURIComponent(d.collegeId ?? d.name)}`} className="font-medium text-heading underline">{d.name}</Link>
              <span className="text-muted"><span className="font-mono">{d.collegeId}</span> · overdue <span className="font-mono">{formatINR(d.overdue)}</span> of <span className="font-mono">{formatINR(d.outstanding)}</span> outstanding</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-heading">{v ?? <span className="text-muted">not recorded</span>}</dd>
    </div>
  );
}

function ProfileCard({ p }: { p: Profile }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-heading">{p.name}</h2>
          <p className="text-sm text-muted"><span className="font-mono">{p.collegeId}</span> · {programShort(p.program)} · {p.batch ?? 'no batch'}{p.section ? ` (section ${p.section})` : ''}</p>
        </div>
        <Link href={`/crm/students/${p.id}`} className="btn-outline py-1.5 text-sm">Open student file</Link>
      </div>
      {p.warnings.length > 0 && (
        <div role="status" className="rounded-xl bg-gold-100/70 px-4 py-3 text-sm dark:bg-gold/10">
          <p className="font-semibold text-heading">Early warning</p>
          <ul className="list-disc pl-5">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Student">
          <dl className="divide-y divide-line">
            <Row k="College ID / roll no." v={<span className="font-mono">{p.collegeId}</span>} />
            <Row k="Date of birth" v={formatDate(p.dob)} />
            <Row k="Gender" v={p.gender} />
            <Row k="Previous school" v={p.previousSchool} />
            <Row k="Board" v={p.board} />
            <Row k="Class at enquiry" v={p.classLevel} />
            <Row k="Stay" v={p.stay === 'hostel' ? `Hostel${p.hostelRoom ? ` · room ${p.hostelRoom}` : ''}` : `Day scholar${p.bus ? ` · bus ${p.bus}` : ''}`} />
          </dl>
        </Panel>
        <Panel title="Parents / guardians">
          <ul className="space-y-1 text-sm">
            {p.guardians.map((g) => (
              <li key={g.name + g.phone} className="flex justify-between gap-3"><span>{g.name} <span className="text-muted">({g.relation})</span></span><span className="font-mono">{g.phone}</span></li>
            ))}
          </ul>
          {p.phonesMasked && <p className="mt-2 text-xs text-muted">Phone numbers are masked for your role.</p>}
        </Panel>
        <Panel title="Attendance (30 days)">
          {p.attendance.pct === null ? <Empty>Not recorded yet.</Empty> : (
            <>
              <p className="text-sm"><span className="font-mono text-lg text-heading">{p.attendance.pct}%</span> · {p.attendance.absent} absent · {p.attendance.late} late</p>
              {p.attendance.recentAbsences.length > 0 && <p className="mt-1 text-xs text-muted">Recent absences: {p.attendance.recentAbsences.map((d) => formatDate(d, { day: 'numeric', month: 'short' })).join(', ')}</p>}
            </>
          )}
        </Panel>
        <Panel title={`Tests${p.trend !== null ? ` · trend ${p.trend >= 0 ? '+' : ''}${p.trend} pts` : ''}`}>
          {p.tests.length === 0 ? <Empty>No published results.</Empty> : (
            <ul className="space-y-1 text-sm">{p.tests.map((t) => <li key={t.title + t.date} className="flex justify-between gap-2"><span>{t.title}</span><span className="font-mono">{t.score}/{t.max} · {t.pct}% · rank {t.rank}/{t.of}</span></li>)}</ul>
          )}
        </Panel>
        {p.fees && (
          <Panel title="Fees">
            <dl className="divide-y divide-line">
              <Row k="Paid (approved)" v={<span className="font-mono">{formatINR(p.fees.paid)}</span>} />
              <Row k="Outstanding" v={p.fees.outstanding === null ? null : <span className="font-mono">{formatINR(p.fees.outstanding)}</span>} />
              <Row k="Overdue" v={p.fees.overdue === null ? null : <span className="font-mono">{formatINR(p.fees.overdue)}</span>} />
            </dl>
            {p.fees.receipts.length > 0 && <p className="mt-2 text-xs text-muted">Receipts: {p.fees.receipts.map((r) => `${r.no} (${formatINR(r.amount)})`).join(', ')}</p>}
          </Panel>
        )}
        <Panel title="Mentor notes & admission">
          {p.mentorNotes.length > 0 ? (
            <ul className="mb-3 space-y-1 text-sm">{p.mentorNotes.map((n, i) => <li key={i}><span className="text-xs text-muted">{formatDate(n.date, { day: 'numeric', month: 'short' })}</span> {n.note}</li>)}</ul>
          ) : <p className="mb-3 text-sm text-muted">No mentor notes you can see.</p>}
          {p.admission && <p className="text-xs text-muted">Admission stage: {p.admission.stage.replace(/_/g, ' ')} · {p.admission.signOffs.length} verification sign-offs</p>}
        </Panel>
      </div>
    </div>
  );
}
