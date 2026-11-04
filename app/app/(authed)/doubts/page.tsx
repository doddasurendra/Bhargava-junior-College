import { askDoubtAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireStudent } from '@/lib/app/portal';
import { formatDateTime } from '@/lib/dates';
import { SUBJECTS } from '@/lib/records/collections';
import { studentDoubts } from '@/lib/school/academics';

export const metadata = { title: 'Doubts' };

export default async function DoubtsPage() {
  const { p } = await requireStudent();
  const list = await studentDoubts(p.studentId);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Ask a doubt</h1>
      <section className="card p-4">
        <QuickForm action={askDoubtAction} submit="Send to my teachers" cols={1} fields={[
          { name: 'subject', label: 'Subject', type: 'select', options: SUBJECTS.map((s) => ({ value: s, label: s })) },
          { name: 'text', label: 'Your doubt', type: 'textarea', required: true, rows: 4 },
        ]} />
      </section>
      <ul className="space-y-2">
        {list.map((d) => (
          <li key={d.id} className="card p-3 text-sm">
            <p className="text-[11px] text-muted">{d.subject} · {formatDateTime(d.createdAt)} · {d.status === 'answered' ? 'answered' : 'waiting'}</p>
            <p className="mt-1 whitespace-pre-line">{d.text}</p>
            {d.answer && <p className="mt-2 whitespace-pre-line rounded-lg bg-bg p-2">{d.answer}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
