import Link from 'next/link';
import { Generator } from '@/components/openbook/client';
import { pickerOptions } from '@/lib/openbook/options';
import { obStudent } from '@/lib/openbook/session';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function GeneratePage() {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'generate');
  const o = await pickerOptions();
  return (
    <div className="space-y-4">
      <H1 sub={pg.sub}>{pg.title}</H1>
      <Generator exams={o.exams.filter((e) => e.category !== 'higher' || e.ready)} chapters={o.chapters} initialExam={me.defaultExam} aiReady={o.aiReady} lang={me.profile.lang} />
      <Link href="/app/openbook/questions" className="block text-center text-xs underline">All my generated questions</Link>
    </div>
  );
}
