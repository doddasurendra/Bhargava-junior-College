import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Body } from '@/components/kb/ui';
import { PageHero, SampleBadge, Section } from '@/components/ui';
import { getLang } from '@/lib/i18n-server';
import { kbT, pick } from '@/lib/kb/i18n';
import { related } from '@/lib/kb/index';
import { getArticle } from '@/lib/kb/service';

export const dynamic = 'force-dynamic';
const PUBLIC = { kind: 'public' as const };

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const got = await getArticle(PUBLIC, params.id, { logView: false });
  if (!got || !got.shown.channels.includes('website')) return { title: 'Knowledge base' };
  return { title: got.shown.title.en, description: got.shown.body.en.replace(/[#_*]/g, '').slice(0, 155), alternates: { canonical: `/knowledge-base/a/${params.id}` } };
}

/** A public KB article (published, public access and sensitivity, website channel). */
export default async function PublicArticlePage({ params }: { params: { id: string } }) {
  const lang = getLang();
  const t = kbT(lang);
  const got = await getArticle(PUBLIC, params.id);
  if (!got || !got.shown.channels.includes('website')) notFound();
  const a = got.shown;
  const rel = await related(PUBLIC, params.id, a.title.en, 4);
  return (
    <>
      <PageHero eyebrow={t.knowledge} title={pick(a.title, lang)} intro="" badge={a.sample} />
      <Section>
        <div className="max-w-3xl">
          {a.sample && <p className="mb-4"><SampleBadge show /></p>}
          <Body text={pick(a.body, lang) || a.body.en} />
          {rel.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold text-heading">{t.related}</h2>
              <ul className="mt-2 space-y-1 text-sm">{rel.map((r) => <li key={r.id}><Link href={r.href} className="underline">{r.title}</Link></li>)}</ul>
            </div>
          )}
          <Link href="/knowledge-base" className="mt-8 inline-block text-sm underline">← {t.knowledge}</Link>
        </div>
      </Section>
    </>
  );
}
