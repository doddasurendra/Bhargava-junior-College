import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { programShort } from '@/components/crm/ui';
import { Crest } from '@/components/ui';
import { college, fullAddress } from '@/content/college';
import { requireStaff } from '@/lib/crm/auth';
import { formatDate } from '@/lib/dates';
import { certificates } from '@/lib/records/collections';
import { store, studentsById } from '@/lib/school/common';

export const metadata = { title: 'Certificate' };

const TITLES = { tc: 'Transfer Certificate', bonafide: 'Bonafide Certificate', study: 'Study Certificate', conduct: 'Conduct Certificate' } as const;

export default async function CertificatePage({ params }: { params: { id: string; cid: string } }) {
  await requireStaff('certificates.issue');
  const c = await certificates.get(store(), params.cid);
  const s = (await studentsById()).get(params.id);
  if (!c || !s || c.data.studentId !== s.id) notFound();
  const pronoun = s.gender === 'female' ? 'She' : s.gender === 'male' ? 'He' : 'They';
  const body = {
    bonafide: `This is to certify that ${s.fullName} (College ID ${s.collegeId}) is a bonafide student of ${college.name}, studying in the ${programShort(s.program)} program.${c.data.purpose ? ` This certificate is issued for the purpose of ${c.data.purpose}.` : ''}`,
    study: `This is to certify that ${s.fullName} (College ID ${s.collegeId}) is studying at ${college.name} in the ${programShort(s.program)} program.`,
    conduct: `This is to certify that ${s.fullName} (College ID ${s.collegeId}) has been a student of ${college.name}. ${pronoun === 'They' ? 'Their' : pronoun === 'She' ? 'Her' : 'His'} conduct during the period of study has been ${c.data.conduct ?? 'good'}.`,
    tc: `This is to certify that ${s.fullName} (College ID ${s.collegeId}), date of birth ${formatDate(s.dob)}, was a student of ${college.name} in the ${programShort(s.program)} program. ${pronoun} ${pronoun === 'They' ? 'have' : 'has'} been granted this Transfer Certificate. Conduct: ${c.data.conduct ?? 'Good'}.`,
  }[c.data.kind];
  return (
    <div className="space-y-4">
      <div className="print:hidden"><PrintButton /></div>
      <article className="mx-auto max-w-[180mm] rounded-xl border border-line bg-white p-10 text-[#151C36] print:border-0 print:p-0">
        <header className="flex items-center gap-4 border-b-4 border-[#C9A24A] pb-4">
          <Crest size={64} />
          <div>
            <p className="font-display text-2xl text-[#1D2A5E]">{college.name}</p>
            <p className="text-xs text-[#7D1F2C]">{college.motto} · {college.society}</p>
            <p className="text-xs text-gray-600">{fullAddress}</p>
          </div>
        </header>
        <div className="mt-6 flex justify-between text-sm"><span className="font-mono">No. {c.data.number}</span><span>Date: {formatDate(c.data.issuedAt.slice(0, 10))}</span></div>
        <h1 className="mt-8 text-center font-display text-2xl uppercase tracking-wider text-[#1D2A5E]">{TITLES[c.data.kind]}</h1>
        <p className="mt-8 text-justify text-[15px] leading-8">{body}</p>
        <div className="mt-24 flex justify-between text-sm">
          <span>Seal</span>
          <span className="text-center">Principal<br /><span className="text-xs text-gray-600">{college.name}</span></span>
        </div>
      </article>
    </div>
  );
}
