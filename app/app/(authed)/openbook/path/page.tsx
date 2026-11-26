import Link from 'next/link';
import { Field, ObForm } from '@/components/openbook/client';
import { addDays, todayIST } from '@/lib/dates';
import { diagnosticQuestions, todayPlan } from '@/lib/openbook/path';
import { obStudent } from '@/lib/openbook/session';
import { EXAMS, EXAM_BY_ID } from '@/lib/openbook/taxonomy';
import { buildPathAction } from '../actions';
import { Diagnostic } from './Diagnostic';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function PathPage({ searchParams }: { searchParams: { diag?: string } }) {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'path');
  const plan = await todayPlan(me.studentId);
  const setup = (
    <ObForm action={buildPathAction} submit={plan ? 'Rebuild my path' : 'Create my learning path'}>
      <Field label="Exam"><select name="examId" defaultValue={plan?.path.examId ?? me.defaultExam} className="input w-full">{EXAMS.filter((e) => e.phase === 1).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
      <Field label="Exam date"><input type="date" name="examDate" required min={addDays(todayIST(), 7)} defaultValue={plan?.path.examDate ?? addDays(todayIST(), 180)} className="input w-full" /></Field>
      <Field label="Minutes I can study in Open Book each day"><input type="number" name="minutes" min={10} max={600} defaultValue={plan?.path.minutesPerDay ?? me.profile.dailyMinutes} className="input w-full" /></Field>
    </ObForm>
  );
  if (!plan) return <div className="space-y-4"><H1 sub={pg.sub}>{pg.title}</H1><section className="card p-4">{setup}</section></div>;
  const exam = EXAM_BY_ID.get(plan.path.examId)!;
  const diagSubject = searchParams.diag;
  const diagQs = diagSubject ? await diagnosticQuestions(me.studentId, plan.path.examId, diagSubject) : [];
  const pending = exam.subjects.filter((s) => !plan.path.diagnostic[s]?.done);
  return (
    <div className="space-y-4">
      <H1 sub={`${exam.name} · exam ${plan.path.examDate} · ${plan.progress}% of concepts mastered`}>Learning Path</H1>
      {pending.length > 0 && !diagSubject && <section className="card space-y-2 p-4 text-sm"><p className="font-semibold text-heading">Start with a short diagnostic</p><p className="text-muted">12 questions per subject so your path starts with what you need most. Your practice, mocks and challenges also count.</p><div className="flex flex-wrap gap-2">{pending.map((s) => <Link key={s} href={`/app/openbook/path?diag=${encodeURIComponent(s)}`} className="btn-outline px-3 py-1">{s}</Link>)}</div></section>}
      {diagSubject && <section className="space-y-2"><h2 className="text-sm font-semibold text-heading">Diagnostic · {diagSubject}</h2>{diagQs.length ? <Diagnostic examId={plan.path.examId} subject={diagSubject} questions={diagQs} lang={me.profile.lang} /> : <p className="card p-3 text-sm text-muted">No diagnostic questions for {diagSubject} in the bank yet. Ask your teacher to add some; your path still uses your practice results.</p>}</section>}
      <section className="card space-y-2 p-4 text-sm">
        <p className="text-[11px] uppercase tracking-wider text-muted">Today: {plan.minutes} of {plan.path.minutesPerDay} min · {plan.dueCards} flashcards due</p>
        {plan.tasks.length === 0 && <p>All caught up for today. Try the daily challenge.</p>}
        {plan.tasks.map((t) => (
          <div key={t.conceptKey} className="rounded-lg border border-line p-3">
            <p className="font-semibold text-heading">{t.kind === 'review' ? '🔁 ' : ''}{t.concept} <span className="text-xs font-normal text-muted">{t.subject} › {t.chapter} · {t.minutes} min</span></p>
            <ul className="mt-1 space-y-0.5">
              {t.read && <li>📖 <Link className="underline" href={`/app/openbook/book/${t.read.bookId}?page=${t.read.pages[0]}`}>Read {t.read.title}, pp. {t.read.pages.join(', ')}</Link></li>}
              <li>✍️ <Link className="underline" href="/app/openbook/generate">{t.questions} questions on {t.concept}</Link></li>
              {t.cards > 0 && <li>🃏 <Link className="underline" href="/app/openbook/flashcards?mode=quick">{t.cards} flashcards</Link></li>}
            </ul>
            <p className="mt-1 text-[11px] italic text-muted">{t.reason}</p>
          </div>
        ))}
      </section>
      {plan.bySubject.map((s) => {
        const items = plan.path.items.filter((i) => i.subject === s.subject);
        return (
          <details key={s.subject} className="card p-3 text-sm" open={s.inProgress > 0}>
            <summary className="cursor-pointer font-semibold text-heading">{s.subject} · {Math.round((s.done / Math.max(1, s.total)) * 100)}% ({s.done}/{s.total})</summary>
            <div className="mt-2 h-2 rounded bg-bg"><div className="h-2 rounded bg-emerald-600" style={{ width: `${(s.done / Math.max(1, s.total)) * 100}%` }} /></div>
            <ol className="mt-2 space-y-1">{items.slice(0, 80).map((i) => <li key={i.conceptKey} className={i.status === 'locked' ? 'text-muted' : ''}>{i.status === 'done' ? '✅' : i.status === 'in_progress' ? '▶️' : '🔒'} {i.concept} <span className="text-[11px] text-muted">· {i.chapter} · by {i.target}{i.adjustedBy ? ` · set by ${i.adjustedBy}` : ''}</span><span className="block pl-5 text-[11px] italic text-muted">{i.reason}</span></li>)}</ol>
          </details>
        );
      })}
      <details className="card p-4 text-sm"><summary className="cursor-pointer font-semibold">Change exam, date or daily time</summary><div className="mt-3">{setup}</div></details>
    </div>
  );
}
