import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideServer, type GuideSearch } from '../GuideServer';

export const dynamic = 'force-dynamic';

const parse = (p: string) => {
  if (p === 'print') return 'print' as const;
  const m = /^step-(\d{1,2})$/.exec(p);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 10 ? n : null;
};

export function generateMetadata({ params }: { params: { page: string } }): Metadata {
  const p = parse(params.page);
  return {
    title: p === 'print' ? 'Parent Counselling Guide · Print' : `Parent Counselling Guide · Step ${p}`,
    alternates: { canonical: `/parent-counselling/${params.page}` },
    robots: p === 'print' ? { index: false } : undefined,
  };
}

export default function ParentCounsellingStep({ params, searchParams }: { params: { page: string }; searchParams: GuideSearch }) {
  const p = parse(params.page);
  if (p === null) notFound();
  return p === 'print' ? <GuideServer page={0} searchParams={searchParams} print /> : <GuideServer page={p} searchParams={searchParams} />;
}
