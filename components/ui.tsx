import type { ReactNode } from 'react';
import { college } from '@/content/college';

export function Crest({ size = 44, className = '' }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={college.logoSrc} alt={`${college.name} crest`} width={size} height={size} className={className} />;
}

/** Shown on any block still using sample data (brief §3). Disappears once the block's `sample` flag is false. */
export function SampleBadge({ show = true, className = '' }: { show?: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span
      title="Sample data — replace from the CMS before launch"
      className={`inline-flex items-center gap-1 rounded-full border border-dashed border-gold bg-gold-100 px-2 py-0.5 align-middle font-sans text-[10px] font-semibold uppercase tracking-wider text-navy ${className}`}
    >
      Sample data
    </span>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  badge,
  children,
  className = '',
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  badge?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`py-14 sm:py-20 ${className}`}>
      <div className="container-x">
        {(eyebrow || title) && (
          <header className="mb-8 max-w-3xl sm:mb-10">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2 className="h2 mt-2">
                {title} {badge && <SampleBadge />}
              </h2>
            )}
            {intro && <p className="lead-text mt-3">{intro}</p>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, intro, badge, children }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; badge?: boolean; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,162,74,0.20),transparent_55%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-10 h-72 w-72 opacity-[0.07] sm:h-96 sm:w-96">
        <Crest size={384} className="h-full w-full" />
      </div>
      <div className="container-x relative py-12 sm:py-16">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">{eyebrow}</p>}
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
          {title} {badge && <SampleBadge />}
        </h1>
        {intro && <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">{intro}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-heading [&::-webkit-details-marker]:hidden">
            {f.q}
            <span aria-hidden className="text-xl leading-none text-gold transition group-open:rotate-45">+</span>
          </summary>
          <p className="px-5 pb-5 text-[15px] leading-7 text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Check({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={`h-5 w-5 shrink-0 text-gold ${className}`} fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
    </svg>
  );
}

export function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
