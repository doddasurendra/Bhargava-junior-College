import Link from 'next/link';
import { StartExam } from '@/components/openbook/ExamRunner';
import { examsForStudent } from '@/lib/openbook/closedExam';
import { obStudent } from '@/lib/openbook/session';

export const metadata = { title: 'Exams' };
export const dynamic = 'force-dynamic';

const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null);

/** Student dashboard: closed-book examinations set by teachers for this batch, and results. */
export default async function ExamsPage() {
  const me = await obStudent();
  const list = await examsForStudent(me.studentId, me.batchId);
  const now = new Date().toISOString();
  const done = list.filter((e) => e.attempt?.data.status === 'submitted');
  const avg = done.length ? Math.round(done.reduce((s, e) => s + ((e.attempt!.data.score ?? 0) / (e.attempt!.data.max || 1)) * 100, 0) / done.length) : null;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Closed-book exams</h1>
      <p className="text-sm text-muted">Exam conditions: full screen, timer, no study material. {done.length ? `${done.length} taken · average ${avg}%.` : ''}</p>
      {list.length === 0 ? <p className="card p-4 text-sm text-muted">No exams set for your batch yet.</p> : (
        <ul className="space-y-2">{list.map((e) => {
          const st = e.attempt?.data.status;
          const notYet = e.closed!.opensAt && now < e.closed!.opensAt;
          const closed = e.closed!.closesAt && now > e.closed!.closesAt;
          return (
            <li key={e.id} className="card space-y-2 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold text-heading">{e.title}</span>{st === 'submitted' && <span className="font-mono font-semibold">{e.attempt!.data.score}/{e.attempt!.data.max}</span>}</div>
              <p className="text-xs text-muted">{e.questionIds.length} questions · {e.minutes} min · +{e.marks}{e.negative ? ` / −${e.negative}` : ''}{e.closed!.opensAt ? ` · opens ${when(e.closed!.opensAt)}` : ''}{e.closed!.closesAt ? ` · closes ${when(e.closed!.closesAt)}` : ''}</p>
              {st === 'submitted' ? <Link className="btn-outline inline-block px-4 py-2 text-sm" href={`/app/exam/report/${e.attempt!.id}`}>View report</Link>
                : notYet ? <p className="text-xs">Opens {when(e.closed!.opensAt)}.</p>
                : closed && !st ? <p className="text-xs text-muted">Closed.</p>
                : <StartExam mockId={e.id} label={st === 'in_progress' ? 'Continue exam' : 'Start exam'} />}
            </li>
          );
        })}</ul>
      )}
    </div>
  );
}
