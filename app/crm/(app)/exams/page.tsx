import Link from 'next/link';
import { createExamAction } from '@/app/crm/exam-actions';
import { ActionForm, Submit } from '@/components/crm/forms';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { canTeach } from '@/lib/openbook/core';
import { DEFAULT_RULES, examsOverview } from '@/lib/openbook/closedExam';
import { EXAMS } from '@/lib/openbook/taxonomy';
import { analysableBatches } from '@/lib/school/attendanceTools';

export const metadata = { title: 'Closed-book exams' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PATTERN_IDS = ['inter1-mpc', 'inter2-mpc', 'inter1-bipc', 'inter2-bipc', 'jee-main', 'jee-advanced', 'neet-ug'];

/** Teachers / exam cell: set closed-book examinations for a batch and see every exam's results. */
export default async function ExamsAdmin() {
  const u = await requireStaff();
  if (!canTeach(u)) return <Panel title="Closed-book exams"><p className="text-sm text-muted">Your role doesn’t set examinations.</p></Panel>;
  const [list, bs] = await Promise.all([examsOverview(u), analysableBatches(u)]);
  const patterns = EXAMS.filter((e) => PATTERN_IDS.includes(e.id)).concat(EXAMS.filter((e) => !PATTERN_IDS.includes(e.id) && ['intermediate', 'engineering', 'medical'].includes(e.category)));
  const subjects = [...new Set(patterns.flatMap((e) => e.subjects))].sort();
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Closed-book exams</h1>
        <p className="text-sm text-muted">Online exams under exam conditions: full screen, timer, shuffled questions and options, no study material, tab and focus changes recorded. Browser checks make cheating harder and visible, not impossible.</p>
      </div>
      <Panel title="Set an exam">
        {bs.length === 0 ? <Empty>No batches you teach yet.</Empty> : (
          <ActionForm action={createExamAction} className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs sm:col-span-2">Title<input name="title" required maxLength={200} placeholder="JEE Main mock 3 · Physics + Chemistry" className="input mt-1 w-full" /></label>
              <label className="text-xs">Batch<select name="batchId" required className="input mt-1 w-full">{bs.map((b) => <option key={b.id} value={b.id}>{b.data.name}</option>)}</select></label>
              <label className="text-xs">Examination pattern<select name="examId" required className="input mt-1 w-full">{patterns.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.pattern.minutes} min, +{e.pattern.marks}{e.pattern.negative ? `/−${e.pattern.negative}` : ''})</option>)}</select></label>
              <label className="text-xs">Questions<input name="count" type="number" min={1} max={200} defaultValue={30} className="input mt-1 w-full" /></label>
              <label className="text-xs">Questions from<select name="source" className="input mt-1 w-full"><option value="pool">Question bank (chosen subjects / chapters)</option><option value="pattern">Past-paper pattern (chapter weightage)</option></select></label>
            </div>
            <fieldset className="text-xs"><legend className="mb-1">Subjects</legend><div className="flex flex-wrap gap-3">{subjects.map((x) => <label key={x} className="flex items-center gap-1"><input type="checkbox" name="subjects" value={x} defaultChecked={x === 'Physics'} /> {x}</label>)}</div></fieldset>
            <label className="block text-xs">Chapters (comma; leave empty for the full syllabus)<input name="chapters" className="input mt-1 w-full" placeholder="Laws of Motion, Work, Energy and Power" /></label>
            <div className="grid gap-2 sm:grid-cols-4">
              <label className="text-xs">Minutes (empty = pattern)<input name="minutes" type="number" min={5} max={600} className="input mt-1 w-full" /></label>
              <label className="text-xs">Marks per question (empty = pattern)<input name="marks" type="number" min={0} max={100} step="0.25" className="input mt-1 w-full" /></label>
              <label className="text-xs">Negative marks (empty = pattern)<input name="negative" type="number" min={0} max={100} step="0.25" className="input mt-1 w-full" /></label>
              <label className="text-xs">Auto-submit after leaving the window (0 = only record)<input name="maxFocusLoss" type="number" min={0} max={20} defaultValue={DEFAULT_RULES.maxFocusLoss} className="input mt-1 w-full" /></label>
              <label className="text-xs">Opens (college time, optional)<input name="opensAt" type="datetime-local" className="input mt-1 w-full" /></label>
              <label className="text-xs">Closes (optional)<input name="closesAt" type="datetime-local" className="input mt-1 w-full" /></label>
            </div>
            <fieldset className="flex flex-wrap gap-4 text-xs"><legend className="mb-1">Exam rules</legend>
              <label className="flex items-center gap-1"><input type="checkbox" name="fullscreen" defaultChecked={DEFAULT_RULES.fullscreen} /> Full screen</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="shuffleQuestions" defaultChecked={DEFAULT_RULES.shuffleQuestions} /> Shuffle questions</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="shuffleOptions" defaultChecked={DEFAULT_RULES.shuffleOptions} /> Shuffle options</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="singleDevice" defaultChecked={DEFAULT_RULES.singleDevice} /> One device per attempt</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="showAnswers" defaultChecked={DEFAULT_RULES.showAnswers} /> Show answers after submitting</label>
            </fieldset>
            <Submit className="btn-primary py-2">Create exam</Submit>
          </ActionForm>
        )}
      </Panel>
      <Panel title={`Exams (${list.length})`}>
        {list.length === 0 ? <Empty>No closed-book exams yet.</Empty> : (
          <table className="table-base text-sm"><thead><tr><th>Exam</th><th className="text-right">Taken</th><th className="text-right">Average</th><th className="text-right">Flagged</th></tr></thead>
            <tbody>{list.map((e) => <tr key={e.id}><td><Link className="underline" href={`/crm/exams/${e.id}`}>{e.title}</Link></td><td className="text-right font-mono">{e.taken}/{e.of}</td><td className="text-right font-mono">{e.average === null ? '–' : `${e.average}%`}</td><td className={`text-right font-mono ${e.flagged ? 'font-semibold text-maroon' : ''}`}>{e.flagged}</td></tr>)}</tbody></table>
        )}
      </Panel>
    </div>
  );
}
