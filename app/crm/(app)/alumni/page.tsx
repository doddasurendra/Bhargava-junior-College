import { revalidatePath } from 'next/cache';
import { QuickForm } from '@/components/crm/QuickForm';
import { Empty, Panel } from '@/components/crm/ui';
import { requireStaff } from '@/lib/crm/auth';
import { phoneFor } from '@/lib/crm/mask';
import { normalizeIndianMobile } from '@/lib/phone';
import { getRecordStore } from '@/lib/records';
import { alumni } from '@/lib/records/collections';
import { allStudents } from '@/lib/school/common';
import type { ActionState } from '@/app/crm/actions';

export const metadata = { title: 'Alumni' };

async function approve(fd: FormData) {
  'use server';
  await requireStaff('alumni.manage');
  const a = await alumni.get(getRecordStore(), String(fd.get('id') ?? ''));
  if (a) await alumni.put(getRecordStore(), { ...a.data, approved: fd.get('approve') === '1' }, a.id);
  revalidatePath('/crm/alumni');
}

/** §9A.1 account lifecycle: "alumni are moved to the alumni role after the course ends". */
async function moveToAlumni(_: ActionState, fd: FormData): Promise<ActionState> {
  'use server';
  await requireStaff('alumni.manage');
  const s = (await allStudents()).find((x) => x.id === fd.get('studentId'));
  if (!s) return { error: 'Pick a student.' };
  const phone = normalizeIndianMobile(String(fd.get('phone') ?? '')) ?? s.loginPhone ?? null;
  if (!phone) return { error: 'Give the student’s own mobile number for their alumni login.' };
  const year = Number(fd.get('year'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Give the year they passed out.' };
  const prev = (await alumni.list(getRecordStore(), { k1: phone }))[0];
  await alumni.put(getRecordStore(), { studentId: s.id, name: s.fullName, phone, passedOut: year, nowAt: prev?.data.nowAt ?? null, course: prev?.data.course ?? null, mentorWilling: prev?.data.mentorWilling ?? false, story: prev?.data.story ?? null, approved: true }, prev?.id);
  revalidatePath('/crm/alumni');
  return { ok: true, message: `${s.fullName} can now sign in to the alumni network with ${phone.slice(-4).padStart(10, '•')}.` };
}

export default async function AlumniAdminPage() {
  const user = await requireStaff('alumni.manage');
  const [list, students] = await Promise.all([alumni.list(getRecordStore()), allStudents()]);
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="font-display text-3xl text-heading">Alumni network</h1>
      <Panel title={`Profiles (${list.length})`}>
        {list.length === 0 ? <Empty>No alumni yet.</Empty> : (
          <ul className="-my-2 divide-y divide-line text-sm">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold text-heading">{a.data.name}</span> · {a.data.passedOut} · <span className="font-mono text-xs">{phoneFor(user, a.data.phone)}</span>
                  <span className="block text-xs text-muted">{[a.data.nowAt, a.data.course, a.data.mentorWilling ? 'willing to mentor' : null].filter(Boolean).join(' · ')}</span>
                  {a.data.story && <span className="block text-xs">{a.data.story}</span>}
                </span>
                <form action={approve} className="flex gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="approve" value={a.data.approved ? '0' : '1'} />
                  <button className="text-xs font-semibold text-maroon underline dark:text-gold">{a.data.approved ? 'Hide' : 'Approve'}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Move a passed-out student to alumni">
        <QuickForm action={moveToAlumni} submit="Move to alumni" fields={[
          { name: 'studentId', label: 'Student', type: 'select', required: true, options: students.map((s) => ({ value: s.id, label: `${s.fullName} · ${s.collegeId}` })) },
          { name: 'year', label: 'Passed out in', type: 'number', required: true, min: 2000, max: 2100, defaultValue: String(new Date().getFullYear()) },
          { name: 'phone', label: 'Student’s own mobile (if not on record)', type: 'tel' },
        ]} />
      </Panel>
    </div>
  );
}
