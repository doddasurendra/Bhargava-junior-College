import Link from 'next/link';
import { requireStudent } from '@/lib/app/portal';
import { formatDate, todayIST } from '@/lib/dates';
import { testResults } from '@/lib/records/collections';
import { batchTests } from '@/lib/school/academics';
import { batchOf, store } from '@/lib/school/common';

export const metadata = { title: 'Online tests' };

export default async function TestsPage() {
  const { p } = await requireStudent();
  const b = await batchOf(p.studentId);
  const list = b ? (await batchTests(b.id)).filter((t) => t.mode === 'online' && t.questions.length > 0) : [];
  const mine = await Promise.all(list.map((t) => testResults.list(store(), { k1: t.id, k2: p.studentId })));
  const today = todayIST();
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Online tests</h1>
      <p className="text-sm text-muted">JEE/NEET pattern: a timer, and marks deducted for wrong answers. Each test can be taken once.</p>
      {list.length === 0 ? <p className="card p-4 text-sm text-muted">No online tests yet.</p> : (
        <ul className="space-y-2">
          {list.map((t, i) => {
            const r = mine[i][0]?.data;
            const state = r?.submittedAt ? (t.published ? `${r.score}/${r.max}` : 'submitted · result after publishing') : r?.startedAt ? 'in progress' : t.date > today ? `opens ${formatDate(t.date, { day: 'numeric', month: 'short' })}` : 'open';
            return (
              <li key={t.id}>
                <Link href={`/app/tests/${t.id}`} className="card flex items-center justify-between p-3 text-sm">
                  <span><span className="font-medium text-heading">{t.title}</span><span className="block text-[11px] text-muted">{t.questions.length} questions · {t.durationMin} min · {t.subjects.join(', ')}</span></span>
                  <span className="text-xs font-semibold text-maroon dark:text-gold">{state}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
