import type { Metadata } from 'next';
import Link from 'next/link';
import { FacultySection } from '@/components/brochure';
import { PageHero, Section } from '@/components/ui';
import { brochureText, FACULTY } from '@/content/brochure';
import { college } from '@/content/college';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: 'Faculty: The Power Houses — MPC & BiPC',
  description: `Meet the ${FACULTY.length} professors of Bhargava Junior College: Mathematics, Physics, Chemistry, Botany & Zoology, each M.Sc. with 16 to 24+ years of experience.`,
  alternates: { canonical: '/faculty' },
};

export default function FacultyPage() {
  const t = brochureText(getLang());
  return (
    <>
      <PageHero eyebrow={t.faculty.eyebrow} title={t.faculty.title} intro={`${FACULTY.length} · ${t.faculty.subjects.join(' · ')}`} />
      <FacultySection t={t} heading={false} />
      <Section eyebrow="Leadership" title={`${college.chairman.name} · ${college.leader.name}`} className="bg-surface">
        <p className="text-sm text-muted">{t.leadership.role}: {college.chairman.name}. {college.leader.name}, {college.leader.credentials}.</p>
        <p className="mt-3"><Link href="/about#leadership" className="font-semibold text-maroon underline dark:text-gold">{t.leadership.subtitle} →</Link></p>
      </Section>
    </>
  );
}
