import Link from 'next/link';
import { revokeDeviceAction, setPasswordAction } from '@/app/app/portal-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { appSessions, requireAppUser } from '@/lib/app/service';
import { shortDevice } from '@/lib/auth/ua';
import { formatDateTime } from '@/lib/dates';

export const metadata = { title: 'More' };

const SECTIONS = {
  student: [['/app/practice', 'Practice, XP & goals'], ['/app/syllabus', 'Syllabus progress'], ['/app/timetable', 'Timetable'], ['/app/homework', 'Homework'], ['/app/study', 'Notes, DPPs & recordings'], ['/app/tests', 'Online tests'], ['/app/results', 'My analytics'], ['/app/report-card', 'Report card'], ['/app/doubts', 'Ask a doubt'], ['/app/open-book', 'Open-book & big question'], ['/app/sports', 'Sports & games'], ['/app/sessions', 'Speaker sessions'], ['/app/wellbeing', 'Wellbeing & counsellor'], ['/app/attendance', 'Attendance'], ['/app/notices', 'Notices'], ['/app/events', 'Events calendar'], ['/app/outpass', 'Hostel out-pass'], ['/app/bus', 'My bus'], ['/app/hostel', 'Hostel & mess menu'], ['/app/fees', 'Fees & receipts'], ['/app/id-card', 'Digital ID card']],
  parent: [['/app/attendance', 'Attendance'], ['/app/syllabus', 'Syllabus progress'], ['/app/leave', 'Apply for leave'], ['/app/practice', 'Practice progress & reports'], ['/app/homework', 'Homework'], ['/app/results', 'Results & mentor notes'], ['/app/sports', 'Sports & achievements'], ['/app/sessions', 'Parent seminars'], ['/app/wellbeing', 'Wellbeing'], ['/app/open-book', 'Open-book marks'],['/app/report-card', 'Report card'], ['/app/events', 'Events calendar'], ['/app/fees', 'Fees, dues & receipts'], ['/app/messages', 'Message the teacher'], ['/app/ptm', 'Book a PTM'], ['/app/outpass', 'Out-pass approvals'], ['/app/hostel', 'Hostel alerts & mess menu'], ['/app/bus', 'Bus'], ['/app/notices', 'Circulars']],
  applicant: [['/app/apply', 'Online application'], ['/app/documents', 'Upload documents'], ['/app/visit', 'Book or reschedule a visit'], ['/app/fees', 'Fees & receipts'], ['/scholarship', 'BSAT registration'], ['/track', 'Track admission']],
  alumni: [['/app/alumni', 'Alumni profile & referrals']],
} as const;

export default async function MorePage() {
  const u = await requireAppUser();
  const kind = u.active?.kind ?? 'applicant';
  const sessions = await appSessions(u);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Everything</h1>
      <ul className="grid grid-cols-2 gap-2">
        {SECTIONS[kind].map(([href, label]) => (
          <li key={href}><Link href={href} className="card block p-3 text-sm font-medium text-heading">{label}</Link></li>
        ))}
      </ul>
      {kind !== 'alumni' && <Link href="/app/alumni" className="block text-sm underline">Passed out? Join the alumni network</Link>}
      {kind === 'student' && (
        <section className="card p-4">
          <p className="mb-1 font-semibold text-heading">College ID password</p>
          <p className="mb-3 text-xs text-muted">Sign in with your College ID and this password instead of a code to your phone.</p>
          <QuickForm action={setPasswordAction} submit="Set password" cols={1} fields={[{ name: 'password', label: 'New password (8+ characters)', type: 'password', required: true }, { name: 'confirm', label: 'Type it again', type: 'password', required: true }]} />
        </section>
      )}
      <section className="card p-4">
        <p className="mb-2 font-semibold text-heading">Signed-in devices</p>
        <ul className="divide-y divide-line text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <span>{shortDevice(s.userAgent)}<span className="block text-[11px] text-muted">last active {formatDateTime(s.lastSeen)}</span></span>
              {s.id === u.sid ? <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">This phone</span> : (
                <form action={revokeDeviceAction}><input type="hidden" name="sessionId" value={s.id} /><button className="text-xs font-semibold text-maroon underline dark:text-gold">Sign out</button></form>
              )}
            </li>
          ))}
        </ul>
        {kind === 'student' && <p className="mt-2 text-[11px] text-muted">Student accounts can be signed in on two devices at a time.</p>}
      </section>
    </div>
  );
}
