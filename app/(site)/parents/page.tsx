import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, PageHero, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Parent corner', description: 'The parent app, PTMs, college policies and transport routes at Bhargava Junior College.', alternates: { canonical: '/parents' } };

export default async function ParentsPage() {
  const { parentCorner: pc } = await getContent();
  return (
    <>
      <PageHero eyebrow="Parent corner" title="Stay close to your child’s progress" intro="Daily attendance and hostel alerts, test results, the mentor’s weekly note, fees and receipts, all in the parent app." badge={pc.sample} />
      <Section eyebrow="Parent app" title="What you see in the app">
        <ul className="grid gap-2 sm:grid-cols-2">
          {['Attendance every day, and an alert if your child is absent', 'Hostel check-in and check-out alerts', 'Test results, rank and chapter-wise progress', 'The mentor’s note in the Sunday WhatsApp report', 'Fee dues, online payment and receipts', 'PTM booking and messages to the class teacher', 'Out-pass approvals for hostellers', 'Bus route and live location for day scholars'].map((x) => <li key={x} className="flex gap-3 text-[15px]"><Check />{x}</li>)}
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/login" className="btn-primary">Open the parent app</Link>
          {pc.appLinks.android && <a href={pc.appLinks.android} className="btn-outline">Google Play</a>}
          {pc.appLinks.ios && <a href={pc.appLinks.ios} className="btn-outline">App Store</a>}
        </div>
        <p className="mt-2 text-xs text-muted">Add it to your home screen from the browser menu: it works like an app on any phone.</p>
      </Section>
      <Section eyebrow="PTM" title="Parent–teacher meetings"><p className="max-w-3xl text-[15px]">{pc.ptm}</p></Section>
      {pc.policies.length > 0 && (
        <Section eyebrow="Policies" title="College policies">
          <dl className="grid gap-4 md:grid-cols-2">{pc.policies.map((p) => <div key={p.title} className="card p-5"><dt className="font-semibold text-heading">{p.title}</dt><dd className="mt-1 text-sm">{p.body}</dd></div>)}</dl>
        </Section>
      )}
      <Section id="transport" eyebrow="Transport" title="Bus routes">
        {pc.routes.length === 0 ? <p className="text-sm text-muted">Routes will be published by the transport office. Call the college to ask about your area.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">{pc.routes.map((r) => <li key={r.name} className="card p-4 text-sm"><p className="font-semibold text-heading">{r.name}{r.pickup ? ` · first pickup ${r.pickup}` : ''}</p><p className="mt-1 text-muted">{r.stops.join(' → ')}</p></li>)}</ul>
        )}
      </Section>
    </>
  );
}
