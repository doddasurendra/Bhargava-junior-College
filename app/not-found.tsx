import Link from 'next/link';
import { Crest } from '@/components/ui';

export default function NotFound() {
  return (
    <section className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <Crest size={88} className="mx-auto opacity-80" />
        <h1 className="mt-6 font-display text-4xl text-heading">This page isn’t here</h1>
        <p className="lead-text mt-3">It may have moved, or it’s coming soon.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">Go to home</Link>
          <Link href="/contact" className="btn-outline">Contact admissions</Link>
        </div>
      </div>
    </section>
  );
}
