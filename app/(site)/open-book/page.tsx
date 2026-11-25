import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, PageHero, Section } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Open Book: AI digital library and exam preparation',
  description: 'Bhargava Junior College students read official textbooks, solve previous-year papers, generate concept-wise practice questions with AI, take timed mock tests and follow a personal learning path, in English, Telugu and Hindi.',
  alternates: { canonical: '/open-book' },
};

const FEATURES: [string, string][] = [
  ['Digital library', 'Official NCERT and board books first, BJC study material, and reference books with the publisher’s legitimate preview or purchase link. Bookmarks, highlights, notes and “continue reading”.'],
  ['Smart PDF reader', 'Select any passage to explain it, simplify it, translate it into Telugu or Hindi, make flashcards or practise questions on it. Answers cite the book and page.'],
  ['Previous-year papers', 'JEE Main, JEE Advanced, NEET, EAPCET and TS Inter papers, organised by exam, year and subject, with answer keys where available and questions extracted for practice.'],
  ['AI question generator', 'Questions on exactly the concept you choose, in your exam’s real pattern and difficulty, with full step-by-step solutions. A uniqueness check makes sure you don’t get the same question twice.'],
  ['AI mock tests', 'Timed papers with question navigation, mark-for-review, save-and-resume and a detailed topic-wise report.'],
  ['Pattern analyzer', 'Chapter-wise weightage across years, rising and falling topics and high-yield chapters, from the papers in the library (it never claims to predict questions).'],
  ['Learning path', 'A diagnostic, a daily plan sized to your time, mastery for every concept and spaced revision, with the reason for every suggestion.'],
  ['Flashcards, daily challenge and community', 'Spaced-repetition flashcards, a daily batch challenge with effort-based leaderboards, and a moderated college-only Q&A space.'],
];

export default function OpenBookPage() {
  return (
    <>
      <PageHero eyebrow="For BJC students" title="Open Book" intro="An AI-powered digital library and exam-preparation platform inside the Bhargava Student app, for Intermediate MPC and BiPC, JEE and NEET." />
      <Section eyebrow="What students get" title="Read, practise, test and revise in one place">
        <ul className="grid gap-4 sm:grid-cols-2">{FEATURES.map(([t, b]) => <li key={t} className="flex gap-3"><Check /><span><b className="block text-heading">{t}</b><span className="text-[15px] text-muted">{b}</span></span></li>)}</ul>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/app/login" className="btn-primary">Students: sign in to Open Book</Link><Link href="/crm/login" className="btn-outline">Teachers: Open Book in the staff CRM</Link></div>
      </Section>
      <Section eyebrow="Safe and fair" title="How we look after students" className="bg-surface">
        <ul className="grid gap-2 sm:grid-cols-2 text-[15px]">
          {['Only signed-in BJC students and staff can use it', 'Notes, bookmarks, answers and AI conversations are private to each student; parents see progress only', 'Copyrighted books are never copied: we link to official and publisher pages', 'Every student upload is checked by a teacher before it is shared', 'The community blocks phone numbers, emails and links, and is moderated by teachers', 'AI answers are labelled as AI; daily limits keep usage healthy'].map((x) => <li key={x} className="flex gap-3"><Check />{x}</li>)}
        </ul>
        <p className="mt-4 text-xs text-muted">Categories for other entrance and government examinations (BITSAT, VITEEE, IIT-JAM, GATE, CAT, UPSC, SSC, Banking, RRB and more) are shown as “coming soon” until their content is added.</p>
      </Section>
    </>
  );
}
