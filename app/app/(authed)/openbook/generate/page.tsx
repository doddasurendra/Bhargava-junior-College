import Link from 'next/link';
import { Generator } from '@/components/openbook/client';
import { pickerOptions } from '@/lib/openbook/options';
import { obStudent } from '@/lib/openbook/session';
import { H1 } from '../ui';

export const dynamic = 'force-dynamic';

export default async function GeneratePage() {
  const me = await obStudent();
  const o = await pickerOptions();
  return (
    <div className="space-y-4">
      <H1 sub="Open Book AI writes questions only on the concept you choose, in your exam’s real pattern, and never repeats one you have already had.">AI Question Generator</H1>
      <Generator exams={o.exams.filter((e) => e.category !== 'higher' || e.ready)} chapters={o.chapters} initialExam={me.defaultExam} aiReady={o.aiReady} />
      <Link href="/app/openbook/questions" className="block text-center text-xs underline">All my generated questions</Link>
    </div>
  );
}
