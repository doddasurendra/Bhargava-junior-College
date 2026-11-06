import type { Metadata } from 'next';
import { GuideServer, type GuideSearch } from './GuideServer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Parent Counselling Session Guide',
  description: 'The 10-step Bhargava parent counselling guide for Class 10 families, in Telugu, English and Hindi.',
  alternates: { canonical: '/parent-counselling' },
};

export default function ParentCounsellingCover({ searchParams }: { searchParams: GuideSearch }) {
  return <GuideServer page={0} searchParams={searchParams} />;
}
