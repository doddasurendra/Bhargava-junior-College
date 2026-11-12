import { cookies } from 'next/headers';
import { askAnonAction, bookCounsellorAction, checkinAction, deleteCheckinForm, wellbeingConsentForm } from '@/app/app/studentlife-actions';
import { QuickForm } from '@/components/crm/QuickForm';
import { requireEnrolled } from '@/lib/app/portal';
import { addDays, formatDate, formatDateTime, todayIST } from '@/lib/dates';
import { anonAnswers, consentOf, listHelplines, myBookings, myCheckins, parentSummary } from '@/lib/studentLife/wellbeing';

export const metadata = { title: 'Wellbeing' };

const MOOD = ['', '😞 Very low', '🙁 Low', '😐 Okay', '🙂 Good', '😄 Great'];
const STRESS = ['', '1 · Calm', '2 · A little', '3 · Some', '4 · High', '5 · Very high'];
const TIPS = [
  ['Box breathing (2 min)', 'Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat 6 times.'],
  ['The 50/10 rule', 'Study 50 minutes, then 10 minutes away from the desk: walk, water, stretch.'],
  ['Sleep is revision', 'Seven to eight hours helps the brain store what you studied today.'],
  ['One bad test is one test', 'Look at what to fix, not at the rank. Talk to your mentor about a plan.'],
] as const;

async function Helplines() {
  const list = await listHelplines();
  return (
    <section className="card border-l-4 border-l-maroon p-4 text-sm dark:border-l-gold">
      <p className="font-semibold text-heading">Need to talk to someone now?</p>
      <ul className="mt-1 space-y-1">
        {list.map((h) => <li key={h.name}><a href={`tel:${h.number.replace(/[^\d+]/g, '')}`} className="font-mono font-semibold underline">{h.number}</a> · {h.name}{h.hours ? ` (${h.hours})` : ''}{h.note ? <span className="block text-[11px] text-muted">{h.note}</span> : null}</li>)}
      </ul>
    </section>
  );
}

export default async function WellbeingPage() {
  const { p } = await requireEnrolled();

  if (p.kind === 'parent') {
    const s = await parentSummary(p.studentId);
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl text-heading">Wellbeing</h1>
        <section className="card p-4 text-sm">
          {s.shared ? (
            <>
              <p className="font-semibold text-heading">Summary of the last {s.weeks} weekly check-ins</p>
              <ul className="mt-1 space-y-0.5"><li>Mood: <span className="font-mono">{s.mood ?? '–'}/5</span></li><li>Stress: <span className="font-mono">{s.stress ?? '–'}/5</span></li><li>Sleep: <span className="font-mono">{s.sleep ?? '–'} h</span></li></ul>
              {s.counsellorAsked && <p className="mt-2 rounded-lg bg-bg p-2">The college counsellor would like to speak with you. Please call the college office to fix a time.</p>}
            </>
          ) : <p>Your child’s weekly check-ins are private between them and the college counsellor. If your child chooses to share a summary with you, it will appear here.</p>}
        </section>
        <section className="card p-4 text-sm">
          <p className="mb-1 font-semibold text-heading">Supporting your child at exam time</p>
          <ul className="list-disc space-y-1 pl-5"><li>Ask “what did you learn?” more than “what rank did you get?”</li><li>Keep sleep and meals regular, especially before tests.</li><li>Notice changes: not eating, not sleeping, withdrawing. Talk to the mentor or the counsellor early.</li></ul>
        </section>
        <Helplines />
      </div>
    );
  }

  const consent = await consentOf(p.studentId);
  if (!consent) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl text-heading">Wellbeing</h1>
        <section className="card space-y-2 p-4 text-sm">
          <p className="font-semibold text-heading">Before you start: your privacy</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your weekly check-ins are seen only by you and the college Student Counsellor.</li>
            <li>Your mentor sees only that you might like a conversation, never your answers or notes.</li>
            <li>The Principal sees only college-wide averages, never names.</li>
            <li>Your parents see a summary only if you choose to share it below, or if the counsellor believes you may be unsafe.</li>
            <li>You can delete any check-in at any time.</li>
          </ul>
          <form action={wellbeingConsentForm} className="space-y-2 pt-1">
            <label className="flex items-center gap-2"><input type="checkbox" name="share" /> Share a summary (mood, stress, sleep averages) with my parents</label>
            <button className="btn-primary px-4 py-2 text-sm">I understand, continue</button>
          </form>
        </section>
        <Helplines />
      </div>
    );
  }

  const today = todayIST();
  const [checks, bookings, answers] = await Promise.all([myCheckins(p.studentId), myBookings(p.studentId), anonAnswers((cookies().get('bjc_anon')?.value ?? '').split('.').filter(Boolean))]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-heading">Wellbeing</h1>
      <Helplines />

      <section className="card p-4">
        <p className="mb-1 font-semibold text-heading">This week’s check-in</p>
        <p className="mb-2 text-xs text-muted">Private: only you and the counsellor. Submitting again this week updates it.</p>
        <QuickForm action={checkinAction} submit="Save check-in" cols={1} fields={[
          { name: 'mood', label: 'Mood this week', type: 'select', required: true, defaultValue: '3', options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: MOOD[n] })) },
          { name: 'stress', label: 'Stress', type: 'select', required: true, defaultValue: '3', options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: STRESS[n] })) },
          { name: 'sleep', label: 'Average sleep (hours)', type: 'number', required: true, min: 0, max: 14, step: 0.5, defaultValue: '7' },
          { name: 'note', label: 'Anything on your mind? (optional)', type: 'textarea', rows: 3, maxLength: 1000 },
        ]} />
        {checks.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {checks.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <span>Week of {formatDate(c.weekStart, { day: 'numeric', month: 'short' })}: {MOOD[c.mood]} · stress {c.stress}/5 · {c.sleepHours} h sleep</span>
                <form action={deleteCheckinForm}><input type="hidden" name="id" value={c.id} /><button className="text-[11px] text-muted underline">Delete</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <p className="mb-2 font-semibold text-heading">Quick stress relief</p>
        <ul className="space-y-2 text-sm">{TIPS.map(([t, d]) => <li key={t}><span className="font-medium">{t}:</span> <span className="text-muted">{d}</span></li>)}</ul>
      </section>

      <section className="card p-4">
        <p className="mb-1 font-semibold text-heading">Talk to the counsellor</p>
        <p className="mb-2 text-xs text-muted">Private booking. Your mentor and parents are not told.</p>
        <QuickForm action={bookCounsellorAction} submit="Request a slot" cols={2} fields={[
          { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: addDays(today, 1) },
          { name: 'time', label: 'Time', type: 'select', required: true, options: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00'].map((t) => ({ value: t, label: t })) },
          { name: 'mode', label: 'How', type: 'select', options: [{ value: 'in_person', label: 'In person' }, { value: 'call', label: 'Phone call' }] },
          { name: 'topic', label: 'Topic (optional)', type: 'text', maxLength: 300 },
        ]} />
        {bookings.length > 0 && <ul className="mt-2 text-sm">{bookings.slice(0, 5).map((b) => <li key={b.id}>{formatDate(b.date)} {b.time} · {b.mode === 'call' ? 'call' : 'in person'} · <span className="font-medium">{b.status}</span></li>)}</ul>}
      </section>

      <section className="card p-4">
        <p className="mb-1 font-semibold text-heading">Ask anonymously</p>
        <p className="mb-2 text-xs text-muted">Your name is not saved with the question. The answer shows here on this phone.</p>
        <QuickForm action={askAnonAction} submit="Send anonymously" cols={1} fields={[{ name: 'text', label: 'Your question', type: 'textarea', required: true, rows: 3, maxLength: 1000 }]} />
        {answers.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {answers.map((a, i) => <li key={i} className="rounded-lg bg-bg p-2"><p className="text-[11px] text-muted">{formatDateTime(a.at)}</p><p>{a.text}</p><p className="mt-1 font-medium">{a.answer ?? 'Waiting for the counsellor’s answer.'}</p></li>)}
          </ul>
        )}
      </section>
      <form action={wellbeingConsentForm} className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>Sharing a summary with parents: <span className="font-semibold">{consent.data.shareWithParent ? 'on' : 'off'}</span></span>
        {!consent.data.shareWithParent && <input type="hidden" name="share" value="on" />}
        <button className="underline">{consent.data.shareWithParent ? 'Stop sharing' : 'Share with parents'}</button>
      </form>
    </div>
  );
}
