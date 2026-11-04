import type { Metadata } from 'next';
import { PageHero, Section } from '@/components/ui';
import { college } from '@/content/college';
import { getContent } from '@/lib/cms';

export const metadata: Metadata = { title: 'Faculty & leadership', description: 'Meet the faculty of Bhargava Junior College: subject, experience and qualifications.', alternates: { canonical: '/faculty' } };

export default async function FacultyPage() {
  const { faculty } = await getContent();
  return (
    <>
      <PageHero eyebrow="Faculty" title="Teachers who have done this before" intro={`Average experience of ${college.facultyAvgExperience}. One mentor for every ${college.mentorRatio} students.`} badge={faculty.sample} />
      <Section eyebrow="Leadership" title={college.leader.name}>
        <p className="text-sm text-muted">{college.leader.credentials}</p>
        {faculty.leadershipMessage && <blockquote className="mt-4 max-w-3xl border-l-4 border-gold pl-4 text-[15px] italic text-ink">{faculty.leadershipMessage}</blockquote>}
      </Section>
      <Section eyebrow="Faculty" title="Subject teachers">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {faculty.items.map((f) => (
            <li key={f.name} className="card p-5">
              {f.photoUrl ? <img src={f.photoUrl} alt={f.name} className="mb-3 aspect-square w-full rounded-xl object-cover" loading="lazy" /> : <div aria-hidden className="mb-3 grid aspect-square w-full place-items-center rounded-xl bg-bg font-display text-4xl text-navy/40 dark:text-white/30">{f.name.split(' ').pop()?.[0]}</div>}
              <p className="font-display text-xl text-heading">{f.name}</p>
              <p className="text-sm text-muted">{f.subject} · {f.years} years</p>
              {f.qualification && <p className="mt-1 text-xs">{f.qualification}</p>}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
