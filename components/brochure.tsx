import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ADDRESSES, BROCHURE_PDF, CAMPUSES, FACULTY, FACULTY_GROUPS, MAP_PINS, media, WEBSITE, type BrochureText, type FacultyMember, type Photo } from '@/content/brochure';
import { college } from '@/content/college';
import { Check } from './ui';

/** Official brochure sections, shared by the pages they appear on. All copy comes from content/brochure. */

export function BPhoto({ p, className = '', sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw', priority = false, rounded = 'rounded-2xl' }: { p: Photo; className?: string; sizes?: string; priority?: boolean; rounded?: string }) {
  return <Image src={p.src} width={p.w} height={p.h} alt={p.alt} sizes={sizes} priority={priority} loading={priority ? undefined : 'lazy'} className={`h-auto w-full object-cover ${rounded} ${className}`} />;
}

export function PhotoNote({ t, className = '' }: { t: BrochureText; className?: string }) {
  return <p className={`mt-3 text-xs italic text-muted ${className}`}>{t.photoNote}</p>;
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${light ? 'text-gold-300' : 'text-maroon dark:text-gold'}`}>{children}</p>;
}

function Block({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-24 py-14 sm:py-20 ${className}`}>
      <div className="container-x">{children}</div>
    </section>
  );
}

function Head({ eyebrow, title, intro, center = false }: { eyebrow?: ReactNode; title: ReactNode; intro?: ReactNode; center?: boolean }) {
  return (
    <header className={`mb-8 max-w-3xl sm:mb-10 ${center ? 'mx-auto text-center' : ''}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="h2 mt-2">{title}</h2>
      {intro && <p className="lead-text mt-3">{intro}</p>}
    </header>
  );
}

// ---------------------------------------------------------------- page 1: cover line + motto

export function CollegeCodeLine({ t, light = false }: { t: BrochureText; light?: boolean }) {
  return (
    <p className={`text-xs leading-5 ${light ? 'text-white/70' : 'text-muted'}`}>
      {t.cover.society} · <strong className={light ? 'text-gold-300' : 'text-heading'}>{t.cover.recognised}</strong>
    </p>
  );
}

export function MottoBanner({ text }: { text: string }) {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-maroon to-[#5a1520] px-6 py-8 text-center text-white sm:py-10">
      <p className="font-display text-2xl italic sm:text-3xl">“{text}”</p>
    </div>
  );
}

// ---------------------------------------------------------------- page 2: leadership

export function LeadershipSection({ t }: { t: BrochureText }) {
  const L = t.leadership;
  return (
    <Block id="leadership">
      <Head eyebrow={L.eyebrow} title={L.title} intro={L.subtitle} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_1fr]">
        <figure className="mx-auto w-full max-w-[300px]">
          <BPhoto p={media.chairman} sizes="300px" className="border border-line" />
          <figcaption className="mt-3 text-center">
            <span className="block font-display text-xl text-heading">{L.name}</span>
            <span className="text-sm text-muted">{L.role}</span>
          </figcaption>
        </figure>
        <div className="space-y-4 text-[15px] leading-7 text-ink">
          <p className="font-semibold uppercase tracking-wide text-heading">{L.salutation}</p>
          {L.message.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>
      <div id="vision" className="mt-10 grid scroll-mt-24 gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="card p-6">
          <Eyebrow>{L.visionLabel}</Eyebrow>
          <p className="mt-2 font-display text-xl leading-8 text-heading">{L.vision}</p>
        </div>
        <div className="card space-y-3 p-6">
          <Eyebrow>{L.missionLabel}</Eyebrow>
          {L.mission.map((p) => <p key={p} className="leading-7 text-ink">{p}</p>)}
        </div>
      </div>
      <div className="mt-6 space-y-3 text-[15px] leading-7 text-ink">
        {L.closing.map((p) => <p key={p}>{p}</p>)}
      </div>
      <div className="mt-8"><MottoBanner text={L.motto} /></div>
    </Block>
  );
}

// ---------------------------------------------------------------- page 3: what makes Bhargava different

export function DifferentSection({ t, className = '' }: { t: BrochureText; className?: string }) {
  const D = t.different;
  return (
    <Block id="different" className={className}>
      <Head eyebrow={D.eyebrow} title={D.title} intro={D.intro} />
      <ol className="grid gap-5 md:grid-cols-2">
        {D.items.map((it, i) => (
          <li key={it.title} className="card overflow-hidden">
            <BPhoto p={media.different[i]} rounded="rounded-none" className="aspect-[3/2]" sizes="(min-width: 768px) 50vw, 100vw" />
            <div className="flex gap-4 p-5">
              <span className="font-display text-3xl leading-none text-gold">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="font-sans text-lg font-semibold text-heading">{it.title}</h3>
                <p className="mt-1 text-[15px] leading-7 text-muted">{it.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <BPhoto p={media.different[8]} className="aspect-[3/2]" sizes="(min-width: 1024px) 40vw, 100vw" />
        <div>
          <h3 className="font-display text-2xl text-heading">{D.beyondTitle}</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {D.beyond.map((b) => (
              <li key={b.title} className="card p-4">
                <p className="font-semibold text-heading">{b.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-10 rounded-3xl bg-navy px-6 py-8 text-center text-white">
        <p className="font-display text-2xl text-gold-300">{D.differenceTitle}</p>
        <p className="mt-2 text-lg">{D.difference}</p>
      </div>
      <PhotoNote t={t} />
    </Block>
  );
}

/** Home: the eight titles as compact cards linking to /why-bhargava. `first`: the opening screen of the home page. */
export function DifferentCompact({ t, first = false }: { t: BrochureText; first?: boolean }) {
  const D = t.different;
  return (
    <Block id="why-bhargava" className={first ? '!py-8 sm:!py-10 bg-surface' : ''}>
      {first ? (
        <header className="mb-6 max-w-3xl">
          <Eyebrow>{D.eyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-3xl leading-tight text-heading sm:text-4xl">{D.title}</h2>
          <p className="mt-2 text-[15px] leading-6 text-muted">{D.intro}</p>
        </header>
      ) : (
        <Head eyebrow={D.eyebrow} title={D.title} intro={D.intro} />
      )}
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {D.items.map((it, i) => (
          <li key={it.title}>
            <Link href="/why-bhargava#different" className="card flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-gold">
              <span className="font-display text-2xl leading-none text-gold">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-sm font-semibold leading-5 text-heading">{it.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/why-bhargava" className={first ? 'btn-primary' : 'font-semibold text-maroon underline dark:text-gold'}>{D.seeAll} →</Link>
        {first && <Link href="#callback" className="btn-outline">{t.cover.eyebrow} · Get a callback</Link>}
        {first && <p className="w-full text-sm font-semibold text-heading sm:w-auto">{D.differenceTitle}: <span className="font-normal text-muted">{D.difference}</span></p>}
      </div>
    </Block>
  );
}

// ---------------------------------------------------------------- page 4 (top): what parents care about

export function ParentsCareSection({ t, className = '' }: { t: BrochureText; className?: string }) {
  const P = t.parents;
  return (
    <Block id="care" className={className}>
      <Head eyebrow={P.eyebrow} title={P.title} intro={<em>{P.tagline}</em>} />
      <ol className="grid gap-5 lg:grid-cols-2">
        {P.items.map((it, i) => (
          <li key={it.q} className="card grid gap-4 p-5 sm:grid-cols-[1fr_160px]">
            <div>
              <p className="font-display text-2xl leading-none text-gold">{i + 1}</p>
              <h3 className="mt-2 font-sans text-base font-semibold text-heading">{it.q}</h3>
              <p className="mt-2 text-[15px] leading-7 text-muted">{it.a}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
              {media.parents[i].map((p) => <BPhoto key={p.src} p={p} rounded="rounded-xl" className="aspect-[4/3]" sizes="160px" />)}
            </div>
          </li>
        ))}
      </ol>
      <PhotoNote t={t} />
    </Block>
  );
}

// ---------------------------------------------------------------- page 4 (bottom): the Power Houses

function FacultyCard({ f, t, small = false }: { f: FacultyMember; t: BrochureText; small?: boolean }) {
  return (
    <li className="card flex flex-col items-center p-4 text-center">
      <Image src={f.photo.src} width={f.photo.w} height={f.photo.h} alt={f.photo.alt} sizes="140px" loading="lazy" className={`${small ? 'h-24 w-24' : 'h-28 w-28 sm:h-[140px] sm:w-[140px]'} rounded-full border-4 border-gold/60 object-cover`} />
      <p className="mt-3 font-display text-lg leading-6 text-heading">{f.name}</p>
      <p className="text-xs text-muted">{f.qualification}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-maroon dark:text-gold">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-gold" fill="currentColor" aria-hidden><path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z" /></svg>
        {f.years}+ {t.faculty.years}
      </p>
      <p className="mt-2 rounded-full bg-navy-950 px-3 py-1 text-[11px] font-semibold text-white dark:bg-white/10">{t.faculty.expertise[f.expertise] ?? f.expertise}</p>
    </li>
  );
}

export function FacultySection({ t, heading = true }: { t: BrochureText; heading?: boolean }) {
  return (
    <Block id="power-houses">
      {heading && <Head eyebrow={t.faculty.eyebrow} title={t.faculty.title} />}
      <div className="space-y-10">
        {FACULTY_GROUPS.map((g, gi) => (
          <div key={g.key}>
            <h3 className="flex items-center gap-3 rounded-2xl px-4 py-3 font-display text-xl text-white" style={{ background: g.color }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={g.icon} /></svg>
              {t.faculty.groups[gi]}
            </h3>
            <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {FACULTY.filter((f) => f.group === g.key).map((f) => <FacultyCard key={f.name} f={f} t={t} />)}
            </ul>
          </div>
        ))}
      </div>
      <PhotoNote t={t} />
    </Block>
  );
}

/** Home preview: one professor per group, and a link to all 16. */
export function FacultyPreview({ t }: { t: BrochureText }) {
  const four = FACULTY_GROUPS.map((g) => FACULTY.find((f) => f.group === g.key)!);
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">{four.map((f) => <FacultyCard key={f.name} f={f} t={t} small />)}</ul>
      <p className="mt-6"><Link href="/faculty" className="btn-outline">{t.faculty.meetAll} →</Link></p>
    </>
  );
}

/** Program pages: the professors who teach that program's subjects. */
export function FacultyForSubjects({ t, groups }: { t: BrochureText; groups: string[] }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{FACULTY.filter((f) => groups.includes(f.group)).map((f) => <FacultyCard key={f.name} f={f} t={t} small />)}</ul>;
}

// ---------------------------------------------------------------- page 5: courses offered + EVOLVE

export function CourseBlock({ t, which }: { t: BrochureText; which: 'jee' | 'neet' }) {
  const c = t.courses[which];
  return (
    <div className="card overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[1fr_1.2fr]">
        <BPhoto p={media.courses[which]} rounded="rounded-none" className="h-full min-h-[220px]" sizes="(min-width: 768px) 40vw, 100vw" />
        <div className="p-6">
          <Eyebrow>{c.label} · {c.exams}</Eyebrow>
          <h3 className="mt-2 font-display text-2xl text-heading">{c.kind}</h3>
          <p className="mt-2 text-[15px] leading-7 text-muted">{c.body}</p>
        </div>
      </div>
      <div className="border-t border-line p-6">
        <p className="label">{t.courses.highlightsLabel}</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {c.highlights.map((h) => (
            <li key={h.t} className="flex gap-3">
              <Check className="mt-0.5" />
              <span><strong className="text-heading">{h.t}:</strong> <span className="text-muted">{h.b}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CoursesSection({ t, className = '' }: { t: BrochureText; className?: string }) {
  return (
    <Block id="courses" className={className}>
      <Head eyebrow={t.courses.eyebrow} title={t.courses.eyebrow} intro={t.courses.intro} />
      <div className="space-y-6">
        <CourseBlock t={t} which="jee" />
        <CourseBlock t={t} which="neet" />
      </div>
      <PhotoNote t={t} />
    </Block>
  );
}

const EVOLVE_COLORS = ['#1f4e9c', '#1d7a4c', '#d9822b', '#b8323a', '#6b3fa0', '#b8902f'];

export function EvolveSection({ t, className = '' }: { t: BrochureText; className?: string }) {
  const E = t.evolve;
  return (
    <Block id="evolve" className={className}>
      <Head eyebrow={E.sub} title={E.title} intro={E.intro} />
      <ol className="grid gap-3 lg:grid-cols-6 lg:gap-0">
        {E.steps.map((s, i) => (
          <li key={s.t} className="relative flex gap-4 rounded-2xl p-4 text-white lg:block lg:rounded-none lg:py-6 lg:pl-8 lg:pr-6 lg:[clip-path:polygon(0_0,88%_0,100%_50%,88%_100%,0_100%,12%_50%)] lg:first:[clip-path:polygon(0_0,88%_0,100%_50%,88%_100%,0_100%)] lg:first:pl-5" style={{ background: EVOLVE_COLORS[i] }}>
            <span className="font-display text-4xl leading-none">{'EVOLVE'[i]}</span>
            <span className="lg:mt-3 lg:block">
              <span className="block font-semibold leading-5">{s.t}</span>
              <span className="mt-1 block text-sm leading-5 text-white/85">{s.b}</span>
            </span>
          </li>
        ))}
      </ol>
    </Block>
  );
}

// ---------------------------------------------------------------- page 6: campus life

export function CampusLifeBlocks({ t, only }: { t: BrochureText; only?: number[] }) {
  const blocks = t.campusLife.blocks.map((b, i) => ({ ...b, i })).filter((b) => !only || only.includes(b.i));
  return (
    <div className="space-y-12">
      {blocks.map((b, k) => (
        <article key={b.title} className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div className={k % 2 ? 'lg:order-2' : ''}>
            <Eyebrow>{b.tagline}</Eyebrow>
            <h3 className="mt-2 font-display text-3xl text-heading">{b.title}</h3>
            <p className="mt-3 text-[15px] leading-7 text-muted">{b.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {media.campusLife[b.i].map((p, j) => (
              <figure key={p.src}>
                <BPhoto p={p} className="aspect-[4/3]" sizes="(min-width: 1024px) 25vw, 50vw" />
                <figcaption className="mt-1.5 text-sm text-muted">{b.captions[j]}</figcaption>
              </figure>
            ))}
          </div>
        </article>
      ))}
      <PhotoNote t={t} />
    </div>
  );
}

export function CampusLifeSection({ t, className = '' }: { t: BrochureText; className?: string }) {
  const C = t.campusLife;
  return (
    <Block id="campus-life" className={className}>
      <Head eyebrow={C.motto} title={C.title} intro={<em>{C.intro}</em>} />
      <CampusLifeBlocks t={t} />
      <ul className="mt-12 flex flex-wrap justify-center gap-2">
        {C.values.map((v) => <li key={v} className="chip px-4 py-1.5 text-sm">{v}</li>)}
      </ul>
      <p className="mt-6 text-center font-display text-2xl text-heading">{C.closing}</p>
    </Block>
  );
}

// ---------------------------------------------------------------- page 7: our campuses

function Pin({ className = 'h-5 w-5' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>;
}

export function CampusesSection({ t, className = '' }: { t: BrochureText; className?: string }) {
  const C = t.campuses;
  return (
    <Block id="campuses" className={className}>
      <Head eyebrow={C.eyebrow} title={C.title} intro={C.intro} />
      <div className="mb-8 rounded-2xl bg-navy px-5 py-4 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">{C.strip}</p>
        <p className="mt-1 text-sm text-white/80">{C.stripItems.join(' · ')}</p>
      </div>
      <ul className="grid gap-5 lg:grid-cols-3">
        {C.items.map((c, i) => (
          <li key={c.name} className="card flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 bg-maroon px-5 py-3 text-white">
              <Pin />
              <div>
                <p className="font-display text-lg leading-6">{c.name}</p>
                <p className="text-xs text-white/80">{c.location}</p>
              </div>
            </div>
            <BPhoto p={media.campuses[i]} rounded="rounded-none" className="aspect-[3/2]" sizes="(min-width: 1024px) 33vw, 100vw" />
            <div className="flex flex-1 flex-col p-5">
              <p className="font-semibold text-heading">{c.tagline}</p>
              <ul className="mt-3 flex-1 space-y-2">
                {c.features.map((f) => <li key={f} className="flex gap-2 text-sm leading-6"><Check className="mt-0.5 h-4 w-4" />{f}</li>)}
              </ul>
              <a href={CAMPUSES[i].mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 text-sm font-semibold text-maroon underline dark:text-gold">{t.contact.directions}</a>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8 card p-6">
        <p className="font-display text-xl text-heading">{C.standardTitle}</p>
        <p className="mt-2 text-[15px] leading-7 text-muted">{C.standard}</p>
      </div>
      <PhotoNote t={t} />
    </Block>
  );
}

// ---------------------------------------------------------------- page 8: back cover

export function ClosingBanner({ t, photo }: { t: BrochureText; photo?: Photo }) {
  return (
    <section className="container-x py-14 sm:py-20">
      <div className={`relative grid items-center overflow-hidden rounded-3xl bg-navy p-8 text-center text-white sm:p-12 ${photo ? 'gap-6 lg:grid-cols-[1.6fr_1fr] lg:text-left' : ''}`}>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,74,0.25),transparent_60%)]" />
        {photo && (
          <div className="relative order-2 mx-auto w-full max-w-[320px]">
            <Image src={photo.src} width={photo.w} height={photo.h} alt={photo.alt} sizes="320px" loading="lazy" className="h-auto w-full rounded-2xl" />
          </div>
        )}
        <div className="relative">
          <p className="inline-block rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy-950">{t.contact.bannerOpen}</p>
          <h2 className={`mt-4 max-w-3xl font-display text-3xl sm:text-4xl ${photo ? 'mx-auto lg:mx-0' : 'mx-auto'}`}>{t.contact.bannerTitle}</h2>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-gold-300">{t.contact.discover}</p>
          <div className={`mt-6 flex flex-wrap justify-center gap-3 ${photo ? 'lg:justify-start' : ''}`}>
            <Link href="/visit" className="btn-gold px-6 py-3">{t.contact.visit}</Link>
            <a href={BROCHURE_PDF} className="btn-outline-light px-6 py-3" download>{t.contact.download}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AddressCards({ t }: { t: BrochureText }) {
  return (
    <div>
      <h3 className="font-display text-2xl text-heading">{t.contact.addressesTitle}</h3>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {ADDRESSES.map((a, i) => (
          <li key={a.address} className="card p-5">
            <p className="flex items-center gap-2 font-semibold text-heading"><Pin className="h-4 w-4 text-maroon dark:text-gold" />{t.contact.offices[i]}</p>
            <address className="mt-2 text-sm not-italic leading-6 text-muted">{a.address}</address>
            <a href={a.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-maroon underline dark:text-gold">{t.contact.directions}</a>
          </li>
        ))}
      </ul>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <li><span className="text-muted">{t.contact.call}: </span>{college.phones.map((p, i) => <span key={p.tel}>{i > 0 && ' · '}<a href={`tel:${p.tel}`} className="font-mono font-semibold text-heading underline">{p.display}</a></span>)}</li>
        <li><span className="text-muted">{t.contact.email}: </span><a href={`mailto:${college.email}`} className="font-semibold text-heading underline">{college.email}</a></li>
        <li><span className="text-muted">{t.contact.website}: </span><a href={`https://${WEBSITE}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-heading underline">{WEBSITE}</a></li>
      </ul>
    </div>
  );
}

/** A simple, not-to-scale map with the three brochure pins (no third-party embed needed). Each pin opens Google Maps. */
export function CampusPinsMap({ t }: { t: BrochureText }) {
  // rough relative positions (east Hyderabad): Kuntloor north-east, LB Nagar west, Bairamalguda south
  const pos = [
    { x: 44, y: 70 },
    { x: 20, y: 38 },
    { x: 76, y: 22 },
  ];
  return (
    <div>
      <h3 className="font-display text-2xl text-heading">{t.contact.mapTitle}</h3>
      <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#e8efe3,#dfe7f1)] dark:bg-[linear-gradient(135deg,#1d2a24,#1b2233)]">
        <svg viewBox="0 0 100 56" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
          <path d="M0 30 C20 26 35 34 50 30 S80 22 100 26" stroke="#c9a24a" strokeWidth="0.8" fill="none" opacity="0.6" />
          <path d="M30 0 C32 20 28 36 34 56" stroke="#c9a24a" strokeWidth="0.6" fill="none" opacity="0.5" />
        </svg>
        {t.contact.pins.map((label, i) => (
          <a key={label} href={MAP_PINS[i]} target="_blank" rel="noopener noreferrer" className="group absolute -translate-x-1/2 -translate-y-full text-center" style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}>
            <Pin className="mx-auto h-8 w-8 text-maroon drop-shadow transition group-hover:scale-110 dark:text-gold" />
            <span className="mt-0.5 block whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-heading shadow">{label}</span>
          </a>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{t.contact.mapNote}</p>
    </div>
  );
}

export function BrochureDownload({ t }: { t: BrochureText }) {
  return (
    <div className="card flex flex-col items-center gap-5 p-6 sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/brochure/contact/brochure-qr.png" width={140} height={140} alt={`QR code: download the brochure (${BROCHURE_PDF})`} className="h-[140px] w-[140px] rounded-lg border border-line bg-white p-1" loading="lazy" />
      <div className="text-center sm:text-left">
        <p className="label">{t.contact.scan}</p>
        <p className="text-sm text-muted">{t.contact.downloadNote}</p>
        <a href={BROCHURE_PDF} download className="btn-primary mt-3">{t.contact.download}</a>
      </div>
    </div>
  );
}
