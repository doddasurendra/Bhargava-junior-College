import { addObQuestionAction, confirmMarksForm, createObAssignmentForm, featureForm, postBigQuestionAction, suggestMarksForm } from '@/app/crm/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDateTime } from '@/lib/dates';
import { OB_ANSWER_TYPES, OB_KINDS } from '@/lib/studentLife/collections';
import { AI_POLICY, bigQuestionBoard, CLOSED_BOOK_NOTE, comparison, teacherOverview } from '@/lib/studentLife/openbook';

export const metadata = { title: 'Open-book learning' };
export const dynamic = 'force-dynamic';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const KIND: Record<string, string> = { application: 'Application', analysis: 'Analysis', case_data: 'Case / data', own_words: 'In your own words', real_life: 'Real-life problem' };
const RES: [string, string][] = [['ownNotes', 'Own notes'], ['ncert', 'NCERT'], ['formulaSheet', 'Formula sheet'], ['calculator', 'Calculator'], ['internet', 'Internet']];

export default async function OpenBookPage({ searchParams }: { searchParams: { batch?: string; attempt?: string } }) {
  const user = await requireStaff();
  if (!can(user, 'openbook.manage')) return <Panel title="Open-book learning"><p className="text-sm text-muted">For faculty and the academic team.</p></Panel>;
  const o = await teacherOverview(user);
  const batchId = searchParams.batch ?? o.batches[0]?.id;
  const cmp = batchId ? await comparison(batchId) : null;
  const board = await bigQuestionBoard();
  const bank = new Map(o.bank.map((q) => [q.id, q]));
  const allAttempts = o.assignments.flatMap((a) => a.attempts.map((x) => ({ ...x, assignment: a.title })));
  const marking = searchParams.attempt ? allAttempts.find((x) => x.id === searchParams.attempt) ?? null : null;
  const now = new Date();
  const local = (dt: Date) => new Date(dt.getTime() + 330 * 60_000).toISOString().slice(0, 16);

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Open-book learning</h1>
        <p className="text-sm text-muted">{CLOSED_BOOK_NOTE}</p>
      </div>

      {cmp && (
        <Panel title={`Open-book vs closed-book: ${cmp.batch}`}>
          <form className="mb-3 flex gap-2"><select name="batch" defaultValue={batchId} className="input py-2 text-sm">{o.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><button className="btn-outline py-1.5 text-sm">Show</button></form>
          <p className="mb-2 text-sm">Batch average: closed-book <span className="font-mono font-semibold">{cmp.closedAvg ?? '–'}%</span> · open-book <span className="font-mono font-semibold">{cmp.openAvg ?? '–'}%</span></p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Student</th><th>Closed</th><th>Open</th><th>What it suggests</th></tr></thead>
            <tbody>{cmp.rows.map((r) => <tr key={r.studentId} className="border-t border-line"><td className="py-1.5 text-heading">{r.name}</td><td className="font-mono">{r.closed ?? '–'}</td><td className="font-mono">{r.open ?? '–'}</td><td className={r.profile.key === 'apply_gap' || r.profile.key === 'recall_gap' ? 'font-medium text-maroon dark:text-gold' : 'text-muted'}>{r.profile.label}</td></tr>)}</tbody>
          </table>
        </Panel>
      )}

      {marking && (
        <Panel title={`Mark: ${marking.name} · ${marking.assignment}`}>
          {!marking.submittedAt ? <Empty>Not submitted yet.</Empty> : (
            <>
              <form action={suggestMarksForm} className="mb-3"><input type="hidden" name="attemptId" value={marking.id} /><button className="btn-outline py-1.5 text-sm">{marking.suggestion ? 'Ask again for an AI suggestion' : 'Get an AI suggestion'}</button> <span className="text-xs text-muted">The suggestion pre-fills the rubric. You confirm or change every mark.</span></form>
              {marking.similarity.length > 0 && <p className="mb-3 rounded-lg bg-maroon/10 px-3 py-2 text-sm text-maroon dark:text-red-200">Similarity check: {marking.similarity.length} answer(s) look very close to a classmate’s ({marking.similarity.map((x) => `${Math.round(x.score * 100)}%`).join(', ')}). Talk to both students before marking.</p>}
              {/* key: radios use defaultChecked, so re-mount the form when a new suggestion or confirmed marks arrive */}
              <form key={JSON.stringify([marking.id, marking.suggestion, marking.marks, marking.feedback])} action={confirmMarksForm} className="space-y-4">
                <input type="hidden" name="attemptId" value={marking.id} />
                {marking.questionIds.map((qid) => {
                  const q = bank.get(qid);
                  if (!q) return null;
                  return (
                    <div key={qid} className="rounded-lg border border-line p-3 text-sm">
                      <p className="font-medium text-heading">{q.text}</p>
                      <p className="mt-2 whitespace-pre-line rounded bg-surface p-2">{marking.answers[qid] || <span className="text-muted">(no answer)</span>}</p>
                      <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">Model answer</summary><p className="mt-1 whitespace-pre-line">{q.modelAnswer}</p></details>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">{q.rubric.map((r) => {
                        const v = marking.marks?.[qid]?.[r.criterion] ?? marking.suggestion?.[qid]?.[r.criterion] ?? 0;
                        return (
                          <fieldset key={r.criterion}><legend className="text-xs font-semibold text-muted">{r.criterion} (/{r.max}){marking.suggestion?.[qid] && !marking.marks ? ' · suggested' : ''}</legend>
                            <div className="mt-1 flex flex-wrap gap-1">{Array.from({ length: r.max + 1 }, (_, n) => <label key={n} className="cursor-pointer"><input type="radio" name={`m:${qid}:${r.criterion}`} value={n} defaultChecked={n === v} className="peer sr-only" /><span className="inline-block min-w-7 rounded border border-line px-2 py-0.5 text-center peer-checked:border-maroon peer-checked:bg-maroon peer-checked:text-white">{n}</span></label>)}</div>
                          </fieldset>
                        );
                      })}</div>
                    </div>
                  );
                })}
                <label className="block text-sm"><span className="text-xs font-semibold uppercase text-muted">Feedback to the student</span><textarea name="feedback" defaultValue={marking.feedback ?? ''} rows={3} className="input mt-1 text-sm" /></label>
                <button className="btn-primary py-2 text-sm">Confirm marks</button>
                {marking.total != null && <span className="ml-3 text-sm">Confirmed: <span className="font-mono font-semibold">{marking.total}/{marking.max}</span></span>}
              </form>
            </>
          )}
        </Panel>
      )}

      <Panel title={`Assignments (${o.assignments.length})`}>
        {o.assignments.length === 0 ? <Empty>None yet.</Empty> : (
          <ul className="divide-y divide-line text-sm">{o.assignments.map((a) => (
            <li key={a.id} className="py-2">
              <span className="font-medium text-heading">{a.title}</span> · {a.batch} · {a.subject} · {a.submitted} submitted · {a.marked} marked
              <span className="block text-xs text-muted">{formatDateTime(a.opensAt)} – {formatDateTime(a.closesAt)} · {a.durationMin} min · allowed: {RES.filter(([k]) => a.resources[k as keyof typeof a.resources]).map(([, l]) => l).join(', ') || 'nothing'}</span>
              {a.attempts.length > 0 && <span className="mt-1 flex flex-wrap gap-1.5">{a.attempts.map((x) => <a key={x.id} href={`/crm/open-book?attempt=${x.id}${batchId ? `&batch=${batchId}` : ''}`} className={`rounded-full px-2 py-0.5 text-xs ${x.marks ? 'bg-emerald-500/15' : x.submittedAt ? 'bg-gold/25' : 'bg-surface'}`}>{x.name}{x.total != null ? ` ${x.total}/${x.max}` : x.submittedAt ? ' · to mark' : ' · in progress'}</a>)}</span>}
            </li>
          ))}</ul>
        )}
        <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-maroon dark:text-gold">Create an open-book assignment</summary>
          <form action={createObAssignmentForm} className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">Title<input name="title" required className="input mt-1" /></label>
              <label className="block">Batch<select name="batchId" className="input mt-1 py-2">{o.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <label className="block">Subject<select name="subject" className="input mt-1 py-2">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="block">Opens<input type="datetime-local" name="opensAt" defaultValue={local(now)} required className="input mt-1" /></label>
              <label className="block">Closes<input type="datetime-local" name="closesAt" defaultValue={local(new Date(now.getTime() + 3 * 86_400_000))} required className="input mt-1" /></label>
              <label className="block">Duration (min, longer than a closed-book test)<input type="number" name="durationMin" defaultValue={90} min={10} max={300} className="input mt-1" /></label>
              <label className="block">Questions per student (randomised)<input type="number" name="perStudent" defaultValue={3} min={1} max={30} className="input mt-1" /></label>
            </div>
            <fieldset><legend className="text-xs font-semibold uppercase text-muted">Allowed resources</legend><div className="mt-1 flex flex-wrap gap-4">{RES.map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name={k} defaultChecked={k !== 'internet'} className="accent-maroon" />{l}</label>)}</div></fieldset>
            <p className="text-xs text-muted">Students accept an honesty pledge before starting. AI-use policy shown to them: {AI_POLICY}</p>
            <fieldset><legend className="text-xs font-semibold uppercase text-muted">Question pool (tagged open-book suitable)</legend>
              <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-line p-2">{o.bank.map((q) => <label key={q.id} className="flex items-start gap-2 py-0.5"><input type="checkbox" name="questionIds" value={q.id} className="mt-1 accent-maroon" /><span><span className="text-xs text-muted">{q.subject} · {KIND[q.kind]} ·</span> {q.text.slice(0, 120)}</span></label>)}</div>
            </fieldset>
            <button className="btn-primary py-2">Create assignment</button>
          </form>
        </details>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Question bank (${o.bank.length})`}>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">{o.bank.map((q) => <li key={q.id} className="py-1.5"><span className="text-xs text-muted">{q.subject} · {q.chapter} · {KIND[q.kind]} · rubric {q.rubric.reduce((t, r) => t + r.max, 0)} marks</span><span className="block">{q.text}</span></li>)}</ul>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-maroon dark:text-gold">Add a question</summary>
            <div className="mt-2"><QuickForm action={addObQuestionAction} submit="Add question" cols={2} fields={[
              { name: 'subject', label: 'Subject', type: 'select', required: true, options: SUBJECTS.map((s) => ({ value: s, label: s })) },
              { name: 'chapter', label: 'Chapter', type: 'text', required: true },
              { name: 'kind', label: 'Type', type: 'select', required: true, options: OB_KINDS.map((k) => ({ value: k, label: KIND[k] })) },
              { name: 'answerType', label: 'Answer type', type: 'select', required: true, options: OB_ANSWER_TYPES.map((k) => ({ value: k, label: k.replace('_', ' ') })) },
              { name: 'text', label: 'Question', type: 'textarea', required: true, wide: true },
              { name: 'modelAnswer', label: 'Model answer', type: 'textarea', required: true, wide: true },
            ]} /></div>
          </details>
        </Panel>
        <Panel title="Weekly big questions">
          <QuickForm action={postBigQuestionAction} submit="Post this week’s question" cols={1} fields={[{ name: 'subject', label: 'Subject', type: 'select', required: true, options: SUBJECTS.map((s) => ({ value: s, label: s })) }, { name: 'text', label: 'Big question', type: 'textarea', required: true }]} />
          <ul className="mt-3 divide-y divide-line text-sm">{board.slice(0, 8).map((q) => (
            <li key={q.id} className="py-2"><span className="text-xs text-muted">{q.subject} · week of {q.weekStart}</span><span className="block font-medium text-heading">{q.text}</span>
              <ul className="mt-1 space-y-1">{q.answers.slice(0, 4).map((a) => <li key={a.id} className="flex items-start justify-between gap-2 text-xs"><span>{a.featured && '⭐ '}<span className="font-semibold">{a.name}:</span> {a.text.slice(0, 160)}</span><form action={featureForm}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="featured" value={a.featured ? '0' : '1'} /><button className="underline">{a.featured ? 'Unfeature' : 'Feature'}</button></form></li>)}</ul>
            </li>
          ))}</ul>
        </Panel>
      </div>
    </div>
  );
}
