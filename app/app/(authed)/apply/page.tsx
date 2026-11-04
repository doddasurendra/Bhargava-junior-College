import { applicationAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { programs } from '@/content/programs';
import { getApplication } from '@/lib/app/flows';
import { requireApplicant } from '@/lib/app/portal';
import { getCrmRepo } from '@/lib/crm/repo';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'Online application' };

export default async function ApplyPage() {
  const { p } = await requireApplicant();
  const [a, lead] = await Promise.all([getApplication(p.leadId), getCrmRepo().getLead(p.leadId)]);
  const v = a?.data;
  if (v?.submittedAt) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl text-heading">Application submitted</h1>
        <section className="card space-y-1 p-4 text-sm">
          <p>Submitted {formatDateTime(v.submittedAt)}. The admission office verifies it next; track every step on the home screen.</p>
          <p><span className="text-muted">Student:</span> {v.studentName} · {programs.find((x) => x.slug === v.program)?.short} · {v.stay === 'hostel' ? 'Hostel' : 'Day scholar'}</p>
        </section>
      </div>
    );
  }
  const fields = (submit: '0' | '1') => [
    { name: 'submit', type: 'hidden' as const, value: submit },
    { name: 'studentName', label: 'Student’s full name', type: 'text' as const, required: true, defaultValue: v?.studentName ?? lead?.studentName ?? '' },
    { name: 'dob', label: 'Date of birth', type: 'date' as const, required: true, defaultValue: v?.dob ?? '' },
    { name: 'gender', label: 'Gender', type: 'select' as const, defaultValue: v?.gender ?? 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }] },
    { name: 'program', label: 'Program', type: 'select' as const, defaultValue: v?.program ?? lead?.program ?? 'iit-jee', options: programs.map((x) => ({ value: x.slug, label: x.name })) },
    { name: 'stay', label: 'Stay', type: 'select' as const, defaultValue: v?.stay ?? 'day', options: [{ value: 'day', label: 'Day scholar' }, { value: 'hostel', label: 'Hostel' }] },
    { name: 'school', label: 'Current school', type: 'text' as const, required: true, defaultValue: v?.school ?? lead?.school ?? '' },
    { name: 'board', label: 'Board', type: 'text' as const, required: true, defaultValue: v?.board ?? 'SSC' },
    { name: 'sscMarks', label: 'SSC / Class 10 marks or GPA', type: 'text' as const, defaultValue: v?.sscMarks ?? '' },
    { name: 'parentName', label: 'Parent / guardian name', type: 'text' as const, required: true, defaultValue: v?.parentName ?? lead?.parentName ?? lead?.contactName ?? '' },
    { name: 'address', label: 'Address', type: 'textarea' as const, required: true, defaultValue: v?.address ?? '' },
  ];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Online application</h1>
      <p className="text-sm text-muted">Save a draft any time. Submit when everything is correct; then upload the documents.</p>
      <section className="card p-4"><QuickForm action={applicationAction} submit="Save draft" cols={1} reset={false} fields={fields('0')} /></section>
      <section className="card p-4"><p className="mb-2 text-sm font-semibold text-heading">Ready? Submit the application</p><QuickForm action={applicationAction} submit="Submit application" cols={1} reset={false} fields={fields('1')} /></section>
    </div>
  );
}
