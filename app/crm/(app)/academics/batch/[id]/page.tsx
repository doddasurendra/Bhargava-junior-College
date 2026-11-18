import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMaterialAction, createTestAction } from '@/app/crm/school-actions';
import { AttendanceForm, SendAttendanceForm } from '@/components/crm/AttendanceForm';
import { getCrmRepo } from '@/lib/crm/repo';
import { deliveryLabel, getMessageStore, mode as whatsappMode } from '@/lib/whatsapp/service';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { addDays, formatDate, todayIST } from '@/lib/dates';
import { batches, MATERIAL_KINDS, SUBJECTS } from '@/lib/records/collections';
import { batchMaterials, batchRegisters, batchTests, batchTimetable, canTeachBatch, sentToParents } from '@/lib/school/academics';
import { store, studentsById } from '@/lib/school/common';
import { attendanceSummary } from '@/lib/school/logic';

export const metadata = { title: 'Batch' };
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function BatchPage({ params, searchParams }: { params: { id: string }; searchParams: { date?: string } }) {
  const user = await requireStaff('attendance.mark');
  const b = await batches.get(store(), params.id);
  if (!b || !(await canTeachBatch(user, b.id))) notFound();
  const today = todayIST();
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) && searchParams.date <= today ? searchParams.date : today;
  const [byId, regs, mats, tests, tt] = await Promise.all([studentsById(), batchRegisters(b.id, addDays(today, -30), today), batchMaterials(b.id), batchTests(b.id), batchTimetable(b.id)]);
  const students = b.data.studentIds.map((sid) => ({ id: sid, name: byId.get(sid)?.fullName ?? 'Student', collegeId: byId.get(sid)?.collegeId ?? null })).sort((x, y) => x.name.localeCompare(y.name));
  const reg = regs.find((r) => r.date === date);
  // Delivery status of what was sent to parents for this register, read live from the WhatsApp outbox.
  const sends = reg ? await sentToParents(`${b.id}:${date}`) : [];
  const statusOf = new Map<string, string>();
  for (const sid of new Set(sends.map((x) => x.studentId))) {
    const st = byId.get(sid);
    const outbox = st ? (await getMessageStore().listForLead(st.leadId, 200)).outbound : [];
    const lines = sends.filter((x) => x.studentId === sid).map((x) => {
      const m = outbox.find((o) => o.id === x.outboxId);
      return `******${x.phone.slice(-4)}: ${m ? deliveryLabel(m) : x.reason ?? x.result}`;
    });
    statusOf.set(sid, lines.join(' · '));
  }
  const staffNames = reg ? new Map((await getCrmRepo().listStaff()).map((s) => [s.id, s.fullName])) : new Map<string, string>();

  return (
    <div className="space-y-5">
      <Link href={can(user, 'academics.manage') ? '/crm/academics' : '/crm/academics/my-classes'} className="text-sm text-muted underline">← Back</Link>
      <div>
        <h1 className="font-display text-3xl text-heading">{b.data.name}</h1>
        <p className="text-sm text-muted">{programShort(b.data.program)} · year {b.data.year} · {students.length}/{b.data.capacity} students</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Panel title={`Attendance · ${formatDate(date)}`} actions={<form method="get" className="flex items-center gap-2"><input type="date" name="date" defaultValue={date} max={today} className="input py-1 text-xs" /><button className="btn-outline py-1 text-xs">Go</button></form>}>
          {students.length === 0 ? <Empty>No students in this batch yet.</Empty> : <AttendanceForm key={date} batchId={b.id} date={date} today={today} students={students} existing={(reg?.marks as Record<string, string>) ?? {}} existingRemarks={reg?.remarks ?? {}} />}
          {reg && <p className="mt-2 text-xs text-muted">Already taken for this date by {staffNames.get(reg.markedBy) ?? 'a teacher'}; saving again corrects it and the change is recorded.</p>}
          {reg?.corrections && reg.corrections.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-semibold text-heading">Correction history ({reg.corrections.length})</summary>
              <ul className="mt-1 space-y-1 text-muted">
                {reg.corrections.map((c, i) => (
                  <li key={i}>{new Date(c.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {staffNames.get(c.by) ?? c.by}: {c.changes.map((x) => `${byId.get(x.studentId)?.fullName ?? 'Student'} ${x.from} → ${x.to}`).join(', ')}</li>
                ))}
              </ul>
            </details>
          )}
        </Panel>
        <Panel title="Last 30 days">
          <ul className="space-y-1 text-sm">
            {students.map((s) => {
              const a = attendanceSummary(regs, s.id);
              return (
                <li key={s.id} className="flex justify-between gap-2">
                  <span>{s.name}</span>
                  <span className={`font-mono ${a.pct !== null && a.pct < 75 ? 'font-semibold text-maroon dark:text-gold' : ''}`}>{a.pct === null ? '–' : `${a.pct}%`} <span className="text-muted">({a.absent} abs)</span></span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title={`Send attendance to parents · ${formatDate(date)}`}>
        {!reg ? <Empty>Save the attendance for this date first. Only saved registers can be sent.</Empty> : (
          <>
            {whatsappMode().kind !== 'cloud' && (
              <p role="status" className="mb-3 rounded-lg bg-gold-100/70 px-3 py-2 text-xs text-ink dark:bg-gold/10">
                WhatsApp Business API is not connected yet (no credentials). Messages are recorded with their exact text but nothing reaches parents until the college’s WhatsApp number and approved templates are configured.
              </p>
            )}
            <SendAttendanceForm batchId={b.id} date={date} students={students.map((s) => ({ id: s.id, name: s.name, mark: reg.marks[s.id] ?? '—', status: statusOf.get(s.id) ?? null }))} />
          </>
        )}
      </Panel>

      <Panel title="Timetable">
        {tt.length === 0 ? <Empty>No periods yet.</Empty> : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {tt.map((p) => <li key={p.id} className="rounded-lg bg-bg px-3 py-1.5"><span className="font-mono">{DAYS[p.day]} {p.start}–{p.end}</span> · {p.subject}{p.room ? ` · ${p.room}` : ''}</li>)}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Notes, DPPs, assignments, recordings">
          {mats.length === 0 ? <Empty>Nothing shared yet.</Empty> : (
            <ul className="-my-2 mb-3 divide-y divide-line text-sm">
              {mats.map((m) => (
                <li key={m.id} className="py-2">
                  <span className="mr-2 rounded bg-bg px-1.5 py-0.5 text-[11px] uppercase">{m.kind}</span>
                  {m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-heading underline">{m.title}</a> : <span className="font-medium text-heading">{m.title}</span>}
                  <span className="text-muted"> · {m.subject}{m.dueDate ? ` · due ${formatDate(m.dueDate)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {can(user, 'materials.upload') && (
            <QuickForm action={addMaterialAction} submit="Share with batch" fields={[
              { name: 'batchId', type: 'hidden', value: b.id },
              { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
              { name: 'kind', label: 'Kind', type: 'select', options: MATERIAL_KINDS.map((k) => ({ value: k, label: k === 'dpp' ? 'DPP' : k[0].toUpperCase() + k.slice(1) })) },
              { name: 'subject', label: 'Subject', type: 'select', options: SUBJECTS.map((x) => ({ value: x, label: x })) },
              { name: 'url', label: 'Link (PDF, video or live class)', type: 'url', wide: true },
              { name: 'dueDate', label: 'Due date (assignments)', type: 'date' },
            ]} />
          )}
        </Panel>
        <Panel title="Tests">
          {tests.length === 0 ? <Empty>No tests yet.</Empty> : (
            <ul className="-my-2 mb-3 divide-y divide-line text-sm">
              {tests.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 py-2">
                  <Link href={`/crm/academics/test/${t.id}`} className="font-medium text-heading hover:underline">{t.title}</Link>
                  <span className="text-muted">{formatDate(t.date, { day: 'numeric', month: 'short' })} · {t.mode} · {t.published ? 'published' : 'draft'}</span>
                </li>
              ))}
            </ul>
          )}
          {can(user, 'tests.manage') && (
            <QuickForm action={createTestAction} submit="Create test" fields={[
              { name: 'batchId', type: 'hidden', value: b.id },
              { name: 'title', label: 'Title', type: 'text', required: true, wide: true, placeholder: 'Physics weekly test 4' },
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: today },
              { name: 'mode', label: 'Mode', type: 'select', options: [{ value: 'online', label: 'Online (in the app, timed)' }, { value: 'offline', label: 'Offline (enter marks)' }] },
              { name: 'durationMin', label: 'Duration (minutes)', type: 'number', defaultValue: '60', min: 5, max: 240 },
              { name: 'maxMarks', label: 'Max marks (offline)', type: 'number', defaultValue: '100', min: 1, max: 1000 },
              { name: 'subjects', label: 'Subjects (comma separated)', type: 'text', defaultValue: 'Physics', wide: true },
            ]} />
          )}
        </Panel>
      </div>
    </div>
  );
}
