import Link from 'next/link';
import { LeadForm } from '@/components/forms';
import { HeroCarousel } from '@/components/HeroCarousel';
import { Check, Crest, Faq, initials, JsonLd, SampleBadge, Section } from '@/components/ui';
import { college, mapsEmbedUrl } from '@/content/college';
import { programs } from '@/content/programs';
import { getContent } from '@/lib/cms';
import { formatDate, todayIST } from '@/lib/dates';
import { formatINR } from '@/lib/fees';
import { faqJsonLd } from '@/lib/seo';

const why = [
  { title: 'Fees published, no form needed', body: 'The full fee table and a scholarship calculator are open to everyone.', href: '/fees' },
  { title: `Batches of at most ${college.maxBatchSize}`, body: `Small classes, and one mentor for every ${college.mentorRatio} students with a weekly one-to-one.`, href: '/about' },
  { title: 'Track your admission like a parcel', body: 'See every step, who owns it, and when you will hear next.', href: '/track' },
  { title: 'Hostel you can see into', body: 'Biometric check-in with WhatsApp alerts, wardens on every floor, and the mess menu in the app.', href: '/hostel' },
  { title: 'Weekly parent report', body: 'Every Sunday on WhatsApp: attendance, test trend and the mentor’s note.', href: '/about' },
  { title: 'Results you can verify', body: 'Each topper card links to the official scorecard. No unverifiable claims.', href: '/results' },
];

export default async function HomePage() {
  const { bsat, faculty, faqs, fees, gallery, heroSlides, results, testimonials } = await getContent();
  const nextBsat = bsat.sessions.find((s) => s.date >= todayIST());
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,162,74,0.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(125,31,44,0.35),transparent_50%)]" />
        <div aria-hidden className="pointer-events-none absolute -left-24 top-1/2 h-[520px] w-[520px] -translate-y-1/2 opacity-[0.06]">
          <Crest size={520} className="h-full w-full" />
        </div>
        <div className="container-x relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
          <div className="animate-rise">
            <HeroCarousel slides={heroSlides.slides} intervalSec={heroSlides.intervalSec} />
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                ['4', 'programs'],
                [`≤ ${college.maxBatchSize}`, 'students per batch'],
                [college.facultyAvgExperience.replace(' years', ' yrs'), 'avg. faculty experience'],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-mono text-2xl font-semibold text-gold-300 sm:text-3xl">{v}</dd>
                  <dd className="mt-1 text-xs leading-4 text-white/60">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div id="callback" className="card p-5 text-ink sm:p-7">
            <LeadForm source="callback" heading="Get a callback" sub="An admissions counsellor will call you during office hours." showClass />
          </div>
        </div>
      </section>

      {/* Results ticker */}
      <div className="border-b border-line bg-surface">
        <div className="container-x flex items-center gap-4 py-3">
          <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-xs font-bold text-navy-950">Results 2026</span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
            <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
              {[...results.items, ...results.items].map((r, i) => (
                <span key={i} aria-hidden={i >= results.items.length} className="whitespace-nowrap text-sm">
                  <strong className="text-heading">{r.name}</strong> <span className="text-muted">{r.exam}</span>{' '}
                  <span className="font-mono font-semibold text-maroon dark:text-gold">{r.score}</span>
                </span>
              ))}
            </div>
          </div>
          <SampleBadge show={results.sample} className="hidden sm:inline-flex" />
        </div>
      </div>

      {/* Aggregates */}
      <section className="border-b border-line bg-bg">
        <div className="container-x grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
          {results.aggregates.map((a) => (
            <div key={a.label} className="text-center md:text-left">
              <p className="font-display text-4xl text-heading sm:text-5xl">{a.value}</p>
              <p className="mt-1 text-sm text-muted">{a.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Programs */}
      <Section eyebrow="Programs" title="Four focused programs, one campus" intro="Every program includes daily practice papers, weekly tests, a full-length mock series, NCERT-based material and regular progress tracking.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p) => (
            <Link key={p.slug} href={`/programs/${p.slug}`} className="card group flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md">
              <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${p.goal === 'Medical' ? 'bg-maroon/10 text-maroon dark:text-red-200' : 'bg-navy/10 text-navy dark:text-gold-300'}`}>
                {p.goal} · {p.duration}
              </span>
              <h3 className="mt-4 font-display text-2xl text-heading">{p.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{p.targets.join(' · ')}</p>
              <p className="mt-4 text-sm">
                <span className="text-muted">Tuition from </span>
                <span className="font-mono font-semibold text-heading">{formatINR(p.track === 'two-year' ? fees.twoYear.tuition : fees.longTerm.tuition)}</span>
                <span className="text-muted">/yr</span>
              </p>
              <span className="mt-3 text-sm font-semibold text-maroon group-hover:underline dark:text-gold">Explore →</span>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Not sure which one fits? <Link href="/course-finder" className="font-semibold text-maroon underline dark:text-gold">Try the 30-second course finder</Link>.
        </p>
      </Section>

      {/* Toppers */}
      <section className="bg-navy py-14 text-white sm:py-20">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">Hall of fame</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">
                Toppers 2026 <SampleBadge show={results.sample} />
              </h2>
            </div>
            <Link href="/results" className="btn-outline-light">All results</Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {results.items.map((r) => (
              <li key={r.name} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-gold font-display text-xl text-gold-300">{initials(r.name)}</span>
                <p className="mt-3 text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-white/60">{r.exam}</p>
                <p className="mt-1 font-mono font-semibold text-gold-300">{r.score}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why */}
      <Section eyebrow="Why Bhargava" title="What most coaching colleges don’t do, and we do">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {why.map((w) => (
            <Link key={w.title} href={w.href} className="card flex gap-4 p-6 transition hover:border-gold">
              <Check className="mt-0.5" />
              <div>
                <h3 className="font-sans text-base font-semibold text-heading">{w.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{w.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* BSAT banner */}
      <section className="container-x">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-maroon to-[#5a1520] p-8 text-white sm:p-12">
          <div aria-hidden className="absolute -right-10 -top-10 h-56 w-56 rounded-full border-[28px] border-gold/20" />
          <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
                BSAT · Scholarship & admission test <SampleBadge show={bsat.sample} />
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Up to {bsat.cap}% off tuition, based on one 90-minute test</h2>
              <p className="mt-3 max-w-xl text-white/80">
                For Class 10 students. Campus or online. Results within {bsat.resultsWithin}.
                {nextBsat && ` Next test: ${formatDate(nextBsat.date, { weekday: 'long', day: 'numeric', month: 'long' })} (${nextBsat.mode}).`}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/scholarship#register" className="btn-gold px-6 py-3">Register for BSAT</Link>
              <Link href="/fees" className="btn-outline-light px-6 py-3">See your fee</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Faculty + testimonials */}
      <Section eyebrow="Faculty" title="Teachers who have done this for a decade and more" badge={faculty.sample} intro={`Average faculty experience is ${college.facultyAvgExperience}. Leadership: ${college.leader.name}, ${college.leader.credentials}.`}>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {faculty.items.map((f) => (
            <li key={f.name} className="card p-5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-100 font-display text-navy">{initials(f.name)}</span>
              <p className="mt-3 font-semibold text-heading">{f.name}</p>
              <p className="text-sm text-muted">{f.subject}</p>
              <p className="mt-2 font-mono text-sm text-maroon dark:text-gold">{f.years} yrs experience</p>
            </li>
          ))}
        </ul>
        <div className="mt-12">
          <p className="eyebrow">What parents say</p>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {testimonials.items.map((t) => (
              <li key={t.name} className="card p-6">
                <p className="font-display text-4xl leading-none text-gold" aria-hidden>“</p>
                {t.quote ? <p className="text-[15px] leading-7 text-ink/85">{t.quote}</p> : <p className="text-sm italic text-muted">Testimonial text to be added from the CMS.</p>}
                <p className="mt-4 font-semibold text-heading">{t.name}</p>
                <p className="text-sm text-muted">Parent{t.role ? ` · ${t.role}` : ''}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Gallery */}
      <Section eyebrow="Campus gallery" title="Life on one focused campus" badge={gallery.sample}>
        {gallery.items.some((g) => g.imageUrl) ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {gallery.items.filter((g) => g.imageUrl).slice(0, 6).map((g) => (
              <li key={g.imageUrl!} className="overflow-hidden rounded-2xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.imageUrl!} alt={g.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <p className="px-3 py-2 text-sm text-muted">{g.title}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Classrooms', `Batches of at most ${college.maxBatchSize}`],
              ['Laboratories', 'Physics, chemistry and biology labs'],
              ['Library', 'NCERT and reference collection, supervised study'],
              ['Hostel', 'Biometric check-in with parent alerts'],
              ['Transport', 'College buses with GPS updates'],
            ].map(([t, d]) => (
              <li key={t}>
                <Link href="/campus" className="card flex h-full flex-col justify-between bg-gradient-to-br from-navy to-[#2a3a78] p-5 text-white transition hover:-translate-y-0.5">
                  <span className="font-display text-xl">{t}</span>
                  <span className="mt-6 text-xs text-white/75">{d}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/campus" className="btn-outline">See the campus</Link>
          {gallery.tourUrl && <a href={gallery.tourUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">360° tour</a>}
        </div>
      </Section>

      {/* FAQ */}
      <Section eyebrow="FAQs" title="Questions parents ask most" badge={faqs.sample} className="bg-surface">
        <div className="max-w-3xl">
          <Faq items={faqs.items} />
        </div>
        <JsonLd data={faqJsonLd(faqs.items)} />
      </Section>

      {/* Map */}
      <Section eyebrow="Visit the campus" title="Come and see the classrooms, labs and hostel">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <iframe title="Bhargava Junior College on Google Maps" src={mapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full rounded-2xl border border-line sm:h-96" />
          <div className="card flex flex-col justify-between gap-6 p-6">
            <div>
              <p className="font-semibold text-heading">Campus visits Monday to Saturday</p>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {college.hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-4">
                    <span>{h.days}</span>
                    <span className="font-mono">{h.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/visit" className="btn-primary">Book a visit slot</Link>
              <a href={`tel:${college.phones[0].tel}`} className="btn-outline font-mono">{college.phones[0].display}</a>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
