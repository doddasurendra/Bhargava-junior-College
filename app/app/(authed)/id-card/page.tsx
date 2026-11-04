import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { getProgram } from '@/content/programs';
import { requireStudent } from '@/lib/app/portal';
import { getAppStore } from '@/lib/app/service';
import { batchOf } from '@/lib/school/common';

export const metadata = { title: 'ID card' };

export default async function DigitalIdPage() {
  const { p } = await requireStudent();
  const [s, b] = await Promise.all([getAppStore().getStudent(p.studentId), batchOf(p.studentId)]);
  if (!s) return null;
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl text-heading">Digital ID card</h1>
      <section className="overflow-hidden rounded-2xl bg-navy text-white shadow-lg">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3"><Crest size={40} /><div><p className="font-display text-lg">{college.name}</p><p className="text-[10px] uppercase tracking-[0.16em] text-gold-300">{college.motto}</p></div></div>
        <div className="space-y-1 px-4 py-4 text-sm">
          <p className="text-lg font-semibold">{s.fullName}</p>
          <p className="font-mono text-xl font-semibold text-gold-300">{s.collegeId}</p>
          <p className="text-white/80">{getProgram(s.program)?.name}{b ? ` · ${b.data.name}` : ''} · {s.stay === 'hostel' ? 'Hosteller' : 'Day scholar'}</p>
        </div>
        <p className="bg-gold px-4 py-1 text-[11px] text-navy-950">{college.phones[0].display}</p>
      </section>
    </div>
  );
}
