import type { Metadata } from 'next';
import Link from 'next/link';
import { OpenChatButton } from '@/components/OpenChatButton';
import { PageHero, SampleBadge, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = {
  title: 'Knowledge base',
  description: 'Answers to common questions about admissions, fees, hostel, transport and policies at Bhargava Junior College.',
  alternates: { canonical: '/knowledge-base' },
};

const CATEGORY: Record<string, string> = { admissions: 'Admissions', fees: 'Fees', academics: 'Academics', hostel: 'Hostel', transport: 'Transport', policies: 'Policies', other: 'General' };

/** Public knowledge base: only published, public articles (staff-only articles never appear here). */
export default async function KnowledgeBasePage({ searchParams }: { searchParams: { q?: string } }) {
  const { knowledgeBase, faqs } = await getContent();
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 100);
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const match = (s: string) => !words.length || words.every((w) => s.toLowerCase().includes(w));
  const articles = knowledgeBase.items.filter((a) => a.published && a.audience === 'public' && match(`${a.title} ${a.body}`));
  const faqItems = faqs.items.filter((f) => match(`${f.q} ${f.a}`));
  const groups = Object.keys(CATEGORY).map((k) => ({ key: k, label: CATEGORY[k], items: articles.filter((a) => a.category === k) })).filter((g) => g.items.length);

  return (
    <>
      <PageHero eyebrow="Help" title="Knowledge base" intro="Answers to the questions families ask most. Can’t find yours? Ask the AI assistant or talk to a counsellor." badge={knowledgeBase.sample} />
      <Section>
        <form method="get" role="search" className="mb-8 flex max-w-2xl gap-2">
          <label htmlFor="kb-q" className="sr-only">Search the knowledge base</label>
          <input id="kb-q" name="q" defaultValue={searchParams.q ?? ''} maxLength={100} placeholder="Search: fees, hostel, documents…" className="input min-w-0 flex-1" />
          <button className="btn-primary">Search</button>
          {q && <Link href="/knowledge-base" className="btn-outline">Clear</Link>}
        </form>

        {groups.length === 0 && faqItems.length === 0 && (
          <p className="card p-5 text-sm text-muted">Nothing matches “{searchParams.q}”. <Link href="/knowledge-base" className="underline">See everything</Link>, or ask the AI assistant below.</p>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="font-display text-2xl text-heading">{g.label}</h2>
              <ul className="mt-3 space-y-3">
                {g.items.map((a) => (
                  <li key={a.title} className="card p-5">
                    <h3 className="font-semibold text-heading">{a.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink">{a.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {faqItems.length > 0 && (
            <div>
              <h2 className="font-display text-2xl text-heading">Frequently asked <SampleBadge show={faqs.sample} /></h2>
              <ul className="mt-3 space-y-3">
                {faqItems.map((f) => (
                  <li key={f.q} className="card p-5">
                    <h3 className="font-semibold text-heading">{f.q}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink">{f.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>
      <Section className="bg-surface">
        <div className="flex flex-wrap items-center gap-3">
          <p className="mr-2 text-sm text-muted">Still have a question?</p>
          <OpenChatButton className="btn-primary">💬 Ask the chat assistant</OpenChatButton>
          <Link href="/voice-assistant" className="btn-outline">🎙️ Ask by voice</Link>
          <Link href="/contact" className="btn-outline">Contact the college</Link>
        </div>
      </Section>
    </>
  );
}
