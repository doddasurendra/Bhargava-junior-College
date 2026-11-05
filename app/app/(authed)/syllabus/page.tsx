import { requireEnrolled } from '@/lib/app/portal';
import { syllabusForStudent } from '@/lib/school/syllabus';

export const metadata = { title: 'Syllabus' };
export const dynamic = 'force-dynamic';

const LABEL = { not_started: 'Not started', in_progress: 'In progress', done: 'Done' } as const;

export default async function AppSyllabusPage() {
  const { p } = await requireEnrolled();
  const data = await syllabusForStudent(p.studentId);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Syllabus</h1>
      {!data ? <p className="card p-4 text-sm text-muted">The syllabus appears once a batch is allotted.</p> : (
        <>
          <section className="card p-4 text-sm">
            <p className="font-semibold text-heading">{data.batch.name} · {data.overall}% covered</p>
            {data.subjects.map((s) => (
              <div key={s.subject} className="mt-2">
                <p className="flex justify-between"><span>{s.subject}</span><span className="font-mono">{s.coverage}%</span></p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-gold" style={{ width: `${s.coverage}%` }} /></div>
              </div>
            ))}
          </section>
          {data.subjects.map((s) => (
            <section key={s.subject} className="card p-4 text-sm">
              <p className="mb-1 font-semibold text-heading">{s.subject}</p>
              <ul className="space-y-1">{s.chapters.map((c) => <li key={c.chapter} className="flex justify-between gap-2"><span>{c.chapter}</span><span className={c.status === 'done' ? 'text-emerald-700 dark:text-emerald-300' : c.status === 'in_progress' ? 'text-gold-700 dark:text-gold' : 'text-muted'}>{LABEL[c.status]}</span></li>)}</ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
