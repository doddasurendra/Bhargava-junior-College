import { redirect } from 'next/navigation';
import { consentAction } from '@/app/app/portal-actions';
import { Crest } from '@/components/ui';
import { college } from '@/content/college';
import { CONSENT_PURPOSES, CONSENT_VERSION, getAppUser, hasConsent } from '@/lib/app/service';

export const metadata = { title: 'Your data', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** DPDP Act 2023: notice and consent at first login for parents, students and applicants (§9A.4). */
export default async function ConsentPage({ searchParams }: { searchParams: { declined?: string } }) {
  const u = await getAppUser();
  if (!u) redirect('/app/login');
  if (await hasConsent(u.phone)) redirect('/app');
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <Crest size={52} />
      <h1 className="mt-4 font-display text-2xl text-heading">How we use your information</h1>
      <p className="mt-2 text-sm text-ink">{college.name} uses the details in this app only for these purposes (Digital Personal Data Protection Act, 2023):</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{CONSENT_PURPOSES.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="mt-3 text-sm text-muted">We never sell your data. You can ask the college office for a copy, a correction, or deletion of data we no longer need to keep, and withdraw consent for WhatsApp messages by replying STOP. Notice version {CONSENT_VERSION}.</p>
      {searchParams.declined && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">The app can’t show admission or academic records without your agreement. Please call the college office if you have questions.</p>}
      <form action={consentAction} className="mt-6 space-y-4">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 accent-maroon" />I have read this and agree to these uses of my and my child’s data.</label>
        <button className="btn-primary w-full py-3">Continue</button>
      </form>
    </main>
  );
}
