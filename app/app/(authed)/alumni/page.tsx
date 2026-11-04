import { alumniAction, referAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireAppUser } from '@/lib/app/service';
import { getRecordStore } from '@/lib/records';
import { alumni } from '@/lib/records/collections';

export const metadata = { title: 'Alumni' };

/** §9A row 20: alumni profile, mentoring current students, success stories, referrals (tracked in the CRM). */
export default async function AlumniPage() {
  const u = await requireAppUser();
  const me = (await alumni.list(getRecordStore(), { k1: u.phone }))[0]?.data;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Alumni network</h1>
      <section className="card p-4">
        <p className="mb-2 text-sm font-semibold text-heading">{me ? (me.approved ? 'Your alumni profile' : 'Your profile (waiting for the college to approve)') : 'Join the alumni network'}</p>
        <QuickForm action={alumniAction} submit="Save" cols={1} reset={false} fields={[
          { name: 'name', label: 'Your name', type: 'text', required: true, defaultValue: me?.name ?? '' },
          { name: 'passedOut', label: 'Year you passed out', type: 'number', required: true, min: 2000, max: 2100, defaultValue: me ? String(me.passedOut) : '' },
          { name: 'nowAt', label: 'Now at (college / IIT / AIIMS / company)', type: 'text', defaultValue: me?.nowAt ?? '' },
          { name: 'course', label: 'Course', type: 'text', defaultValue: me?.course ?? '' },
          { name: 'mentor', label: 'I’m happy to mentor current students', type: 'checkbox', defaultChecked: me?.mentorWilling ?? false },
          { name: 'story', label: 'Your story (for the website, with your permission)', type: 'textarea', defaultValue: me?.story ?? '' },
        ]} />
      </section>
      <section className="card p-4">
        <p className="mb-1 text-sm font-semibold text-heading">Refer a family</p>
        <p className="mb-2 text-xs text-muted">Only share a family’s number with their permission. An admission counsellor will call them.</p>
        <QuickForm action={referAction} submit="Refer" cols={1} fields={[
          { name: 'name', label: 'Parent’s name', type: 'text', required: true },
          { name: 'phone', label: 'Mobile', type: 'tel', required: true },
          { name: 'note', label: 'Note', type: 'text' },
        ]} />
      </section>
    </div>
  );
}
