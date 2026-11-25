import Link from 'next/link';
import { MockBuilder } from '@/components/openbook/MockBuilder';
import { mocksFor } from '@/lib/openbook/mocks';
import { pickerOptions } from '@/lib/openbook/options';
import { obStudent } from '@/lib/openbook/session';
import { H1 } from '../ui';
import { StartButton } from './StartButton';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function MockPage() {
  const me = await obStudent();
  const [mocks, o] = await Promise.all([mocksFor(me.studentId, me.batchId), pickerOptions()]);
  return (
    <div className="space-y-4">
      <H1 sub="Timed papers in your exam’s pattern with instant evaluation and a detailed report.">AI Mock Tests</H1>
      <MockBuilder exams={o.exams} chapters={o.chapters} initialExam={me.defaultExam} aiReady={o.aiReady} />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-heading">My tests</h2>
        {mocks.length === 0 && <p className="card p-3 text-sm text-muted">No tests yet.</p>}
        {mocks.map((m) => (
          <div key={m.id} className="card flex items-center justify-between gap-2 p-3 text-sm">
            <div><p className="font-semibold text-heading">{m.title}{m.shared && <span className="ml-1 rounded bg-navy/10 px-1 text-[10px]">from teacher</span>}</p><p className="text-xs text-muted">{m.questionIds.length} questions · {m.minutes} min · +{m.marks}/−{m.negative} · {m.source}{m.basis ? ` · ${m.basis}` : ''}</p></div>
            {m.attempt?.status === 'submitted' ? <Link href={`/app/openbook/mock/report/${m.attempt.id}`} className="btn-outline shrink-0 px-3 py-1 text-xs">{m.attempt.score}/{m.attempt.max} · report</Link> : <StartButton mockId={m.id} label={m.attempt ? 'Resume' : 'Start'} />}
          </div>
        ))}
      </section>
    </div>
  );
}
