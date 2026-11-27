import Link from 'next/link';
import { BarList } from '@/components/crm/charts';
import { Empty, Panel, Stat } from '@/components/crm/ui';
import { can } from '@/lib/crm/permissions';
import type { Staff } from '@/lib/crm/types';
import { examsOverview } from '@/lib/openbook/closedExam';

type P = { tab: string; user: Staff; from: string; to: string; q: Record<string, string | undefined> };

/** Analytics tabs from later modules. Every tab re-checks the permission on the server. */
export async function ExtraTab(p: P) {
  if (p.tab === 'mocks' && can(p.user, 'ob.teach')) return <MocksTab {...p} />;
  return <Empty>Not available for your role.</Empty>;
}

async function MocksTab({ user }: P) {
  const list = await examsOverview(user);
  const taken = list.reduce((s, e) => s + e.taken, 0);
  const withAvg = list.filter((e) => e.average !== null);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Closed-book exams" value={list.length} />
        <Stat label="Attempts submitted" value={taken} />
        <Stat label="Average across exams" value={withAvg.length ? `${Math.round((withAvg.reduce((s, e) => s + e.average!, 0) / withAvg.length) * 10) / 10}%` : '–'} />
        <Stat label="Flagged attempts" value={list.reduce((s, e) => s + e.flagged, 0)} tone={list.some((e) => e.flagged) ? 'warn' : 'good'} />
      </div>
      <Panel title="Average score by exam">{withAvg.length ? <BarList rows={withAvg.map((e) => ({ label: e.title, value: e.average!, note: `${e.taken}/${e.of}` }))} unit="%" /> : <Empty>No submitted exams yet.</Empty>}</Panel>
      <p className="text-sm"><Link href="/crm/exams" className="underline">Open closed-book exams →</Link></p>
    </>
  );
}
