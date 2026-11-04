import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/crm/receipts/[id]/PrintButton';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { programShort } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { batchOf, studentsById } from '@/lib/school/common';

export const metadata = { title: 'ID card' };

/** CR80 ID card (85.6 × 54 mm) for printing (§9A.2 row 10). */
export default async function IdCardPage({ params }: { params: { id: string } }) {
  await requireStaff('certificates.issue');
  const s = (await studentsById()).get(params.id);
  if (!s?.collegeId) notFound();
  const batch = await batchOf(s.id);
  return (
    <div className="space-y-4">
      <div className="print:hidden"><PrintButton /></div>
      <div className="flex flex-wrap gap-6">
        <div className="flex h-[54mm] w-[85.6mm] flex-col overflow-hidden rounded-[3mm] border border-line bg-white text-[#151C36] shadow print:shadow-none">
          <div className="flex items-center gap-2 bg-[#1D2A5E] px-3 py-1.5 text-white">
            <Crest size={28} />
            <div className="leading-tight">
              <p className="text-[9px] font-bold uppercase tracking-wider">{college.name}</p>
              <p className="text-[7px] text-[#C9A24A]">{college.motto}</p>
            </div>
          </div>
          <div className="flex flex-1 gap-3 px-3 py-2">
            <div className="grid h-[26mm] w-[21mm] place-items-center rounded border border-dashed border-gray-400 text-[7px] text-gray-500">Photo</div>
            <div className="min-w-0 text-[9px] leading-[1.45]">
              <p className="text-[11px] font-bold">{s.fullName}</p>
              <p className="font-mono text-[10px] font-semibold text-[#7D1F2C]">{s.collegeId}</p>
              <p>{programShort(s.program)}{batch ? ` · ${batch.data.name}` : ''}</p>
              <p>{s.stay === 'hostel' ? 'Hosteller' : 'Day scholar'}</p>
              <p>Guardian: {s.guardianName}</p>
            </div>
          </div>
          <div className="bg-[#C9A24A] px-3 py-0.5 text-[7px] text-[#151C36]">{college.phones[0].display} · if found, please return to the college office</div>
        </div>
      </div>
    </div>
  );
}
