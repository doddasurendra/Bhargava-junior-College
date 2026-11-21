import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Body, SamplePill } from '@/components/kb/ui';
import { getLang } from '@/lib/i18n-server';
import { kbT, pick } from '@/lib/kb/i18n';
import { related } from '@/lib/kb/index';
import { getArticle } from '@/lib/kb/service';
import { currentViewer } from '@/lib/kb/viewer';

export const metadata = { title: 'Article' };

export default async function AppArticlePage({ params }: { params: { id: string } }) {
  const lang = getLang();
  const t = kbT(lang);
  const v = await currentViewer('app');
  if (v.kind !== 'student' && v.kind !== 'parent') notFound();
  const got = await getArticle(v, params.id);
  if (!got) notFound();
  const a = got.shown;
  const rel = await related(v, params.id, a.title.en, 4);
  return (
    <article className="space-y-4">
      <Link href="/app/knowledge" className="text-xs underline">← {t.knowledge}</Link>
      <h1 className="font-display text-2xl text-heading">{pick(a.title, lang)} <SamplePill show={a.sample} label={t.sample} /></h1>
      <div className="card p-4"><Body text={pick(a.body, lang) || a.body.en} /></div>
      {rel.length > 0 && (
        <section>
          <p className="mb-1 text-sm font-semibold text-heading">{t.related}</p>
          <ul className="space-y-1 text-sm">{rel.map((r) => <li key={r.id}><Link href={r.href} className="underline">{r.title}</Link></li>)}</ul>
        </section>
      )}
    </article>
  );
}
