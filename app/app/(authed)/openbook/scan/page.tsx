import { Scanner } from '@/components/openbook/client';
import { aiConfigured } from '@/lib/openbook/llm';
import { pickerOptions } from '@/lib/openbook/options';
import { obStudent } from '@/lib/openbook/session';
import { H1 } from '../ui';
import { page as pageText } from '@/lib/openbook/i18n';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function ScanPage() {
  const me = await obStudent();
  const pg = pageText(me.profile.lang, 'scan');
  const o = await pickerOptions();
  return (
    <div className="space-y-4">
      <H1 sub={pg.sub}>{pg.title}</H1>
      {!aiConfigured() && <p className="text-xs text-muted">Automatic reading (OCR) and solving need the AI service, which isn’t switched on yet. You can still type the question and save it, make a flashcard, post it or send it to a teacher.</p>}
      <Scanner exams={o.exams} defaultExam={me.defaultExam} lang={me.profile.lang} />
      <p className="text-[11px] text-muted">Your photo is stored privately and never changed.</p>
    </div>
  );
}
