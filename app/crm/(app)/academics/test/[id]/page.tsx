import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addFromBankAction, addQuestionAction, enterMarksAction, publishTestAction } from '@/app/crm/school-actions';
import { chaptersOf, QUESTIONS, SUBJECTS } from '@/lib/practice/bank';
import { ActionButton, QuickForm, type QField } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { batches, testResults, tests } from '@/lib/records/collections';
import { canTeachBatch, rankList } from '@/lib/school/academics';
import { store, studentsById } from '@/lib/school/common';

export const metadata = { title: 'Test' };

export default async function TestPage({ params }: { params: { id: string } }) {
  const user = await requireStaff('tests.manage');
  const t = await tests.get(store(), params.id);
  if (!t || !(await canTeachBatch(user, t.data.batchId))) notFound();
  const [b, ranks, results, byId] = await Promise.all([batches.get(store(), t.data.batchId), rankList(t.id), testResults.list(store(), { k1: t.id }), studentsById()]);
  const taken = results.length > 0;
  const marksFields: QField[] = [
    { name: 'testId', type: 'hidden', value: t.id },
    ...(b?.data.studentIds ?? []).map((sid) => ({ name: `s:${sid}`, label: byId.get(sid)?.fullName ?? 'Student', type: 'number' as const, min: -t.data.maxMarks, max: t.data.maxMarks, step: 0.25, defaultValue: results.find((r) => r.data.studentId === sid)?.data.score?.toString() ?? '' })),
  ];

  return (
    <div className="space-y-5">
      <Link href={`/crm/academics/batch/${t.data.batchId}`} className="text-sm text-muted underline">← {b?.data.name ?? 'Batch'}</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-heading">{t.data.title}</h1>
          <p className="text-sm text-muted">{formatDate(t.data.date)} · {t.data.mode} · {t.data.durationMin} min · max {t.data.maxMarks} · {t.data.published ? 'published' : 'not published'}</p>
        </div>
        {can(user, 'results.publish') && !t.data.published && <ActionButton action={publishTestAction} label="Publish results" hidden={{ testId: t.id }} className="btn-primary py-2" />}
      </div>

      {t.data.mode === 'online' ? (
        <Panel title={`Questions (${t.data.questions.length})`}>
          {t.data.questions.length === 0 ? <Empty>Add the questions. Students take the test in the app with a timer and +marks / −negative marking.</Empty> : (
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm">
              {t.data.questions.map((q) => (
                <li key={q.id}>
                  <span className="font-medium text-heading">{q.text}</span>
                  <span className="text-muted"> · {q.subject} / {q.chapter} · +{q.marks} / −{q.negative}</span>
                  <ol className="mt-1 grid grid-cols-2 gap-x-4 text-xs" type="a">
                    {q.options.map((o, i) => <li key={i} className={i === q.answer ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-muted'}>{String.fromCharCode(65 + i)}. {o}</li>)}
                  </ol>
                </li>
              ))}
            </ol>
          )}
          {!taken && (
            <div className="mb-4 rounded-xl border border-line p-3">
              <p className="mb-2 text-sm font-semibold text-heading">Generate from the question bank ({QUESTIONS.length} questions, +4 / −1)</p>
              <QuickForm action={addFromBankAction} submit="Add from bank" cols={3} fields={[
                { name: 'testId', type: 'hidden', value: t.id },
                { name: 'chapter', label: 'Subject · chapter', type: 'select', options: [{ value: '', label: 'Any subject / chapter' }, ...SUBJECTS.flatMap((x) => [{ value: `${x}|`, label: `${x} (all chapters)` }, ...chaptersOf(x).map((c) => ({ value: `${x}|${c}`, label: `${x} · ${c}` }))])] },
                { name: 'difficulty', label: 'Level', type: 'select', options: [{ value: '', label: 'Any level' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }] },
                { name: 'count', label: 'Questions', type: 'number', min: 1, max: 50, defaultValue: '10' },
              ]} />
            </div>
          )}
          {taken ? <p className="text-sm text-muted">Students have started this test, so questions can no longer change.</p> : (
            <QuickForm action={addQuestionAction} submit="Add question" fields={[
              { name: 'testId', type: 'hidden', value: t.id },
              { name: 'text', label: 'Question', type: 'textarea', required: true, wide: true },
              { name: 'o0', label: 'Option A', type: 'text', required: true },
              { name: 'o1', label: 'Option B', type: 'text', required: true },
              { name: 'o2', label: 'Option C', type: 'text', required: true },
              { name: 'o3', label: 'Option D', type: 'text', required: true },
              { name: 'answer', label: 'Correct option', type: 'select', options: ['A', 'B', 'C', 'D'].map((l, i) => ({ value: String(i), label: l })) },
              { name: 'subject', label: 'Subject', type: 'select', options: t.data.subjects.map((x) => ({ value: x, label: x })) },
              { name: 'chapter', label: 'Chapter', type: 'text', required: true },
              { name: 'marks', label: 'Marks', type: 'number', defaultValue: '4', min: 0, max: 10 },
              { name: 'negative', label: 'Negative', type: 'number', defaultValue: '1', min: 0, max: 5, step: 0.25 },
            ]} />
          )}
        </Panel>
      ) : (
        <Panel title="Enter marks">
          {(b?.data.studentIds.length ?? 0) === 0 ? <Empty>No students in this batch.</Empty> : <QuickForm action={enterMarksAction} submit="Save marks" cols={3} reset={false} fields={marksFields} />}
        </Panel>
      )}

      <Panel title="Rank list">
        {ranks.length === 0 ? <Empty>No results yet.</Empty> : (
          <table className="table-base text-sm">
            <thead><tr><th>Rank</th><th>Student</th><th className="text-right">Score</th><th className="text-right">Percentile</th></tr></thead>
            <tbody>
              {ranks.filter((r) => r.submittedAt).map((r) => (
                <tr key={r.studentId}><td className="font-mono">{r.rank}</td><td>{r.name} <span className="text-xs text-muted">{r.collegeId}</span></td><td className="text-right font-mono">{r.score}/{r.max}</td><td className="text-right font-mono">{r.percentile}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
