import Link from 'next/link';
import { setChapterStatusAction } from '@/app/crm/syllabus-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { can } from '@/lib/crm/permissions';
import { formatDate } from '@/lib/dates';
import { canTeachBatch } from '@/lib/school/common';
import { syllabusBatches, syllabusFor } from '@/lib/school/syllabus';

export const metadata = { title: 'Syllabus' };
export const dynamic = 'force-dynamic';

const LABEL = { not_started: 'Not started', in_progress: 'In progress', done: 'Done' } as const;
const TONE = { not_started: 'text-muted', in_progress: 'text-gold-700 dark:text-gold', done: 'text-emerald-700 dark:text-emerald-300' } as const;

export default async function SyllabusPage({ searchParams }: { searchParams: { batch?: string } }) {
  const user = await requireStaff();
  if (!can(user, 'homework.assign') && !can(user, 'academics.view')) return <Panel title="Syllabus"><p className="text-sm text-muted">Your role doesn’t use the syllabus tracker.</p></Panel>;
  const batches = await syllabusBatches(user);
  const batch = batches.find((b) => b.id === searchParams.batch) ?? batches[0] ?? null;
  const data = batch ? await syllabusFor(batch) : null;
  const editable = batch ? can(user, 'homework.assign') && (await canTeachBatch(user, batch.id)) : false;

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-heading">Syllabus</h1>
        <p className="text-sm text-muted">Chapter-by-chapter coverage per batch (TS Inter, JEE Main and NEET chapters). Students and parents see the same progress in the app.</p>
      </div>
      {batches.length > 1 && (
        <nav className="flex flex-wrap gap-1.5">{batches.map((b) => <Link key={b.id} href={`/crm/syllabus?batch=${b.id}`} className={`chip px-3 py-1 text-sm ${b.id === batch?.id ? 'chip-active' : ''}`}>{b.data.name}</Link>)}</nav>
      )}
      {!data ? <Panel title="Batches"><Empty>No batches yet. Create batches in Batches &amp; timetable.</Empty></Panel> : (
        <>
          <Panel title={`${data.batch.name} · ${data.overall}% covered`}>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.subjects.map((s) => (
                <div key={s.subject}>
                  <p className="flex justify-between text-sm"><span className="font-medium text-heading">{s.subject}</span><span className="font-mono">{s.coverage}%</span></p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-gold" style={{ width: `${s.coverage}%` }} /></div>
                </div>
              ))}
            </div>
          </Panel>
          {data.subjects.map((s) => (
            <Panel key={s.subject} title={`${s.subject} · ${s.coverage}%`}>
              <ul className="divide-y divide-line text-sm">
                {s.chapters.map((c) => (
                  <li key={c.chapter} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="text-heading">{c.chapter}</span>
                      <span className="ml-2 text-xs text-muted">{c.curriculum.join(' · ')}</span>
                      <span className={`ml-2 text-xs font-semibold ${TONE[c.status]}`}>{LABEL[c.status]}{c.date && c.status !== 'not_started' ? ` · ${formatDate(c.date, { day: 'numeric', month: 'short' })}` : ''}</span>
                    </span>
                    {editable && (
                      <span className="flex gap-1">
                        {(['not_started', 'in_progress', 'done'] as const).filter((x) => x !== c.status).map((x) => (
                          <QuickForm key={x} action={setChapterStatusAction} submit={LABEL[x]} cols={1} fields={[{ name: 'batchId', type: 'hidden', value: data.batch.id }, { name: 'subject', type: 'hidden', value: s.subject }, { name: 'chapter', type: 'hidden', value: c.chapter }, { name: 'status', type: 'hidden', value: x }]} />
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}
