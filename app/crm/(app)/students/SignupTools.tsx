import Link from 'next/link';
import * as X from '@/app/crm/signup-actions';
import { ActionForm, Submit } from '@/components/crm/forms';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel, programShort } from '@/components/crm/ui';
import { signupQueue, testSignupsPreview } from '@/lib/app/pendingAdmin';
import { recentImports } from '@/lib/app/studentImport';
import type { Staff } from '@/lib/crm/types';
import { formatDate, formatDateTime } from '@/lib/dates';

const VIEWS = [['pending', 'Pending sign-ups'], ['conflicts', 'Conflicts'], ['add', 'Add student'], ['import', 'Import (Excel / CSV)'], ['test', 'Test data']] as const;
const CASE: Record<string, string> = { B: 'B · no college record', C: 'C · record details differ', E: 'E · College ID already has an account' };
const PROGRAMS = [['iit-jee', 'IIT-JEE'], ['neet', 'NEET'], ['long-term-jee', 'Long Term JEE'], ['long-term-neet', 'Long Term NEET']];
const d = (x: string) => formatDate(x, { day: 'numeric', month: 'short', year: 'numeric' });

/** Admin Office: student sign-up verification, add / import students, test data (master prompt task 2.7). */
export async function SignupTools({ user, view }: { user: Staff; view: string }) {
  const q = await signupQueue(user);
  const v = VIEWS.some(([k]) => k === view) ? view : 'pending';
  const superAdmin = user.roles.includes('super_admin') && !user.viewedBy;
  const newFields = (id: string, cid: string) => [
    { name: 'id', type: 'hidden' as const, value: id },
    { name: 'collegeId', label: 'College ID', type: 'text' as const, defaultValue: cid, required: true },
    { name: 'program', label: 'Program', type: 'select' as const, required: true, options: PROGRAMS.map(([value, label]) => ({ value, label })) },
    { name: 'gender', label: 'Gender', type: 'select' as const, required: true, options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
    { name: 'stay', label: 'Stay', type: 'select' as const, options: [{ value: 'day', label: 'Day scholar' }, { value: 'hostel', label: 'Hostel' }] },
    { name: 'guardianName', label: 'Parent / guardian', type: 'text' as const, required: true },
    { name: 'guardianPhone', label: 'Parent mobile', type: 'tel' as const, required: true },
  ];
  return (
    <section className="space-y-4" aria-label="Admin office: student sign-ups">
      <nav className="flex flex-wrap gap-1.5" aria-label="Sign-up tools">
        {VIEWS.map(([k, l]) => (
          <Link key={k} href={`/crm/students?view=${k}`} className={k === v ? 'chip chip-active' : 'chip'}>
            {l}{k === 'pending' && q.pending.length ? ` (${q.pending.length})` : ''}{k === 'conflicts' && q.conflicts.length ? ` (${q.conflicts.length})` : ''}
          </Link>
        ))}
      </nav>

      {v === 'pending' && (
        <Panel title={`Pending sign-ups (${q.pending.length})`}>
          {q.pending.length === 0 ? <Empty>No sign-ups are waiting.</Empty> : (
            <ul className="divide-y divide-line">
              {q.pending.map((p) => (
                <li key={p.id} className="py-3 text-sm" data-testid="pending-row">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span><b className="text-heading">{p.fullName}</b> · <span className="font-mono">{p.collegeId}</span> · DOB {d(p.dob)}{p.isTest && <span className="ml-1 rounded bg-amber-100 px-1.5 text-[10px] font-semibold uppercase text-amber-900">test</span>}</span>
                    <span className="text-xs text-muted">{CASE[p.case]} · signed up {formatDateTime(p.createdAt)} · temp id {p.tempId}</span>
                  </div>
                  {p.suggestions.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs font-semibold uppercase text-muted">Suggested matching records</p>
                      {p.suggestions.map((sg) => (
                        <div key={sg.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                          <span className="flex-1">{sg.fullName} · <span className="font-mono">{sg.collegeId}</span> · DOB {d(sg.dob)} · {programShort(sg.program)} · name match {Math.round(sg.similarity * 100)}%</span>
                          <ActionForm action={X.verifyLinkAction} reset={false} quiet={false} className="inline"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="studentId" value={sg.id} /><Submit className="btn-primary px-3 py-1 text-xs">Verify &amp; link</Submit></ActionForm>
                          <ActionForm action={X.mergeAction} reset={false} quiet={false} className="inline"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="studentId" value={sg.id} /><Submit className="btn-outline px-3 py-1 text-xs">Merge</Submit></ActionForm>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-1 text-xs text-muted">No similar college record found.</p>}
                  <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-maroon dark:text-gold">Create as new student</summary><div className="mt-2"><QuickForm action={X.createNewAction} submit="Create and link" cols={3} fields={newFields(p.id, p.collegeId)} /></div></details>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <QuickForm action={X.messageAction} submit="Message student" cols={1} fields={[{ name: 'id', type: 'hidden', value: p.id }, { name: 'text', label: 'Message (shown on their home screen)', type: 'text', required: true, maxLength: 500 }]} />
                    <QuickForm action={X.rejectAction} submit="Reject / disable" cols={1} fields={[{ name: 'id', type: 'hidden', value: p.id }, { name: 'reason', label: 'Reason (shown to the student)', type: 'text', maxLength: 300 }]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {q.recent.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-xs font-semibold uppercase text-muted">Recently handled ({q.recent.length})</summary><ul className="mt-2 space-y-1">{q.recent.map((r) => <li key={r.id}>{r.fullName} · <span className="font-mono">{r.collegeId}</span> · {r.resolution} by {r.decidedBy} {r.decidedAt ? formatDateTime(r.decidedAt) : ''}</li>)}</ul></details>}
        </Panel>
      )}

      {v === 'conflicts' && (
        <Panel title={`Conflicts (${q.conflicts.length}) · admin office only`}>
          {q.conflicts.length === 0 ? <Empty>No conflicts.</Empty> : (
            <div className="space-y-3">
              {q.conflicts.map((c) => (
                <div key={c.id} className="rounded-xl border border-line p-3 text-sm" data-testid="conflict-row">
                  <p className="text-xs font-semibold uppercase text-muted">{c.conflictType === 'duplicate_account' ? 'Duplicate College ID: the record already has an account' : c.conflictType === 'duplicate_signup' ? 'Duplicate sign-up for this College ID' : 'Record details differ'}{c.conflictHasAccount ? ' · existing account active' : ''}</p>
                  <table className="table-base mt-2 text-xs">
                    <thead><tr><th /><th>Existing college record</th><th>New registration</th></tr></thead>
                    <tbody>
                      <tr><td>College ID</td><td className="font-mono">{c.conflict?.collegeId ?? '—'}</td><td className="font-mono">{c.collegeId}</td></tr>
                      <tr><td>Name</td><td>{c.conflict?.fullName ?? '—'}</td><td>{c.fullName}</td></tr>
                      <tr><td>Date of birth</td><td>{c.conflict ? d(c.conflict.dob) : '—'}</td><td>{d(c.dob)}</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted">Suggested: {c.conflict && c.conflictHasAccount ? 'check with the student; if the new registration is the real student, Merge (the older account is disabled); otherwise Reject.' : c.conflict ? 'if the record has a typo, correct it and Verify & link; otherwise Create as new with another College ID.' : 'compare the sign-ups and keep one.'}</p>
                  {c.conflict && <div className="mt-2 flex flex-wrap gap-2">
                    {!c.conflictHasAccount && <ActionForm action={X.verifyLinkAction} reset={false} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="studentId" value={c.conflict.id} /><Submit className="btn-primary px-3 py-1 text-xs">Verify &amp; link</Submit></ActionForm>}
                    <ActionForm action={X.mergeAction} reset={false} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="studentId" value={c.conflict.id} /><Submit className="btn-outline px-3 py-1 text-xs">Merge</Submit></ActionForm>
                  </div>}
                  <div className="mt-2"><QuickForm action={X.rejectAction} submit="Reject / disable" cols={1} fields={[{ name: 'id', type: 'hidden', value: c.id }, { name: 'reason', label: 'Reason (shown to the student)', type: 'text', maxLength: 300 }]} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {v === 'add' && (
        <Panel title="Add student">
          <QuickForm action={X.addStudentAction} submit="Add student" cols={3} fields={[
            { name: 'fullName', label: 'Student name', type: 'text', required: true },
            { name: 'collegeId', label: 'College ID', type: 'text', required: true, placeholder: 'BJC-2027-JEE-0007' },
            { name: 'dob', label: 'Date of birth', type: 'date', required: true },
            { name: 'program', label: 'Program', type: 'select', required: true, options: PROGRAMS.map(([value, label]) => ({ value, label })) },
            { name: 'gender', label: 'Gender', type: 'select', required: true, options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
            { name: 'stay', label: 'Day scholar / hostel', type: 'select', options: [{ value: 'day', label: 'Day scholar' }, { value: 'hostel', label: 'Hostel' }] },
            { name: 'guardianName', label: 'Parent / guardian name', type: 'text', required: true },
            { name: 'guardianPhone', label: 'Parent mobile', type: 'tel', required: true },
            { name: 'relation', label: 'Relation', type: 'select', options: [{ value: 'father', label: 'Father' }, { value: 'mother', label: 'Mother' }, { value: 'guardian', label: 'Guardian' }] },
          ]} />
          <p className="mt-2 text-xs text-muted">The parent gets app access with this mobile. Batch and campus are allotted on the Academics › Batches page. A pending sign-up with the same College ID, date of birth and name is linked automatically.</p>
        </Panel>
      )}

      {v === 'import' && (
        <Panel title="Import students (Excel .xlsx or CSV)">
          <ActionForm action={X.importStudentsAction} reset={false} className="space-y-2 text-sm">
            <input type="file" name="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="block text-sm" />
            <Submit className="btn-primary px-4 py-2 text-sm">Import</Submit>
          </ActionForm>
          <p className="mt-2 text-xs text-muted">Header row with: <span className="font-mono">college_id, full_name, dob, gender, program, stay, guardian_name, guardian_phone</span> (optional <span className="font-mono">relation</span>). Dates as YYYY-MM-DD or DD/MM/YYYY; Excel dates work. Existing College IDs are skipped, so importing the same file again creates no duplicates. Matching pending sign-ups are linked and activated; others go to Conflicts.</p>
          <ImportReports />
        </Panel>
      )}

      {v === 'test' && (
        <Panel title="Test data">
          <ActionForm action={X.markTestAction} reset={false} className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase text-muted">Sign-ups</p>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-line p-2">
              {[...q.pending, ...q.recent].map((p) => <label key={p.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" name="pendingIds" value={p.id} className="accent-maroon" />{p.fullName} · <span className="font-mono">{p.collegeId}</span> · {p.status}{p.isTest && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-900">test</span>}</label>)}
            </div>
            <div className="flex gap-2"><Submit className="btn-outline px-3 py-1.5 text-xs" name="test" value="1">Mark selected as test</Submit><Submit className="btn-outline px-3 py-1.5 text-xs" name="test" value="0">Unmark</Submit></div>
          </ActionForm>
          {superAdmin ? <DeleteTest user={user} /> : <p className="mt-3 text-xs text-muted">Only the Super Admin can delete test sign-ups. Test-marked records are kept out of reports and the Summary dashboard.</p>}
        </Panel>
      )}
    </section>
  );
}

async function ImportReports() {
  const list = await recentImports();
  if (!list.length) return null;
  return (
    <div className="mt-4 space-y-2 text-sm" data-testid="import-reports">
      <p className="text-xs font-semibold uppercase text-muted">Recent imports</p>
      {list.map((r) => (
        <details key={r.id} className="rounded-lg border border-line p-2">
          <summary className="cursor-pointer">{formatDateTime(r.at)} · {r.fileName} · by {r.by}: {r.total} rows · {r.created} new · {r.linked} linked · {r.conflicts} conflicts · {r.existing} already present · {r.failed} failed</summary>
          <table className="table-base mt-2 text-xs"><thead><tr><th>Row</th><th>College ID</th><th>Result</th><th>Note</th></tr></thead><tbody>{r.rows.slice(0, 200).map((x) => <tr key={x.row}><td>{x.row}</td><td className="font-mono">{x.collegeId}</td><td>{x.outcome}</td><td>{x.note}</td></tr>)}</tbody></table>
        </details>
      ))}
    </div>
  );
}

async function DeleteTest({ user }: { user: Staff }) {
  const pv = await testSignupsPreview(user);
  const total = pv.signups + pv.accounts;
  return (
    <div className="mt-4 rounded-xl border border-red-200 p-3 text-sm dark:border-red-400/30">
      <p className="font-semibold text-heading">Delete all test sign-ups (Super Admin)</p>
      <p className="mt-1 text-xs text-muted">Will delete {pv.signups} sign-up(s) and {pv.accounts} student account(s) marked Test, with their sign-in users and sessions. College student records are never deleted. Every deletion is written to the audit log.</p>
      {pv.names.length > 0 && <p className="mt-1 text-xs">{pv.names.join(' · ')}</p>}
      {total > 0 ? (
        <QuickForm action={X.deleteTestAction} submit={`Delete ${total} test record(s)`} cols={1} fields={[{ name: 'count', type: 'hidden', value: String(total) }, { name: 'confirm', label: 'Type DELETE to confirm', type: 'text', required: true }]} />
      ) : <p className="mt-1 text-xs text-muted">Nothing is marked as test.</p>}
    </div>
  );
}
