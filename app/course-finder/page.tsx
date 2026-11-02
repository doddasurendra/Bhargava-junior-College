import type { Metadata } from 'next';
import { CourseFinder } from '@/components/ClientWidgets';
import { PageHero, Section } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Course finder: which program is right for you?',
  description: 'Answer two questions to find the right program: IIT-JEE or NEET integrated with Intermediate, or a Long Term repeater program.',
  alternates: { canonical: '/course-finder' },
};

export default function CourseFinderPage() {
  return (
    <>
      <PageHero eyebrow="Course finder" title="Find the right program in 30 seconds" intro="Two questions, and we’ll point you to the program that fits." />
      <Section>
        <div className="max-w-4xl">
          <CourseFinder />
        </div>
      </Section>
    </>
  );
}
