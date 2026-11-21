import type { Metadata } from 'next';
import Link from 'next/link';
import { OpenChatButton } from '@/components/OpenChatButton';
import { AskBox, Marked } from '@/components/kb/client';
import { PageHero, SampleBadge, Section } from '@/components/ui';
import { getContent } from '@/lib/cms';
import { getLang } from '@/lib/i18n-server';
import { ASSISTANT_INFO, assistantsFor } from '@/lib/kb/ai';
import { CENTRES, PUBLIC_GROUPS } from '@/lib/kb/centres';
import { kbT, pick } from '@/lib/kb/i18n';
import { search } from '@/lib/kb/index';
import { listArticles } from '@/lib/kb/service';
import { headers } from 'next/headers';
import { allow, LIMITS } from '@/lib/kb/rate';

export const metadata: Metadata = {
  title: 'Knowledge base',
  description: 'Answers to common questions about admissions, courses, campus life, exams, careers and events at Bhargava Junior College.',
  alternates: { canonical: '/knowledge-base' },
};
export const dynamic = 'force-dynamic';

const CATEGORY: Record<string, string> = { parents: 'Parents', campus: 'Campuses & campus life', academics: 'Academics', admissions: 'Admissions', fees: 'Fees', hostel: 'Hostel', transport: 'Transport', policies: 'Policies', other: 'General' };
const HERO = {
  en: { title: 'Knowledge base', intro: 'Answers to the questions families ask most. Can’t find yours? Ask the AI assistant or talk to a counsellor.', faq: 'Frequently asked', still: 'Still have a question?', chat: '💬 Ask the chat assistant', voice: '🎙️ Ask by voice', contact: 'Contact the college' },
  te: { title: 'సమాచార కేంద్రం', intro: 'కుటుంబాలు ఎక్కువగా అడిగే ప్రశ్నలకు సమాధానాలు. మీ ప్రశ్న దొరకలేదా? AI సహాయకుడిని అడగండి లేదా కౌన్సెలర్‌తో మాట్లాడండి.', faq: 'తరచుగా అడిగే ప్రశ్నలు', still: 'ఇంకా ప్రశ్న ఉందా?', chat: '💬 చాట్ సహాయకుడిని అడగండి', voice: '🎙️ వాయిస్‌తో అడగండి', contact: 'కాలేజీని సంప్రదించండి' },
  hi: { title: 'ज्ञान केंद्र', intro: 'परिवारों के सबसे आम प्रश्नों के उत्तर। अपना प्रश्न नहीं मिला? AI सहायक से पूछें या काउंसलर से बात करें।', faq: 'अक्सर पूछे जाने वाले प्रश्न', still: 'अभी भी कोई प्रश्न है?', chat: '💬 चैट सहायक से पूछें', voice: '🎙️ आवाज़ से पूछें', contact: 'कॉलेज से संपर्क करें' },
};

/** Public knowledge base: only published, public, public-sensitivity content (staff-only items never appear here). */
export default async function KnowledgeBasePage({ searchParams }: { searchParams: { q?: string } }) {
  const lang = getLang();
  const t = kbT(lang);
  const h = HERO[lang];
  const { knowledgeBase, faqs } = await getContent();
  const q = (searchParams.q ?? '').trim().slice(0, 100);
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limited = q && !allow(`search:ip:${ip}`, LIMITS.public.search);
  const v = { kind: 'public' as const };
  const [hits, kb] = await Promise.all([q && !limited ? search(v, q, {}, { perSource: true, k: 15 }) : Promise.resolve([]), listArticles(v, { status: 'published' })]);
  const pub = kb.filter((x) => x.a.channels.includes('website'));
  const cmsArticles = knowledgeBase.items.filter((a) => a.published && a.audience === 'public');
  const cmsGroups = Object.keys(CATEGORY).map((k) => ({ key: k, label: CATEGORY[k], items: cmsArticles.filter((a) => a.category === k) })).filter((g) => g.items.length);
  const groups = PUBLIC_GROUPS.map((g) => ({ ...g, items: pub.filter((x) => CENTRES.find((c) => c.id === x.a.centre)?.publicGroup === g.id) })).filter((g) => g.items.length);
  const assistants = assistantsFor(v);

  return (
    <>
      <PageHero eyebrow="Help" title={h.title} intro={h.intro} badge={knowledgeBase.sample} />
      <Section>
        <form method="get" role="search" className="mb-6 flex max-w-2xl gap-2">
          <label htmlFor="kb-q" className="sr-only">{t.search}</label>
          <input id="kb-q" name="q" defaultValue={searchParams.q ?? ''} maxLength={100} placeholder={t.searchPlaceholder} className="input min-w-0 flex-1" />
          <button className="btn-primary">{t.search}</button>
          {q && <Link href="/knowledge-base" className="btn-outline">{t.all}</Link>}
        </form>
        {limited && <p className="card mb-6 p-4 text-sm">Too many searches in a minute. Please wait a moment.</p>}
        {q && !limited && (
          <div className="mb-10">
            {hits.length === 0 ? (
              <p className="card p-5 text-sm text-muted">{t.noResults} <Link href="/knowledge-base" className="underline">{t.all}</Link></p>
            ) : (
              <ul className="space-y-3">
                {hits.map((x) => (
                  <li key={x.id} className="card p-5">
                    <Link href={x.href} className="font-semibold text-heading underline-offset-2 hover:underline">{x.title}{x.page ? ` · ${t.page} ${x.page}` : ''}</Link>
                    <p className="mt-2 text-sm leading-6 text-ink"><Marked text={x.snippet} /></p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mb-10 max-w-3xl rounded-2xl border border-line bg-surface p-5">
          <p className="mb-3 font-semibold text-heading">🤖 {t.ask}</p>
          <AskBox assistants={assistants.map((a) => ({ id: a, name: ASSISTANT_INFO[a].name[lang] }))} initial="public" suggestions={ASSISTANT_INFO.public.suggestions[lang]} labels={{ placeholder: t.askPlaceholder, ask: t.askButton, sources: t.sources, page: t.page, basedOn: t.basedOn, helpful: t.helpful, notHelpful: t.notHelpful, suggested: t.suggested }} compact />
        </div>

        {groups.length > 0 && (
          <div className="mb-10 grid gap-8 lg:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id}>
                <h2 className="font-display text-2xl text-heading">{g.name[lang]}</h2>
                <ul className="mt-3 space-y-2">
                  {g.items.map(({ id, a }) => (
                    <li key={id}><Link href={`/knowledge-base/a/${id}`} className="card block p-4 hover:border-gold"><span className="font-semibold text-heading">{pick(a.title, lang)}</span>{a.sample && <span className="ml-2 align-middle"><SampleBadge show /></span>}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {cmsGroups.map((g) => (
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
          {faqs.items.length > 0 && (
            <div>
              <h2 className="font-display text-2xl text-heading">{h.faq} <SampleBadge show={faqs.sample} /></h2>
              <ul className="mt-3 space-y-3">
                {faqs.items.map((f) => (
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
          <p className="mr-2 text-sm text-muted">{h.still}</p>
          <OpenChatButton className="btn-primary">{h.chat}</OpenChatButton>
          <Link href="/voice-assistant" className="btn-outline">{h.voice}</Link>
          <Link href="/contact" className="btn-outline">{h.contact}</Link>
        </div>
      </Section>
    </>
  );
}
